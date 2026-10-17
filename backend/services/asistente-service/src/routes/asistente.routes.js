// ---------------------------------------------------------------------------
// CAPA HTTP  (asistente-service)
//
// Responsabilidad unica: traducir HTTP <-> el service. No hay reglas de negocio
// aqui ni llamadas a internet (de eso se encarga services/ y external/).
//
// Los bloques @openapi de este archivo son los que `swagger-jsdoc` recolecta
// para construir la documentacion que se sirve en /docs.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import * as service from '../services/asistente.service.js';
import { crearLog } from '../lib/log.js';

const router = Router();
const log = crearLog('asistente-service');

/**
 * @openapi
 * /api/asistente:
 *   post:
 *     tags: [Asistente]
 *     summary: Pregunta al asistente de IA
 *     description: >
 *       Consulta una IA publica (Google Gemini) para responder preguntas sobre
 *       la app (Pokemon, One Piece y docentes). En `modo=restringido` (por
 *       defecto) solo responde con informacion de la base de datos propia; ante
 *       cualquier pregunta fuera de ese contexto devuelve exactamente
 *       "No estoy programada para dar ese tipo de preguntas.". En `modo=abierto`
 *       responde cualquier pregunta (primera fase de la actividad).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pregunta]
 *             properties:
 *               pregunta: { type: string, example: "Que tipos tiene Pikachu?" }
 *               modo:
 *                 type: string
 *                 enum: [restringido, abierto]
 *                 default: restringido
 *               historial:
 *                 type: array
 *                 description: Turnos anteriores para dar contexto a la conversacion.
 *                 items:
 *                   type: object
 *                   properties:
 *                     rol: { type: string, enum: [usuario, asistente] }
 *                     texto: { type: string }
 *     responses:
 *       200:
 *         description: La respuesta del asistente.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RespuestaAsistente'
 *       400:
 *         description: Falta la pregunta.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       502:
 *         description: La IA publica respondio con un error.
 *       503:
 *         description: La IA no esta configurada o no se pudo leer la base de datos.
 */
router.post('/', async (req, res, next) => {
  try {
    const { pregunta, historial, modo } = req.body ?? {};
    const resultado = await service.responder({ pregunta, historial, modo });
    // Deja constancia del modo y de si la pregunta entro en contexto. La
    // pregunta concreta se registra dentro del service (recortada).
    log(
      `respuesta -> modo=${resultado.modo} motor=${resultado.motor} ` +
        `enAlcance=${resultado.enAlcance}`,
    );
    res.json(resultado);
  } catch (error) {
    next(error);
  }
});

export default router;
