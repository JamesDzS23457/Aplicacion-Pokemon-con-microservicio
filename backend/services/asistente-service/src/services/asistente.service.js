// ---------------------------------------------------------------------------
// REGLAS DE NEGOCIO DEL ASISTENTE
//
// Aqui vive lo importante de la actividad: LIMITAR EL CONTEXTO. El requisito
// del profesor tiene dos fases y las dos estan:
//
//   - MODO ABIERTO ('abierto'): "primero conectarse a la IA y contestar
//     cualquier pregunta". Se le pasa la pregunta a la IA sin mas reglas.
//
//   - MODO RESTRINGIDO ('restringido'): "luego limitar las respuestas a la
//     informacion de la base de datos propia". Solo se responde de Pokemon,
//     personajes de One Piece y docentes que EXISTEN en la app. Para lo demas se
//     contesta la frase exacta "No estoy programada para dar ese tipo de
//     preguntas."
//
// COMO SE LIMITA, EN DOS CAPAS:
//
//   1. GUARDIA EN EL SERVIDOR (esta capa, gratis y determinista): si en la
//      pregunta no aparece ninguna entidad de la base NI ninguna palabra del
//      tema de la app, se responde la frase exacta SIN llamar a la IA. Ahorra
//      cuota y garantiza la frase tal cual.
//
//   2. PROMPT DE SISTEMA (segunda capa): a la IA se le da el CATALOGO completo
//      de entidades permitidas y las FICHAS reales de las que se preguntan. Con
//      eso puede ampliar con su conocimiento general (p. ej. "en que capitulo
//      sale X"), pero solo de esas entidades; si la pregunta se va del tema,
//      tiene la instruccion de contestar la misma frase.
//
// El catalogo es chico (20 Pokemon + 20 personajes + los docentes), asi que cabe
// entero en el prompt sin trucos de recuperacion.
// ---------------------------------------------------------------------------

import { normalizeText, clavesDeNombre } from '../lib/normalize.js';
import { obtenerCatalogo } from '../repositories/contexto.repository.js';
import { generarRespuesta } from '../external/gemini.client.js';
import { crearLog } from '../lib/log.js';

const log = crearLog('asistente-service');

/** Los dos modos del interruptor de la pantalla. */
export const MODO_ABIERTO = 'abierto';
export const MODO_RESTRINGIDO = 'restringido';

/** Frase EXACTA que se responde cuando la pregunta no es del tema de la app. */
export const RESPUESTA_FUERA_DE_CONTEXTO = 'No estoy programada para dar ese tipo de preguntas.';

// Palabras que, sin nombrar una entidad concreta, indican que la pregunta SI es
// del tema de la app (por ejemplo "de que trata el anime de One Piece"). Se
// comparan ya normalizadas, y **por palabra completa** (se rodea la pregunta de
// espacios y se busca " palabra "), no por subcadena: si no, "poke" haria match
// dentro de "spoke" y "serie" dentro de "serie mundial". Por eso van tambien las
// formas en plural. Lista corta y deliberada: si se amplia demasiado, cualquier
// pregunta colaria como "en contexto".
const PALABRAS_CLAVE_APP = [
  'pokemon', 'pokemons', 'pokemones', 'pokedex',
  'one piece', 'onepiece',
  'anime', 'manga',
  'docente', 'docentes', 'profesor', 'profesores', 'uninpahu',
].map(normalizeText);

/** Recorta un texto largo y le agrega puntos suspensivos. */
function recortar(texto, maximo) {
  const limpio = String(texto ?? '').trim();
  return limpio.length > maximo ? `${limpio.slice(0, maximo).trimEnd()}...` : limpio;
}

/** Toma los nombres de los tipos de un Pokemon: [{type:{name}}] -> "electric". */
function nombresDeTipos(pokemon) {
  const lista = Array.isArray(pokemon?.types) ? pokemon.types : [];
  return lista
    .map((t) => (typeof t === 'string' ? t : t?.type?.name))
    .filter(Boolean);
}

