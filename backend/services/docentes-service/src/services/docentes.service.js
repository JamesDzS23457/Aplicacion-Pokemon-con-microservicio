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

// ---------------------------------------------------------------------------
// ESCRITURA (CRUD)
// ---------------------------------------------------------------------------

/**
 * Normaliza un campo de texto opcional: recorta espacios y convierte "" en
 * null, para no guardar cadenas vacias en la base.
 *
 * Devuelve `undefined` (y no null) cuando el campo NO VENIA en el cuerpo: asi
 * actualizarDocente distingue "no lo toques" (ausente) de "dejalo vacio"
 * (vacio o null explicito). Sin esa distincion, un PUT con solo `{"cargo":...}`
 * pondria el resto de columnas en null y borraria datos sin avisar.
 */
function textoOpcional(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === '' ? null : texto;
}

/**
 * Normaliza una lista (areas, formacion): acepta array o texto con un elemento
 * por linea, recorta cada elemento y quita los vacios.
 *
 * Igual que textoOpcional: ausente es `undefined` (no se toca) y null es []
 * (se vacia a proposito).
 */
function listaOpcional(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return [];
  const elementos = Array.isArray(valor) ? valor : String(valor).split('\n');
  return elementos.map((e) => String(e).trim()).filter((e) => e !== '');
}

/**
 * Valida que el email, si viene, tenga forma de email.
 *
 * No se verifica que el dominio exista: eso seria salir a internet en tiempo de
 * peticion, y este servicio responde siempre solo con la base.
 */
function validarEmail(email) {
  if (email === null || email === undefined) return;
  if (!/\S+@\S+\.\S+/.test(email)) {
    throw httpError('El email no tiene un formato valido.', 400);
  }
}

/**
 * Limpia el cuerpo de una peticion de escritura y lo deja en forma de docente.
 *
 * Es la lista blanca de campos: lo que no sea un campo escribible (id,
 * search_key, *_key, created_at...) se ignora aunque venga en el cuerpo.
 * `requerirNombre` distingue crear (el nombre es obligatorio) de actualizar
 * (puede no venir, pero si viene no puede quedar vacio).
 */
function limpiarCuerpo(body, { requerirNombre }) {
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError('El cuerpo debe ser un objeto JSON con los datos del docente.', 400);
  }

  const datos = {
    nombre: body.nombre === undefined ? undefined : textoOpcional(body.nombre),
    cargo: textoOpcional(body.cargo),
    departamento: textoOpcional(body.departamento),
    carrera: textoOpcional(body.carrera),
    facultad: textoOpcional(body.facultad),
    email: textoOpcional(body.email),
    foto_url: textoOpcional(body.foto_url),
    resumen: textoOpcional(body.resumen),
    biografia: textoOpcional(body.biografia),
    areas: listaOpcional(body.areas),
    formacion: listaOpcional(body.formacion),
  };

  if (requerirNombre && !datos.nombre) {
    throw httpError('El nombre del docente es obligatorio.', 400);
  }
  if (datos.nombre !== undefined && !datos.nombre) {
    throw httpError('El nombre del docente no puede quedar vacio.', 400);
  }
  if (datos.email !== undefined) validarEmail(datos.email);

  return datos;
}

/**
 * Traduce un error de Postgres a error de negocio.
 *
 * - 23505 (unique_violation en `nombre`): otro docente ya tiene ese nombre -> 409.
 * - 'Limite de 20 docentes alcanzado' (trigger): la tabla esta llena -> 409.
 */
function traducirErrorPostgres(error) {
  if (error?.code === '23505') {
    throw httpError('Ya existe un docente con ese nombre.', 409);
  }
  if (/Limite de 20 docentes alcanzado/.test(error?.message || '')) {
    throw httpError('Limite de 20 docentes alcanzado. Borra uno antes de agregar otro.', 409);
  }
  throw error;
}

/** POST: inserta un docente nuevo. El id lo asigna el servicio. */
export async function crearDocente(body) {
  const datos = limpiarCuerpo(body, { requerirNombre: true });

  try {
    return await repo.insert(datos);
  } catch (error) {
    traducirErrorPostgres(error);
  }
}

/** PUT: reemplaza los campos dados de un docente existente. */
export async function actualizarDocente(id, body) {
  const numerico = Number(id);
  if (!Number.isInteger(numerico) || numerico < 1) {
    throw httpError('El id debe ser un numero entero', 400);
  }

  const datos = limpiarCuerpo(body, { requerirNombre: false });
  const cambios = {};
  for (const [clave, valor] of Object.entries(datos)) {
    // `undefined` = el campo no venia en el cuerpo y no se toca. Solo entra lo
    // que el cliente mando de verdad.
    if (valor === undefined) continue;
    cambios[clave] = valor;
  }
  if (Object.keys(cambios).length === 0) {
    throw httpError('No hay campos para actualizar.', 400);
  }

  try {
    const actualizado = await repo.updateById(numerico, cambios);
    if (!actualizado) {
      throw httpError('Docente no encontrado', 404);
    }
    return actualizado;
  } catch (error) {
    if (error?.status) throw error;
    traducirErrorPostgres(error);
  }
}

/** DELETE: borra un docente por id. */
export async function eliminarDocente(id) {
  const numerico = Number(id);
  if (!Number.isInteger(numerico) || numerico < 1) {
    throw httpError('El id debe ser un numero entero', 400);
  }

  const borrado = await repo.remove(numerico);
  if (!borrado) {
    throw httpError('Docente no encontrado', 404);
  }
  return { id: borrado.id };
}