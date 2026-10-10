// ---------------------------------------------------------------------------
// POOL DE CONEXIONES A POSTGRESQL  (servicio de docentes)
//
// Unica dependencia externa de este microservicio: el driver `pg`. Node no
// trae un cliente de PostgreSQL en su biblioteca estandar, asi que el driver es
// inevitable. Lo que el enunciado pide es no usar librerias de TERCEROS para
// montar el servidor HTTP (Express, Fastify, Koa...), y aqui no hay ninguna: el
// servicio se construye entero con `node:http`. Ver src/server.js.
//
// Este es el TERCER pool del proyecto y, como los otros dos, apunta a SU PROPIA
// base de datos (DOCENTES_DATABASE_URL). Si los tres apuntaran a la misma, los
// microservicios se pisarian entre si y perderian la independencia que
// justifica tenerlos separados.
//
// ---------------------------------------------------------------------------
// CARGA DEL .env LOCAL
//
// Este modulo lo importa CUALQUIER proceso que hable con la base: el servicio en
// si, el seed y verify.js. Por eso es el sitio correcto para leer el .env de la
// RAIZ del proyecto: da igual como se lance el proceso (`npm run backend`,
// `node src/index.js`, `node scripts/seed-docentes.js`...).
//
// En produccion (Render) no existe ningun archivo .env: las variables llegan del
// entorno y esta funcion no hace nada. Por eso es seguro tenerla aqui. Se busca
// hacia arriba porque el comando puede correr desde la raiz o desde backend/.
// loadEnvFile NO pisa variables ya definidas en el entorno.
// ---------------------------------------------------------------------------

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Busca el .env hacia arriba desde `inicio` (maximo 6 niveles). */
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
// que la generica para que docentes nunca apunte a la base de pokemon ni a la
// de onepiece.
const CONNECTION_STRING =
  process.env.DOCENTES_DATABASE_URL || process.env.DATABASE_URL;

// Si falta la URI NO se revienta al importar. Mismo criterio que
// onepiece-service: antes moria antes de escuchar y Render pedia Manual Deploy.
export const ERROR_CONFIGURACION = CONNECTION_STRING
  ? null
  : 'Falta DOCENTES_DATABASE_URL (o DATABASE_URL) en el entorno. Revisa Environment > tu servicio en Render.';

// Host de la base de datos, SIN usuario ni contrasena, solo para los logs de
// arranque. new URL() entiende "postgresql://..." y separa el host, asi que lo
// que se imprime nunca incluye credenciales.
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

// Supabase EXIGE SSL. Con DATABASE_SSL=false se conecta a un Postgres local
// (Docker) que no lo tenga; no hay que tocar nada mas.
const useSsl = process.env.DATABASE_SSL !== 'false';

export const POOL = CONNECTION_STRING
  ? new pg.Pool({
      connectionString: CONNECTION_STRING,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      max: 10,
      idleTimeoutMillis: 30_000,
    })
  : null;

/** Ejecuta una consulta y devuelve las filas. */
export async function query(text, params = []) {
  if (!POOL) throw Object.assign(new Error(ERROR_CONFIGURACION), { status: 503 });
  const result = await POOL.query(text, params);
  return result.rows;
}

/** Igual que query, pero devuelve la primera fila o null. */
export async function queryOne(text, params = []) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}

/**
 * Crea el esquema si no existe. Idempotente.
 *
 * Se ejecuta ANTES de escuchar, con el mismo criterio que pokemon-service: si
 * la tabla no esta, el servicio muere al arrancar en vez de devolver un 500 en
 * la primera peticion, que es mucho mas dificil de diagnosticar.
 */
export async function ensureSchema() {
  if (!POOL) throw Object.assign(new Error(ERROR_CONFIGURACION), { status: 503 });
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await POOL.query(sql);
}

/** Cierra el pool. Sin esto el proceso se queda vivo esperando conexiones. */
export async function closePool() {
  if (POOL) await POOL.end();
}