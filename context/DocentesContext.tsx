// ---------------------------------------------------------------------------
// CONTEXTO DE DOCENTES
//
// Es el tercer contexto de la app y el unico que trabaja con una LISTA en vez
// de con un unico resultado: Pokemon y One Piece muestran una ficha cada uno,
// Docentes muestra las veinte tarjetas de la quinta pestana.
//
// Sigue el mismo patron que PokemonContext y OnePieceContext (por eso los tres
// se leen igual), con dos diferencias que son las del enunciado:
//
//   1. SOLO PETICIONES GET. No hay ningun POST en este archivo. Los filtros van
//      como QUERY PARAMS (`?q=ana&carrera=...`) y la ficha de un docente se pide
//      con un PATH PARAM (`/api/docentes/7`). Nunca hay un cuerpo que enviar.
//
//   2. Un unico estado para la lista, no un resultado suelto. La pestana necesita
//      el total, el numero de resultados de la pagina y los filtros aplicados,
//      asi que se guarda la respuesta completa tal cual llega del gateway.
//
// Regla del proyecto que este archivo respeta: la app NUNCA llama a un
// microservicio ni a la base de datos. Solo al gateway (API_URL), igual que las
// otras dos pestanas.
// ---------------------------------------------------------------------------

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL, log, esArranqueFrio, MENSAJE_ARRANQUE_FRIO } from '../lib/api';

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
  /** 'info' para el aviso de arranque en frio; 'error' para fallos reales. */
  tono: 'error' | 'info';
  /** Si true, ya se hizo al menos una peticion y la lista esta vacia de verdad. */
  vacio: boolean;
  /** Aplica filtros (query params) y vuelve a pedir el listado. */
  filtrar: (filtros: Partial<FiltrosDocentes>) => Promise<void>;
  /** Vuelve a pedir el listado con los filtros actuales. */
  refrescar: () => Promise<void>;
  /** Pide UNA ficha por path param. Se usa en la pagina de detalle. */
  obtenerDocente: (id: number) => Promise<Docente | null>;
  /** Recarga tambien las facetas. Se llama al arrancar la app. */
  cargarFacetas: () => Promise<void>;
};

/** Filtros vacios. Se usan como punto de partida y como referencia de igualdad. */
const FILTROS_VACIOS: FiltrosDocentes = { q: '', carrera: '', departamento: '' };

/** Facetas vacias, para no tener `null` en el estado inicial. */
const FACETAS_VACIAS: Facetas = { facultad: [], carrera: [], departamento: [] };

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

export function DocentesProvider({ children }: PropsWithChildren) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [total, setTotal] = useState(0);
  const [filtros, setFiltros] = useState<FiltrosDocentes>(FILTROS_VACIOS);
  const [facetas, setFacetas] = useState<Facetas>(FACETAS_VACIAS);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [tono, setTono] = useState<'error' | 'info'>('error');
  const [cargadoUnaVez, setCargadoUnaVez] = useState(false);

  /**
   * Pide el listado al gateway.
   *
   * No recibe los filtros: usa los del estado. Eso obliga a que `filtrar` sea el
   * unico camino para cambiar lo que se muestra, y evita el clásico "cambie el
   * filtro en pantalla pero la peticion iba con el anterior" (un `useEffect`
   * que dispara con dependencias equivocadas y se queda una peticion atrasada).
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
      setDocentes(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === 'number' ? payload.total : 0);
      log(`  ${estado} en ${Date.now() - inicio}ms: ${payload?.count ?? 0} de ${payload?.total ?? 0}`);
    } catch (error) {
      const mensajeError = error instanceof Error ? error.message : 'No se pudo consultar el servicio.';
      log(`  ${estado || 'sin respuesta'} en ${Date.now() - inicio}ms: ${mensajeError}`);
      // NO se borra la lista: si ya habia docentes en pantalla y un refresco
      // falla, quitarlos deja la pestana vacia y da la impresion de que se perdio
      // el dato. Es mejor mantener lo que se tenia y avisar con el Notice, que
      // ya explica el motivo.
      if (esArranqueFrio(estado, mensajeError)) {
        setTono('info');
        setMensaje(MENSAJE_ARRANQUE_FRIO);
      } else {
        setTono('error');
        setMensaje(
          estado === 0
            ? 'No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.'
            : mensajeError,
        );
      }
    } finally {
      setCargando(false);
      // Se marca incluso si fallo. Es lo que distingue "no hay docentes" de
      // "todavia no se ha preguntado": sin esto, la primera vez que la base no
      // responde la pantalla diria que el listado esta vacio.
      setCargadoUnaVez(true);
    }
  }, [filtros]);

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

  /** Pide una ficha por id. El id viaja como PATH PARAM. */
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
      } else {
        setTono('error');
        setMensaje(
          estado === 0
            ? 'No hubo respuesta del servidor. Revisa tu conexion e intenta de nuevo.'
            : mensajeError,
        );
      }
      return null;
    }
  }, []);

  /**
   * Pide los valores disponibles para los filtros.
   *
   * Va aparte del listado y se carga una vez. Son 3 listas cortas (facultades,
   * carreras y departamentos) que no cambian durante la sesion: pedirlas en cada
   * cambio de filtro serian dos viajes a la base para mostrar lo mismo de nuevo.
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
      // Las facetas son una comodidad, no un dato imprescindible: si no se
      // pueden cargar, la pantalla funciona igual sin los botones de filtro, asi
      // que no se ensucia la pantalla con un aviso por esto.
      log('  no se pudieron cargar las facetas; la lista funciona igual sin filtros');
    }
  }, []);

  // Carga inicial: el listado completo y las facetas, en paralelo. Se lanza una
  // sola vez al montar el provider (que vive por encima de las pestanas) y no en
  // cada visita a la quinta pestana: volver a entrar no debe repreguntar.
  useEffect(() => {
    void refrescar();
    void cargarFacetas();
    // Solo al montar. `refrescar` cambia cuando cambian los filtros, y no
    // interesa: el cambio de filtros se dispara desde `filtrar`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        filtrar,
        refrescar,
        obtenerDocente,
        cargarFacetas,
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