// ---------------------------------------------------------------------------
// NORMALIZACION DE TEXTO  (frontend - debe coincidir EXACTAMENTE con
// backend/services/docentes-service/src/lib/normalize.js)
//
// La columna `search_key` / `carrera_key` / `departamento_key` de la tabla se
// genera con ESTA funcion en el seed, y las busquedas la comparan contra el
// resultado de ESTA funcion. Si se cambia una, hay que cambiar la otra y volver
// a correr el seed.
// ---------------------------------------------------------------------------

/**
 * Normaliza un texto para poder compararlo.
 *
 * Regla unica: minusculas, sin acentos, sin puntuacion y sin espacios sobrantes.
 * 'José', 'JOSE' y 'jose' producen la misma clave, que es justo lo que hace que
 * el buscador de la app no falle por una tilde.
 *
 * @param value Texto a normalizar. Tolera null/undefined.
 * @returns La clave normalizada (puede quedar vacia).
 */
export function normalizeText(value: string | null | undefined): string {
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
export function normalizeSearchKey(value: string | null | undefined): string {
  return normalizeText(value).replace(/\s+/g, '');
}

/**
 * Normaliza un valor de filtro (carrera, departamento, facultad...).
 *
 * Aqui NO se quitan los espacios: se conservan como separador de palabras
 * porque la busqueda por filtro se hace con `LIKE '%' || $n || '%'` sobre la
 * columna `_key` ya normalizada.
 */
export function normalizeFilter(value: string | null | undefined): string {
  return normalizeText(value);
}