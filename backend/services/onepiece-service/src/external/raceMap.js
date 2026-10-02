// ---------------------------------------------------------------------------
// MAPA DE RAZAS
//
// ESTE DATO NO EXISTE EN LA API DE ONE PIECE.
//
// La API devuelve nombre, talla, edad, recompensa, fruta y tripulacion, pero
// NO tiene ningun campo "raza" o "especie". Asi que este mapa es dato curado
// a mano: informacion externa al sistema.
//
// El bug que hadia este archivo antes: las claves se comparaban contra el
// nombre CRUDO de la API. El mapa tenia 'tony tony chopper' (sin guiones) pero
// la API devuelve 'Tony-Tony Chopper' (con guiones), asi que nunca coincidian
// y el resultado era "Humano" con raceEstimated: true.
//
// LA CAUSA RAIZ era no normalizar, no el mapa. Por eso ahora la clave se
// busca con normalizeName(): minusculas, sin acentos, sin puntuacion y
// cortando el sufijo "/ Alias". Asi todas estas entradas apuntan al mismo
// personaje:
//     'Tony-Tony Chopper'  'tony tony chopper'  'TONY TONY CHOPPER'
//
// Si se anaden mas personajes, la clave DEBE escribirse ya normalizada:
// sin espacios, sin guiones, sin acentos, y sin la parte tras "/ ".
// ---------------------------------------------------------------------------

import { normalizeName } from '../lib/normalize.js';

// Personajes que SI son humanas.
const HUMANO = 'Humano';

const RACE_MAP = {
  // Tripulacion del Sombrero de Paja
  monkeydluffy: HUMANO,
  roronoazoro: HUMANO,
  nami: HUMANO,
  usopp: HUMANO,
  sanji: HUMANO,
  // Chopper es humano con una fruta Zoan que le da forma de reno.
  tonytonychopper: 'Humano-Reno (fruta Zoan)',
  nicorobin: HUMANO,
  franky: 'Cyborg (humano modificado)',
  // Brook es un esqueleto con una fruta que le permite revivir.
  brook: 'Esqueleto (fruta Yomi Yomi)',
  // Jinbe es un fishman: humano con sangre de pez.
  jinbe: 'Pez-hombre (Fishman)',

  // Otros grupos
  trafalgarwaterlaw: HUMANO,
  portgasdace: HUMANO,
  sabo: HUMANO,
  shanks: HUMANO,
  boahancock: HUMANO,
  donquijotedoflamingo: HUMANO,
  // Kaido es humano con una fruta Zoan mitica. OJO: antes este mapa decia
  // "Pez dragon", lo cual era incorrecto: Kaido es humano.
  kaido: 'Humano (fruta Zoan mitica)',
  charlottelinlin: 'Humano-Gigante',
  charlottelinlinbigmom: 'Humano-Gigante',
  crocodile: HUMANO,
  goldroger: HUMANO,
  silversrayleigh: HUMANO,
  eustasskidd: HUMANO,
  marshalldteach: HUMANO,

  // Fishmen
  arlong: 'Pez-hombre (Fishman)',

  // Mink (tribu de la isla Kumanoti)
  inuarashi: 'Mink',
  nekomamushi: 'Mink',
  carrot: 'Mink',

  // Familia Kuja
  reiju: HUMANO,
};

/**
 * Devuelve la raza de un personaje.
 *
 * Si no esta en el mapa, cae en "Humano" MARCADO COMO ESTIMADO. No se
 * devuelve null ni se lanza un error, porque casi todos los personajes de
 * One Piece son humanos y asi la UI siempre tiene algo que mostrar.
 *
 * El flag raceEstimated viaja hasta el frontend precisamente para que se
 * pueda distinguir un dato curado de un valor por defecto.
 */
export function getRace(name) {
  const found = RACE_MAP[normalizeName(name)];
  return found
    ? { race: found, estimated: false }
    : { race: HUMANO, estimated: true };
}