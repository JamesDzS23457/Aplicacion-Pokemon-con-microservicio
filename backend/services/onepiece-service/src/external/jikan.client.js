// ---------------------------------------------------------------------------
// CLIENTE DE IMAGENES (Jikan / MyAnimeList)
//
// POR QUE EXISTE ESTE ARCHIVO:
// La API de datos de One Piece (onepiece.client.js) NO devuelve ninguna
// imagen. Sin este cliente, la columna image_url se quedaria siempre en NULL
// y la ficha mostraria el recuadro "OP" en vez del retrato del personaje.
//
// POR QUE JIKAN Y NO OTRAS FUENTES (esto se probo a mano, no es una suposicion):
//   - Wikipedia: devuelve 429 de forma sistematica y, cuando responde, su
//     miniatura no siempre es del personaje (Kaido salia como un grabado
//     japones y Crocodile como un cocodrilo real).
//   - Fandom (onepiece.fandom.com): su API de datos funciona, pero su CDN de
//     imagenes (static.wikia.nocookie.net) responde 403 con un reto de
//     Cloudflare. Eso rompe tanto la descarga desde el seed como un <img>
//     hotlinkeado en el navegador.
//   - Jikan: la API y su CDN (cdn.myanimelist.net) responden 200 y permiten
//     hotlinking incluso con un Referer de otro dominio, que es justo lo que
//     hace el frontend.
//
// COMO FUNCIONA (una sola peticion para los 20):
// El endpoint /anime/{id}/characters de Jikan devuelve TODOS los personajes
// del anime One Piece (id 21 = 1477 personajes) con su imagen, en una sola
// respuesta y sin paginar. Se descarga UNA vez, se indexa por nombre
// normalizado y luego cada personaje se resuelve contra ese indice en
// memoria. Asi no se hace una peticion por personaje ni se roza el limite de
// peticiones de Jikan.
//
// RESPONSABILIDADES Y LIMITES:
//   - Vive en external/, la UNICA capa autorizada a salir a internet.
//   - Se usa SOLO desde el seed: guarda la URL en la BD (image_url) y a
//     partir de ahi el backend jamas vuelve a pedir la imagen.
//   - NO decide nada de negocio: si no encuentra imagen, devuelve null y el
//     seed guarda null, que la UI ya sabe representar con el recuadro "OP".
//
// SOBRE LA LICENCIA: se guarda solo la URL del CDN de MyAnimeList, no se
// copia el archivo. En una app real habria que revisar sus terminos de uso.
// ---------------------------------------------------------------------------

import { normalizeName } from '../lib/normalize.js';

const BASE_URL = 'https://api.jikan.moe/v4';

// ID de One Piece en MyAnimeList. Es estable y es lo que permite traer la
// lista completa de personajes de una sola vez.
const ONEPIECE_ANIME_ID = 21;

// 20s: la respuesta trae 1477 personajes, es mas grande que una peticion
// normal y en una conexion lenta puede tardar. Si aun asi no llega, se sigue
// sin imagenes en lugar de bloquear el seed.
const TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// TRADUCCION NOMBRE DE NUESTRA API -> NOMBRE EN MYANIMELIST
//
// MAL escribe algunos nombres distinto (coma en lugar de punto, otra
// romanizacion). Las claves y los valores van YA normalizados con
// normalizeName(), asi que 'Trafalgar-law' y 'trafalgar law' caen en la
// misma clave sin depender de tildes ni puntuacion.
//
//   Nuestro nombre            Nombre en MAL
//   ------------------------  --------------------------
//   Trafalgar D. Water Law    Trafalgar, Law
//   Don Quijote Doflamingo    Donquixote, Doflamingo
//   Kaido                     Kaidou
//
// Los otros 17 coinciden normalizados y no necesitan alias.
// ---------------------------------------------------------------------------
const MAL_NAME_ALIASES = {
  trafalgardwaterlaw: 'trafalgarlaw',
  donquijotedoflamingo: 'donquixotedoflamingo',
  kaido: 'kaidou',
};

/**
 * Fetch con timeout, mismo patron que onepiece.client.js.
 *
 * El AbortController es imprescindible: sin el, una conexion colgada dejaria
 * el seed esperando para siempre. El clearTimeout va en el finally para que
 * el temporizador se limpie tanto si la peticion va bien como si falla.
 */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Jikan respondio ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Descarga los 1477 personajes de One Piece y los indexa por nombre
 * normalizado. El valor guardado es la URL de la imagen, no el objeto
 * completo, para que las busquedas posteriores sean directas.
 *
 * Cuando MAL tiene el mismo nombre repetido, gana el personaje con mas
 * favoritos: es el que suele ser el canonico y evita quedarnos con una
 * variante secundaria.
 */
async function buildIndex() {
  const json = await fetchJson(`${BASE_URL}/anime/${ONEPIECE_ANIME_ID}/characters`);

  const list = json?.data;
  // Se valida la forma de la respuesta: si Jikan cambiara el formato, mejor
  // fallar con un mensaje claro que con "no se puede leer length de undefined".
  if (!Array.isArray(list)) throw new Error('Respuesta inesperada de Jikan');

  const index = new Map();

  for (const entry of list) {
    // jpg primero por ser el formato universal; webp como respaldo.
    const image =
      entry.character?.images?.jpg?.image_url ??
      entry.character?.images?.webp?.image_url ??
      null;
    if (!image) continue;

    const key = normalizeName(entry.character?.name);
    if (!key) continue;

    const current = index.get(key);
    if (!current || (entry.favorites ?? 0) > (current.favorites ?? 0)) {
      index.set(key, { image, favorites: entry.favorites ?? 0 });
    }
  }

  return index;
}

// Promesa del indice, cacheada a nivel de modulo.
//
// Se cachea la PROMESA, no el resultado: asi, si el seed pidiera el indice
// dos veces antes de que responda la primera, ambas comparten la misma
// peticion en lugar de lanzar dos. El seed lo llama una vez por personaje
// (20 veces), pero solo sale a la red la primera.
let indexPromise = null;

function loadIndex() {
  if (!indexPromise) {
    indexPromise = buildIndex().catch((error) => {
      // No se deja la promesa rota en cache para siempre: se reinicia para
      // que un reintento posterior pueda volver a intentarlo, y se propaga
      // el error solo a la llamada que lo pidio.
      indexPromise = null;
      throw error;
    });
  }
  return indexPromise;
}

/**
 * Imagen del personaje, o null si no se encuentra.
 *
 * Aplica el alias de grafia si existe y busca en el indice ya descargado.
 * Cualquier fallo de red se traduce en null en lugar de una excepcion: una
 * imagen es un adorno y no debe tumbar la carga de los 20 personajes.
 */
export async function findCharacterImage(name) {
  const key = normalizeName(name);
  if (!key) return null;

  const lookupKey = MAL_NAME_ALIASES[key] ?? key;

  try {
    const index = await loadIndex();
    return index.get(lookupKey)?.image ?? null;
  } catch (error) {
    console.warn(`  ! imagen: Jikan no disponible (${error.message}). Se guardara sin imagen.`);
    return null;
  }
}
