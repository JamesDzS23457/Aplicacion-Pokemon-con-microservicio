// ---------------------------------------------------------------------------
// CAPA HTTP  (servicio de One Piece)
//
// Responsabilidad unica: traducir HTTP <-> funciones del service.
// No hay logica de negocio aqui ni SQL.
//
// El unico detalle no obvio es el try/catch: el service lanza errores con
// `error.status` y este route los pasa a next(error). El middleware de errores
// del final de index.js es quien construye la respuesta. Asi los errores se
// manejan en un solo sitio.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as service from '../services/characters.service.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listCharacters());
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const results = await service.searchCharacters(req.body?.name);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getCharacterById(req.params.id));
  } catch (error) {
    next(error);
  }
});

export default router;