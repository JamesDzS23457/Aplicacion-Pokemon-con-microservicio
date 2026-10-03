// ---------------------------------------------------------------------------
// POOL DE CONEXIONES A POSTGRESQL  (servicio de Pokemon)
//
// Mismo patron que onepiece-service. Son dos microservicios independientes:
// cada uno tiene su PROPIO pool y su PROPIA base de datos (DATABASE_URL
// distinta). Si uno se cae, el otro sigue funcionando.
//
// Ver el comentario largo en onepiece-service/src/db/connection.js para la
// explicacion de por que todo es async y de por que los parametros van
// separados ($1, $2) en lugar de concatenados.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Base de datos PROPIA de este servicio. Se lee la variable especifica antes
// que la generica para que pokemon y onepiece nunca apunten al mismo sitio.
const CONNECTION_STRING =
  process.env.POKEMON_DATABASE_URL || process.env.DATABASE_URL;

if (!CONNECTION_STRING) {
  throw new Error(
    'Falta POKEMON_DATABASE_URL (o DATABASE_URL) en el entorno.',
  );
}

// Host de la base de datos, SIN usuario ni contrasena, solo para los logs de
// arranque. new URL() entiende "postgresql://..." y separa el host, asi que
// lo que se imprime nunca incluye credenciales.
//
// Sirve para responder de un vistazo a "contra que base estoy hablando":
// "localhost" = Postgres local; "aws-0-<region>.pooler.supabase.com" = Supabase.
export const DB_HOST = (() => {
  try {
    return new URL(CONNECTION_STRING).hostname;
  } catch {
    return 'desconocido';
  }
})();

// Ver la explicacion de SSL en onepiece-service/src/db/connection.js.
// Resumen: por defecto se pide SSL (lo que exige Supabase), pero con
// DATABASE_SSL=false se conecta a un Postgres local que no lo tenga.
const useSsl = process.env.DATABASE_SSL !== 'false';

export const POOL = new pg.Pool({
  connectionString: CONNECTION_STRING,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function query(text, params = []) {
  const result = await POOL.query(text, params);
  return result.rows;
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/** Crea las tablas si no existen. Idempotente. */
export async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await POOL.query(sql);
}

export async function closePool() {
  await POOL.end();
}