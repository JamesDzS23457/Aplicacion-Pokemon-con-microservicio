// ---------------------------------------------------------------------------
// REPOSITORY DE CONTEXTO
//
// En este servicio, "repository" es la capa que TRAE LOS DATOS de la app. No hay
// SQL propio: la app ya tiene sus datos repartidos en tres microservicios (cada
// uno con su base), y este servicio los consulta a traves de sus APIs internas.
// Asi se respeta la regla del proyecto de "una base por servicio": el asistente
// no abre conexiones a Postgres ni a Mongo, solo lee lo que los otros servicios
// exponen.
//
// No es una llamada "a internet": son peticiones a NUESTROS servicios. Aun asi,
// el unico archivo que sale a internet de verdad es external/gemini.client.js.
//
// Los datos cambian poco (un seed cada tanto), asi que el catalogo se cachea
// unos minutos: una conversacion de 10 mensajes no golpea los servicios 10 veces
// por bando. Si un servicio falla, se usa lo ultimo que se tenia en cache y, si
// nunca hubo, se devuelve lista vacia para ese grupo sin tumbar a los demas.
// ---------------------------------------------------------------------------

import { config } from '../config.js';
import { crearLog } from '../lib/log.js';

const log = crearLog('asistente-service');

/** ultima lectura buena del catalogo y su momento de expiracion. */
let cache = { datos: null, expira: 0 };

/** Nombres de las tres fuentes de datos de la app. */
export const FUENTES = ['pokemons', 'personajes', 'docentes'];

/**
 * Hace un GET y devuelve el JSON. Con timeout para no colgar la peticion del
 * usuario si un microservicio esta en arranque en frio demasiado tiempo.
 *
 * @param {string} url
 * @param {number} [timeoutMs]
 * @returns {Promise<any>}
 */
async function fetchJson(url, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Lee el catalogo completo de la app (los tres grupos de datos).
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.forzar] Ignora la cache y vuelve a pedir todo.
 * @returns {Promise<{pokemons: any[], personajes: any[], docentes: any[]}>}
 * @throws {Error & {status?: number}} 503 si NINGUNA fuente devolvio datos.
 */
export async function obtenerCatalogo({ forzar = false } = {}) {
  const ahora = Date.now();
  if (!forzar && cache.datos && ahora < cache.expira) {
    return cache.datos;
  }

  // Se piden las tres a la vez: son independientes y en paralelo el catalogo se
  // arma en el tiempo de la mas lenta, no en la suma.
  const [pokemons, personajes, docentes] = await Promise.all([
    pedirSeguro(`${config.POKEMON_SERVICE_URL}/api/pokemon`, 'pokemons'),
    pedirSeguro(`${config.ONEPIECE_SERVICE_URL}/api/characters`, 'personajes'),
    pedirSeguro(`${config.DOCENTES_SERVICE_URL}/api/docentes?limite=100`, 'docentes'),
  ]);

  const datos = { pokemons, personajes, docentes };
  const total = pokemons.length + personajes.length + docentes.length;

  if (total === 0) {
    // Sin datos no hay contexto que dar. Se responde 503 para que la app diga
    // "el asistente no puede consultar la base de datos todavia" en vez de
    // inventar una respuesta.
    const error = new Error(
      'No se pudo leer la base de datos de la app: ninguno de los microservicios respondio.',
    );
    error.status = 503;
    throw error;
  }

  cache = { datos, expira: ahora + config.CATALOGO_TTL_MS };
  return datos;
}

/**
 * Pide una fuente y devuelve su lista. Nunca lanza: si falla, avisa y devuelve
 * lo que hubiera en cache para ese grupo (o lista vacia).
 *
 * @param {string} url
 * @param {string} clave Nombre del grupo ('pokemons' | 'personajes' | 'docentes').
 * @returns {Promise<any[]>}
 */
async function pedirSeguro(url, clave) {
  try {
    const payload = await fetchJson(url);
    // Los tres endpoints devuelven la lista en `data` (ver el contrato de cada
    // servicio), salvo /api/pokemon que devuelve {count, data}.
    const data = Array.isArray(payload) ? payload : payload?.data;
    if (!Array.isArray(data)) {
      throw new Error('respuesta sin lista de datos');
    }
    log(`catalogo ${clave}: ${data.length} registro(s)`);
    return data;
  } catch (error) {
    const enCache = cache.datos?.[clave];
    log(
      `AVISO catalogo ${clave}: no se pudo leer (${error?.message}); ` +
        (enCache ? 'se usa la copia anterior' : 'se omite este grupo'),
    );
    return Array.isArray(enCache) ? enCache : [];
  }
}

/** Limpia la cache. Se usa en las pruebas. */
export function limpiarCache() {
  cache = { datos: null, expira: 0 };
}
