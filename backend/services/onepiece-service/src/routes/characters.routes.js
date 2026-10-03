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
import { crearLog } from '../lib/log.js';

const router = Router();
const log = crearLog('onepiece-service');

router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listCharacters());
  } catch (error) {
    next(error);
  }
});

router.post('/search', async (req, res, next) => {
  const termino = req.body?.name;
  try {
    const results = await service.searchCharacters(termino);
    // Deja constancia de QUE se busco y CUANTOS resultados hubo. El termino
    // se imprime crudo (tal como llego) para poder detectar problemas de
    // normalizacion, por ejemplo que "LUFFY  " no encuentre nada.
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
    res.json(await service.getCharacterById(req.params.id));
  } catch (error) {
    next(error);
  }
});

export default router;