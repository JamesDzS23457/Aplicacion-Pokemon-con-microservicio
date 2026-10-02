// ---------------------------------------------------------------------------
// CLIENTE DE LA API DE ONE PIECE
//
// UNICA capa del servicio que hace fetch a internet. Se usa SOLO desde el
// seed: en el flujo normal de busqueda nunca se llama, porque la respuesta
// sale de PostgreSQL.
//
// Esa separacion es el requisito del profesor: si el servidor externo se cae,
// la app sigue funcionando con los 20 registros guardados.
// ---------------------------------------------------------------------------

import { normalizeName } from '../lib/normalize.js';

const BASE_URL = 'https://api.api-onepiece.com/v2/characters/en';
const TIMEOUT_MS = 10_000; // 10s: si la API no responde, se abandona

/**
 * Fetch con timeout. Sin AbortController, una peticion colgada dejaria el
 * seed esperando indefinidamente.
 *
 * Se usa el patron try/finally con clearTimeout en el finally para que el
 * temporizador se limpie tanto si la peticion va bien como si falla.
 */
async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(`One Piece API respondio ${response.status}`);
      // 404 = el recurso no existe. Cualquier otro status es un problema de
      // la API, no nuestra, asi que se marca como 502 (bad gateway).
      error.statusCode = response.status === 404 ? 404 : 502;
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Descarga la lista completa de personajes (786 en total). */
export async function listCharacters() {
  const list = await fetchWithTimeout(BASE_URL);
  // Se valida que sea un array: si la API cambiara el formato de la respuesta,
  // mejor fallar aqui con un mensaje claro que mas abajo con "no se puede
  // leer la propiedad length de undefined".
  if (!Array.isArray(list)) throw new Error('Respuesta inesperada de One Piece API');
  return list;
}

/**
 * Busca un personaje por nombre.
 *
 * IMPORTANTE: la API ignora el query param ?name=. Se comprobó que
 * /characters/en?name=Monkey%20D%20Luffy devuelve LOS 786 personajes, no uno.
 * Por eso se descarga la lista y se filtra en memoria comparando el nombre
 * ya normalizado.
 */
export async function findCharacterByName(name) {
  const key = normalizeName(name);
  if (!key) return null;
  const list = await listCharacters();
  return list.find((item) => normalizeName(item.name) === key) ?? null;
}

/** Detalle completo de un personaje por su id. */
export async function getCharacterById(id) {
  return fetchWithTimeout(`${BASE_URL}/${id}`);
}