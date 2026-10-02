// ---------------------------------------------------------------------------
// SEED DE POKEMON
//
// Igual que en One Piece: este es el unico punto que habla con PokeAPI.
//
// A diferencia de One Piece, aqui SI se consulta la API por cada Pokemon
// (cada uno tiene su propia ficha), asi que son 20 peticiones. Se hacen
// secuenciales a proposito: las APIs publicas no perdonan bien las
// peticiones en paralelo y acabarian devolviendo 429.
// ---------------------------------------------------------------------------

import * as repo from '../services/pokemon-service/src/repositories/pokemon.repository.js';
import { getPokemon } from '../services/pokemon-service/src/external/pokeapi.client.js';

// Los 20 Pokemon del seed.
//
// OJO: PokeAPI exige el sufijo -f o -m en nidoran porque el caracter
// no es URL-safe. Por eso esta 'nidoran-f' y no 'nidoran'.
export const POKEMON_SEED_NAMES = [
  'bulbasaur', 'ivysaur', 'venusaur', 'charmander', 'charmeleon',
  'charizard', 'squirtle', 'wartortle', 'blastoise', 'pikachu',
  'raichu', 'nidoran-f', 'nidorina', 'nidoqueen', 'clefairy',
  'clefable', 'vulpix', 'jigglypuff', 'gengar', 'lapras',
];

export async function seedPokemons() {
  let saved = 0;
  const missing = [];

  for (const name of POKEMON_SEED_NAMES) {
    try {
      const pokemon = await getPokemon(name);

      await repo.upsert({
        id: pokemon.id,
        name: pokemon.name,
        height: pokemon.height ?? null,
        weight: pokemon.weight ?? null,
        genero: pokemon.genero ?? null,
        especie: pokemon.especie ?? null,
        sprite_default: pokemon.sprites?.front_default ?? null,
        sprite_shiny: pokemon.sprites?.front_shiny ?? null,
        sprite_back_shiny: pokemon.sprites?.back_shiny ?? null,
        types: (pokemon.types ?? []).map((t) => ({ type: { name: t.type?.name } })),
        // Se guardan solo los nombres de los movimientos. Un Pokemon tiene
        // ~110, y guardar el objeto entero haria la fila enorme para algo
        // que la app unicamente muestra.
        moves: (pokemon.moves ?? []).map((m, i) => ({
          move: { name: m.move?.name },
          index: i,
        })),
      });

      saved += 1;
      console.log(`  + ${pokemon.name} (#${pokemon.id}) - ${pokemon.especie || 'sin especie'}`);
    } catch (error) {
      // Un Pokemon fallido no debe tumbar todo el seed.
      missing.push(name);
      console.warn(`  ! no se pudo guardar ${name}: ${error.message}`);
    }
  }

  return { saved, missing };
}