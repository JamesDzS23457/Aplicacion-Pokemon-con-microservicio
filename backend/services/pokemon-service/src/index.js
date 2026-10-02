// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA  (microservicio pokemon-service, puerto 4001)
//
// Mismo patron que onepiece-service. Ver el comentario ahi para el orden de
// arranque (esquema antes de listen) y para el middleware de errores.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import pokemonRoutes from './routes/pokemon.routes.js';
import { ensureSchema } from './db/connection.js';
import * as repo from './repositories/pokemon.repository.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10kb' }));

/** Healthcheck. Si la BD esta caida, responde 500 en vez de decir "ok". */
app.get('/health', async (_req, res, next) => {
  try {
    const total = await repo.count();
    res.json({ status: 'ok', service: 'pokemon-service', pokemons: total });
  } catch (error) {
    next(error);
  }
});

app.use('/api/pokemon', pokemonRoutes);

/** Middleware de errores. Necesita los 4 parametros para que Express lo reconozca. */
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? 'Error interno del servidor' : err.message;
  console.error(`[pokemon-service] ${status}:`, err.message);
  res.status(status).json({ error: message || 'Error interno del servidor' });
});

const PORT = process.env.PORT || 4001;

try {
  await ensureSchema();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`pokemon-service escuchando en :${PORT}`);
  });
} catch (error) {
  console.error('No se pudo iniciar pokemon-service:', error.message);
  console.error('Revisa DATABASE_URL en tu .env');
  process.exit(1);
}