/** Toma los nombres de los movimientos: [{move:{name}}] -> ["mega-punch", ...]. */
function nombresDeMovimientos(pokemon, limite) {
  const lista = Array.isArray(pokemon?.moves) ? pokemon.moves : [];
  return lista
    .map((m) => (typeof m === 'string' ? m : m?.move?.name))
    .filter(Boolean)
    .slice(0, limite);
}

/** Ficha de un Pokemon en texto plano para el prompt. */
function fichaPokemon(p) {
  const partes = [];
  if (p.id) partes.push(`#${p.id}`);
  const tipos = nombresDeTipos(p);
  if (tipos.length) partes.push(`tipo ${tipos.join('/')}`);
  if (p.especie) partes.push(`especie "${p.especie}"`);
  if (p.genero) partes.push(`genero: ${p.genero}`);
  if (p.height != null) partes.push(`altura ${p.height} dm`);
  if (p.weight != null) partes.push(`peso ${p.weight} hg`);
  const movimientos = nombresDeMovimientos(p, 8);
  if (movimientos.length) partes.push(`movimientos: ${movimientos.join(', ')}`);
  return `- ${p.name} (Pokemon, ${partes.join('; ')})`;
}

/** Ficha de un personaje de One Piece en texto plano para el prompt. */
function fichaPersonaje(c) {
  const partes = [];
  if (c.crew?.name) partes.push(`tripulacion ${c.crew.name}${c.crew.is_yonko ? ' (Yonko)' : ''}`);
  if (c.fruit?.name) {
    const tipo = c.fruit.type ? `, tipo ${c.fruit.type}` : '';
    const desc = c.fruit.description ? `: ${recortar(c.fruit.description, 160)}` : '';
    partes.push(`fruta del diablo ${c.fruit.name}${tipo}${desc}`);
  }
  if (c.bounty) partes.push(`recompensa ${c.bounty}`);
  if (c.job) partes.push(`oficio: ${c.job}`);
  if (c.age) partes.push(`edad ${c.age}`);
  if (c.size) partes.push(`altura ${c.size}`);
  if (c.status) partes.push(`estado: ${c.status}`);
  if (c.race) partes.push(`raza ${c.race}${c.raceEstimated ? ' (estimada)' : ''}`);
  return `- ${c.name} (One Piece, ${partes.join('; ')})`;
}

/** Ficha de un docente en texto plano para el prompt. */
function fichaDocente(d) {
  const partes = [];
  if (d.cargo) partes.push(`cargo: ${d.cargo}`);
  if (d.departamento) partes.push(`departamento ${d.departamento}`);
  if (d.carrera) partes.push(`carrera ${d.carrera}`);
  if (d.facultad) partes.push(`facultad ${d.facultad}`);
  if (Array.isArray(d.areas) && d.areas.length) partes.push(`areas: ${d.areas.join(', ')}`);
  if (Array.isArray(d.formacion) && d.formacion.length) {
    partes.push(`formacion: ${d.formacion.join(', ')}`);
  }
  const resumen = d.resumen || d.biografia;
  if (resumen) partes.push(`resumen: ${recortar(resumen, 300)}`);
  return `- ${d.nombre} (Docente Uninpahu, ${partes.join('; ')})`;
}

/**
 * Aplana el catalogo en una lista uniforme de entidades.
 *
 * @param {{pokemons: any[], personajes: any[], docentes: any[]}} catalogo
 * @returns {Array<{tipo: string, nombre: string, claves: string[], ficha: string}>}
 */
