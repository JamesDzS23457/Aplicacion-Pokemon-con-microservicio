// ---------------------------------------------------------------------------
// NORMALIZACION DE TEXTO  (asistente-service)
//
// Se usa SOLO para dos cosas dentro de este servicio:
//
//   1. Comparar la pregunta del usuario contra los nombres de las entidades de
//      la app (Pokemon, personajes de One Piece, docentes) para saber QUE ficha
//      hay que meter en el contexto de la IA. La comparacion tiene que ser
//      tolerante: "Luffy", "luffy" y "LUFFY" son el mismo personaje.
//
//   2. Decidir si la pregunta pertenece al tema de la app.
//
// Regla: minusculas + sin acentos + sin puntuacion + espacios colapsados. Es una
// version minima de lib/normalize.js de pokemon-service (no corta el sufijo
// "/ Alias" porque aqui solo se compara texto libre, no se genera una clave que
// se guarde en una base de datos).
// ---------------------------------------------------------------------------

/**
 * Normaliza texto libre para compararlo.
 *
 * @param {unknown} value Texto a normalizar.
 * @returns {string} Texto en minusculas, sin acentos, sin signos y con un solo
 *   espacio entre palabras.
 */
export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    // Quita los acentos (marcas diacriticas) que NFD separa de la letra base.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Todo lo que no sea letra, numero o espacio se convierte en espacio: asi
    // "Nidoran-F", "Tony-Tony Chopper" y "Don Quijote" no pierden palabras.
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras que NO sirven para identificar una entidad por si solas: aparecen en
// muchisimos nombres y, si se buscaran sueltas, una pregunta cualquiera
// coincidiria con medio catalogo. La comparacion por nombre COMPLETO no las
// necesita; solo se filtran de la lista de "tokens sueltos".
const PALABRAS_IGNORADAS = new Set([
  'monkey', 'trafalgar', 'charlotte', 'don', 'quijote', 'tony', 'water',
  'big', 'mama', 'san', 'del', 'los', 'las', 'the', 'and',
]);

/**
 * Claves de busqueda de un nombre: el nombre completo normalizado mas sus
 * palabras sueltas significativas (4+ letras). Sirve para que "el capitan
 * Luffy" encuentre a "Monkey D Luffy" sin que la pregunta tenga que traer el
 * nombre completo.
 *
 * @param {string} nombre Nombre tal cual esta en la base de datos.
 * @returns {string[]} Lista de claves (puede venir vacia si el nombre es corto).
 */
export function clavesDeNombre(nombre) {
  const completo = normalizeText(nombre);
  if (!completo) return [];
  const claves = new Set([completo]);
  for (const palabra of completo.split(' ')) {
    if (palabra.length >= 4 && !PALABRAS_IGNORADAS.has(palabra)) {
      claves.add(palabra);
    }
  }
  return [...claves];
}
