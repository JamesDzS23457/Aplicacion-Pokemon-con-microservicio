// ---------------------------------------------------------------------------
// RUTAS DE POKEMON (gateway)
//
// Estructura identica a characters.routes.js. Cada ruta reenvia al
// microservicio de Pokemon y devuelve su respuesta tal cual.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { proxy } from '../proxy.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/pokemon/search   body: { name: "pikachu" }
 *
 * Busca entre los 20 Pokemon guardados. Acepta busquedas parciales: "pika"
 * encuentra "pikachu", porque el microservicio normaliza el texto antes de
 * comparar contra la columna search_key.
 */
router.post('/search', async (req, res) => {
  const result = await proxy(config.POKEMON_SERVICE_URL, '/api/pokemon/search', {
    method: 'POST',
    body: { name: req.body?.name },
  });
  res.status(result.status).json(result.payload);
});

/** GET /api/pokemon -> lista los 20 Pokemon guardados. */
router.get('/', async (_req, res) => {
  const result = await proxy(config.POKEMON_SERVICE_URL, '/api/pokemon');
  res.status(result.status).json(result.payload);
});

/** GET /api/pokemon/:id -> un Pokemon concreto. */
router.get('/:id', async (req, res) => {
  const result = await proxy(config.POKEMON_SERVICE_URL, `/api/pokemon/${req.params.id}`);
  res.status(result.status).json(result.payload);
});

export default router;