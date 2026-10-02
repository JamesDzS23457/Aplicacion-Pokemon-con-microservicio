// ---------------------------------------------------------------------------
// CAPA HTTP  (servicio de Pokemon)
//
// Mismo patron que onepiece-service. Ver el comentario ahi.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as service from '../services/pokemon.service.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listPokemons());
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req, res, next) => {
  try {
    const results = await service.searchPokemons(req.body?.name);
    res.json({ data: results });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getPokemonById(req.params.id));
  } catch (error) {
    next(error);
  }
});

export default router;