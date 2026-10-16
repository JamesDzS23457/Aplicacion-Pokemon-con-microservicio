// ---------------------------------------------------------------------------
// CONTEXTO DE DOCENTES (con respaldo offline SQLite)
//
// Es el tercer contexto de la app y el unico que trabaja con una LISTA en vez
// de con un unico resultado: Pokemon y One Piece muestran una ficha cada uno,
// Docentes muestra las veinte tarjetas de la quinta pestana.
//
// Sigue el mismo patron que PokemonContext y OnePieceContext (por eso los tres
// se leen igual), con dos diferencias que son las del enunciado:
//
//   1. LECTURA CON GET Y ESCRITURA CON POST/PUT/DELETE. Los filtros van como
//      QUERY PARAMS (`?q=ana&carrera=...`), la ficha se pide con un PATH PARAM
//      (`/api/docentes/7`) y crear/actualizar mandan un JSON en el cuerpo.
//      Borrar solo necesita el path param.
//
//   2. Un unico estado para la lista, no un resultado suelto. La pestana necesita
//      el total, el numero de resultados de la pagina y los filtros aplicados,
//      asi que se guarda la respuesta completa tal cual llega del gateway.
//
// MODO OFFLINE (Actividad en Clase 13):
//   - Con red: todo va al gateway y el resultado se guarda como espejo en
//     SQLite local (db/docentesLocal.ts).
//   - Sin red (fetch sin respuesta HTTP, estado 0): lectura y escritura van
//     contra SQLite. Las escrituras se encolan en la tabla `cola` (outbox).
//   - Al volver la red: `sincronizar()` sube la cola en orden FIFO y luego
//     recarga desde la nube.
//   - MONITOR (Tarea 10): cada `intervaloMs` (2s/10s/30s/Off, parametrizable en
//     la pestana) `revisarNube()` pregunta si la nube cambio. Sin pendientes
//     descarga en silencio; con pendientes sincroniza primero para no pisar lo
//     local. Los ids no vistos llevan insignia "nuevo" (tabla `conocidos`) que
//     se limpia al consultar la ficha. Choque por nombre duplicado al subir:
//     se FUSIONA (PUT con lo local, gana lo local) en un solo registro.
//
// Regla del proyecto que este archivo respeta: la app NUNCA llama a un
// microservicio ni a la base de datos en la nube. Solo al gateway (API_URL),
// igual que las otras dos pestanas. SQLite es una BD del DISPOSITIVO, no de
// la nube, asi que no rompe esa regla.
//
// DISTINCION CRITICA: un 503 NO es "sin conexion". 503 = arranque en frio de
// Render (hay red, el servicio despierta). Solo estado 0 (sin respuesta HTTP)
// activa el modo offline.
// ---------------------------------------------------------------------------

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { API_URL, log, esArranqueFrio, MENSAJE_ARRANQUE_FRIO } from '../lib/api';
import { useConexion, initConexion } from '../lib/conexion';
import * as localDb from '../db/docentesLocal';

/**
 * Un docente tal cual lo devuelve el microservicio.
 *
 * Se tipa con los campos tal cual llegan, en camelCase y con los mismos nombres
 * que el SQL. No se "traduce" a otro formato en el frontend: si el contrato
 * cambia, cambia aqui y en un solo sitio mas (los types de TypeScript detectan
 * el resto).
 */
export type Docente = {
  id: number;
  nombre: string;
  cargo?: string;
  departamento?: string;
  carrera?: string;
  facultad?: string;
  email?: string;
  /** URL de la foto. Opcional: si viene null la app dibuja un avatar con iniciales. */
  foto_url?: string | null;
  /** Descripcion BREVE. Es la que va en la tarjeta de la quinta pestana. */
  resumen?: string;
  /** Descripcion COMPLETA. Es la que va en la pagina de la ficha. */
  biografia?: string;
  areas?: string[];
  formacion?: string[];
};

/** Filtros de la fila de botones de la pestana. Todos opcionales. */
export type FiltrosDocentes = {
  q: string;
  carrera: string;
  departamento: string;
};

/** Respuesta del listado. `total` es el total SIN paginar. */
export type ListadoDocentes = {
  total: number;
  pagina: number;
  limite: number;
  filtros: { q: string | null; carrera: string | null; departamento: string | null };
  count: number;
  data: Docente[];
};

/** Valores disponibles para los filtros, de /api/docentes/facetas. */
export type Facetas = {
  facultad: string[];
  carrera: string[];
  departamento: string[];
};

/**
 * Datos para crear o actualizar un docente.
 *
 * Son los campos escribibles y todos opcionales en el tipo porque al
 * actualizar solo se mandan los que cambiaron; al crear, la pantalla exige el
 * `nombre` antes de llamar. El `id` nunca se manda: lo asigna el servicio.
 */
export type DocenteInput = {
  nombre?: string;
  cargo?: string;
  departamento?: string;
  carrera?: string;
  facultad?: string;
  email?: string;
  foto_url?: string;
  resumen?: string;
  biografia?: string;
  areas?: string[];
  formacion?: string[];
};

type DocentesContextValue = {
  /** Los docentes de la respuesta actual (ya filtrados). */
  docentes: Docente[];
  /** Cuantos hay en total, sin paginar. Permite el "Mostrando 6 de 20". */
  total: number;
  /** Los filtros que esta aplicados ahora mismo. */
  filtros: FiltrosDocentes;
  /** Valores posibles de carrera y departamento, para los botones de filtro. */
  facetas: Facetas;
  cargando: boolean;
  mensaje: string;
  /** 'info' para avisos (arranque en frio, modo offline); 'error' para fallos. */
  tono: 'error' | 'info';
  /** Si true, ya se hizo al menos una peticion y la lista esta vacia de verdad. */
  vacio: boolean;
  /** true = hay red (o aun no se sabe); false = modo offline. */
  enLinea: boolean;
  /** Operaciones pendientes de sincronizar (cola outbox). */
  pendientes: number;
  /** true mientras se esta sincronizando la cola. */
  sincronizando: boolean;
  /** Ids de la nube que el usuario aun no consulta (llevan insignia "nuevo"). */
  nuevosIds: number[];
  /** Momento de la ultima revision automatica de la nube (null si aun no hubo). */
  ultimaRevision: number | null;
  /** Cada cuanto se revisa la nube (ms). 0 = revision automatica apagada. */
  intervaloMs: number;
  /** Cambia el intervalo de revision y lo guarda en el dispositivo. */
  fijarIntervalo: (ms: number) => Promise<void>;
  /** Aplica filtros (query params) y vuelve a pedir el listado. */
  filtrar: (filtros: Partial<FiltrosDocentes>) => Promise<void>;
  /** Vuelve a pedir el listado con los filtros actuales. */
  refrescar: () => Promise<void>;
  /** Pide UNA ficha por path param. Se usa en la pagina de detalle. */
  obtenerDocente: (id: number) => Promise<Docente | null>;
  /** Crea un docente (POST con red, SQLite + cola sin red). */
  crearDocente: (datos: DocenteInput) => Promise<Docente | null>;
  /** Actualiza un docente (PUT con red, SQLite + cola sin red). */
  actualizarDocente: (id: number, datos: DocenteInput) => Promise<Docente | null>;
  /** Borra un docente (DELETE con red, SQLite + cola sin red). */
  eliminarDocente: (id: number) => Promise<boolean>;
  /** Recarga tambien las facetas. Se llama al arrancar la app. */
  cargarFacetas: () => Promise<void>;
  /** Sube la cola pendiente y recarga desde la nube. */
  sincronizar: () => Promise<void>;
};

