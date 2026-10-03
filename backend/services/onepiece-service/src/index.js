// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA  (microservicio onepiece-service, puerto 4002)
//
// Orden de arranque, importante:
//
//   1. ensureSchema()  -> crea las tablas si no existen (idempotente).
//                         Se hace ANTES de listen() a proposito: asi el
//                         servicio no acepta peticiones hasta que la base
//                         de datos esta lista. Si fuera al reves, un cliente
//                         podria recibir un 500 en los primeros milisegundos.
//   2. listen()        -> empieza a aceptar peticiones.
//
// Cada microservicio tiene SU PROPIA base de datos (DATABASE_URL distinta).
// Son independientes de verdad: si esta base cae, Pokemon sigue funcionando.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import charactersRoutes from './routes/characters.routes.js';
import { ensureSchema, DB_HOST } from './db/connection.js';
import * as repo from './repositories/characters.repository.js';
import { crearLog, ENTORNO } from './lib/log.js';

const app = express();
const log = crearLog('onepiece-service');

app.use(cors());
app.use(express.json({ limit: '10kb' }));

/**
 * Healthcheck. Lo usa Render para saber si el servicio esta vivo.
 * Incluye el conteo porque un servicio que responde pero tiene 0 personajes
 * es un servicio "sano pero inservible", y conviene poder detectarlo.
 */
app.get('/health', async (_req, res, next) => {
  try {
    const total = await repo.count();
    res.json({ status: 'ok', service: 'onepiece-service', characters: total });
  } catch (error) {
    next(error);
  }
});

app.use('/api/characters', charactersRoutes);

/**
 * Middleware de errores. Va SIEMPRE al final y necesita 4 parametros: Express
 * lo reconoce como manejador de errores solo si tiene los cuatro.
 *
 * Los errores con status >= 500 son inesperados (BD caida, bug), asi que se
 * oculta el detalle para no filtrar informacion. Los 4xx si son mensajes
 * pensados para el usuario final y se muestran tal cual.
 */
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Error interno del servidor' : err.message;
  // Punto unico para registrar errores: cubre los 4xx "normales" (400 sin
  // nombre, 404 no encontrado) y los 5xx. El mensaje interno se registra
  // completo aunque al cliente solo se le devuelva el generico en un 5xx.
  log(`${status}: ${err.message}`);
  res.status(status).json({ error: message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4002;

try {
  await ensureSchema();
  app.listen(PORT, '0.0.0.0', () => {
    // Deja claro, desde el arranque, en que entorno corre y contra que base
    // de datos habla. Es lo primero que se mira si una busqueda "no encuentra
    // nada": si ENTORNO=LOCAL, estas consultando tu Postgres local, no Supabase.
    log(`ENTORNO=${ENTORNO} | BD=${DB_HOST} | escuchando en :${PORT}`);
  });
} catch (error) {
  log(`no se pudo iniciar: ${error.message}`);
  log('Revisa ONEPIECE_DATABASE_URL en tu .env');
  process.exit(1);
}