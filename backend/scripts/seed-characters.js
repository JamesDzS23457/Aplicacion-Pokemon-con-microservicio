// ---------------------------------------------------------------------------
// SEED DE PERSONAJES
//
// ESTE ES EL UNICO ARCHIVO DEL SERVICIO QUE CONSULTA LA API EXTERNA.
// Despues de correrlo, el sistema no necesita internet para responder: la
// base de datos local es la fuente de verdad y el resto del codigo nunca
// vuelve a salir a la red.
//
// La API de One Piece ignora el query param ?name= (siempre devuelve los 786
// personajes), asi que se descarga la lista UNA vez y se filtra en memoria
// sobre el nombre normalizado.
// ---------------------------------------------------------------------------

import * as repo from '../services/onepiece-service/src/repositories/characters.repository.js';
import * as client from '../services/onepiece-service/src/external/onepiece.client.js';
import { getRace } from '../services/onepiece-service/src/external/raceMap.js';
import { normalizeName } from '../services/onepiece-service/src/lib/normalize.js';

// Los 20 personajes que se guardan.
//
// OJO: estos nombres tienen que coincidir con los que devuelve la API, no con
// los nombres "correctos" en la vida real. Por eso hay rarezas como
// 'Trafalgar D. Water Law' (no 'Trafalgar Law') o 'Don Quijote Doflamingo'
// (no 'Donquixote'). La busqueda es normalizada, asi que acentos y
// puntuacion no importan.
export const CHARACTER_SEED_NAMES = [
  'Monkey D Luffy',
  'Roronoa Zoro',
  'Nami',
  'Usopp',
  'Sanji',
  'Tony-Tony Chopper',
  'Nico Robin',
  'Franky',
  'Brook',
  'Jinbe',
  'Trafalgar D. Water Law',
  'Portgas D Ace',
  'Sabo',
  'Shanks',
  'Boa Hancock',
  'Don Quijote Doflamingo',
  'Kaido',
  'Charlotte Linlin',
  'Crocodile',
  'Gol D. Roger',
];

export async function seedCharacters() {
  // 1. Descargar la lista completa una sola vez.
  const list = await client.listCharacters();

  // 2. Indexarla por nombre normalizado para buscar en O(1) en vez de recorrer
  //    los 786 con .find() por cada personaje.
  const byKey = new Map(list.map((item) => [normalizeName(item.name), item]));

  let saved = 0;
  const missing = [];

  // 3. Por cada nombre del seed, traer el detalle y guardarlo.
  for (const name of CHARACTER_SEED_NAMES) {
    const ref = byKey.get(normalizeName(name));
    if (!ref) {
      missing.push(name);
      console.warn(`  ! no encontrado en la API: ${name}`);
      continue;
    }

    const details = await client.getCharacterById(ref.id);
    const race = getRace(details.name);

    await repo.upsert({
      id: details.id,
      name: details.name,
      size: details.size ?? null,
      age: details.age ?? null,
      bounty: details.bounty ?? null,
      job: details.job ?? null,
      status: details.status ?? null,
      // crew y fruit vienen como objetos anidados; la BD los guarda planos.
      crew_name: details.crew?.name ?? null,
      crew_is_yonko: details.crew?.is_yonko ?? false,
      fruit_name: details.fruit?.name ?? null,
      fruit_type: details.fruit?.type ?? null,
      fruit_description: details.fruit?.description ?? null,
      // Sin imagen: Wikipedia devuelve 429 de forma sistematica, asi que
      // guardar un valor aleatorio seria peor que guardar null.
      image_url: null,
      race: race.race,
      race_estimated: race.estimated,
    });

    saved += 1;
    console.log(`  + ${details.name} (raza: ${race.race}${race.estimated ? ' [estimada]' : ''})`);
  }

  return { saved, missing };
}