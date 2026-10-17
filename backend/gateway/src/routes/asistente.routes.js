// ---------------------------------------------------------------------------
// RUTAS DEL ASISTENTE (gateway)
//
// Estructura identica a las otras rutas: el gateway no sabe nada de IA ni de
// Gemini, solo reenvia la peticion y devuelve la respuesta tal cual.
//
// El cuerpo se filtra con LISTA BLANCA antes de reenviarse: solo viajan
// `pregunta`, `modo` e `historial`. Cualquier otra cosa que el cliente mande de
// mas se descarta y nunca llega al microservicio.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { proxy } from '../proxy.js';
import { config } from '../config.js';

const router = Router();

// Modos validos. Si llega cualquier otro, se deja que el microservicio aplique
// su valor por defecto ('restringido'): aqui no se duplica esa regla.
const MODOS = ['restringido', 'abierto'];

/**
 * Limpia el historial: deja solo objetos {rol, texto}. Un historial con basura
 * (objetos raros, textos no string) se descarta en vez de reenviarse.
 */
function historialLimpio(valor) {
  if (!Array.isArray(valor)) return [];
  return valor
    .filter((m) => m && typeof m.texto === 'string')
    .map((m) => ({
      rol: m.rol === 'asistente' ? 'asistente' : 'usuario',
      texto: m.texto,
    }));
}

/**
 * POST /api/asistente   body: { pregunta, modo?, historial? }
 *
 * Reenvia la pregunta al microservicio de IA. La clave de Gemini vive SOLO en el
 * microservicio; el gateway no la ve.
 */
router.post('/', async (req, res) => {
  const cuerpo = { pregunta: req.body?.pregunta };
  if (MODOS.includes(req.body?.modo)) cuerpo.modo = req.body.modo;
  const historial = historialLimpio(req.body?.historial);
  if (historial.length > 0) cuerpo.historial = historial;

  const result = await proxy(config.ASISTENTE_SERVICE_URL, '/api/asistente', {
    method: 'POST',
    body: cuerpo,
  });
  res.status(result.status).json(result.payload);
});

export default router;
