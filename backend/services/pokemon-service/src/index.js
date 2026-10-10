// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA  (microservicio pokemon-service, puerto 4001)
//
// Mismo patron que onepiece-service. Ver el comentario ahi para el orden de
// arranque (esquema antes de listen) y para el middleware de errores.
//
// Ademas, este servicio expone su documentacion:
//   GET /docs         -> Swagger UI (interfaz para probar la API)
//   GET /openapi.json -> el contrato OpenAPI en bruto
// Es un requisito del trabajo documentar el microservicio.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import pokemonRoutes from './routes/pokemon.routes.js';
import { ensureSchema, DB_HOST, ERROR_CONFIGURACION } from './db/connection.js';
import * as repo from './repositories/pokemon.repository.js';
import { crearLog, ENTORNO } from './lib/log.js';
import { swaggerSpec } from './swagger.js';

const app = express();
const log = crearLog('pokemon-service');

app.use(cors());
app.use(express.json({ limit: '10kb' }));

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Salud]
 *     summary: Estado del servicio
 *     description: Comprueba que el servicio responde y cuantos Pokemon hay en la base.
 *     responses:
 *       200:
 *         description: Servicio vivo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 service: { type: string, example: pokemon-service }
 *                 pokemons: { type: integer, example: 20 }
 *       500:
 *         description: La base de datos no responde.
 */
app.get('/health', async (_req, res) => {
  if (ERROR_CONFIGURACION) {
    return res.json({ status: 'error', service: 'pokemon-service', error: ERROR_CONFIGURACION });
  }
  try {
    const total = await repo.count();
    res.json({ status: 'ok', service: 'pokemon-service', pokemons: total });
  } catch (error) {
    // 200 a proposito: `healthCheckPath: /health` de Render reinicia la
    // instancia ante un no-200 y el servicio quedaria en bucle inalcanzable.
    // El codigo HTTP dice "el proceso vive", el estado de la base va dentro.
    log(`health: ${error.message}`);
    res.json({ status: 'error', service: 'pokemon-service', error: 'La base de datos no responde' });
  }
});

// Documentacion. Se monta ANTES de las rutas de negocio porque /docs y
// /openapi.json son rutas propias del servicio, no del recurso Pokemon.
// /openapi.json se expone aparte porque alguna herramienta (y el propio
// Swagger UI) consume el contrato en bruto.
app.get('/openapi.json', (_req, res) => {
  res.json(swaggerSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Pokemon API' }));

app.use('/api/pokemon', pokemonRoutes);

/** Middleware de errores. Necesita los 4 parametros para que Express lo reconozca. */
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Error interno del servidor' : err.message;
  // Punto unico para registrar errores: cubre los 4xx "normales" (400 sin
  // nombre, 404 no encontrado) y los 5xx. El mensaje interno se registra
  // completo aunque al cliente solo se le devuelva el generico en un 5xx.
  log(`${status}: ${err.message}`);
  res.status(status).json({ error: message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4001;

if (ERROR_CONFIGURACION) {
  log(`ARRANQUE DEGRADADO: ${ERROR_CONFIGURACION}`);
} else {
  try {
    await ensureSchema();
  } catch (error) {
    // No se muere el proceso: Supabase a veces da ETIMEDOUT en el primer
    // intento al pooler. Morir aqui = deploy fallido en Render = Manual Deploy.
    // Se arranca degradado y /health lo dice con status:error.
    log(`AVISO: la base no responde todavia: ${error.message}`);
  }
}

app.listen(PORT, '0.0.0.0', () => {
  // Deja claro, desde el arranque, en que entorno corre y contra que base
  // de datos habla. Es la primera cosa que se mira si una busqueda "no
  // encuentra nada": si ENTORNO=LOCAL, estas consultando tu Postgres local,
  // no Supabase.
  log(`ENTORNO=${ENTORNO} | BD=${DB_HOST} | escuchando en :${PORT}`);
  log(`documentacion en http://localhost:${PORT}/docs`);
});