/** Filtros vacios. Se usan como punto de partida y como referencia de igualdad. */
const FILTROS_VACIOS: FiltrosDocentes = { q: '', carrera: '', departamento: '' };

/** Facetas vacias, para no tener `null` en el estado inicial. */
const FACETAS_VACIAS: Facetas = { facultad: [], carrera: [], departamento: [] };

/** Aviso que se muestra cuando se esta trabajando contra la copia local. */
const MENSAJE_OFFLINE =
  'Sin conexion: mostrando datos guardados en el dispositivo. ' +
  'Puedes consultar, crear, editar y borrar; se sincronizaran al volver la red.';

const DocentesContext = createContext<DocentesContextValue | undefined>(undefined);

/**
 * Construye la query string del listado.
 *
 * Se separa en una funcion propia porque la usan dos sitios (la carga inicial y
 * el refresco) y duplicar el armado de la URL fue justo lo que Provoco el bug
 * de los Pokemon de antes: dos pantallas construyendo la misma llamada de
 * forma distinta.
 *
 * Se usa `URLSearchParams` (estandar, viene con el navegador y con React Native)
 * en vez de concatenar con `&` a mano: es el que se encarga de codificar los
 * valores, y sin eso un termino con acentos, con espacios o con un `&` dentro
 * romperia la URL. El microservicio normaliza despues, pero solo puede hacerlo
 * si el parametro llega entero.
 */
function queryDeListado(filtros: FiltrosDocentes): string {
  const params = new URLSearchParams();
  if (filtros.q.trim()) params.set('q', filtros.q.trim());
  if (filtros.carrera) params.set('carrera', filtros.carrera);
  if (filtros.departamento) params.set('departamento', filtros.departamento);
  const cadena = params.toString();
  return cadena ? `?${cadena}` : '';
}

/** Convierte una fila local (SQLite) al tipo Docente que usa la UI. */
function localADocente(fila: localDb.DocenteLocal): Docente {
  return {
    id: fila.id,
    nombre: fila.nombre,
    cargo: fila.cargo ?? undefined,
    departamento: fila.departamento ?? undefined,
    carrera: fila.carrera ?? undefined,
    facultad: fila.facultad ?? undefined,
    email: fila.email ?? undefined,
    foto_url: fila.foto_url ?? null,
    resumen: fila.resumen ?? undefined,
    biografia: fila.biografia ?? undefined,
    areas: fila.areas,
    formacion: fila.formacion,
  };
}

