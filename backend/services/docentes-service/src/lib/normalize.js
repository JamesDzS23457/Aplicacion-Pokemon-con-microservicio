// ---------------------------------------------------------------------------
// NORMALIZACION DE TEXTO  (servicio de docentes)
//
// Mismo criterio que lib/normalize.js de pokemon-service: minusculas, sin
// acentos y sin puntuacion, para que la busqueda tolere como escribe el
// usuario. Aqui es todavia mas importante que en Pokemon, porque los nombres
// de las personas llevan acentos, apostrofos y dobles apellidos:
//
//   "Jose Luis Fernandez"  ->  "joseluisfernandez"
//   "FERNÁNDEZ, José Luis" ->  "fernandezjoseluis"  (no coincide, y es correcto:
//                                               el orden invertido es otro nombre)
//
// La columna `search_key` de la tabla se genera con ESTA funcion en el seed, y
// las busquedas la comparan contra el resultado de ESTA funcion. Si se cambia
// una, hay que cambiar las dos y volver a correr el seed.
// ---------------------------------------------------------------------------

/**
 * Normaliza un texto para poder compararlo.
 *
 * Regla unica: minusculas, sin acentos, sin puntuacion y sin espacios sobrantes.
 * 'José', 'JOSE' y 'jose' producen la misma clave, que es justo lo que hace que
 * el buscador de la app no falle por una tilde.
 *
 * @param {*} value Texto a normalizar. Tolera null/undefined.
 * @returns {string} La clave normalizada (puede quedar vacia).
 */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Igual que normalizeText pero sin espacios: "jose luis" -> "joseluis".
 *
 * Es la que se guarda en la columna `search_key`, para que el usuario pueda
 * escribir el nombre con o sin espacios y encuentre lo mismo.
 */
export function normalizeSearchKey(value) {
  return normalizeText(value).replace(/\s+/g, '');
}

/**
 * Normaliza un valor de filtro (carrera, departamento, facultad...).
 *
 * Aqui NO se quitan los espacios: se conservan como separador de palabras
 * porque la busqueda por filtro se hace con `ILIKE '%' || $n || '%'` sobre el
 * texto crudo de la columna. Ver la nota del filtro en el repository.
 */
export function normalizeFilter(value) {
  return normalizeText(value);
}