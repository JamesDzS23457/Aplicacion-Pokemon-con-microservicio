// ---------------------------------------------------------------------------
// SCRIPT DE CARGA DE DATOS
//
// Es el UNICO script del proyecto que consulta las APIs externas.
// Despues de ejecutarlo, el backend funciona 100% con la base de datos local
// y se puede desconectar internet (ver scripts/test-offline.sh).
//
//   node scripts/seed.js
//
// Es idempotente: se puede ejecutar N veces sin duplicar filas, porque los
// repositories hacen upsert por id en lugar de INSERT.
// ---------------------------------------------------------------------------

import { seedCharacters } from './seed-characters.js';
import { seedPokemons } from './seed-pokemon.js';
import * as charactersRepo from '../services/onepiece-service/src/repositories/characters.repository.js';
import * as pokemonRepo from '../services/pokemon-service/src/repositories/pokemon.repository.js';

// Crea las tablas antes de insertar. Por seguridad se podria hacer al
// arrancar cada servicio, pero hacerlo aqui deja el resultado del seed
// autocontenido y mas facil de leer en una defensa.
import { ensureSchema as ensureCharactersSchema, closePool as closeCharactersPool } from '../services/onepiece-service/src/db/connection.js';
import { ensureSchema as ensurePokemonsSchema, closePool as closePokemonsPool } from '../services/pokemon-service/src/db/connection.js';

// Los dos servicios usan la MISMA variable DATABASE_URL (segun la que
// exportes en la shell), pero en produccion cada uno tiene la suya.
await ensureCharactersSchema();
await ensurePokemonsSchema();

console.log('== Cargando One Piece ==');
const characters = await seedCharacters();

console.log('\n== Cargando Pokemon ==');
const pokemons = await seedPokemons();

console.log('\n== Resumen ==');
console.log(`onepiece: ${await charactersRepo.count()} personajes`);
console.log(`pokemon:  ${await pokemonRepo.count()} pokemon`);

const missing = [...characters.missing, ...pokemons.missing];
if (missing.length > 0) {
  console.warn(`\n${missing.length} no se pudieron cargar: ${missing.join(', ')}`);
}

// Si alguna base quedo vacia, algo fallo de verdad: salir con codigo 1 para
// que un pipeline o un deploy se entere, en lugar de "terminar bien" con 0
// filas y que el fallo se descubra mas tarde.
if ((await charactersRepo.count()) === 0 || (await pokemonRepo.count()) === 0) {
  console.error('\nEl seed fallo: alguna base de datos quedo vacia.');
  await closeCharactersPool();
  await closePokemonsPool();
  process.exit(1);
}

// Cerrar los pools: sin esto el proceso se queda vivo esperando conexiones.
await closeCharactersPool();
await closePokemonsPool();

console.log('\nListo. El backend ya no necesita internet para responder.');