// ---------------------------------------------------------------------------
// CAPA DE REGLAS DE NEGOCIO  (servicio de docentes)
//
// Aqui es donde se decide QUE es una peticion valida y que codigo HTTP devuelve
// cada caso. La capa de rutas (routes/) solo traduce HTTP y esta capa solo
// razona: ninguna de las dos toca SQL.
//
// Los errores de negocio se tiran con httpError(mensaje, status) de
// ../lib/errors.js; el manejador central de src/server.js los traduce a
// `{"error": "..."}`, que es el mismo contrato que usan pokemon-service y el
// gateway. Un 404 de "docente no encontrado" tiene que LLEGAR como 404 al
// frontend, no como un 500: la app usa ese codigo para mostrar "no encontrado"
// en vez de un error generico.
// ---------------------------------------------------------------------------

import * as repo from '../repositories/docentes.repository.js';
import { normalizeSearchKey, normalizeFilter } from '../lib/normalize.js';
import { httpError } from '../lib/errors.js';

// Tope de la paginacion. Existe para que un `?limite=999999` no pida una tabla
// gigante: la tabla tiene 20 filas, asi que 50 es de sobra.
const LIMITE_MAXIMO = 50;

/**
 * Lee un query param que tiene que ser un entero dentro de un rango.
 *
 * CUIDADO con el parametro ausente: `URLSearchParams.get()` devuelve `null`
 * cuando no viene el parametro, NO `undefined`. Y `Number(null)` es `0`, que es
 * un entero VALIDO, asi que un `?limite` ausente se colaba como si el usuario
 * hubiera pedido limite 0 y el `Math.max` de abajo lo dejaba en 1: la respuesta
 * traia una sola tarjeta y `total` decia 20, que parece un fallo de datos. Por
 * eso se comprueba `null` explicitamente y no solo `undefined`.
 *
 * `Number('')` y `Number('abc')` dan 0 y NaN, y en los dos casos el `||` de
 * abajo devolveria el valor por defecto silenciosamente. Por eso se comprueba
 * tambien que el resultado sea un entero valido antes de convertirlo.
 *
 * @param {string|null|undefined} valor Valor crudo del query param.
 * @param {number} porDefecto        Valor si no viene o no es valido.
 * @param {number} minimo            Valor minimo admitido.
 * @param {number} maximo            Valor maximo admitido.
 * @returns {number} El entero ya acotado.
 */
function parseEntero(valor, porDefecto, minimo, maximo) {
  if (valor === null || valor === undefined || valor === '') return porDefecto;
  const numero = Number(valor);
  if (!Number.isInteger(numero)) return porDefecto;
  return Math.min(Math.max(numero, minimo), maximo);
}

/**
 * Normaliza y valida los filtros del listado.
 *
 * @param {URLSearchParams} query Query params de la peticion.
 * @returns {{q: string, carrera: string, departamento: string, limite: number, pagina: number}}
 *   Filtros ya limpios: sin espacios sobrantes y con la paginacion acotada.
 */
function parseFiltros(query) {
  const q = normalizeSearchKey(query.get('q'));
  const carrera = normalizeFilter(query.get('carrera'));
  const departamento = normalizeFilter(query.get('departamento'));
  const limite = parseEntero(query.get('limite'), LIMITE_MAXIMO, 1, LIMITE_MAXIMO);
  const pagina = parseEntero(query.get('pagina'), 1, 1, 1000);

  return { q, carrera, departamento, limite, pagina };
}

/**
 * Listado de docentes con filtros, paginacion y total.
 *
 * Devuelve el total SIN paginar para que la app pueda decir "mostrando 3 de 20".
 * Count y datos salen de la misma ronda de consultas: son dos viajes, pero
 * separarlos daria la falsa impresion de que el total corresponde a otra cosa.
 */
export async function listarDocentes(query) {
  const filtros = parseFiltros(query);

  const [data, total] = await Promise.all([
    repo.findMany({ ...filtros, offset: (filtros.pagina - 1) * filtros.limite }),
    repo.countMany(filtros),
  ]);

  return {
    total,
    pagina: filtros.pagina,
    limite: filtros.limite,
    filtros: {
      q: filtros.q || null,
      carrera: filtros.carrera || null,
      departamento: filtros.departamento || null,
    },
    count: data.length,
    data,
  };
}

/** Un docente por id. El id viene de un PATH PARAM. */
export async function getDocenteById(id) {
  // Number('abc') es NaN, y buscar por NaN en Postgres no da error: simplemente
  // no encuentra nada y el usuario veria un 404 sin motivo. Un id no numerico
  // es un 400.
  const numerico = Number(id);
  if (!Number.isInteger(numerico) || numerico < 1) {
    throw httpError('El id debe ser un numero entero', 400);
  }

  const docente = await repo.findById(numerico);
  if (!docente) {
    throw httpError('Docente no encontrado', 404);
  }

  return docente;
}

/**
 * Busqueda por termino. El termino viene de un PATH PARAM.
 *
 * Ruta: GET /api/docentes/buscar/:termino
 */
export async function buscarDocentes(termino) {
  // Un termino que al normalizar se queda vacio (por ejemplo un espacio, o
  // signos de puntuacion sueltos) NO es una busqueda valida: es un 400. Sin
  // esta comprobacion, el repositorio devolveria la lista vacia y el usuario
  // veria un 404 "no encontrado" cuando en realidad escribio mal la consulta.
  if (!normalizeSearchKey(termino)) {
    throw httpError('El termino de busqueda es obligatorio', 400);
  }

  const resultados = await repo.search(termino);
  if (resultados.length === 0) {
    throw httpError('No se encontro ningun docente con ese criterio', 404);
  }

  return { count: resultados.length, data: resultados };
}

/** Valores disponibles para los filtros de la pantalla. */
export async function listarFacetas() {
  const facetas = await repo.findFacetas();
  return {
    facultad: facetas.facultad,
    carrera: facetas.carrera,
    departamento: facetas.departamento,
  };
}