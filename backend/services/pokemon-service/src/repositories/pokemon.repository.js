// ---------------------------------------------------------------------------
// REPOSITORY DE POKEMON
//
// Unica capa que habla SQL. Mismo patron que onepiece-service; ver el
// comentario largo ahi para la explicacion de por que todo es async y de por
// que los parametros van separados ($1, $2).
//
// Particularidad de Pokemon: types y moves llegan de PokeAPI como arrays de
// objetos. Se guardan como TEXT con JSON en vez de crear tablas hijas, porque
// la app solo los LEE y los muestra; nunca los filtra ni los busca.
// ---------------------------------------------------------------------------

import { query, queryOne } from '../db/connection.js';
import { normalizeName } from '../lib/normalize.js';

const COLUMNS = `
  id, name, search_key, height, weight, genero, especie,
  sprite_default, sprite_shiny, sprite_back_shiny, types, moves
`;

// Convierte el JSON guardado en array. Si viniera corrupto, devuelve []
// en vez de romper toda la respuesta.
function parseJson(value) {
  if (!value) return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    height: row.height,
    weight: row.weight,
    genero: row.genero,
    especie: row.especie,
    sprites: {
      front_default: row.sprite_default ?? null,
      front_shiny: row.sprite_shiny ?? null,
      back_shiny: row.sprite_back_shiny ?? null,
    },
    types: parseJson(row.types),
    moves: parseJson(row.moves),
  };
}

export async function count() {
  const row = await queryOne('SELECT COUNT(*)::int AS n FROM pokemons');
  return row.n;
}

export async function findAll() {
  const rows = await query(`SELECT ${COLUMNS} FROM pokemons ORDER BY id`);
  return rows.map(mapRow);
}

export async function findById(id) {
  const row = await queryOne(`SELECT ${COLUMNS} FROM pokemons WHERE id = $1`, [id]);
  return mapRow(row);
}

/** Busqueda tolerante sobre search_key. Ver nota en el repo de One Piece. */
export async function search(term) {
  const key = normalizeName(term);
  if (!key) return [];

  const rows = await query(
    `SELECT ${COLUMNS}
       FROM pokemons
      WHERE search_key = $1
         OR search_key LIKE $2
         OR search_key LIKE $3
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

/** Upsert idempotente: reejecutar el seed no duplica ni falla. */
export async function upsert(pokemon) {
  await query(
    `INSERT INTO pokemons (
        id, name, search_key, height, weight, genero, especie,
        sprite_default, sprite_shiny, sprite_back_shiny, types, moves, updated_at
     ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        search_key = EXCLUDED.search_key,
        height = EXCLUDED.height,
        weight = EXCLUDED.weight,
        genero = EXCLUDED.genero,
        especie = EXCLUDED.especie,
        sprite_default = EXCLUDED.sprite_default,
        sprite_shiny = EXCLUDED.sprite_shiny,
        sprite_back_shiny = EXCLUDED.sprite_back_shiny,
        types = EXCLUDED.types,
        moves = EXCLUDED.moves,
        updated_at = NOW()`,
    [
      pokemon.id,
      pokemon.name,
      normalizeName(pokemon.name),
      pokemon.height ?? null,
      pokemon.weight ?? null,
      pokemon.genero ?? null,
      pokemon.especie ?? null,
      pokemon.sprite_default ?? null,
      pokemon.sprite_shiny ?? null,
      pokemon.sprite_back_shiny ?? null,
      JSON.stringify(pokemon.types ?? []),
      JSON.stringify(pokemon.moves ?? []),
    ],
  );
}

export async function clear() {
  await query('DELETE FROM pokemons');
}