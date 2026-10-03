// ---------------------------------------------------------------------------
// CAPA HTTP  (servicio de Pokemon)
//
// Mismo patron que onepiece-service. Ver el comentario ahi.
//
// Los bloques @openapi de este archivo son los que `swagger-jsdoc` recolecta
// para construir la documentacion que se sirve en /docs.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as service from '../services/pokemon.service.js';
import { crearLog } from '../lib/log.js';

const router = Router();
const log = crearLog('pokemon-service');

/**
 * @openapi
 * /api/pokemon:
 *   get:
 *     tags: [Pokemon]
 *     summary: Lista los Pokemon guardados
 *     description: Devuelve los 20 Pokemon de la base de datos local, ordenados por id.
 *     responses:
 *       200:
 *         description: Listado completo.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PokemonList'
 */
router.get('/', async (_req, res, next) => {
  try {
    res.json(await service.listPokemons());
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/pokemon/search:
 *   post:
 *     tags: [Pokemon]
 *     summary: Busca un Pokemon por nombre
 *     description: >
 *       Busca en la base de datos LOCAL, nunca en PokeAPI. La comparacion es
 *       tolerante: ignora mayusculas, acentos y puntuacion.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: pikachu }
 *     responses:
 *       200:
 *         description: Coincidencias encontradas.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SearchResponse'
 *       400:
 *         description: Falta el nombre.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: No esta en la base de datos local.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @openapi
 * /api/pokemon/{id}:
 *   get:
 *     tags: [Pokemon]
 *     summary: Obtiene un Pokemon por id
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         example: 25
 *     responses:
 *       200:
 *         description: El Pokemon encontrado.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Pokemon'
 *       404:
 *         description: No existe.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    res.json(await service.getPokemonById(req.params.id));
  } catch (error) {
    next(error);
  }
});

export default router;
