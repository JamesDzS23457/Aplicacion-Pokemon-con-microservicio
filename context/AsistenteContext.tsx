// ---------------------------------------------------------------------------
// CONTEXTO DEL ASISTENTE DE IA  (sexta pestana)
//
// Es el cuarto contexto de la app. A diferencia de Pokemon, One Piece y
// Docentes, aqui el "dato" no es una ficha de la base sino una CONVERSACION:
// una lista de mensajes que crece con cada pregunta y su respuesta.
//
// Regla del proyecto que respeta: la app NUNCA llama a la IA ni a los
// microservicios directamente. Solo habla con el GATEWAY (API_URL), que reenvia
// al asistente-service. La clave de Gemini vive en el servidor, no aqui.
//
// El interruptor de modo demuestra las dos fases del enunciado:
//   - 'abierto':     la IA contesta cualquier pregunta (primera fase).
//   - 'restringido': solo responde de la base de datos de la app (segunda fase).
//
// El historial que se manda son los ultimos turnos (sin la bienvenida), para que
// el asistente entienda seguimientos ("y su tripulacion?") sin repetir todo.
// ---------------------------------------------------------------------------

import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { API_URL, log, esArranqueFrio, MENSAJE_ARRANQUE_FRIO } from '../lib/api';

/** De quien es un mensaje del chat. */
export type RolMensaje = 'usuario' | 'asistente';

/** Un mensaje de la conversacion. */
export type Mensaje = {
  id: string;
  rol: RolMensaje;
  texto: string;
  /** Momento en que se agrego (ms). Se muestra la hora en la burbuja. */
  hora: number;
  /**
   * true cuando el asistente respondio que la pregunta no era de su contexto.
   * La burbuja se pinta distinta para que se vea que NO es un error.
   */
  fueraDeContexto?: boolean;
};

/** Los dos modos del interruptor. */
export type ModoAsistente = 'restringido' | 'abierto';

type AsistenteContextValue = {
  mensajes: Mensaje[];
  /** true mientras el asistente piensa (se muestra "escribiendo..."). */
  cargando: boolean;
  /** Modo actual: restringido (solo la base de la app) o abierto. */
  modo: ModoAsistente;
  /** Aviso para el Notice (vacio si no hay nada que avisar). */
  mensaje: string;
  tono: 'error' | 'info';
  /** Envia una pregunta al asistente. */
  preguntar: (texto: string) => Promise<void>;
  /** Borra la conversacion y vuelve a dejar el saludo inicial. */
  limpiar: () => Promise<void>;
  /** Cambia entre modo restringido y abierto. */
  cambiarModo: (modo: ModoAsistente) => void;
};

/** Texto del saludo inicial. Explica de que se puede preguntar. */
const SALUDO =
  '¡Hola! Soy el asistente de la app. Puedo responder preguntas sobre los Pokémon, ' +
  'los personajes de One Piece y los docentes que aparecen en la aplicación. ' +
  'Si preguntas algo fuera de eso, te avisaré. ¿Qué quieres saber?';

const AsistenteContext = createContext<AsistenteContextValue | undefined>(undefined);

/** Tope de mensajes que se recuerdan para dar contexto (los ultimos). */
const HISTORIAL_MAXIMO = 8;

export function AsistenteProvider({ children }: PropsWithChildren) {
  const contador = useRef(0);
  const nuevoId = () => `m${Date.now()}-${contador.current++}`;

  // El saludo va como primer mensaje del asistente, con un id estable.
  const [mensajes, setMensajes] = useState<Mensaje[]>([
    { id: 'bienvenida', rol: 'asistente', texto: SALUDO, hora: Date.now() },
  ]);
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<ModoAsistente>('restringido');
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');

  // Refs para leer el valor ACTUAL dentro de callbacks sin recrearlos (mismo
  // criterio que en DocentesContext: si fueran dependencias, habria peticiones
  // de mas o closures viejos).
  const cargandoRef = useRef(cargando);
  cargandoRef.current = cargando;
  const mensajesRef = useRef(mensajes);
  mensajesRef.current = mensajes;
  const modoRef = useRef(modo);
  modoRef.current = modo;

  /** Envia una pregunta y agrega las dos burbujas (usuario y asistente). */
  const preguntar = useCallback(async (texto: string) => {
    const pregunta = texto.trim();
    // Una peticion a la vez: evita respuestas cruzadas si se pulsa varias veces.
    if (!pregunta || cargandoRef.current) return;

    // Historial = turnos anteriores SIN el saludo (que es fijo y no aporta).
    const historial = mensajesRef.current
      .filter((m) => m.id !== 'bienvenida')
      .slice(-HISTORIAL_MAXIMO)
      .map((m) => ({ rol: m.rol, texto: m.texto }));

    setMensajes((prev) => [
      ...prev,
      { id: nuevoId(), rol: 'usuario', texto: pregunta, hora: Date.now() },
    ]);
    setCargando(true);
    setMensaje('');
    setTono('error');

    const inicio = Date.now();
    let estado = 0;
    try {
      log(`POST /api/asistente (modo=${modoRef.current}) -> ${API_URL}`);
      const response = await fetch(`${API_URL}/api/asistente`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        body: JSON.stringify({ pregunta, modo: modoRef.current, historial }),
      });
      estado = response.status;
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || 'El asistente no pudo responder.');
      }
      log(`  ${estado} en ${Date.now() - inicio}ms (motor=${payload?.motor})`);
      setMensajes((prev) => [
        ...prev,
        {
          id: nuevoId(),
          rol: 'asistente',
          texto: String(payload?.respuesta ?? '').trim() || 'No tengo una respuesta para eso.',
          hora: Date.now(),
          fueraDeContexto: payload?.enAlcance === false,
        },
      ]);
    } catch (error) {
      const mensajeError =
        error instanceof Error ? error.message : 'No se pudo consultar al asistente.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
      } else {
        setTono('error');
        setMensaje(mensajeError);
      }
    } finally {
      setCargando(false);
    }
  }, []);

  /** Vuelve al estado inicial: solo el saludo. */
  const limpiar = useCallback(async () => {
    setMensajes([{ id: 'bienvenida', rol: 'asistente', texto: SALUDO, hora: Date.now() }]);
    setMensaje('');
    setTono('error');
  }, []);

  const cambiarModo = useCallback((nuevo: ModoAsistente) => {
    setModo(nuevo === 'abierto' ? 'abierto' : 'restringido');
  }, []);

  return (
    <AsistenteContext.Provider
      value={{ mensajes, cargando, modo, mensaje, tono, preguntar, limpiar, cambiarModo }}
    >
      {children}
    </AsistenteContext.Provider>
  );
}

/** Hook de acceso al contexto del asistente. */
export function useAsistente() {
  const ctx = useContext(AsistenteContext);
  if (!ctx) {
    throw new Error('useAsistente debe usarse dentro de <AsistenteProvider>.');
  }
  return ctx;
}
