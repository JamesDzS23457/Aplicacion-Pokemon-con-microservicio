// ---------------------------------------------------------------------------
// VERIFICACIONES
//
// Unica red de seguridad del backend: no hay tests ni CI. Se ejecuta a mano
// tras tocar la base de datos, el seed o las rutas.
//
//   node scripts/verify.js
//
// Comprueba lo que de verdad importa del enunciado del profesor: que hay 20
// registros, que la busqueda funciona y que el limite de 20 lo impone la base
// de datos y no el codigo.
//
// NOTA DE ARQUITECTURA: este script NO habla con el microservicio de One Piece
// (que ya no es Node), sino DIRECTAMENTE con su base de datos PostgreSQL. Asi
// sigue funcionando sin levantar el servicio Python, y ademas comprueba la
// tabla real, no lo que devuelve una capa por encima.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import * as pokemonRepo from '../services/pokemon-service/src/repositories/pokemon.repository.js';
import { normalizeName } from '../services/pokemon-service/src/lib/normalize.js';
import {
  ensureSchema as ensurePokemonsSchema,
  closePool as closePokemonsPool,
} from '../services/pokemon-service/src/db/connection.js';

// ---------------------------------------------------------------------------
// CONEXION DIRECTA A LA BASE DE ONE PIECE
//
// Se crea un pool propio (no se importa el del servicio Python, que es otro
// lenguaje). El trigger del limite de 20 SI vive en esta base, asi que solo
// consultandola de verdad se puede comprobar.
//
// POR QUE createRequire:
// `pg` no es dependencia de backend/ (la carpeta scripts/ no tiene node_modules
// propio): la instala pokemon-service. En vez de duplicar la dependencia, este
// require se ancla al package.json de pokemon-service, de modo que Node
// resuelve el MISMO `pg` que usa el servicio. Ademas, si esa carpeta no
// existiera, este script ya fallaria antes al importar el repository.
// ---------------------------------------------------------------------------
const require = createRequire(
  new URL('../services/pokemon-service/package.json', import.meta.url),
);
const pg = require('pg');

const ONEPIECE_URL = process.env.ONEPIECE_DATABASE_URL || process.env.DATABASE_URL;
if (!ONEPIECE_URL) {
  console.error('Falta ONEPIECE_DATABASE_URL (o DATABASE_URL) para verificar One Piece.');
  process.exit(1);
}

const useSsl = process.env.DATABASE_SSL !== 'false';
const charactersPool = new pg.Pool({
  connectionString: ONEPIECE_URL,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 4,
});

/** Ejecuta SQL contra la base de One Piece y devuelve las filas. */
async function charactersQuery(text, params = []) {
  const { rows } = await charactersPool.query(text, params);
  return rows;
}

/**
 * Replica la consulta de busqueda del servicio Python.
 *
 * Se escribe aqui (en vez de llamar al microservicio) para que verify siga
 * siendo autonomo y para comprobar el SQL real: exacto, por prefijo y por
 * contenido. El ORDER BY prioriza igual que el repository.
 */
async function searchCharacters(term) {
  const key = normalizeName(term);
  if (!key) return [];
  return charactersQuery(
    `SELECT name FROM characters
      WHERE search_key = $1 OR search_key LIKE $2 OR search_key LIKE $3
      ORDER BY
        CASE WHEN search_key = $1 THEN 0 WHEN search_key LIKE $2 THEN 1 ELSE 2 END,
        name
      LIMIT 20`,
    [key, `${key}%`, `%${key}%`],
  );
}

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '  OK  ' : ' FALLA'} ${label}` +
      (ok ? '' : ` (esperado: ${expected}, obtenido: ${actual})`),
  );
}

// Se asegura el esquema en ambas bases antes de comprobar. Para One Piece se
// reutiliza el schema.sql del servicio Python, que es la fuente de verdad.
await ensurePokemonsSchema();
const charactersSchema = readFileSync(
  new URL('../services/onepiece-service/src/db/schema.sql', import.meta.url),
  'utf8',
);
await charactersQuery(charactersSchema);

console.log('== 1. Las bases de datos tienen 20 registros ==');
check('onepiece', (await charactersQuery('SELECT COUNT(*)::int AS n FROM characters'))[0].n, 20);
check('pokemon', await pokemonRepo.count(), 20);

console.log('\n== 2. La busqueda es tolerante (sin llamar a la API externa) ==');
check("buscar 'luffy' encuentra a Luffy", (await searchCharacters('luffy'))[0]?.name, 'Monkey D Luffy');
check("buscar 'pikachu'", (await pokemonRepo.search(normalizeName('pikachu')))[0]?.name, 'pikachu');
check("buscar 'pika' (prefijo)", (await pokemonRepo.search(normalizeName('pika')))[0]?.name, 'pikachu');
check(
  'buscar mayusculas normaliza',
  (await searchCharacters('DON QUIJOTE DOFLAMINGO'))[0]?.name,
  'Don Quijote Doflamingo',
);

console.log('\n== 3. El mapa de razas funciona con el nombre real de la API ==');
const chopper = (
  await charactersQuery(
    "SELECT race, race_estimated FROM characters WHERE name = 'Tony-Tony Chopper'",
  )
)[0];
check('raza de Tony-Tony Chopper', chopper?.race, 'Humano-Reno (fruta Zoan)');
check('no marcado como estimado', chopper?.race_estimated, false);

console.log('\n== 4. El limite de 20 lo impone el motor ==');
// Se intenta insertar un id nuevo con el minimo de columnas obligatorias. Si el
// trigger funciona, PostgreSQL lanza una excepcion y el INSERT no se produce.
let triggerOk = false;
try {
  await charactersQuery(
    "INSERT INTO characters (id, name, search_key) VALUES (999999, 'Personaje De Prueba', 'personajedeprueba')",
  );
} catch (error) {
  triggerOk =
    String(error.message).includes('20') ||
    String(error.message).includes('characters_max_20');
}
check('el trigger bloquea el registro 21', triggerOk, true);
check('siguen siendo 20', (await charactersQuery('SELECT COUNT(*)::int AS n FROM characters'))[0].n, 20);

console.log('\n== 5. Coherencia de datos ==');
const sample = (await charactersQuery('SELECT name, race FROM characters ORDER BY id LIMIT 1'))[0];
check('nombre presente', typeof sample?.name === 'string' && sample.name.length > 0, true);
check('raza presente', typeof sample?.race === 'string', true);
const pika = (await pokemonRepo.findAll()).find((p) => p.name === 'pikachu');
check('tipos de pikachu', Array.isArray(pika?.types) && pika.types.length > 0, true);
check('movimientos de pikachu', Array.isArray(pika?.moves) && pika.moves.length > 0, true);

await charactersPool.end();
await closePokemonsPool();

console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} verificacion(es) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
