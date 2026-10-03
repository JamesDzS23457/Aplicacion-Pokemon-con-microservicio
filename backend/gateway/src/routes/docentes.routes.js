// ---------------------------------------------------------------------------
// RUTAS DE DOCENTES (gateway)
//
// Estructura identica a pokemon.routes.js y characters.routes.js: el gateway no
// sabe nada de docentes, solo reenvia y devuelve la respuesta tal cual.
//
// -----------------------------------------------------------------------------
// POR QUE TODAS SON GET Y ADEMAS REENVIAN LA CADENA DE CONSULTA
// -----------------------------------------------------------------------------
// El microservicio de docentes es de SOLO LECTURA y usa unicamente path params y
// query params, nunca body params. El gateway no puede romper ese contrato por su
// cuenta, asi que:
//
//   1. Solo declara GET. Ni siquiera existe un POST aqui que reenviar.
//   2. Reconstruye la query string con URLSearchParams.
//
// El punto 2 es lo importante: no se reenvia lo que venga crudo. Se toma lo
// recibido, se queda SOLO con los filtros que el microservicio entiende y se
// vuelve a serializar. Asi el cliente no puede inyectar parametros que el
// servicio no espera, y el microservicio recibe siempre la misma forma de
// consulta. Los valores viajan dentro de la URL, que es donde fetch los mete
// codificados, asi que un `q` con acentos o con un `&` llega intacto.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { proxy } from '../proxy.js';
import { config } from '../config.js';

const router = Router();

// Filtros que el microservicio acepta en el listado. Es una lista blanca: lo que
// no este aqui no se reenvia.
const FILTROS_ACEPTADOS = ['q', 'carrera', 'departamento', 'limite', 'pagina'];

/**
 * Reconstruye la query string del listado a partir de lo que llego.
 *
 * Un filtro vacio ("?q=") se descarta en lugar de reenviarse: en el servicio
 * equivale a no filtrar, asi que mandarlo solo haria que el log del gateway y el
 * del servicio mostraran un filtro que en realidad no se esta aplicando.
 *
 * @param {import('express').Request} req
 * @returns {string} Cadena "?a=1&b=2", o "" si no queda ningun filtro.
 */
function queryDeListado(req) {
  const params = new URLSearchParams();
  for (const nombre of FILTROS_ACEPTADOS) {
    const valor = req.query[nombre];
    if (typeof valor === 'string' && valor.trim() !== '') {
      params.set(nombre, valor);
    }
  }
  const cadena = params.toString();
  return cadena ? `?${cadena}` : '';
}

/**
 * GET /api/docentes?q=ana&carrera=Ingenieria
 *
 * Lista los docentes guardados, con filtros opcionales. Sin filtros devuelve
 * el listado completo.
 */
router.get('/', async (req, res) => {
  const query = queryDeListado(req);
  const result = await proxy(config.DOCENTES_SERVICE_URL, `/api/docentes${query}`);
  res.status(result.status).json(result.payload);
});

/**
 * GET /api/docentes/facetas
 *
 * Valores disponibles para los filtros de la pantalla (facultades, carreras y
 * departamentos). Va antes que `/:id` porque `facetas` es un segmento literal y
 * Express compara en orden de declaracion: si `/:id` se declarara antes, se
 * comeria el literal y esta ruta nunca se alcanzaria.
 */
router.get('/facetas', async (_req, res) => {
  const result = await proxy(config.DOCENTES_SERVICE_URL, '/api/docentes/facetas');
  res.status(result.status).json(result.payload);
});

/**
 * GET /api/docentes/buscar/ana
 *
 * Busqueda por termino en el path. El termino llega ya codificado por Express
 * (req.params), y proxy lo mete en la URL interna de destino.
 */
router.get('/buscar/:termino', async (req, res) => {
  const result = await proxy(
    config.DOCENTES_SERVICE_URL,
    `/api/docentes/buscar/${encodeURIComponent(req.params.termino)}`,
  );
  res.status(result.status).json(result.payload);
});

/** GET /api/docentes/7 -> la ficha de un docente. */
router.get('/:id', async (req, res) => {
  const result = await proxy(config.DOCENTES_SERVICE_URL, `/api/docentes/${req.params.id}`);
  res.status(result.status).json(result.payload);
});

export default router;