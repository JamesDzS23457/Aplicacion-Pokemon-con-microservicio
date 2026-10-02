// ---------------------------------------------------------------------------
// CAPA DE REGLAS DE NEGOCIO  (servicio de Pokemon)
//
// Mismo patron que onepiece-service. Ver el comentario ahi para el "por que".
// ---------------------------------------------------------------------------

import * as repo from '../repositories/pokemon.repository.js';
import { normalizeName } from '../lib/normalize.js';

export async function listPokemons() {
  const data = await repo.findAll();
  return { count: data.length, data };
}

export async function getPokemonById(id) {
  const pokemon = await repo.findById(Number(id));
  if (!pokemon) {
    const error = new Error('Pokemon no encontrado');
    error.status = 404;
    throw error;
  }
  return pokemon;
}

export async function searchPokemons(term) {
  const key = normalizeName(term);
  if (!key) {
    const error = new Error('El nombre del Pokemon es obligatorio');
    error.status = 400;
    throw error;
  }

  const results = await repo.search(key);
  if (results.length === 0) {
    const error = new Error('Pokemon no encontrado en la base de datos local');
    error.status = 404;
    throw error;
  }

  return results;
}