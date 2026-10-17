// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA  (microservicio asistente-service, puerto 4004)
//
// Es el servicio de IA que pide la Actividad en Clase 13. Mantiene el mismo
// patron que los otros microservicios de la app (capas routes/ -> services/ ->
// repositories/ -> external/) y no tiene base de datos propia: su contexto sale
// de los otros microservicios, y su unica salida a internet es la IA publica
// (external/gemini.client.js).
//
// PUERTO 4004: cada microservicio tiene el suyo (pokemon 4001, onepiece 4002,
// docentes 4003). En Render NO se fija: la plataforma lo inyecta en PORT.
//
// DEGRADACION: sin GEMINI_API_KEY el proceso ARRANCA igual (no muere) y /health
// lo dice. Un deploy mal configurado no debe tumbar el servicio: el fallo se ve
// en /health y en el mensaje de la respuesta, no en "el deploy fallo".
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import asistenteRoutes from './routes/asistente.routes.js';
import { config, IA_CONFIGURADA } from './config.js';
import { swaggerSpec } from './swagger.js';
import { crearLog, ENTORNO } from './lib/log.js';

const app = express();
const log = crearLog('asistente-service');

app.use(cors());

// 64kb y no 10kb: el cuerpo lleva la pregunta MAS el historial de la
// conversacion. Un historial largo con texto no deberia llegar a 64kb, pero el
// tope da margen para una conversacion normal.
app.use(express.json({ limit: '64kb' }));

// Ninguna respuesta del asistente se puede cachear: depende de la pregunta.
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Salud]
 *     summary: Estado del servicio
 *     description: >
 *       Comprueba que el proceso vive y si la IA tiene clave configurada. No
 *       consulta la base de datos ni la IA (por eso responde rapido).
 *     responses:
 *       200:
 *         description: Servicio vivo.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 service: { type: string, example: asistente-service }
 *                 ia: { type: string, example: "configurada (gemini-3.5-flash-lite)" }
 */
app.get('/health', (_req, res) => {
  // 200 SIEMPRE: `healthCheckPath: /health` de Render reinicia la instancia ante
  // un no-200. El estado va DENTRO del cuerpo (misma decision que onepiece).
  res.json({
    status: IA_CONFIGURADA ? 'ok' : 'degradado',
    service: 'asistente-service',
    ia: IA_CONFIGURADA
      ? `configurada (${config.GEMINI_MODEL})`
      : 'sin configurar (falta GEMINI_API_KEY)',
  });
});

// Documentacion ANTES de las rutas de negocio: /docs y /openapi.json son rutas
// propias del servicio, no del recurso del asistente.
app.get('/openapi.json', (_req, res) => {
  res.json(swaggerSpec);
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'Asistente API' }));

app.use('/api/asistente', asistenteRoutes);

/** 404 global, despues de todos los routers. */
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

/**
 * Middleware de errores. Necesita los 4 parametros para que Express lo
 * reconozca.
 *
 * Diferencia con los otros servicios: aqui SI se expone el mensaje de los
 * errores con `status` (400, 502, 503, 504). Son los que produce la IA o la
 * lectura del catalogo, y el mensaje (por ejemplo "API key not valid" o "La IA
 * tardo demasiado en responder") es justo lo que el usuario necesita para
 * arreglarlo. Un error inesperado (sin status) sigue siendo un 500 generico.
 */
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.status ? err.message : 'Error interno del servidor';
  log(`${status}: ${err.message}`);
  res.status(status).json({ error: message || 'Error interno del servidor' });
});

if (!IA_CONFIGURADA) {
  log('ARRANQUE DEGRADADO: falta GEMINI_API_KEY; el asistente no podra responder.');
}

app.listen(config.PORT, '0.0.0.0', () => {
  log(`ENTORNO=${ENTORNO} | escuchando en :${config.PORT}`);
  log(`IA=${IA_CONFIGURADA ? config.GEMINI_MODEL : 'sin configurar'}`);
  log(`datos: pokemon=${config.POKEMON_SERVICE_URL} onepiece=${config.ONEPIECE_SERVICE_URL} docentes=${config.DOCENTES_SERVICE_URL}`);
  log(`documentacion en http://localhost:${config.PORT}/docs`);
});
