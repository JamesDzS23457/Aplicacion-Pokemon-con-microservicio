// ---------------------------------------------------------------------------
// RUTAS DE DOCENTES (gateway)
//
// Estructura identica a pokemon.routes.js y characters.routes.js: el gateway no
// sabe nada de docentes, solo reenvia y devuelve la respuesta tal cual.
//
// -----------------------------------------------------------------------------
// LECTURA Y ESCRITURA
// -----------------------------------------------------------------------------
// Las rutas GET leen y reenvian solo query params filtrados (ver
// queryDeListado). Las rutas POST/PUT/DELETE escriben y reenvian un JSON en el
// cuerpo, construido AQUI con lista blanca de campos: lo que el cliente mande
// de mas (id, search_key, *_key, created_at...) se descarta y nunca llega al
// microservicio, igual que los query params no aceptados no se reenvian.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { proxy } from '../proxy.js';
import { config } from '../config.js';

const router = Router();

// Filtros que el microservicio acepta en el listado. Es una lista blanca: lo que
// no este aqui no se reenvia.
const FILTROS_ACEPTADOS = ['q', 'carrera', 'departamento', 'limite', 'pagina'];

// Campos que el microservicio acepta al crear o actualizar. Es la misma idea
// que FILTROS_ACEPTADOS pero para el cuerpo: las columnas calculadas
// (search_key, carrera_key, departamento_key) y los metadatos (id, created_at)
// los pone el servicio, no el cliente.
const CAMPOS_ESCRIBIBLES = [
  'nombre',
  'cargo',
  'departamento',
  'carrera',
  'facultad',
  'email',
  'foto_url',
  'resumen',
  'biografia',
  'areas',
  'formacion',
];

/**
 * Limpia el cuerpo de una peticion de escritura.
 *
 * Devuelve un objeto solo con los campos escribibles que venian definidos. Un
 * cuerpo ausente o que no sea objeto da {}: es el microservicio quien responde
 * 400 ("el cuerpo debe ser un objeto..." / "no hay campos..."), no el gateway,
 * para que el mensaje de error sea el mismo se llame por donde se llame.
 *
 * @param {*} body req.body tal como lo dejo express.json().
 * @returns {object} Cuerpo filtrado.
 */
function cuerpoDeEscritura(body) {
  if (body === null || body === undefined || typeof body !== 'object' || Array.isArray(body)) {
    return {};
  }
  const limpio = {};
  for (const campo of CAMPOS_ESCRIBIBLES) {
    if (body[campo] !== undefined) limpio[campo] = body[campo];
  }
  return limpio;
}

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

/**
 * POST /api/docentes -> agrega un docente nuevo.
 *
 * El cuerpo viaja como JSON y se filtra con la lista blanca antes de
 * reenviarse. Responde 201 con la fila creada (el proxy conserva el codigo del
 * microservicio).
 */
router.post('/', async (req, res) => {
  const result = await proxy(config.DOCENTES_SERVICE_URL, '/api/docentes', {
    method: 'POST',
    body: cuerpoDeEscritura(req.body),
  });
  res.status(result.status).json(result.payload);
});

/**
 * PUT /api/docentes/7 -> actualiza los campos que vengan en el cuerpo.
 *
 * El id va en el path y los datos en el cuerpo, igual que en el
 * microservicio. Los campos no escribibles se descartan aqui.
 */
router.put('/:id', async (req, res) => {
  const result = await proxy(config.DOCENTES_SERVICE_URL, `/api/docentes/${req.params.id}`, {
    method: 'PUT',
    body: cuerpoDeEscritura(req.body),
  });
  res.status(result.status).json(result.payload);
});

/** DELETE /api/docentes/7 -> borra un docente. No lleva cuerpo. */
router.delete('/:id', async (req, res) => {
  const result = await proxy(config.DOCENTES_SERVICE_URL, `/api/docentes/${req.params.id}`, {
    method: 'DELETE',
  });
  res.status(result.status).json(result.payload);
});

export default router;