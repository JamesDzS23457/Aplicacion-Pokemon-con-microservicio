// ---------------------------------------------------------------------------
// RUTA RAIZ DEL GATEWAY
//
// Expone informacion de diagnostico: que servicios hay y donde estan.
// No devuelve datos de negocio, asi que se puede consultar sin miedo.
//
// OJO con esto en produccion: publicar las URLs internas no es ideal en una
// app real. Se deja porque en desarrollo ayuda a depurar.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { config } from '../config.js';
import { ENTORNO, clasificarDestino } from '../lib/log.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    gateway: 'ok',
    entorno: ENTORNO,
    services: {
      pokemon: config.POKEMON_SERVICE_URL,
      onepiece: config.ONEPIECE_SERVICE_URL,
      docentes: config.DOCENTES_SERVICE_URL,
    },
    // Misma informacion que `services`, pero ya clasificada como LOCAL o
    // DESPLEGADO, para no tener que comparar la URL a mano.
    destinos: {
      pokemon: clasificarDestino(config.POKEMON_SERVICE_URL),
      onepiece: clasificarDestino(config.ONEPIECE_SERVICE_URL),
      docentes: clasificarDestino(config.DOCENTES_SERVICE_URL),
    },
  });
});

export default router;