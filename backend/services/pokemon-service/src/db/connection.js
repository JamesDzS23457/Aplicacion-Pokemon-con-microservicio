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

// ---------------------------------------------------------------------------
// CARGA DEL .ENV LOCAL
//
// Este modulo lo importa CUALQUIER proceso que hable con la base: el servicio
// en si, scripts/seed.js y scripts/verify.js. Por eso es el sitio correcto para
// leer el .env de la raiz del proyecto: da igual como se lance el proceso
// (npm run backend, node src/index.js, node scripts/verify.js...).
//
// En produccion (Render) no existe ningun archivo .env: las variables llegan
// del entorno y esta funcion no hace nada. Por eso es seguro tenerla aqui.
// Se busca hacia arriba porque el comando puede correr desde la raiz o desde
// backend/. loadEnvFile NO pisa variables ya definidas en el entorno.
// ---------------------------------------------------------------------------
function buscarEnv(inicio) {
  let dir = inicio;
  for (let intento = 0; intento < 6; intento += 1) {
    const candidato = path.join(dir, '.env');
    if (fs.existsSync(candidato)) return candidato;
    const padre = path.dirname(dir);
    if (padre === dir) return null;
    dir = padre;
  }
  return null;
}

if (typeof process.loadEnvFile === 'function') {
  const envFile = buscarEnv(process.cwd());
  if (envFile) process.loadEnvFile(envFile);
}

// Base de datos PROPIA de este servicio. Se lee la variable especifica antes
// que la generica para que pokemon y onepiece nunca apunten al mismo sitio.
const CONNECTION_STRING =
  process.env.POKEMON_DATABASE_URL || process.env.DATABASE_URL;

// Si falta la URI NO se revienta al importar. Mismo criterio que
// onepiece-service: antes este modulo hacia `throw` aqui y el proceso moria
// ANTES de escuchar, Render marcaba el deploy como fallido en bucle y la unica
// salida era un `Manual Deploy`. Ahora el servicio arranca en modo degradado,
// `/health` responde 200 con `status: error` y el motivo, y las rutas de datos
// devuelven ese mismo motivo. El fallo cambia de superficie (log + HTTP) pero
// no se pierde: `query()` lo lanza cuando se usa.
export const ERROR_CONFIGURACION = CONNECTION_STRING
  ? null
  : 'Falta POKEMON_DATABASE_URL (o DATABASE_URL) en el entorno. Revisa Environment > tu servicio en Render.'

// Host de la base de datos, SIN usuario ni contrasena, solo para los logs de
// arranque. new URL() entiende "postgresql://..." y separa el host, asi que
// lo que se imprime nunca incluye credenciales.
//
// Sirve para responder de un vistazo a "contra que base estoy hablando":
// "localhost" = Postgres local; "aws-0-<region>.pooler.supabase.com" = Supabase.
export const DB_HOST = (() => {
  if (!CONNECTION_STRING) return 'sin-configurar';
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

export const POOL = CONNECTION_STRING
  ? new pg.Pool({
      connectionString: CONNECTION_STRING,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

export async function query(text, params = []) {
  if (!POOL) throw Object.assign(new Error(ERROR_CONFIGURACION), { status: 503 });
  const result = await POOL.query(text, params);
  return result.rows;
}

export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/** Crea las tablas si no existen. Idempotente. */
export async function ensureSchema() {
  if (!POOL) throw Object.assign(new Error(ERROR_CONFIGURACION), { status: 503 });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await POOL.query(sql);
}

export async function closePool() {
  if (POOL) await POOL.end();
}