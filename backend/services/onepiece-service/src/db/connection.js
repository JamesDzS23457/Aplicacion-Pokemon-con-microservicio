// ---------------------------------------------------------------------------
// POOL DE CONEXIONES A POSTGRESQL
//
// QUE CAMBIO RESPECTO A SQLITE (importante para entenderlo):
//
// Con SQLite (node:sqlite) abrias un archivo y todo era SINCRONO:
//     const fila = db.prepare('SELECT ...').get();   // ya tienes el resultado
//
// Postgres es un SERVIDOR REMOTO. Cada consulta es un viaje de ida y vuelta
// por la red, asi que es ASINCRONA y SIEMPRE necesita await:
//     const { rows } = await pool.query('SELECT ...');
//
// Eso obliga a que TODA la cadena sea async: repositories -> services ->
// routes. Si olvidas un await, la respuesta llega vacia sin ningun error
// visible, que es el fallo clasico al migrar de SQLite a Postgres.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Cada microservicio tiene SU PROPIA base de datos. Por eso se lee primero
// una variable especifica del servicio y se cae a DATABASE_URL solo como
// valor por defecto (util para scripts locales).
//
// El pool se crea AL IMPORTAR el modulo, no al arrancar, asi que las variables
// de entorno tienen que estar definidas ANTES de lanzar el proceso.
const CONNECTION_STRING =
  process.env.ONEPIECE_DATABASE_URL || process.env.DATABASE_URL;

// Falla pronto y con un mensaje claro, en lugar de dejar que `pg` lance un
// error de conexion mas adelante y mas dificil de entender.
if (!CONNECTION_STRING) {
  throw new Error(
    'Falta ONEPIECE_DATABASE_URL (o DATABASE_URL) en el entorno.',
  );
}

// ---------------------------------------------------------------------------
// SSL
//
// Supabase y la mayoria de hosters gestionados EXIGEN SSL y ademas usan un
// certificado propio, por eso se acepta sin verificar la cadena
// (rejectUnauthorized: false).
//
// Pero un Postgres local normal (Docker, Postgres instalado en la maquina)
// muchas veces NO tiene SSL configurado, y pedirlo falla con
// "The server does not support SSL connections".
//
// Por eso es configurable con la variable DATABASE_SSL:
//   DATABASE_SSL=false  -> Postgres local sin SSL
//   (por defecto)       -> SSL activado, que es lo que quiere Supabase
// ---------------------------------------------------------------------------
const useSsl = process.env.DATABASE_SSL !== 'false';

// rejectUnauthorized:false porque el certificado de Supabase es autofirmado
// y node lo rechazaria por defecto.
export const POOL = new pg.Pool({
  connectionString: CONNECTION_STRING,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10, // conexiones maximas simultaneas para este proceso
  idleTimeoutMillis: 30_000, // cierra conexiones ociosas tras 30s
});

/**
 * Ejecuta una consulta y devuelve sus filas.
 * Los parametros SIEMPRE van separados ($1, $2, ...) y nunca concatenados en
 * el texto: eso es lo que evita inyeccion SQL.
 */
export async function query(text, params = []) {
  const result = await POOL.query(text, params);
  return result.rows;
}

/** Igual que query(), pero devuelve solo la primera fila (o null). */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Crea las tablas si no existen. Se usa al arrancar el servicio para que
 * una base de datos vacia quede lista sin pasos manuales.
 * IF NOT EXISTS en todo el esquema lo hace idempotente.
 */
export async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await POOL.query(sql);
}

/** Cierra el pool. Necesario en los scripts que terminan (seed, verify). */
export async function closePool() {
  await POOL.end();
}