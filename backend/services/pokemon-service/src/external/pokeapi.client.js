// ---------------------------------------------------------------------------
// CLIENTE DE POKEAPI
//
// UNICA capa del servicio que hace fetch a internet, y solo la usa el seed.
// En el flujo normal de busqueda nunca se llama: la respuesta sale de
// PostgreSQL. Esa separacion es el requisito del profesor.
// ---------------------------------------------------------------------------

const BASE_URL = 'https://pokeapi.co/api/v2';
const TIMEOUT_MS = 10_000;

/**
 * Fetch con timeout. Sin AbortController, una peticion colgada dejaria el
 * seed esperando indefinidamente.
 */
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const error = new Error(
        response.status === 404
          ? 'Pokemon no encontrado'
          : `PokeAPI respondio ${response.status}`,
      );
      // 404 = ese Pokemon no existe (error del usuario).
      // Otro status = problema de la API, se marca como 502.
      error.statusCode = response.status === 404 ? 404 : 502;
      throw error;
    }
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * TRADUCCION DE GENERO
 *
 * OJO, esto NO es el genero real del Pokemon. PokeAPI no tiene ningun endpoint
 * que lo devuelva. Lo que da es el gender_rate de la ESPECIE, que es una
 * PROBABILIDAD, un numero del -1 al 8:
 *
 *   -1  = la especie no tiene genero definido (por ejemplo, Magnemite)
 *    0  = 100% macho
 *    8  = 100% hembra
 *    otro = mezcla de ambos
 *
 * Se traduce ese numero a texto porque es lo unico disponible. Es correcto,
 * pero conviene saber que es una probabilidad y no un dato exacto.
 */
function genderFromRate(genderRate) {
  if (genderRate === undefined || genderRate === null || genderRate === -1) {
    return 'Sin genero definido';
  }
  if (genderRate === 0) return 'Siempre macho';
  if (genderRate === 8) return 'Siempre hembra';
  return 'Macho o hembra';
}

/**
 * Ficha completa de un Pokemon.
 *
 * Hace DOS peticiones: una al Pokemon y otra a su especie.
 *
 * La segunda es un extra: si la especie falla (o no existe), se captura el
 * error y se sigue devolviendo el Pokemon. Perder el genero y la especie es
 * mucho mejor que perder el Pokemon entero por un 404 en un dato opcional.
 */
export async function getPokemon(name) {
  const pokemon = await fetchJson(`${BASE_URL}/pokemon/${encodeURIComponent(name)}`);

  let genero = 'Sin genero definido';
  let especie = '';

  try {
    const species = await fetchJson(
      `${BASE_URL}/pokemon-species/${encodeURIComponent(name)}`,
    );

    genero = genderFromRate(species.gender_rate);

    // "genus" trae el genero en varios idiomas. Se busca el español y, si no
    // existe, el ingles. Por eso pikachu sale como "Pokemon Raton" y no como
    // "Pokemon".
    const genus =
      (species.genera ?? []).find((g) => g.language?.name === 'es') ??
      (species.genera ?? []).find((g) => g.language?.name === 'en');

    especie = genus?.genus ?? '';
  } catch {
    // Se ignora a proposito: la especie es un dato adicional, no el principal.
  }

  return { ...pokemon, genero, especie };
}