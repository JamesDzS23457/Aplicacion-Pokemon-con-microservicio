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

/**
 * Tabla de docentes.
 *
 * Los nombres NO enlazan a la foto aunque `foto_url` tenga valor: la foto es un
 * dato opcional y puede desaparecer (algunos CDN de fotos de perfil responden
 * 403 sin más aviso). Poner un enlace a una imagen que puede romperse en la
 * tabla del documento es peor que no ponerlo; la app ya dibuja iniciales cuando
 * no puede cargar la imagen.
 */
function tablaDocentes(docentes) {
  if (docentes.length === 0) {
    return '_La base de datos esta vacia._';
  }

  // El servicio devuelve `foto_url` en camelCase? No: este contrato usa el
  // mismo nombre que la columna (`foto_url`), a diferencia de One Piece, donde
  // si hay `image` / `raceEstimated`. Por eso aqui no hay que traducir nada.
  const filas = docentes.map((d, i) => {
    const numero = String(i + 1).padStart(2, '0');
    const campos = [
      numero,
      d.id,
      celda(d.nombre),
      celda(d.cargo),
      celda(d.carrera),
      celda(d.departamento),
      d.foto_url ? 'si' : 'no',
    ];
    return `| ${campos.join(' | ')} |`;
  });

  return [
    `## Docentes (${docentes.length})`,
    '',
    '| # | id | Nombre | Cargo | Carrera | Departamento | Foto |',
    '|---:|---:|---|---|---|---|---|',
    ...filas,
    '',
    'Cada docente tiene **dos textos distintos**, que es lo que exige la quinta',
    'pestaña: `resumen` (el breve, que va en la tarjeta, recortado a tres líneas)',
    'y `biografia` (el completo, que va en la ficha al pulsar «Leer más»).',
    '',
    'Esta tabla **no tiene API externa de origen**: se edita a mano en el Table',
    'Editor de Supabase (o con `npm run backend:seed:docentes`, que la reinicia a',
    'partir de `backend/scripts/docentes-datos.js`). Por eso el servicio tiene un',
    '*trigger* que recalcula `search_key`, `carrera_key` y `departamento_key` en cada',
    'inserción: si no, un docente escrito a mano sin esas columnas aparecería en el',
    'listado pero no se encontraría al buscarlo ni se podría filtrar.',
    '',
    '`foto_url` es **opcional**. Cuando falta, la app dibuja un avatar con las',
    'iniciales sobre el color de la facultad, así que la pantalla nunca se ve rota.',
  ].join('\n');
}


async function main() {
  // Se piden los dos listados en paralelo para no encadenar dos esperas.
  // Se piden los TRES listados en paralelo para no encadenar esperas. Los tres
  // van al gateway, que es la misma ruta que usa la app: si un docente se agrega
  // o se borra a mano en Supabase, sale aqui sin tocar el codigo.
  const [personajes, pokemons, docentes] = await Promise.all([
    traer('/api/characters'),
    traer('/api/pokemon'),
    traer('/api/docentes?limite=50'),
  ]);

  const fecha = new Date().toISOString().slice(0, 10);
  const contenido = [
    '# Datos de las bases de datos',
    '',
    // "desplegadas" solo si se consultedo un gateway en internet. Con el local
    // (que es lo normal al developing) decir "desplegadas" seria mentir.
    `Documento generado automáticamente desde las bases ${
      /localhost|127\.0\.0\.1/.test(GATEWAY_URL) ? '**locales**' : '**desplegadas**'
    }`,
    `(consultadas a través del gateway \`${GATEWAY_URL}\`) el **${fecha}**.`,
    '',
    'Pokémon y docentes guardan como máximo **20 registros** cada una, y el',
    'límite lo impone un *trigger* de PostgreSQL, no el código. One Piece también',
    'tiene 20, pero **su límite no es un trigger**: MongoDB no tiene triggers, así',
    'que se comprueba en el repositorio antes de insertar un documento nuevo (un',
    'id que ya existe sí se puede reescribir, para que el seed sea idempotente).',
    '',
    'Las tres bases son de motor distinto: Pokémon y docentes en **PostgreSQL**',
    '(Supabase) y One Piece en **MongoDB** (Atlas).',
    '',
    'La tabla de docentes no está llena: contiene las personas autorizadas, que',
    'pueden ser menos de 20, y cambia cuando alguien la edita a mano.',
    '',
    'En las dos primeras tablas, si hay retrato, el nombre enlaza a la imagen. En',
    'la de docentes **no**: `foto_url` es opcional y el enlace se rompería en',
    'cuanto ese CDN dejara de servirla.',
    '',
    '---',
    '',
    tablaOnePiece(personajes),
    '',
    '---',
    '',
    tablaPokemon(pokemons),
    '',
    '---',
    '',
    tablaDocentes(docentes),
    '',
  ].join('\n');

  await writeFile(DESTINO, contenido, 'utf8');
  console.log(`DATOS.md actualizado: ${personajes.length} personajes, ${pokemons.length} Pokemon y ${docentes.length} docentes.`);
}

main().catch((error) => {
  console.error('No se pudo generar DATOS.md:', error.message);
  process.exit(1);
});
