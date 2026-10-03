// ---------------------------------------------------------------------------
// CAPA HTTP  (servicio de Pokemon)
//
// Mismo patron que onepiece-service. Ver el comentario ahi.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as service from '../services/pokemon.service.js';
import { crearLog } from '../lib/log.js';

const router = Router();
const log = crearLog('pokemon-service');

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listPokemons());
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req, res, next) => {
  const termino = req.body?.name;
  try {
    const results = await service.searchPokemons(termino);
    // Deja constancia de QUE se busco y CUANTOS resultados hubo. El termino
    // se imprime crudo (tal como llego) para poder detectar problemas de
    // normalizacion, por ejemplo que "PiKaChu " no encuentre nada.
    log(`busqueda "${termino}" -> ${results.length} resultado(s)`);
    res.json({ data: results });
  } catch (error) {
    // No se registra aqui: de los errores se encarga el middleware de index.js,
    // que ademas conoce el codigo HTTP. Registrar en ambos sitios duplicaria
    // la linea de un 404.
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