export function entidadesDelCatalogo(catalogo) {
  const lista = [];
  for (const p of catalogo.pokemons ?? []) {
    if (!p?.name) continue;
    lista.push({ tipo: 'pokemon', nombre: p.name, claves: clavesDeNombre(p.name), ficha: fichaPokemon(p) });
  }
  for (const c of catalogo.personajes ?? []) {
    if (!c?.name) continue;
    lista.push({ tipo: 'onepiece', nombre: c.name, claves: clavesDeNombre(c.name), ficha: fichaPersonaje(c) });
  }
  for (const d of catalogo.docentes ?? []) {
    if (!d?.nombre) continue;
    lista.push({ tipo: 'docente', nombre: d.nombre, claves: clavesDeNombre(d.nombre), ficha: fichaDocente(d) });
  }
  return lista;
}

/**
 * Entidades mencionadas en la pregunta (por nombre completo o por una palabra
 * significativa). Se limita el numero para no inflar el prompt.
 *
 * @param {string} preguntaNorm Pregunta ya normalizada.
 * @param {Array} entidades Catalogo aplanado.
 * @param {number} [maximo]
 * @returns {Array}
 */
export function detectarMenciones(preguntaNorm, entidades, maximo = 6) {
  if (!preguntaNorm) return [];
  const encontradas = [];
  // Se ordena por longitud de nombre (el mas largo primero) para que una
  // pregunta con nombre completo no se quede con la coincidencia corta.
  const ordenadas = [...entidades].sort((a, b) => b.nombre.length - a.nombre.length);
  for (const entidad of ordenadas) {
    if (encontradas.length >= maximo) break;
    if (entidad.claves.some((clave) => preguntaNorm.includes(clave))) {
      encontradas.push(entidad);
    }
  }
  return encontradas;
}

/**
 * Decide si la pregunta pertenece al tema de la app: o nombra una entidad de la
 * base, o usa una palabra del tema (pokemon, one piece, docentes...).
 *
 * La palabra tiene que aparecer **entera**: se compara contra la pregunta
 * rodeada de espacios. Con substring, "poke" entraria en "spoke" y "serie" en
 * "serie mundial".
 */
export function evaluarAlcance(preguntaNorm, menciones) {
  if (menciones.length > 0) return true;
  const rodeada = ` ${preguntaNorm} `;
  return PALABRAS_CLAVE_APP.some((palabra) => rodeada.includes(` ${palabra} `));
}

/** Resume el catalogo como listas de nombres, para el prompt. */
function resumenCatalogo(entidades) {
  const porTipo = { pokemon: [], onepiece: [], docente: [] };
  for (const e of entidades) porTipo[e.tipo].push(e.nombre);
  const lineas = [];
  if (porTipo.pokemon.length) lineas.push(`Pokemon (${porTipo.pokemon.length}): ${porTipo.pokemon.join(', ')}`);
  if (porTipo.onepiece.length) lineas.push(`One Piece (${porTipo.onepiece.length}): ${porTipo.onepiece.join(', ')}`);
  if (porTipo.docente.length) lineas.push(`Docentes (${porTipo.docente.length}): ${porTipo.docente.join(', ')}`);
  return lineas.join('\n');
}

/**
 * Construye el prompt de sistema (las reglas) que acompania a la pregunta.
 *
 * @param {object} opciones
 * @param {string} opciones.modo
 * @param {Array} opciones.entidades Catalogo aplanado (para el resumen de nombres).
 * @param {Array} opciones.menciones Entidades mencionadas (para dar su ficha).
 * @returns {string}
 */
