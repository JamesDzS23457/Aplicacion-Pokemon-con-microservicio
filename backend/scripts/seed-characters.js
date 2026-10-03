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
import { findCharacterImage } from '../services/onepiece-service/src/external/jikan.client.js';
import { getRace } from '../services/onepiece-service/src/external/raceMap.js';
import { normalizeName } from '../services/onepiece-service/src/lib/normalize.js';
// La API externa entrega tripulacion, oficio, estado y fruta en frances o
// ingles. Se traducen aqui, en el seed, para guardarlos en espanol en la BD.
import {
  translateAge,
  translateCrew,
  translateFruitName,
  translateFruitType,
  translateJob,
  translateStatus,
} from '../services/onepiece-service/src/lib/translations.js';

// Pausa entre personajes. Por cada uno se pide su detalle a api-onepiece.com.
// Las imagenes no suman peticiones por personaje: se bajan una sola vez de
// Jikan en un indice cacheado (ver external/jikan.client.js). Sin pausa
// serian 20 peticiones seguidas a api-onepiece.com y algunas APIs lo toman
// por abuso y responden 429. Con 150ms el seed entero aguanta educado y solo
// suma unos 3 segundos.
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    // La imagen se saca de Jikan/MyAnimeList porque la API de One Piece no la
    // trae (ver external/jikan.client.js). Puede devolver null: en ese caso
    // la ficha muestra el recuadro "OP", no un hueco roto.
    const image_url = await findCharacterImage(details.name);

    await repo.upsert({
      id: details.id,
      name: details.name,
      size: details.size ?? null,
      // age, job, status, crew y fruit se guardan YA traducidos al espanol
      // (ver lib/translations.js). La descripcion se deja tal cual: es un
      // texto largo y no se muestra en las pantallas principales.
      age: translateAge(details.age),
      bounty: details.bounty ?? null,
      job: translateJob(details.job),
      status: translateStatus(details.status),
      // crew y fruit vienen como objetos anidados; la BD los guarda planos.
      crew_name: translateCrew(details.crew?.name),
      crew_is_yonko: details.crew?.is_yonko ?? false,
      fruit_name: translateFruitName(details.fruit?.name),
      fruit_type: translateFruitType(details.fruit?.type),
      fruit_description: details.fruit?.description ?? null,
      image_url,
      race: race.race,
      race_estimated: race.estimated,
    });

    saved += 1;
    console.log(
      `  + ${details.name} (raza: ${race.race}${race.estimated ? ' [estimada]' : ''}${image_url ? ', con imagen' : ', SIN imagen'})`,
    );

    // Respiro para no saturar las APIs externas (ver comentario del helper).
    await sleep(150);
  }

  return { saved, missing };
}