export function DocentesProvider({ children }: PropsWithChildren) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosDocentes>(FILTROS_VACIOS);
  const [facetas, setFacetas] = useState<Facetas>(FACETAS_VACIAS);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');
  const [cargadoUnaVez, setCargadoUnaVez] = useState(false);
  const [pendientes, setPendientes] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);
  const [nuevosIds, setNuevosIds] = useState<number[]>([]);
  const [ultimaRevision, setUltimaRevision] = useState<number | null>(null);
  // 10s por defecto: 2s es agresivo para la bateria y 30s tarda en la demo.
  const [intervaloMs, setIntervaloMs] = useState(10_000);

  const conexion = useConexion();
  // null (aun sin medir) se trata como en linea para conservar el
  // comportamiento actual hasta que NetInfo responda.
  const enLinea = conexion !== false;

  // Guarda la ultima lectura de `enLinea` para detectar la vuelta de la red.
  const enLineaRef = useRef(enLinea);
  enLineaRef.current = enLinea;
  // Refs para el poll automatico y el blindaje (se leen en callbacks sin
  // recrearlos: si fueran dependencias habria temporizadores duplicados).
  const sincronizandoRef = useRef(sincronizando);
  sincronizandoRef.current = sincronizando;
  const cargandoRef = useRef(cargando);
  cargandoRef.current = cargando;

  // Inicializa el detector de red y carga el intervalo guardado (una sola vez).
  useEffect(() => {
    initConexion();
    localDb.leerAjuste('poll_ms', '10000')
      .then(v => {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0) setIntervaloMs(n);
      })
      .catch(() => { /* sin SQLite: queda el valor por defecto */ });
  }, []);

  /** Cambia el intervalo de revision automatica y lo persiste. */
  const fijarIntervalo = useCallback(async (ms: number) => {
    setIntervaloMs(ms);
    try {
      await localDb.guardarAjuste('poll_ms', String(ms));
    } catch {
      // sin SQLite no se persiste, pero igual aplica en memoria
    }
  }, []);

  /** Relee el numero de operaciones pendientes (ignora fallos de SQLite). */
  const actualizarPendientes = useCallback(async () => {
    try {
      setPendientes(await localDb.contarPendientes());
    } catch (error) {
      log(`  no se pudo contar la cola local: ${error instanceof Error ? error.message : error}`);
    }
  }, []);

  /**
   * Lee el listado desde SQLite (modo offline o respaldo).
   * Devuelve true si habia datos locales que mostrar.
   */
  const leerLocal = useCallback(async () => {
    const LIMITE = 50;
    const datos = await localDb.listarLocales(
      filtros.q.trim(), filtros.carrera, filtros.departamento, LIMITE, 0,
    );
    const totalLocal = await localDb.contarLocalesFiltrados(
      filtros.q.trim(), filtros.carrera, filtros.departamento,
    );
    setDocentes(datos.map(localADocente));
    setTotal(totalLocal);
    return datos.length > 0 || totalLocal > 0;
  }, [filtros]);

  /**
   * Fusiona lo pendiente local sobre lo que trajo la nube, para pintar.
   *
   * Si hay operaciones sin subir, la nube trae la version vieja: se reemplaza
   * con la fila local (actualizar), se quita si esta marcada para borrar y se
   * agregan los creados locales (ids negativos). Asi lo pendiente nunca se
   * esconde aunque la nube aun no lo tenga.
   */
  const fusionarPendientes = useCallback(
    async (nube: Docente[], totalNube: number): Promise<{ lista: Docente[]; total: number }> => {
      let pendientesFilas: localDb.DocenteLocal[];
      try {
        pendientesFilas = await localDb.obtenerFilasPendientes();
      } catch {
        return { lista: nube, total: totalNube };
      }
      if (pendientesFilas.length === 0) return { lista: nube, total: totalNube };
      const borrados = new Set(
        pendientesFilas.filter(p => p.accion === 'borrar').map(p => p.id),
      );
      const porId = new Map(pendientesFilas.map(p => [p.id, p]));
      const lista = nube
        .filter(d => !borrados.has(d.id))
        .map(d => {
          const p = porId.get(d.id);
          return p && p.accion === 'actualizar' ? localADocente(p) : d;
        });
      let extra = 0;
      for (const p of pendientesFilas) {
        if (!lista.some(d => d.id === p.id)) {
          lista.push(localADocente(p));
          extra += 1;
        }
      }
      // Orden alfabetico como la nube; los negativos (nuevos locales) quedan
      // mezclados por nombre igual que el resto.
      lista.sort((a, b) => a.nombre.localeCompare(b.nombre));
      return { lista, total: totalNube + extra };
    },
    [],
  );

  /**
   * Pide el listado al gateway.
   *
   * No recibe los filtros: usa los del estado. Eso obliga a que `filtrar` sea el
   * unico camino para cambiar lo que se muestra, y evita el clásico "cambie el
   * filtro en pantalla pero la peticion iba con el anterior" (un `useEffect`
   * que dispara con dependencias equivocadas y se queda una peticion atrasada).
   *
   * Con red: fetch + espejo SQLite. Sin red (estado 0): lectura local.
   *
   * BLINDAJE: si hay operaciones pendientes y hay red, NO descarga directo
   * (borraria del espejo lo que aun no subio): delega en sincronizar(), que
   * sube primero y recarga despues. Solo se salta cuando ya se esta
   * sincronizando, para no entrar en recursion.
   *
   * Modo silencioso (poll automatico): no muestra spinner, no limpia el
   * mensaje y no avisa fallos; solo registra en el log.
   */
  const refrescar = useCallback(async (opts?: { silencioso?: boolean }) => {
    const silencioso = opts?.silencioso === true;
    if (!silencioso) {
      setCargando(true);
      setMensaje('');
      setTono('error');
    }
    const query = queryDeListado(filtros);
    const inicio = Date.now();
    log(`GET /api/docentes${query} -> ${API_URL}`);
    // 0 = ni siquiera hubo respuesta HTTP (sin red, o servicio dormido).
    let estado = 0;
    try {
      // BLINDAJE: con pendientes y red, primero se sube y despues se descarga.
      // Descargar directo (reemplazarEspejo) pisaria del espejo lo que aun no
      // subio. Se delega en sincronizar(), salvo que ya se este sincronizando
      // (su recarga final) para no entrar en recursion.
      if (!silencioso && enLineaRef.current && !sincronizandoRef.current) {
        try {
          if ((await localDb.contarPendientes()) > 0) {
            log('  hay pendientes: refrescar delega en sincronizar');
            await sincronizarRef.current();
            return;
          }
        } catch {
          // Sin SQLite no hay cola que proteger: se sigue normal.
        }
      }
      const response = await fetch(`${API_URL}/api/docentes${query}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        // Sin cache del navegador: el listado tiene que reflejar el estado
        // ACTUAL de la base, no la respuesta anterior.
        cache: 'no-store',
      });
      estado = response.status;
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        throw new Error(detail?.error || 'No se pudo consultar el servicio de docentes');
      }
      const payload: ListadoDocentes = await response.json();
      // Se protege con `?? []`: si el gateway devuelve algo raro, `docentes`
      // queda como lista vacia y la pantalla muestra el estado vacio en vez de
      // romperse al hacer `.map`.
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const totalNube = typeof payload?.total === 'number' ? payload.total : 0;
      log(`  ${estado} en ${Date.now() - inicio}ms: ${payload?.count ?? 0} de ${totalNube}`);
      // Espejo local: la proxima vez sin red se lee de aqui. Si SQLite falla
      // (p. ej. web sin COOP/COEP), la nube sigue mandando: no se lanza.
      // El espejo preserva las filas pendientes (ver reemplazarEspejo).
      try {
        await localDb.reemplazarEspejo(data);
      } catch (error) {
        log(`  espejo local no disponible: ${error instanceof Error ? error.message : error}`);
      }
      // Lo pendiente se pinta sobre lo de la nube para no esconderlo.
      const { lista, total } = await fusionarPendientes(data, totalNube);
      setDocentes(lista);
      setTotal(total);
      await actualizarPendientes();
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el servicio.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      if (silencioso) {
        // El poll automatico no ensucia la pantalla: solo registra.
        return;
      }
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
      } else if (estado === 0) {
        // SIN RED: respaldo SQLite. Un 503 nunca entra aqui (es arranque en
        // frio, hay red). Solo la ausencia total de respuesta HTTP.
        try {
          const hayDatos = await leerLocal();
          await actualizarPendientes();
          setTono('info');
          setMensaje(hayDatos ? MENSAJE_OFFLINE : `${MENSAJE_OFFLINE} Aun no hay datos guardados.`);
        } catch (errorLocal) {
          // NO se borra la lista: si ya habia docentes en pantalla y un
          // refresco falla, quitarlos deja la pestana vacia y da la impresion
          // de que se perdio el dato.
          setTono('error');
          setMensaje('No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.');
          log(`  SQLite local tampoco disponible: ${errorLocal instanceof Error ? errorLocal.message : errorLocal}`);
        }
      } else {
        // NO se borra la lista: si ya habia docentes en pantalla y un refresco
        // falla, quitarlos deja la pestana vacia y da la impresion de que se perdio
        // el dato. Es mejor mantener lo que se tenia y avisar con el Notice, que
        // ya explica el motivo.
        setTono('error');
        setMensaje(mensajeError);
      }
    } finally {
      if (!silencioso) setCargando(false);
      // Se marca incluso si fallo. Es lo que distingue "no hay docentes" de
      // "todavia no se ha preguntado": sin esto, la primera vez que la base no
      // responde la pantalla diria que el listado esta vacio.
      setCargadoUnaVez(true);
    }
  }, [filtros, leerLocal, actualizarPendientes, fusionarPendientes]);

  /** Aplica filtros nuevos y vuelve a pedir el listado. */
  const filtrar = useCallback(async (nuevos: Partial<FiltrosDocentes>) => {
    // Se limpian los que vienen vacios. Sin esto, quitar el filtro de carrera
    // dejaria el valor anterior en el estado y la siguiente peticion seguiria
    // filtrando por el.
    const siguiente: FiltrosDocentes = {
      q: nuevos.q ?? filtros.q,
      carrera: nuevos.carrera ?? '',
      departamento: nuevos.departamento ?? '',
    };
    // Si no cambia nada, no se dispara una peticion identica: en el boton "Todos"
    // eso seria un viaje a la base por cada toque.
    const igual =
      siguiente.q.trim() === filtros.q.trim() &&
      siguiente.carrera === filtros.carrera &&
      siguiente.departamento === filtros.departamento;
    if (igual) return;
    setFiltros(siguiente);
  }, [filtros]);

  /** Pide una ficha por id. El id viaja como PATH PARAM. Sin red, lee SQLite. */
  const obtenerDocente = useCallback(async (id: number): Promise<Docente | null> => {
    log(`GET /api/docentes/${id} -> ${API_URL}`);
    let estado = 0;
    try {
      const response = await fetch(`${API_URL}/api/docentes/${encodeURIComponent(String(id))}`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      estado = response.status;
      if (!response.ok) {
        const detail = await response.json().catch(() => null);
        // Un 404 aqui NO es un fallo: el docente no existe, y la pagina lo
        // dibuja con su propio mensaje. Se devuelve null y no se lanza.
        if (response.status === 404) return null;
        throw new Error(detail?.error || 'No se pudo consultar el servicio de docentes');
      }
      const ficha = (await response.json()) as Docente;
      // Visto: si venia con insignia "nuevo", se limpia al consultar.
      try {
        await localDb.marcarConocido(id);
      } catch { /* insignia prescindible */ }
      setNuevosIds(prev => prev.filter(n => n !== id));
      return ficha;
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el servicio.';
      log(`  ${estado || 'sin respuesta'}: ${mensajeError}`);
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
        return null;
      }
      if (estado === 0) {
        // Respaldo local: un id negativo solo existe en el dispositivo.
        try {
          const fila = await localDb.obtenerLocal(id);
          if (fila) {
            setTono('info');
            setMensaje(MENSAJE_OFFLINE);
            setNuevosIds(prev => prev.filter(n => n !== id));
            return localADocente(fila);
          }
          return null;
        } catch {
          // cae al error generico de abajo
        }
        setTono('error');
        setMensaje('No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.');
        return null;
      }
      setTono('error');
      setMensaje(mensajeError);
      return null;
    }
  }, []);

  /**
   * Traduce el fallo de una escritura (POST/PUT/DELETE) a mensaje en pantalla.
   *
   * A diferencia del listado, aqui el fallo SI importa: el usuario acaba de
   * pulsar "Guardar" y necesita saber si se guardo. Los 400/404/409 del
   * servicio traen el motivo en `error` y se muestran tal cual; el arranque en
   * frio se avisa como tal para que reintente en vez de corregir el formulario.
   *
   * @returns El mensaje del servicio, o null si fue arranque en frio (ya se
   *   puso el aviso generico en ese caso).
   */
  const avisarFallo = (estado: number, detalle: unknown, accion: string): string | null => {
    const mensajeError =
      detalle && typeof detalle === 'object' && 'error' in detalle && typeof detalle.error === 'string'
        ? detalle.error
        : `No se pudo ${accion}.`;
    log(`  ${estado || 'sin respuesta'}: ${mensajeError}`);
    if (esArranqueFrio(estado, mensajeError)) {
      setTono('info');
      setMensaje(MENSAJE_ARRANQUE_FRIO);
      return null;
    }
    setTono('error');
    setMensaje(
      estado === 0
        ? 'No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.'
        : mensajeError,
    );
    return mensajeError;
  };

  /** Recarga el listado desde SQLite tras una escritura offline. */
  const recargarDesdeLocal = useCallback(async () => {
    await leerLocal();
    await actualizarPendientes();
    try {
      const todas = await localDb.listarLocales('', '', '', 50, 0);
      const dedup = (xs: (string | null | undefined)[]) =>
        [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ''))].sort();
      setFacetas({
        facultad: dedup(todas.map(t => t.facultad)),
        carrera: dedup(todas.map(t => t.carrera)),
        departamento: dedup(todas.map(t => t.departamento)),
      });
    } catch {
      // las facetas son prescindibles
    }
  }, [leerLocal, actualizarPendientes]);

  /**
   * Crea un docente. Con red hace POST; sin red (estado 0) guarda en SQLite
   * con id temporal negativo y encola la operacion.
   */
  const crearDocente = useCallback(
    async (datos: DocenteInput): Promise<Docente | null> => {
      log(`POST /api/docentes -> ${API_URL}`);
      setCargando(true);
      setMensaje('');
      setTono('error');
      let estado = 0;
      try {
        const response = await fetch(`${API_URL}/api/docentes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          cache: 'no-store',
          body: JSON.stringify(datos),
        });
        estado = response.status;
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          avisarFallo(estado, payload, 'guardar el docente');
          return null;
        }
        await refrescar();
        await cargarFacetas();
        try {
          if (payload && typeof (payload as Docente).id === 'number') {
            await localDb.marcarConocido((payload as Docente).id);
          }
        } catch { /* insignia prescindible */ }
        return payload as Docente;
      } catch (error) {
        const mensajeError = error instanceof Error ? error.message : 'No se pudo guardar el docente.';
        // Solo el estado 0 va a SQLite. Un 503 (arranque en frio) no: hay red
        // y el dato no se ha guardado en ningun sitio.
        if (estado === 0) {
          try {
            // Deteccion temprana de duplicados: `nombre` es UNIQUE en la nube
            // y un duplicado seria 409 en el sync (se descartaria y el dato se
            // perderia). Mejor avisar aqui, con la fila original a la vista.
            if (datos.nombre && (await localDb.existeNombreLocal(datos.nombre))) {
              setTono('error');
              setMensaje('Ya existe un docente con ese nombre en este dispositivo.');
              return null;
            }
            const idLocal = await localDb.crearLocal({
              nombre: datos.nombre ?? '',
              cargo: datos.cargo,
              departamento: datos.departamento,
              carrera: datos.carrera,
              facultad: datos.facultad,
              email: datos.email,
              foto_url: datos.foto_url,
              resumen: datos.resumen,
              biografia: datos.biografia,
              areas: datos.areas ?? [],
              formacion: datos.formacion ?? [],
            });
            log(`  guardado LOCAL con id ${idLocal} (pendiente de sincronizar)`);
            await recargarDesdeLocal();
            setTono('info');
            setMensaje('Guardado en el dispositivo sin conexion. Se sincronizara al volver la red.');
            const fila = await localDb.obtenerLocal(idLocal);
            // El que lo crea ya lo vio: no llevara insignia "nuevo".
            try {
              await localDb.marcarConocido(idLocal);
            } catch { /* insignia prescindible */ }
            return fila ? localADocente(fila) : null;
          } catch (errorLocal) {
            const msg = errorLocal instanceof Error ? errorLocal.message : 'No se pudo guardar localmente.';
            log(`  fallo local: ${msg}`);
            setTono('error');
            setMensaje(msg);
            return null;
          } finally {
            setCargando(false);
          }
        }
        log(`  ${estado || 'sin respuesta'}: ${mensajeError}`);
        setTono('error');
        setMensaje('No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.');
        return null;
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros],
  );

  /**
   * Actualiza un docente. Con red hace PUT; sin red actualiza SQLite y encola.
   */
  const actualizarDocente = useCallback(
    async (id: number, datos: DocenteInput): Promise<Docente | null> => {
      log(`PUT /api/docentes/${id} -> ${API_URL}`);
      setCargando(true);
      setMensaje('');
      setTono('error');
      let estado = 0;
      try {
        const response = await fetch(`${API_URL}/api/docentes/${encodeURIComponent(String(id))}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          cache: 'no-store',
          body: JSON.stringify(datos),
        });
        estado = response.status;
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          avisarFallo(estado, payload, 'actualizar el docente');
          return null;
        }
        await refrescar();
        await cargarFacetas();
        return payload as Docente;
      } catch (error) {
        const mensajeError = error instanceof Error ? error.message : 'No se pudo actualizar el docente.';
        if (estado === 0) {
          try {
            // Si cambia el nombre, se comprueba duplicado (excluyendose a si
            // mismo): evita encolar una operacion que la nube rechazaria.
            if (datos.nombre !== undefined && datos.nombre.trim() !== '') {
              const filaPropia = await localDb.obtenerLocal(id);
              const nombreNuevo = datos.nombre.trim();
              if ((!filaPropia || filaPropia.nombre !== nombreNuevo) &&
                  (await localDb.existeNombreLocal(nombreNuevo, id))) {
                setTono('error');
                setMensaje('Ya existe otro docente con ese nombre en este dispositivo.');
                return null;
              }
            }
            await localDb.actualizarLocal(id, {
              nombre: datos.nombre,
              cargo: datos.cargo,
              departamento: datos.departamento,
              carrera: datos.carrera,
              facultad: datos.facultad,
              email: datos.email,
              foto_url: datos.foto_url,
              resumen: datos.resumen,
              biografia: datos.biografia,
              areas: datos.areas,
              formacion: datos.formacion,
            });
            log(`  actualizado LOCAL id ${id} (pendiente de sincronizar)`);
            await recargarDesdeLocal();
            setTono('info');
            setMensaje('Cambio guardado en el dispositivo sin conexion. Se sincronizara al volver la red.');
            const fila = await localDb.obtenerLocal(id);
            return fila ? localADocente(fila) : null;
          } catch (errorLocal) {
            const msg = errorLocal instanceof Error ? errorLocal.message : 'No se pudo actualizar localmente.';
            log(`  fallo local: ${msg}`);
            setTono('error');
            setMensaje(msg);
            return null;
          } finally {
            setCargando(false);
          }
        }
        log(`  ${estado || 'sin respuesta'}: ${mensajeError}`);
        setTono('error');
        setMensaje('No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.');
        return null;
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros],
  );

  /**
   * Borra un docente. Con red hace DELETE; sin red marca en SQLite y encola.
   */
  const eliminarDocente = useCallback(
    async (id: number): Promise<boolean> => {
      log(`DELETE /api/docentes/${id} -> ${API_URL}`);
      setCargando(true);
      setMensaje('');
      setTono('error');
      let estado = 0;
      try {
        const response = await fetch(`${API_URL}/api/docentes/${encodeURIComponent(String(id))}`, {
          method: 'DELETE',
          headers: { 'Cache-Control': 'no-cache' },
          cache: 'no-store',
        });
        estado = response.status;
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          avisarFallo(estado, payload, 'borrar el docente');
          return false;
        }
        setNuevosIds(prev => prev.filter(n => n !== id));
        await refrescar();
        await cargarFacetas();
        return true;
      } catch (error) {
        const mensajeError = error instanceof Error ? error.message : 'No se pudo borrar el docente.';
        if (estado === 0) {
          try {
            await localDb.borrarLocal(id);
            log(`  borrado LOCAL id ${id} (pendiente de sincronizar)`);
            await recargarDesdeLocal();
            setTono('info');
            setMensaje('Borrado en el dispositivo sin conexion. Se sincronizara al volver la red.');
            return true;
          } catch (errorLocal) {
            const msg = errorLocal instanceof Error ? errorLocal.message : 'No se pudo borrar localmente.';
            log(`  fallo local: ${msg}`);
            setTono('error');
            setMensaje(msg);
            return false;
          } finally {
            setCargando(false);
          }
        }
        log(`  ${estado || 'sin respuesta'}: ${mensajeError}`);
        setTono('error');
        setMensaje('No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.');
        return false;
      } finally {
        setCargando(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtros],
  );

  /**
   * Pide los valores disponibles para los filtros.
   *
   * Va aparte del listado y se carga una vez. Son 3 listas cortas (facultades,
   * carreras y departamentos) que no cambian durante la sesion: pedirlas en cada
   * cambio de filtro serian dos viajes a la base para mostrar lo mismo de nuevo.
   * Sin red, se calculan desde el espejo local.
   */
  const cargarFacetas = useCallback(async () => {
    log(`GET /api/docentes/facetas -> ${API_URL}`);
    try {
      const response = await fetch(`${API_URL}/api/docentes/facetas`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const payload = await response.json();
      const datos = payload?.data;
      if (!datos) return;
      // Cada lista se normaliza a array de string. Si el servicio devuelve un
      // valor raro, el `.map` de la pantalla no se rompe.
      setFacetas({
        facultad: Array.isArray(datos.facultad) ? datos.facultad : [],
        carrera: Array.isArray(datos.carrera) ? datos.carrera : [],
        departamento: Array.isArray(datos.departamento) ? datos.departamento : [],
      });
    } catch {
      // Respaldo local: las facetas salen del espejo SQLite.
      try {
        const todas = await localDb.listarLocales('', '', '', 50, 0);
        if (todas.length === 0) {
          log('  no se pudieron cargar las facetas; la lista funciona igual sin filtros');
          return;
        }
        const dedup = (xs: (string | null | undefined)[]) =>
          [...new Set(xs.filter((x): x is string => !!x && x.trim() !== ''))].sort();
        setFacetas({
          facultad: dedup(todas.map(t => t.facultad)),
          carrera: dedup(todas.map(t => t.carrera)),
          departamento: dedup(todas.map(t => t.departamento)),
        });
        log('  facetas desde SQLite local');
      } catch {
        // Las facetas son una comodidad, no un dato imprescindible: si no se
        // pueden cargar, la pantalla funciona igual sin los botones de filtro, asi
        // que no se ensucia la pantalla con un aviso por esto.
        log('  no se pudieron cargar las facetas; la lista funciona igual sin filtros');
      }
    }
  }, []);

  /**
   * Detecta ids de la nube que el usuario aun no vio y los marca con "nuevo".
   *
   * Se usa al final de sincronizar() y en el poll automatico. No toca el
   * espejo ni la lista: solo la insignia. Devuelve los ids frescos.
   */
  const detectarNuevos = useCallback(async (): Promise<number[]> => {
    try {
      const response = await fetch(`${API_URL}/api/docentes?limite=50`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (!response.ok) return [];
      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const conocidos = await localDb.obtenerConocidos();
      const frescos = data
        .map((d: { id?: unknown }) => d?.id)
        .filter((id): id is number => typeof id === 'number' && !conocidos.has(id));
      if (frescos.length > 0) {
        setNuevosIds(prev => [...new Set([...prev, ...frescos])]);
        log(`  nuevos en la nube: ${frescos.join(', ')}`);
      }
      return frescos;
    } catch {
      return [];
    }
  }, []);

  /**
   * Busca en la nube el id de un docente por su nombre exacto.
   *
   * Se usa al fusionar: si el POST choca con UNIQUE, hay que encontrar la
   * ficha existente para actualizarla en vez de duplicarla.
   */
  const buscarIdEnNube = useCallback(async (nombre: string): Promise<number | null> => {
    try {
      const response = await fetch(
        `${API_URL}/api/docentes/buscar/${encodeURIComponent(nombre.trim())}`,
        { method: 'GET', headers: { 'Cache-Control': 'no-cache' }, cache: 'no-store' },
      );
      if (!response.ok) return null;
      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const exacto = data.find(
        (d: { nombre?: unknown }) =>
          typeof d?.nombre === 'string' && d.nombre.trim() === nombre.trim(),
      );
      return typeof exacto?.id === 'number' ? exacto.id : null;
    } catch {
      return null;
    }
  }, []);
  /**
   * Fusiona un crear rechazado por nombre duplicado (UNIQUE en la nube).
   *
   * Es la politica decidida para el choque nube-vs-local: UN solo registro y
   * ganan los datos locales por ser lo mas reciente. Busca la ficha existente
   * por nombre exacto y le hace PUT solo con los campos que traen dato (los
   * null/vacios no se mandan para no borrar lo que ya estaba bien en la nube).
   * Despues elimina la fila temporal local: reescribir su id chocaria con la
   * PRIMARY KEY porque ese id ya existe en el espejo.
   *
   * @returns Mensaje para el usuario, o null si no se pudo fusionar (ahi el
   *   llamador lo descarta como antes). Si falla la RED, lanza para que la
   *   operacion quede en cola y se reintente.
   */
  const fusionarCrearDuplicado = useCallback(
    async (op: localDb.OperacionPendiente, nombre: string): Promise<string | null> => {
      const idNube = await buscarIdEnNube(nombre);
      if (idNube === null) return null;
      const cuerpo: Record<string, unknown> = {};
      const src = (op.payload ?? {}) as Record<string, unknown>;
      for (const [clave, valor] of Object.entries(src)) {
        if (clave === 'id') continue;
        if (valor === null || valor === undefined) continue;
        if (typeof valor === 'string' && valor.trim() === '') continue;
        if (Array.isArray(valor) && valor.length === 0) continue;
        cuerpo[clave] = valor;
      }
      if (typeof cuerpo.nombre !== 'string' || cuerpo.nombre.trim() === '') {
        cuerpo.nombre = nombre;
      }
      // Si falla la red aqui, se lanza a proposito: la operacion queda en
      // cola para el proximo intento en vez de descartarse.
      const response = await fetch(
        `${API_URL}/api/docentes/${encodeURIComponent(String(idNube))}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
          cache: 'no-store',
          body: JSON.stringify(cuerpo),
        },
      );
      if (!response.ok) return null;
      await localDb.eliminarDeCola(op.orden);
      await localDb.eliminarFilaLocal(op.id_local).catch(() => {});
      try {
        await localDb.marcarConocido(idNube);
      } catch { /* insignia prescindible */ }
      setNuevosIds(prev => prev.filter(n => n !== idNube));
      log(`  SYNC crear orden ${op.orden}: fusionado en nube ${idNube} (gana lo local)`);
      return `"${nombre}": ya existia en la nube; se fusiono con tus datos`;
    },
    [buscarIdEnNube],
  );

  /**
   * Sincroniza la cola pendiente con la nube (subir lo local, luego bajar).
   *
   * Procesa la cola en orden FIFO. Cada operacion que el servidor acepta se
   * elimina de la cola. Si el servidor responde 409 a un crear por nombre
   * duplicado, NO se descarta: se FUSIONA (PUT a la ficha existente con los
   * datos locales, que son lo mas reciente) y queda un solo registro. Otros
   * 409/400 (limite 20, etc.) si se descartan y se avisa el motivo. Si vuelve
   * a fallar la red a mitad, se detiene y lo que queda sigue en cola.
   *
   * Al terminar sin pendientes, detecta los ids nuevos de la nube para la
   * insignia "nuevo".
   */
  const sincronizar = useCallback(async () => {
    const fusionados: string[] = [];
    let cola: localDb.OperacionPendiente[];
    try {
      cola = await localDb.obtenerCola();
    } catch (error) {
      log(`  sincronizar: SQLite no disponible (${error instanceof Error ? error.message : error})`);
      return;
    }
    if (cola.length === 0) {
      await actualizarPendientes();
      return;
    }
    setSincronizando(true);
    setMensaje('');
    setTono('error');
    log(`SYNC: ${cola.length} operaciones pendientes`);
    // Mapea ids temporales negativos a los ids reales que asigna el servidor.
    const mapaIds = new Map<number, number>();
    let subidas = 0;
    // Motivos especificos de descarte ("Nombre: motivo"), para que el usuario
    // sepa POR QUE la nube rechazo cada cambio en vez de ver solo un conteo.
    const descartes: string[] = [];
    const nombreDe = (payload: unknown): string => {
      if (payload && typeof payload === 'object' && 'nombre' in payload &&
          typeof (payload as { nombre: unknown }).nombre === 'string' &&
          ((payload as { nombre: string }).nombre.trim() !== '')) {
        return (payload as { nombre: string }).nombre.trim();
      }
      return '';
    };

    const resolverId = (idLocal: number) => mapaIds.get(idLocal) ?? idLocal;

    for (const op of cola) {
      const idReal = resolverId(op.id_local);
      try {
        if (op.tipo === 'crear') {
          // El id lo asigna el servidor: se manda el payload sin id.
          const { ...datos } = op.payload as DocenteInput & { id?: number };
          const response = await fetch(`${API_URL}/api/docentes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            cache: 'no-store',
            body: JSON.stringify(datos),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            if (response.status === 409 || response.status === 400) {
              // Posible duplicado por nombre (UNIQUE en la nube): antes de
              // descartar se intenta FUSIONAR, que es la politica decidida
              // para el choque nube-vs-local (gana lo local por ser lo mas
              // reciente, y queda UN solo registro).
              const etiqueta = nombreDe(op.payload);
              const fusionado = etiqueta
                ? await fusionarCrearDuplicado(op, etiqueta)
                : null;
              if (fusionado) {
                fusionados.push(fusionado);
                subidas += 1;
                continue;
              }
              // No era fusionable (limite 20, etc.): se descarta de la cola
              // y se elimina la fila temporal para no reintentarla siempre.
              // Se usa eliminarFilaLocal (sin encolar) y no borrarLocal:
              // borrarLocal meteria OTRA operacion en la cola.
              await localDb.eliminarDeCola(op.orden);
              await localDb.eliminarFilaLocal(op.id_local).catch(() => {});
              const motivo = (payload && typeof payload === 'object' && 'error' in payload &&
                typeof (payload as { error: unknown }).error === 'string')
                ? (payload as { error: string }).error
                : `Error ${response.status}`;
              descartes.push(etiqueta ? `"${etiqueta}": ${motivo}` : motivo);
              log(`  SYNC crear orden ${op.orden}: descartada (${motivo})`);
              continue;
            }
            throw new Error(payload?.error || `Error ${response.status} al subir la creacion`);
          }
          const creado = payload as Docente;
          mapaIds.set(op.id_local, creado.id);
          await localDb.reescribirIdLocal(op.id_local, creado.id);
          await localDb.eliminarDeCola(op.orden);
          try {
            await localDb.marcarConocido(creado.id);
          } catch { /* insignia prescindible */ }
          subidas += 1;
          log(`  SYNC crear orden ${op.orden}: local ${op.id_local} -> nube ${creado.id}`);
        } else if (op.tipo === 'actualizar') {
          if (idReal < 0) {
            // Su `crear` aun no subio (no deberia pasar en FIFO, pero si la
            // creacion se descarto, el actualizar queda huerfano).
            await localDb.eliminarDeCola(op.orden);
            descartes.push('Cambio sobre un docente que la nube rechazo');
            log(`  SYNC actualizar orden ${op.orden}: huerfana (crear descartada), se elimina`);
            continue;
          }
          const response = await fetch(`${API_URL}/api/docentes/${encodeURIComponent(String(idReal))}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            cache: 'no-store',
            body: JSON.stringify(op.payload),
          });
          const payload = await response.json().catch(() => null);
          if (!response.ok) {
            if (response.status === 404 || response.status === 409 || response.status === 400) {
              await localDb.eliminarDeCola(op.orden);
              await localDb.marcarSincronizado(idReal).catch(() => {});
              const motivo = (payload && typeof payload === 'object' && 'error' in payload &&
                typeof (payload as { error: unknown }).error === 'string')
                ? (payload as { error: string }).error
                : `Error ${response.status}`;
              descartes.push(`Cambio al docente ${idReal}: ${motivo}`);
              log(`  SYNC actualizar orden ${op.orden}: descartada (${motivo})`);
              continue;
            }
            throw new Error(payload?.error || `Error ${response.status} al subir la actualizacion`);
          }
          await localDb.eliminarDeCola(op.orden);
          await localDb.marcarSincronizado(idReal).catch(() => {});
          subidas += 1;
          log(`  SYNC actualizar orden ${op.orden}: id ${idReal} ok`);
        } else {
          // borrar
          if (idReal < 0) {
            // Se creo y se borro sin red: no hay nada que subir.
            await localDb.eliminarDeCola(op.orden);
            log(`  SYNC borrar orden ${op.orden}: era temporal, nada que subir`);
            continue;
          }
          const response = await fetch(`${API_URL}/api/docentes/${encodeURIComponent(String(idReal))}`, {
            method: 'DELETE',
            headers: { 'Cache-Control': 'no-cache' },
            cache: 'no-store',
          });
          if (!response.ok && response.status !== 404) {
            const payload = await response.json().catch(() => null);
            throw new Error(payload?.error || `Error ${response.status} al subir el borrado`);
          }
          await localDb.eliminarDeCola(op.orden);
          subidas += 1;
          log(`  SYNC borrar orden ${op.orden}: id ${idReal} ok`);
        }
      } catch (error) {
        // Sin red de nuevo (o gateway caido): se detiene, lo que queda sigue
        // en cola para el proximo intento.
        log(`  SYNC detenida en orden ${op.orden}: ${error instanceof Error ? error.message : error}`);
        break;
      }
    }

    // Bajar: recarga desde la nube y reemplaza el espejo.
    try {
      await refrescar();
      await cargarFacetas();
    } catch {
      // refrescar ya pone su propio mensaje
    } finally {
      await actualizarPendientes();
      setSincronizando(false);
    }
    const restantes = await localDb.contarPendientes().catch(() => 0);
    let nuevos = 0;
    if (restantes === 0) {
      // Sin pendientes, la nube manda: se detectan los ids que el usuario aun
      // no vio para la insignia "nuevo".
      nuevos = (await detectarNuevos().catch(() => [] as number[])).length;
    }
    if (restantes === 0) {
      const partes = [`Sincronizado: ${subidas} cambios subidos a la nube`];
      if (fusionados.length > 0) partes.push(`${fusionados.length} fusionado(s): ${fusionados.join('; ')}`);
      let texto = partes.join('. ') + '.';
      if (descartes.length > 0) texto += ` No se pudo subir: ${descartes.join('; ')}.`;
      if (nuevos > 0) texto += ` Hay ${nuevos} docente(s) nuevo(s) en la nube.`;
      setTono(descartes.length > 0 ? 'error' : 'info');
      setMensaje(texto);
      log(`SYNC completa: ${subidas} subidas, ${fusionados.length} fusiones, ${descartes.length} descartadas, ${nuevos} nuevos`);
    } else {
      setTono('info');
      setMensaje(`Sincronizacion parcial: quedan ${restantes} cambios pendientes.`);
    }
  }, [refrescar, cargarFacetas, actualizarPendientes, buscarIdEnNube, detectarNuevos, fusionarCrearDuplicado]);

  /**
   * Revision periodica de la nube (el "monitor" que pide la tarea).
   *
   * Cada `intervaloMs` pregunta a la nube sin molestar: si falla (503 de
   * arranque en frio, timeouts) no toca la pantalla, solo registra. Si hay
   * pendientes, no descarga directo: delega en sincronizar() para no pisar lo
   * local. Si la nube cambio, reemplaza el espejo, refresca la vista en
   * silencio y marca los ids frescos con la insignia "nuevo".
   *
   * No corre sin red, mientras se sincroniza ni mientras el usuario guarda
   * (para no pisarle el Notice del formulario).
   */
  const revisarNube = useCallback(async () => {
    if (!enLineaRef.current || sincronizandoRef.current || cargandoRef.current) return;
    log('POLL: revisando cambios en la nube');
    try {
      const cola = await localDb.contarPendientes().catch(() => 0);
      if (cola > 0) {
        log(`  POLL: hay ${cola} pendiente(s), se sincroniza en vez de descargar`);
        await sincronizarRef.current();
        setUltimaRevision(Date.now());
        return;
      }
      const response = await fetch(`${API_URL}/api/docentes?limite=50`, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
        cache: 'no-store',
      });
      if (!response.ok) {
        log(`  POLL: nube responde ${response.status}, se reintenta en el proximo ciclo`);
        return;
      }
      const payload = await response.json();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const huellas = await localDb.huellasLocales();
      const idsNube = new Set(
        data.map((d: { id?: unknown }) => d?.id).filter((id): id is number => typeof id === 'number'),
      );
      const huboBajas = [...huellas.keys()].some(id => id > 0 && !idsNube.has(id));
      const huboCambios = data.some(
        (d: { id?: unknown }) =>
          typeof d?.id === 'number' && huellas.get(d.id) !== localDb.huellaDocente(d),
      );
      // Ids que la nube trae y NO estaban en el espejo local ANTES de refrescar:
      // candidatos a "nuevo". Se confirman despues del refresco, porque en la
      // primera descarga reemplazarEspejo siembra los ids como conocidos y
      // entonces ninguno es nuevo (si no, los 2 de la base saldrian con NUEVO).
      const llegaron = data
        .map((d: { id?: unknown }) => d?.id)
        .filter((id): id is number => typeof id === 'number' && !huellas.has(id));
      if (llegaron.length === 0 && !huboBajas && !huboCambios && data.length === huellas.size) {
        setUltimaRevision(Date.now());
        return;
      }
      // Hubo cambios: refrescar() baja y reemplaza el espejo en silencio (aqui
      // la cola esta vacia, asi que no delega en sincronizar). No se llama a
      // reemplazarEspejo aparte para no hacerlo dos veces.
      await refrescar({ silencioso: true });
      await cargarFacetas();
      const conocidos = await localDb.obtenerConocidos();
      const frescos = llegaron.filter(id => !conocidos.has(id));
      if (frescos.length > 0) {
        setNuevosIds(prev => [...new Set([...prev, ...frescos])]);
        setTono('info');
        setMensaje(
          `Hay ${frescos.length} docente(s) nuevo(s) en la nube (marca NUEVO). ` +
          `Abre su ficha para quitar la marca.`,
        );
      }
      setUltimaRevision(Date.now());
      log(`  POLL: espejo actualizado, ${frescos.length} nuevo(s)`);
    } catch (error) {
      log(`  POLL omitido: ${error instanceof Error ? error.message : error}`);
    }
  }, [refrescar, cargarFacetas]);

  // Temporizador del monitor. Se recrea SOLO al cambiar el intervalo; con 0
  // esta apagado. Dispara una revision inmediata al activarse para no esperar
  // el primer ciclo con la pantalla desactualizada.
  //
  // `revisarNube` cambia de identidad con cada filtro (depende de `refrescar`),
  // asi que se lee por ref: si fuera dependencia, cada tecla del buscador
  // reiniciaria el temporizador y dispararia un poll de mas.
  const revisarNubeRef = useRef(revisarNube);
  revisarNubeRef.current = revisarNube;
  useEffect(() => {
    if (intervaloMs <= 0) return;
    void revisarNubeRef.current();
    const timer = setInterval(() => {
      void revisarNubeRef.current();
    }, intervaloMs);
    return () => clearInterval(timer);
  }, [intervaloMs]);

  // Sincronizacion automatica al volver la red.
  const sincronizarRef = useRef(sincronizar);
  sincronizarRef.current = sincronizar;
  const estabaEnLinea = useRef(enLinea);
  useEffect(() => {
    const antes = estabaEnLinea.current;
    estabaEnLinea.current = enLinea;
    if (!antes && enLinea) {
      // Volvio la red: si hay cola, se sube sola.
      localDb.contarPendientes()
        .then(n => {
          if (n > 0) {
            log(`Red de vuelta: sincronizando ${n} pendientes`);
            void sincronizarRef.current();
          }
        })
        .catch(() => {});
    }
  }, [enLinea]);

  // Cada vez que cambian los filtros se vuelve a pedir el listado, con los
  // filtros YA applied. Este efecto es el UNICO sitio que dispara una consulta
  // por cambio de filtro.
  //
  // Antes no habia nada aqui: `filtrar` solo llamaba a `setFiltros`, y como
  // `refrescar` es un `useCallback` que depende de `filtros` pero nadie lo
  // llamaba, escribir en el buscador o pulsar un filtro de carrera no pedia
  // NADA. La lista se quedaba siempre con la primera consulta. El `[]` que hay
  // en las dependencias de la pantalla no lo arregla: se dispara al montar, no
  // al cambiar el filtro.
  //
  // Al montar tambien se ejecuta (las dependencias iniciales son las de
  // siempre), asi que la primera carga sigue siendo una sola peticion.
  useEffect(() => {
    void refrescar();
  }, [filtros, refrescar]);

  // Las facetas son las que generan los botones de filtro. Se piden una sola vez,
  // al montar: son tres listas cortas que no cambian durante la sesion. Si el
  // usuario agrega un docente con una carrera nueva desde Supabase, el boton de
  // esa carrera no aparecera hasta reiniciar la app; por eso la pantalla llama
  // tambien a `cargarFacetas` al volver a la pestana.
  useEffect(() => {
    void cargarFacetas();
  }, [cargarFacetas]);

  return (
    <DocentesContext.Provider
      value={{
        docentes,
        total,
        filtros,
        facetas,
        cargando,
        mensaje,
        tono,
        vacio: cargadoUnaVez && docentes.length === 0,
        enLinea,
        pendientes,
        sincronizando,
        nuevosIds,
        ultimaRevision,
        intervaloMs,
        fijarIntervalo,
        filtrar,
        refrescar,
        obtenerDocente,
        crearDocente,
        actualizarDocente,
        eliminarDocente,
        cargarFacetas,
        sincronizar,
      }}
    >
      {children}
    </DocentesContext.Provider>
  );
}

export function useDocentes() {
  const context = useContext(DocentesContext);
  if (!context) throw new Error('useDocentes debe usarse dentro de DocentesProvider');
  return context;
}
