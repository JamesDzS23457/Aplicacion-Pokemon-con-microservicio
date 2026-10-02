// ---------------------------------------------------------------------------
// REPOSITORY DE PERSONAJES
//
// Esta es la UNICA capa del servicio que habla SQL. Por eso, cuando la base
// de datos cambio de SQLite a Postgres, TODOS los cambios se concentraron
// aqui (y en db/). Las demas capas no se enteraron.
//
// CAMBIOS DE SINTAXIS QUE HUBO QUE HACER:
//
//   SQLite                              Postgres
//   ----------------------------------  -----------------------------------
//   db.prepare(sql).all(params)          await pool.query(sql, params)
//   @nombre  (parametro con nombre)      $1, $2  (posicional, en orden)
//   datetime('now')                      NOW()
//   BOOLEAN como 0/1                     BOOLEAN de verdad
//   .get() devolvia una fila              await queryOne(...) -> fila o null
//
// Postgres NO admite parametros con nombre ($nombre), por eso el orden de
// los $1, $2 tiene que coincidir exactamente con el orden del array.
// ---------------------------------------------------------------------------

import { query, queryOne } from '../db/connection.js';
import { normalizeName } from '../lib/normalize.js';

// Columnas que se piden al SELECT. Se escribe una vez y se reutiliza en todas
// las consultas para no olvidarse de alguna.
const COLUMNS = `
  id, name, search_key, size, age, bounty, job, status,
  crew_name, crew_is_yonko, fruit_name, fruit_type,
  fruit_description, image_url, race, race_estimated
`;

// ---------------------------------------------------------------------------
// TRADUCCION FILA <-> OBJETO
//
// Postgres devuelve BOOLEAN como true/false de verdad, asi que ya no hace
// falta el === 1 que hacia falta con SQLite.
// Tambien reconstruye los objetos anidados (crew, fruit) que la API externa
// entregaba: la base guarda planos, la API entrega anidados.
// ---------------------------------------------------------------------------
function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    size: row.size,
    age: row.age,
    bounty: row.bounty,
    job: row.job,
    status: row.status,
    crew: row.crew_name
      ? { name: row.crew_name, is_yonko: row.crew_is_yonko }
      : null,
    fruit: row.fruit_name
      ? {
          name: row.fruit_name,
          type: row.fruit_type,
          description: row.fruit_description,
        }
      : null,
    image: row.image_url ?? null,
    race: row.race,
    raceEstimated: row.race_estimated,
  };
}

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------

/** Cuantos personajes hay guardados. Lo usa /health y el seed. */
export async function count() {
  const row = await queryOne('SELECT COUNT(*)::int AS n FROM characters');
  return row.n;
}

/** Los 20 personajes, ordenados por id. */
export async function findAll() {
  const rows = await query(`SELECT ${COLUMNS} FROM characters ORDER BY id`);
  return rows.map(mapRow);
}

/** Un personaje por su id. */
export async function findById(id) {
  const row = await queryOne(`SELECT ${COLUMNS} FROM characters WHERE id = $1`, [id]);
  return mapRow(row);
}

/**
 * BUSQUEDA TOLERANTE.
 *
 * Busca sobre search_key (ya normalizada), no sobre name. Por eso
 * 'luffy', 'LUFFY', 'monkey d luffy' y 'monkey d. luffy' encontraron lo mismo.
 *
 * Tambien busca dentro del nombre de la tripulacion (ILIKE = busqueda sin
 * distinguir mayusculas, exclusivo de Postgres), para que escribir
 * 'chapeau' encuentre a toda la crew del Sombrero de Paja.
 *
 * El ORDER BY usa CASE para priorizar: primero la coincidencia EXACTA, luego
 * la que empieza por el termino, luego la que solo lo contiene. Asi 'nami'
 * aparece antes que un personaje que solo tenga 'nami' en medio del nombre.
 */
export async function search(term) {
  const key = normalizeName(term);
  if (!key) return [];

  const rows = await query(
    `SELECT ${COLUMNS}
       FROM characters
      WHERE search_key = $1
         OR search_key LIKE $2
         OR search_key LIKE $3
         OR crew_name ILIKE $3
      ORDER BY
        CASE
          WHEN search_key = $1    THEN 0
          WHEN search_key LIKE $2 THEN 1
          ELSE 2
        END,
        name
      LIMIT 20`,
    [key, `${key}%`, `%${key}%`],
  );

  return rows.map(mapRow);
}

// ---------------------------------------------------------------------------
// UPSERT
//
// INSERT ... ON CONFLICT DO UPDATE = "si el id ya existe, actualizalo; si no,
// insertalo". Hace que el seed sea idempotente: se puede ejecutar N veces y
// siempre deja los mismos 20 registros, sin duplicar ni fallar.
//
// NOTA IMPORTANTE: el trigger del limite de 20 se dispara en el INSERT, pero
// permite reinsertar una fila que ya existe, asi que el seed nunca se bloquea
// a si mismo al reejecutarse.
// ---------------------------------------------------------------------------
export async function upsert(character) {
  await query(
    `INSERT INTO characters (
        id, name, search_key, size, age, bounty, job, status,
        crew_name, crew_is_yonko, fruit_name, fruit_type,
        fruit_description, image_url, race, race_estimated, updated_at
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        search_key = EXCLUDED.search_key,
        size = EXCLUDED.size,
        age = EXCLUDED.age,
        bounty = EXCLUDED.bounty,
        job = EXCLUDED.job,
        status = EXCLUDED.status,
        crew_name = EXCLUDED.crew_name,
        crew_is_yonko = EXCLUDED.crew_is_yonko,
        fruit_name = EXCLUDED.fruit_name,
        fruit_type = EXCLUDED.fruit_type,
        fruit_description = EXCLUDED.fruit_description,
        image_url = EXCLUDED.image_url,
        race = EXCLUDED.race,
        race_estimated = EXCLUDED.race_estimated,
        updated_at = NOW()`,
    [
      character.id,
      character.name,
      normalizeName(character.name),
      character.size ?? null,
      character.age ?? null,
      character.bounty ?? null,
      character.job ?? null,
      character.status ?? null,
      character.crew_name ?? null,
      character.crew_is_yonko ?? false,
      character.fruit_name ?? null,
      character.fruit_type ?? null,
      character.fruit_description ?? null,
      character.image_url ?? null,
      character.race ?? null,
      character.race_estimated ?? false,
    ],
  );
}

/** Borra todo. Solo lo usa el seed con --reset. */
export async function clear() {
  await query('DELETE FROM characters');
}