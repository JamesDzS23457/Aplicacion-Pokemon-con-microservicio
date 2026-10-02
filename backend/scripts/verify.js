// ---------------------------------------------------------------------------
// VERIFICACIONES
//
// Unica red de seguridad del backend: no hay tests ni CI. Se ejecuta a mano
// tras tocar la base de datos, el seed o las rutas.
//
//   node scripts/verify.js
//
// Comprueba lo que de verdad importa del enunciado del profesor:
// que hay 20 registros, que la busqueda funciona y que el limite de 20
// lo impone la base de datos y no el codigo.
// ---------------------------------------------------------------------------

import * as charactersRepo from '../services/onepiece-service/src/repositories/characters.repository.js';
import * as pokemonRepo from '../services/pokemon-service/src/repositories/pokemon.repository.js';
import { normalizeName } from '../services/onepiece-service/src/lib/normalize.js';
import { closePool as closeCharactersPool, ensureSchema as ensureCharactersSchema } from '../services/onepiece-service/src/db/connection.js';
import { closePool as closePokemonsPool, ensureSchema as ensurePokemonsSchema } from '../services/pokemon-service/src/db/connection.js';

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '  OK  ' : ' FALLA'} ${label}` +
      (ok ? '' : ` (esperado: ${expected}, obtenido: ${actual})`),
  );
}

await ensureCharactersSchema();
await ensurePokemonsSchema();

console.log('== 1. Las bases de datos tienen 20 registros ==');
check('onepiece', await charactersRepo.count(), 20);
check('pokemon', await pokemonRepo.count(), 20);

console.log('\n== 2. La busqueda es tolerante (sin llamar a la API externa) ==');
const luffy = await charactersRepo.search(normalizeName('luffy'));
check("buscar 'luffy' encuentra a Luffy", luffy[0]?.name, 'Monkey D Luffy');
check("buscar 'pikachu'", (await pokemonRepo.search(normalizeName('pikachu')))[0]?.name, 'pikachu');
check("buscar 'pika' (prefijo)", (await pokemonRepo.search(normalizeName('pika')))[0]?.name, 'pikachu');
check("buscar 'DON QUIJOTE DOFLAMINGO' (mayusculas)", (await charactersRepo.search('DON QUIJOTE DOFLAMINGO'))[0]?.name, 'Don Quijote Doflamingo');

console.log('\n== 3. El raceMap funciona con el nombre real de la API ==');
const chopper = (await charactersRepo.findAll()).find((c) => c.name === 'Tony-Tony Chopper');
check('raza de Tony-Tony Chopper', chopper?.race, 'Humano-Reno (fruta Zoan)');
check('no marcado como estimado', chopper?.raceEstimated, false);

console.log('\n== 4. El limite de 20 lo impone el motor ==');
// Se intenta insertar un id nuevo. Si el trigger funciona, Postgres lanza
// una excepcion y el INSERT no se produce.
let triggerOk = false;
try {
  await charactersRepo.upsert({
    id: 999999,
    name: 'Personaje De Prueba',
    size: null, age: null, bounty: null, job: null, status: null,
    crew_name: null, crew_is_yonko: false,
    fruit_name: null, fruit_type: null, fruit_description: null,
    image_url: null, race: 'Humano', race_estimated: true,
  });
} catch (error) {
  // Postgres reporta el error con el codigo 23514 (raise_exception) o  P0001.
  triggerOk =
    String(error.message).includes('20') ||
    String(error.message).includes('characters_max_20');
}
check('el trigger bloquea el registro 21', triggerOk, true);
check('siguen siendo 20', await charactersRepo.count(), 20);

console.log('\n== 5. Coherencia de datos ==');
const sample = (await charactersRepo.findAll())[0];
check('nombre presente', typeof sample?.name === 'string' && sample.name.length > 0, true);
check('raza presente', typeof sample?.race === 'string', true);
const pika = (await pokemonRepo.findAll()).find((p) => p.name === 'pikachu');
check('tipos de pikachu', Array.isArray(pika?.types) && pika.types.length > 0, true);
check('movimientos de pikachu', Array.isArray(pika?.moves) && pika.moves.length > 0, true);

await closeCharactersPool();
await closePokemonsPool();

console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} verificacion(es) fallaron.`);
process.exit(failures === 0 ? 0 : 1);