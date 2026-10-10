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

  const conexion = useConexion();
  // null (aun sin medir) se trata como en linea para conservar el
  // comportamiento actual hasta que NetInfo responda.
  const enLinea = conexion !== false;

  // Guarda la ultima lectura de `enLinea` para detectar la vuelta de la red.
  const enLineaRef = useRef(enLinea);
  enLineaRef.current = enLinea;

  // Inicializa el detector de red una sola vez.
  useEffect(() => {
    initConexion();
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
   * Pide el listado al gateway.
   *
   * No recibe los filtros: usa los del estado. Eso obliga a que `filtrar` sea el
   * unico camino para cambiar lo que se muestra, y evita el clásico "cambie el
   * filtro en pantalla pero la peticion iba con el anterior" (un `useEffect`
   * que dispara con dependencias equivocadas y se queda una peticion atrasada).
   *
   * Con red: fetch + espejo SQLite. Sin red (estado 0): lectura local.
   */
  const refrescar = useCallback(async () => {
    setCargando(true);
    setMensaje('');
    setTono('error');
    const query = queryDeListado(filtros);
    const inicio = Date.now();
    log(`GET /api/docentes${query} -> ${API_URL}`);
    // 0 = ni siquiera hubo respuesta HTTP (sin red, o servicio dormido).
    let estado = 0;
    try {
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
      setDocentes(data);
      setTotal(typeof payload?.total === 'number' ? payload.total : 0);
      log(`  ${estado} en ${Date.now() - inicio}ms: ${payload?.count ?? 0} de ${payload?.total ?? 0}`);
      // Espejo local: la proxima vez sin red se lee de aqui. Si SQLite falla
      // (p. ej. web sin COOP/COEP), la nube sigue mandando: no se lanza.
      try {
        await localDb.reemplazarEspejo(data);
      } catch (error) {
        log(`  espejo local no disponible: ${error instanceof Error ? error.message : error}`);
      }
      await actualizarPendientes();
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el servicio.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
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
      setCargando(false);
      // Se marca incluso si fallo. Es lo que distingue "no hay docentes" de
      // "todavia no se ha preguntado": sin esto, la primera vez que la base no
      // responde la pantalla diria que el listado esta vacio.
      setCargadoUnaVez(true);
    }
  }, [filtros, leerLocal, actualizarPendientes]);

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
      return (await response.json()) as Docente;
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
   * Sincroniza la cola pendiente con la nube (subir lo local, luego bajar).
   *
   * Procesa la cola en orden FIFO. Cada operacion que el servidor acepta se
   * elimina de la cola; si el servidor responde 409 (limite 20 o nombre
   * duplicado) tambien se elimina pero se cuenta como descartada y se avisa.
   * Si vuelve a fallar la red a mitad, se detiene y lo que queda sigue en cola.
   */
  const sincronizar = useCallback(async () => {
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
              // La nube lo rechaza (limite o duplicado): se descarta de la
              // cola y se elimina la fila temporal para no reintentarla
              // siempre. Se usa eliminarFilaLocal (sin encolar) y no
              // borrarLocal: borrarLocal meteria OTRA operacion en la cola.
              await localDb.eliminarDeCola(op.orden);
              await localDb.eliminarFilaLocal(op.id_local).catch(() => {});
              const motivo = (payload && typeof payload === 'object' && 'error' in payload &&
                typeof (payload as { error: unknown }).error === 'string')
                ? (payload as { error: string }).error
                : `Error ${response.status}`;
              const etiqueta = nombreDe(op.payload);
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
    if (restantes === 0) {
      setTono(descartes.length > 0 ? 'error' : 'info');
      setMensaje(
        descartes.length > 0
          ? `Sincronizado: ${subidas} cambios subidos. No se pudo subir: ${descartes.join('; ')}.`
          : `Sincronizado: ${subidas} cambios subidos a la nube.`,
      );
      log(`SYNC completa: ${subidas} subidas, ${descartes.length} descartadas (${descartes.join('; ')})`);
    } else {
      setTono('info');
      setMensaje(`Sincronizacion parcial: quedan ${restantes} cambios pendientes.`);
    }
  }, [refrescar, cargarFacetas, actualizarPendientes]);

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
