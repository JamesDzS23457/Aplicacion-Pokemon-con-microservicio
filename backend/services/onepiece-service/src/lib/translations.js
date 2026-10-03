// ---------------------------------------------------------------------------
// TRADUCCION DE LOS DATOS DE ONE PIECE AL ESPANOL
//
// La API externa (api-onepiece.com) mezcla idiomas:
//   - La tripulacion, el oficio y el estado vienen en frances ("vivant") o en
//     ingles ("Captain").
//   - La edad trae el sufijo frances "ans".
//   - El tipo de fruta puede ser "Zoan Mythique".
//
// Este archivo es un mapa CURADO A MANO, igual que raceMap.js: la API no
// ofrece traducciones, asi que el texto se traduce UNA vez durante el seed y
// se guarda ya en espanol en la base de datos. Asi la app, la API propia y
// cualquier documento derivado (por ejemplo DATOS.md) leen el mismo idioma,
// y no hay que traducir nada en tiempo de busqueda.
//
// REGLA: si un valor no esta en el mapa, se devuelve TAL CUAL. Nunca se
// inventa ni se deja vacio: es preferible mostrar un texto sin traducir a
// perder el dato.
//
// Si se anaden personajes al seed, hay que anadir aqui sus valores nuevos.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// TRIPULACIONES
//
// Se usa el nombre canonico en espanol cuando existe y es reconocible, en
// lugar de una traduccion literal que sonaria rara. Ejemplos:
//   - "The Chapeau de Paille crew" (frances) = Sombrero de Paja.
//   - "The Hearth crew" es en realidad la tripulacion Heart de Law; la API la
//     escribe mal ("Hearth" en vez de "Heart"), se traduce al nombre real.
//   - "Le Roux crew" es la tripulacion de Shanks; "Le Roux" es solo un
//     miembro, por eso se usa el nombre canonico de la banda.
// ---------------------------------------------------------------------------
const CREW_ES = {
  'The Chapeau de Paille crew': 'Piratas del Sombrero de Paja',
  'The Hearth crew': 'Piratas Heart',
  'The Kuja Pirates crew': 'Piratas Kuja',
  'Le Roux crew': 'Piratas del Pelirrojo',
  "Big Mom's crew": 'Piratas de Big Mom',
  'The Hundred Beasts crew': 'Piratas de las Cien Bestias',
  'The Pirates Roger crew': 'Piratas de Roger',
  "Whitebeard's crew": 'Piratas de Barbablanca',
  "Don Quixote's crew": 'Piratas de Donquixote',
  'Armée Révolutionnaire': 'Ejército Revolucionario',
};

// ---------------------------------------------------------------------------
// OFICIOS (CARGO A BORDO)
// ---------------------------------------------------------------------------
const JOB_ES = {
  Captain: 'Capitán',
  'Right-hand man': 'Mano derecha',
  Navigator: 'Navegante',
  Sniper: 'Francotirador',
  Cook: 'Cocinero',
  Doctor: 'Médico',
  Archaeologist: 'Arqueólogo/a',
  Carpenter: 'Carpintero',
  Musician: 'Músico',
  Helmsman: 'Timonel',
  'Commander 2nd Ship': 'Comandante del 2.º barco',
  'Chief of Staff': 'Jefe de Estado Mayor',
};

// ---------------------------------------------------------------------------
// ESTADO
//
// "vivant" y "living" significan lo mismo ("vivo"): la API usa los dos. Se
// unifican al mismo texto para que la ficha no muestre dos estados distintos
// segun el personaje.
// ---------------------------------------------------------------------------
const STATUS_ES = {
  vivant: 'Vivo',
  living: 'Vivo',
  deceased: 'Fallecido',
};

// ---------------------------------------------------------------------------
// TIPO DE FRUTA
// ---------------------------------------------------------------------------
const FRUIT_TYPE_ES = {
  'Zoan Mythique': 'Zoan Mítica',
  Zoan: 'Zoan',
  Paramecia: 'Paramecia',
  Logia: 'Logia',
};

// ---------------------------------------------------------------------------
// NOMBRE DE LA FRUTA
//
// Se traduce la parte descriptiva y se conservan los nombres propios. No se
// inventan nombres japoneses que la API no da: solo se traduce lo que dice.
// ---------------------------------------------------------------------------
const FRUIT_NAME_ES = {
  'Hito Hito no Mi, Nika model': 'Fruta Hito Hito, modelo Nika',
  'Fruit of the Human': 'Fruta de la Humanidad',
  'Fruit Des Éclosions': 'Fruta de la Floración',
  'Fruit of the Resurrection': 'Fruta de la Resurrección',
  'Fruit of the Scalpel': 'Fruta del Escalpelo',
  'Passion fruit': 'Fruta de la Pasión',
  'Fruit of Souls': 'Fruta de las Almas',
  'Fruit of the Fish, Azure Dragon version': 'Fruta del Pez, modelo Dragón Azul',
  'Pyro-Fruit': 'Fruta Piro (Fuego)',
  'Fruit du Fil': 'Fruta del Hilo',
};

/**
 * Traduce un valor contra un diccionario.
 *
 * Devuelve null si no hay valor, y el texto ORIGINAL si no esta en el mapa.
 * Centralizar la logica aqui evita repetir el mismo "map[x] ?? x" en cada
 * traductor.
 */
function translate(map, value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return map[text] ?? text;
}

export const translateCrew = (value) => translate(CREW_ES, value);
export const translateJob = (value) => translate(JOB_ES, value);
export const translateStatus = (value) => translate(STATUS_ES, value);
export const translateFruitType = (value) => translate(FRUIT_TYPE_ES, value);
export const translateFruitName = (value) => translate(FRUIT_NAME_ES, value);

/**
 * La edad viene como "19 ans" (frances). Se cambia el sufijo por "años" y se
 * respeta cualquier otro formato ("años", "years", numeros sueltos).
 *
 * La expresion regular solo quita el sufijo al final, asi que un valor como
 * "Edad desconocida" se queda intacto en vez de vaciarse.
 */
export function translateAge(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.replace(/\s*(ans|years?)\s*$/i, ' años');
}
