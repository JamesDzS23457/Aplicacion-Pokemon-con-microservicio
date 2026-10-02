// ---------------------------------------------------------------------------
// RUTAS DE PERSONAJES (gateway)
//
// Cada ruta tiene UNA linea de logica: construyen la peticion hacia el
// microservicio y devuelven lo que este respondeu.
//
// Que NO hagan aqui:
//   - validaciones (eso es del service del microservicio)
//   - consultas a la base de datos
//   - llamadas a las APIs externas
//
// Si se duplicara una regla entre gateway y microservicio, un cambio en uno
// dejaria al otro desactualizado y el fallo apareceria en produccion sin
// aviso. La regla vive en un solo sitio: el service del microservicio.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { proxy } from '../proxy.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/characters/search   body: { name: "luffy" }
 *
 * Busca en la base de datos LOCAL. No va a la API de One Piece: si ese
 * nombre no esta entre los 20 guardados, devuelve 404.
 */
router.post('/search', async (req, res) => {
  const result = await proxy(config.ONEPIECE_SERVICE_URL, '/api/characters/search', {
    method: 'POST',
    // Se reenvia solo el campo `name`: cualquier otra cosa que llegue en el
    // cuerpo se descarta y nunca llega al microservicio.
    body: { name: req.body?.name },
  });
  res.status(result.status).json(result.payload);
});

/** GET /api/characters -> lista los 20 personajes guardados. */
router.get('/', async (_req, res) => {
  const result = await proxy(config.ONEPIECE_SERVICE_URL, '/api/characters');
  res.status(result.status).json(result.payload);
});

/** GET /api/characters/:id -> un personaje concreto. */
router.get('/:id', async (req, res) => {
  const result = await proxy(
    config.ONEPIECE_SERVICE_URL,
    `/api/characters/${req.params.id}`,
  );
  res.status(result.status).json(result.payload);
});

export default router;