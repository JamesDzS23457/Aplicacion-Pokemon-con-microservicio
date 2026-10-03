// ---------------------------------------------------------------------------
// SEED DE POKEMON  (script Node)
//
// Carga los 20 Pokemon desde PokeAPI. Es UNO de los dos seeds del proyecto: el
// de One Piece vive en Python (services/onepiece-service/seed.py) porque su
// microservicio esta escrito en Python. El comando `npm run backend:seed`
// ejecuta los dos seguidos.
//
// Es idempotente: se puede ejecutar N veces sin duplicar filas, porque el
// repository hace upsert por id en lugar de INSERT.
//
//   node scripts/seed.js
// ---------------------------------------------------------------------------

import { seedPokemons } from './seed-pokemon.js';
import * as pokemonRepo from '../services/pokemon-service/src/repositories/pokemon.repository.js';
import {
  ensureSchema as ensurePokemonsSchema,
  closePool as closePokemonsPool,
} from '../services/pokemon-service/src/db/connection.js';

// Crea la tabla antes de insertar. Asi el resultado del seed queda
// autocontenido y facil de leer en una defensa.
await ensurePokemonsSchema();

console.log('== Cargando Pokemon ==');
const pokemons = await seedPokemons();

console.log('\n== Resumen ==');
console.log(`pokemon: ${await pokemonRepo.count()} pokemon`);

if (pokemons.missing.length > 0) {
  console.warn(`\n${pokemons.missing.length} no se pudieron cargar: ${pokemons.missing.join(', ')}`);
}

// Si la base quedo vacia, algo fallo de verdad: salir con codigo 1 para que un
// pipeline o un deploy se entere, en lugar de "terminar bien" con 0 filas.
if ((await pokemonRepo.count()) === 0) {
  console.error('\nEl seed fallo: la base de datos de Pokemon quedo vacia.');
  await closePokemonsPool();
  process.exit(1);
}

// Cerrar el pool: sin esto el proceso se queda vivo esperando conexiones.
await closePokemonsPool();

console.log('\nListo. El servicio de Pokemon ya no necesita internet para responder.');
