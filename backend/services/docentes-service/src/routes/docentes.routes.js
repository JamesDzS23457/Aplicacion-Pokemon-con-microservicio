// ---------------------------------------------------------------------------
// CAPA HTTP  (servicio de docentes)
//
// Aqui se DECLARAN las rutas. Cada manejador:
//   1. lee los QUERY PARAMS o los PATH PARAMS que le llegan ya parseados,
//   2. se los pasa a la capa de servicios, y
//   3. devuelve el resultado en JSON.
//
// No hay ninguna regla de negocio ni ninguna consulta SQL en este archivo: si
// apareciera un SELECT aqui, la arquitectura del proyecto estaria rota.
//
// -----------------------------------------------------------------------------
// LECTURA Y ESCRITURA
// -----------------------------------------------------------------------------
// Las rutas GET leen y llevan sus parametros en la URL (query params y path
// params). Las rutas POST/PUT/DELETE escriben y reciben un JSON en el cuerpo,
// ya parseado en `ctx.body` por src/server.js. El `id` de PUT/DELETE sigue
// siendo un PATH PARAM: lo que identifica al recurso va en la ruta, lo que lo
// describe va en el cuerpo.
// ---------------------------------------------------------------------------
// -----------------------------------------------------------------------------
// ORDEN DE LAS RUTAS: IMPORTA
// -----------------------------------------------------------------------------
// El router gana la primera ruta que coincide (ver ../http/router.js), asi que
// las rutas con segmentos literales van ANTES que las que tienen `:id`. Si
// `/facetas` fuera despues de `/:id`, el id se comeria la palabra "facetas" y
// pedir las facetas devolveria un 404 de "docente no encontrado".
// ---------------------------------------------------------------------------

import { json } from '../http/respond.js';
import * as service from '../services/docentes.service.js';
import * as repo from '../repositories/docentes.repository.js';
import { crearLog } from '../lib/log.js';

const log = crearLog('docentes-service');

/**
 * Registra todas las rutas del servicio en el router.
 *
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @returns {void}
 */
export function registrarRutas(router) {
  // -------------------------------------------------------------------------
  // Salud del servicio. La usa Render como healthcheck (ver render.yaml).
  // -------------------------------------------------------------------------
  router.get('/health', async (ctx) => {
    try {
      const total = await repo.count();
      json(ctx.res, 200, {
        status: 'ok',
        service: 'docentes-service',
        docentes: total,
      });
    } catch (error) {
      // 200 a proposito: `healthCheckPath: /health` de Render reinicia la
      // instancia ante un no-200 y el servicio quedaria en bucle inalcanzable.
      json(ctx.res, 200, {
        status: 'error',
        service: 'docentes-service',
        error: 'La base de datos no responde',
      });
      log(`el healthcheck fallo: ${error.message}`);
    }
  });

  // -------------------------------------------------------------------------
  // Documentacion.
  // -------------------------------------------------------------------------
  // Son las rutas mas cortas y literales del servicio, asi que podrian ir en
  // cualquier parte; se dejan aqui arriba por legibilidad.
  router.get('/', (ctx) => {
    json(ctx.res, 200, {
      service: 'docentes-service',
      descripcion:
        'Datos de docentes de Uninpahu. Las consultas viajan en la URL (path ' +
        'params y query params); la escritura (POST/PUT/DELETE) recibe un JSON ' +
        'en el cuerpo.',
      documentacion: '/docs',
      contrato: '/openapi.json',
      salud: '/health',
      rutas: router.list(),
    });
  });

  // -------------------------------------------------------------------------
  // Listado con filtros. Los filtros son QUERY PARAMS.
  // -------------------------------------------------------------------------
  router.get('/api/docentes', async (ctx) => {
    const resultado = await service.listarDocentes(ctx.query);
    log(
      `listado q="${ctx.query.get('q') ?? ''}" ` +
        `carrera="${ctx.query.get('carrera') ?? ''}" -> ${resultado.count} de ${resultado.total}`,
    );
    json(ctx.res, 200, resultado);
  });

  // -------------------------------------------------------------------------
  // Valores posibles de los filtros. Literal, y por eso va antes de /:id.
  // -------------------------------------------------------------------------
  router.get('/api/docentes/facetas', async (ctx) => {
    const facetas = await service.listarFacetas();
    json(ctx.res, 200, { data: facetas });
  });

  // -------------------------------------------------------------------------
  // Busqueda por termino, en el PATH. Tambien literal + parametro, asi que
  // tiene que ir antes de /:id.
  // -------------------------------------------------------------------------
  router.get('/api/docentes/buscar/:termino', async (ctx) => {
    const termino = ctx.params.termino;
    const resultado = await service.buscarDocentes(termino);
    // El termino se imprime CRUDO, tal como llego, para poder detectar problemas
    // de normalizacion ("AnA" o "josé" no deberían encontrar nada, pero si el
    // caso apareciera se veria en el log).
    log(`busqueda "${termino}" -> ${resultado.count} resultado(s)`);
    json(ctx.res, 200, resultado);
  });

  // -------------------------------------------------------------------------
  // Ficha de un docente. PATH PARAM.
  //
  // Va la ULTIMA de las GET a proposito: `:id` coincide con cualquier segmento,
  // asi que cualquier ruta literal que se declare despues de esta quedaria
  // oculta.
  // -------------------------------------------------------------------------
  router.get('/api/docentes/:id', async (ctx) => {
    const docente = await service.getDocenteById(ctx.params.id);
    log(`ficha id=${ctx.params.id} -> ${docente.nombre}`);
    json(ctx.res, 200, docente);
  });

  // -------------------------------------------------------------------------
  // Crear un docente. El cuerpo trae el JSON con los datos; el id lo asigna el
  // servicio. Responde 201 con la fila creada.
  // -------------------------------------------------------------------------
  router.post('/api/docentes', async (ctx) => {
    const creado = await service.crearDocente(ctx.body);
    log(`alta "${creado.nombre}" -> id=${creado.id}`);
    json(ctx.res, 201, creado);
  });

  // -------------------------------------------------------------------------
  // Actualizar un docente. El id va en el PATH y los campos nuevos en el cuerpo.
  // Solo se tocan los campos que vienen; los demas quedan igual.
  // -------------------------------------------------------------------------
  router.put('/api/docentes/:id', async (ctx) => {
    const actualizado = await service.actualizarDocente(ctx.params.id, ctx.body);
    log(`edicion id=${ctx.params.id} -> ${actualizado.nombre}`);
    json(ctx.res, 200, actualizado);
  });

  // -------------------------------------------------------------------------
  // Borrar un docente. Solo necesita el id del PATH; no lee ningun cuerpo.
  // -------------------------------------------------------------------------
  router.delete('/api/docentes/:id', async (ctx) => {
    const borrado = await service.eliminarDocente(ctx.params.id);
    log(`baja id=${ctx.params.id}`);
    json(ctx.res, 200, borrado);
  });
}