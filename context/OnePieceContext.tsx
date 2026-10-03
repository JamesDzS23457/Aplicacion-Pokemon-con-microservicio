import { createContext, PropsWithChildren, useContext, useState } from 'react';
import { API_URL, log, esArranqueFrio, MENSAJE_ARRANQUE_FRIO } from '../lib/api';

export type OnePieceCharacter = {
  id: number;
  name: string;
  size?: string;
  age?: string;
  bounty?: string;
  job?: string;
  status?: string;
  crew?: { name?: string; is_yonko?: boolean };
  fruit?: { name?: string; type?: string; description?: string };
  image?: string | null;
  race?: string;
  raceEstimated?: boolean;
};

type OnePieceContextValue = {
  character: OnePieceCharacter | null;
  cargando: boolean;
  mensaje: string;
  /** 'info' para el aviso de arranque en frio; 'error' para fallos reales. */
  tono: 'error' | 'info';
  /** El personaje de la ultima busqueda correcta, para poder refrescarlo. */
  ultimaBusqueda: string;
  buscarPersonaje: (nombre: string) => Promise<void>;
  /** Vuelve a consultar la ultima busqueda (boton Actualizar / pull-to-refresh). */
  refrescar: () => Promise<void>;
};

const OnePieceContext = createContext<OnePieceContextValue | undefined>(undefined);

export function OnePieceProvider({ children }: PropsWithChildren) {
  const [character, setCharacter] = useState<OnePieceCharacter | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');
  // Se recuerda QUE se busco por ultima vez, igual que en PokemonContext. Sin
  // esto, un cambio hecho en la base de datos no se veia hasta que el usuario
  // volvia a escribir el nombre a mano.
  const [ultimaBusqueda, setUltimaBusqueda] = useState('');

  const buscarPersonaje = async (nombre: string) => {
    if (!nombre.trim()) {
      setCharacter(null);
      setUltimaBusqueda('');
      setTono('error');
      setMensaje('Escribe el nombre de un personaje.');
      return;
    }
    // Se guarda ANTES de la peticion para que "Actualizar" siga funcionando
    // aunque esta falle (por ejemplo con el servicio dormido).
    setUltimaBusqueda(nombre.trim());
    setCargando(true);
    setMensaje('');
    setTono('error');
    // Mismo patron que PokemonContext: medir y registrar cada busqueda. El
    // nombre se envia tal cual (sin lower) porque el microservicio es quien
    // normaliza; aqui se registra para ver exactamente que viajo por la red.
    const inicio = Date.now();
    log(`POST /api/characters/search name="${nombre.trim()}" -> ${API_URL}`);
    // 0 = ni siquiera hubo respuesta HTTP (fallo de red o servicio dormido).
    let estado = 0;
    try {
      const response = await fetch(`${API_URL}/api/characters/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // La respuesta tiene que reflejar el estado ACTUAL de la base.
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        body: JSON.stringify({ name: nombre.trim() }),
      });
      estado = response.status;
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        if (response.status === 400) throw new Error(detail?.error || 'Escribe el nombre de un personaje.');
        if (response.status === 404) throw new Error(detail?.error || 'Personaje no encontrado en la base de datos local');
        throw new Error(detail?.error || 'No se pudo consultar el servicio');
      }
      const payload = await response.json();
      const encontrado = payload.data?.[0] ?? null;
      setCharacter(encontrado);
      log(`  ${estado} en ${Date.now() - inicio}ms: ${encontrado ? `encontrado "${encontrado.name}"` : 'sin resultados'}`);
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar One Piece.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      // Igual que en Pokemon: si ya habia una ficha se conserva. Un refresco
      // fallido (arranque en frio) no debe vaciar la pantalla.
      setCharacter((actual) => (actual ?? null));
      // El arranque en frio se muestra como aviso, no como error rojo, porque
      // reintentar soluciona.
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
      } else {
        setTono('error');
        // Igual que en Pokemon: se evita el "Failed to fetch" en ingles cuando
        // el navegador no recibio siquiera un codigo HTTP.
        setMensaje(estado === 0 ? 'No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.' : mensajeError);
      }
    } finally {
      setCargando(false);
    }
  };

  /**
   * Vuelve a consultar la ultima busqueda.
   *
   * Es lo que hace visible un cambio hecho en MongoDB sin obligar al usuario a
   * reescribir el nombre. Reutiliza `buscarPersonaje` para que el refresco
   * aplique los mismos criterios y errores.
   */
  const refrescar = async () => {
    if (!ultimaBusqueda || cargando) return;
    log(`refrescando "${ultimaBusqueda}"`);
    await buscarPersonaje(ultimaBusqueda);
  };

  return (
    <OnePieceContext.Provider
      value={{ character, cargando, mensaje, tono, ultimaBusqueda, buscarPersonaje, refrescar }}
    >
      {children}
    </OnePieceContext.Provider>
  );
}

export function useOnePiece() {
  const context = useContext(OnePieceContext);
  if (!context) throw new Error('useOnePiece debe usarse dentro de OnePieceProvider');
  return context;
}