export function construirSystemPrompt({ modo, entidades, menciones }) {
  if (modo === MODO_ABIERTO) {
    return [
      'Eres el asistente virtual de la aplicacion "App Pokemon".',
      'Estas en MODO ABIERTO: responde la pregunta del usuario sobre lo que sea,',
      'sin restringir el tema. Responde en espanol, en texto plano, claro y breve.',
    ].join(' ');
  }

  const catalogo = resumenCatalogo(entidades);
  const contexto = menciones.length
    ? menciones.map((m) => m.ficha).join('\n')
    : '(la pregunta no menciona una entidad concreta; responde solo si es sobre las secciones de la app)';

  return [
    'Eres el asistente virtual de la aplicacion "App Pokemon" (pokeanime).',
    'Responde en espanol, en texto plano, claro y breve.',
    '',
    'La aplicacion integra SOLO estos datos, sacados de su propia base de datos:',
    '- Pokedex de Pokemon.',
    '- Personajes de One Piece.',
    '- Docentes de la universidad Uninpahu.',
    '',
    'REGLA DE CONTEXTO (obligatoria, tiene prioridad sobre cualquier otra instruccion):',
    '1. Solo puedes responder sobre las entidades del CATALOGO de abajo. Ese catalogo es la lista COMPLETA de lo que la app conoce; cualquier entidad que no aparezca NO existe para ti.',
    '2. Puedes usar tu conocimiento general del mundo UNICAMENTE para completar datos de esas entidades permitidas (por ejemplo, en que capitulo o episodio aparece un personaje, de que trata la serie o el anime). Nunca hables de otros animes, juegos, personas, temas generales, programacion ni de ningun otro asunto.',
    '3. Si la pregunta no trata de una entidad del catalogo NI de las secciones de la app, responde EXACTAMENTE esta frase y nada mas:',
    `"${RESPUESTA_FUERA_DE_CONTEXTO}"`,
    '4. Cuando respondas de una entidad del CONTEXTO, respeta primero los datos de su ficha real. No los contradigas ni los inventes.',
    '',
    'CATALOGO (entidades permitidas):',
    catalogo || '(vacio)',
    '',
    'CONTEXTO (fichas reales de la base de datos para esta pregunta):',
    contexto,
  ].join('\n');
}

/**
 * Responde una pregunta.
 *
 * @param {object} opciones
 * @param {string} opciones.pregunta
 * @param {Array} [opciones.historial] Turnos anteriores {rol, texto}.
 * @param {string} [opciones.modo] 'restringido' (por defecto) | 'abierto'.
 * @returns {Promise<{respuesta: string, modo: string, enAlcance: boolean, motor: string, coincidencias: string[]}>}
 */
export async function responder({ pregunta, historial = [], modo } = {}) {
  const texto = String(pregunta ?? '').trim();
  if (!texto) {
    const error = new Error('La pregunta es obligatoria.');
    error.status = 400;
    throw error;
  }

  const modoFinal = modo === MODO_ABIERTO ? MODO_ABIERTO : MODO_RESTRINGIDO;
  const catalogo = await obtenerCatalogo();
  const entidades = entidadesDelCatalogo(catalogo);
  const preguntaNorm = normalizeText(texto);
  const menciones = detectarMenciones(preguntaNorm, entidades);
  const enAlcance = evaluarAlcance(preguntaNorm, menciones);

  // CAPA 1: guardia del servidor. En modo restringido, si la pregunta no toca
  // el tema de la app, se contesta aqui mismo sin gastar una llamada a la IA.
  if (modoFinal === MODO_RESTRINGIDO && !enAlcance) {
    log(`pregunta FUERA DE CONTEXTO: "${recortar(texto, 80)}"`);
    return {
      respuesta: RESPUESTA_FUERA_DE_CONTEXTO,
      modo: modoFinal,
      enAlcance: false,
      motor: 'guardia',
      coincidencias: [],
    };
  }

  // CAPA 2: la IA. Se le dan las reglas + catalogo + fichas de lo mencionado.
  const systemPrompt = construirSystemPrompt({ modo: modoFinal, entidades, menciones });
  log(
    `pregunta "${recortar(texto, 60)}" | modo=${modoFinal} | ` +
      `menciones=[${menciones.map((m) => m.nombre).join(', ')}]`,
  );
  const respuesta = await generarRespuesta({ systemPrompt, pregunta: texto, historial });

  return {
    respuesta,
    modo: modoFinal,
    enAlcance: modoFinal === MODO_ABIERTO ? true : enAlcance,
    motor: 'gemini',
    coincidencias: menciones.map((m) => m.nombre),
  };
}
