// ---------------------------------------------------------------------------
// CAPA DE REGLAS DE NEGOCIO  (servicio de One Piece)
//
// Que hace y que NO hace:
//   - Valida entradas y decide el codigo de error (400 vs 404).
//   - NO sabe nada de SQL: pide datos al repository y no sabe si vienen de
//     SQLite, Postgres o de donde sea.
//   - NO conoce HTTP: no toca req ni res.
//
// Por que separarla del repository: permite cambiar de base de datos sin tocar
// esta capa, y permite testear las reglas sin levantar un servidor.
// ---------------------------------------------------------------------------

import * as repo from '../repositories/characters.repository.js';
import { normalizeName } from '../lib/normalize.js';

/** GET /api/characters -> devuelve los 20 personajes guardados. */
export async function listCharacters() {
  const data = await repo.findAll();
  return { count: data.length, data };
}

/**
 * GET /api/characters/:id
 * Lanza un error con status 404 si no existe; el route lo traduce a respuesta.
 */
export async function getCharacterById(id) {
  const character = await repo.findById(Number(id));
  if (!character) {
    const error = new Error('Personaje no encontrado');
    error.status = 404; // el middleware de errores lo lee de aqui
    throw error;
  }
  return character;
}

/**
 * POST /api/characters/search  { name }
 *
 * Dos validaciones distintas que se confunden fácil:
 *   - 400: el usuario no escribio nada. Es un error de quien llama.
 *   - 404: escribio algo, pero no esta en la base de datos local.
 */
export async function searchCharacters(term) {
  const key = normalizeName(term);
  if (!key) {
    const error = new Error('El nombre del personaje es obligatorio');
    error.status = 400;
    throw error;
  }

  const results = await repo.search(key);
  if (results.length === 0) {
    const error = new Error('Personaje no encontrado en la base de datos local');
    error.status = 404;
    throw error;
  }

  return results;
}