// ---------------------------------------------------------------------------
// GENERADOR DE DATOS.md
//
// Consulta los endpoints de listado del gateway (los mismos que usa la app) y
// escribe DATOS.md con el inventario actual de las dos bases. Asi el documento
// refleja lo que hay de verdad en Supabase y no hay que copiarlo a mano, que
// es justo como quedo desactualizado la primera vez.
//
// Uso:
//   GATEWAY_URL=https://gateway-wm3a.onrender.com node backend/scripts/generate-datos.js
//
// Si no se indica GATEWAY_URL, usa EXPO_PUBLIC_API_URL y, como ultimo recurso,
// el gateway local (http://localhost:3000).
// ---------------------------------------------------------------------------

import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Gateway a consultar. Se quita la barra final para no dejar "//api/...".
const GATEWAY_URL = (
  process.env.GATEWAY_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

const __dirname = dirname(fileURLToPath(import.meta.url));
const DESTINO = resolve(__dirname, '..', '..', 'DATOS.md');

/**
 * Pide un listado al gateway y devuelve solo el array de datos.
 * El gateway responde { count, data }, igual que los microservicios.
 */
async function traer(path) {
  const response = await fetch(`${GATEWAY_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} respondio ${response.status}`);
  }
  const payload = await response.json();
  return payload.data ?? [];
}

/**
 * Limpia un valor para meterlo en una celda de tabla Markdown: sin saltos de
 * linea (romperian la fila) y sin barras verticales (son el separador).
 */
function celda(value) {
  const text = value === undefined || value === null || value === '' ? '-' : String(value);
  return text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

/** Envuelve un nombre en un enlace a su imagen si existe; si no, lo deja plano. */
function enlace(nombre, url) {
  const etiqueta = celda(nombre);
  return url ? `[${etiqueta}](${url})` : etiqueta;
}

/** Seccion de personajes de One Piece. */
function tablaOnePiece(personajes) {
  const filas = personajes.map((c, i) => {
    const fruta = c.fruit?.name ?? '-';
    return `| ${i + 1} | ${celda(c.id)} | ${enlace(c.name, c.image)} | ${celda(c.crew?.name)} | ${celda(fruta)} | ${celda(c.race)} | ${celda(c.status)} |`;
  });
  return [
    `## Personajes de One Piece (${personajes.length})`,
    '',
    '| # | id | Nombre | Tripulación | Fruta | Raza | Estado |',
    '|---:|---:|---|---|---|---|---|',
    ...filas,
    '',
    'Retratos: `cdn.myanimelist.net` (Jikan / MyAnimeList), guardados en',
    '`image_url` durante el seed.',
  ].join('\n');
}

/** Seccion de Pokemon. */
function tablaPokemon(pokemons) {
  const filas = pokemons.map((p, i) => {
    const tipos = (p.types ?? [])
      .map((t) => t.type?.name)
      .filter(Boolean)
      .join(', ');
    const sprite = p.sprites?.front_default;
    return `| ${i + 1} | ${celda(p.id)} | ${enlace(p.name, sprite)} | ${celda(tipos)} | ${celda(p.genero)} | ${celda(p.especie)} |`;
  });
  return [
    `## Pokémon (${pokemons.length})`,
    '',
    '| # | id | Nombre | Tipos | Género | Especie |',
    '|---:|---:|---|---|---|---|',
    ...filas,
    '',
    'Retratos: `raw.githubusercontent.com` (PokeAPI sprites), guardados en',
    '`sprites.front_default` durante el seed.',
  ].join('\n');
}

async function main() {
  // Se piden los dos listados en paralelo para no encadenar dos esperas.
  const [personajes, pokemons] = await Promise.all([
    traer('/api/characters'),
    traer('/api/pokemon'),
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  const contenido = [
    '# Datos de las bases de datos',
    '',
    `Documento generado automáticamente desde las bases **desplegadas**`,
    `(consultadas a través del gateway \`${GATEWAY_URL}\`) el **${fecha}**.`,
    '',
    'Cada base guarda como máximo **20 registros**; el límite lo impone un',
    '*trigger* de PostgreSQL, no el código de la aplicación.',
    '',
    'En la columna **Nombre**, si hay retrato, el nombre enlaza a la imagen.',
    '',
    '---',
    '',
    tablaOnePiece(personajes),
    '',
    '---',
    '',
    tablaPokemon(pokemons),
    '',
  ].join('\n');

  await writeFile(DESTINO, contenido, 'utf8');
  console.log(`DATOS.md actualizado: ${personajes.length} personajes y ${pokemons.length} Pokemon.`);
}

main().catch((error) => {
  console.error('No se pudo generar DATOS.md:', error.message);
  process.exit(1);
});
