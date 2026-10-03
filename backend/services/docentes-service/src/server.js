// ---------------------------------------------------------------------------
// SERVIDOR  (microservicio de docentes)
//
// Aqui se junta todo lo que hace de servidor web sin usar ningun framework:
//   - `node:http` crea el servidor y le pasa una peticion cada vez;
//   - este archivo decide que hacer con cada peticion (CORS, 405, 404, errores).
//
// El resultado es `createServer()`, que devuelve un servidor de Node puro. Que
// sea una FUNCION y no un archivo que arranca al importarse tiene una ventaja
// concreta: los tests o scripts pueden montarlo en un puerto efimero sin tener
// que abrir el 4001 y cerrarlo despues.
//
// -----------------------------------------------------------------------------
// EL ORDEN DE LAS COMPROBACIONES
// -----------------------------------------------------------------------------
//   1. OPTIONS      -> 204. El navegador lo manda solo, antes del GET, para
//                      preguntar si puede hacer la peticion. Si no se responde,
//                      la peticion real nunca sale y el error que ve el
//                      desarrollador es "CORS", no el problema real.
//   2. metodo       -> 405 si no es GET. Este servicio es de SOLO LECTURA: no
//                      hay ninguna ruta que modifique datos, asi que un POST
//                      tiene que fallar de forma explicita.
//   3. ruta         -> 404 si el router no encuentra ninguna.
//   4. manejador    -> por ultimo, dentro de un try/catch que convierte
//                      cualquier error en JSON con su codigo.
//
// El manejador se busca en el paso 3 y se EJECUTA en el paso 4 a proposito:
// separarlos permite distinguir "no existe" (404) de "existe pero fallo" (400,
// 404 o 500 segun la capa de servicios) sin que las rutas tengan que
// repetir try/catch.
// ---------------------------------------------------------------------------

import http from 'node:http';
import { createRouter } from './http/router.js';
import { cabecerasCors, json, html, clasificarError } from './http/respond.js';
import { registrarRutas } from './routes/docentes.routes.js';
import { registrarRutasDocumentacion } from './docs/documentacion.routes.js';
import { crearLog } from './lib/log.js';

const log = crearLog('docentes-service');

/**
 * Crea el servidor HTTP completo.
 *
 * @returns {import('node:http').Server} Servidor de Node sin wrapear.
 */
export function createServer() {
  const router = createRouter();

  // Rutas de negocio y rutas de documentacion. Las de documentacion van
  // DESPUES a proposito: si un dia alguna ruta de negocio se llamara
  // /docs, la de documentacion se registraria despues y la de negocio ganaria.
  registrarRutas(router);
  registrarRutasDocumentacion(router, { json, html });

  return http.createServer(async (req, res) => {
    const inicio = Date.now();

    // `new URL(req.url, base)` hace dos cosas de una vez: separa la ruta de la
    // query string y ya entrega los query params parseados en `.searchParams`.
    // El segundo argumento es obligatorio y es solo un ancla: Node exige una URL
    // absoluta para poder interpretarla, pero nunca sale a la red.
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const ruta = url.pathname;
    const metodo = (req.method ?? 'GET').toUpperCase();

    cabecerasCors(res);

    // ---- 1. OPTIONS -------------------------------------------------------
    if (metodo === 'OPTIONS') {
      res.writeHead(204, { 'Content-Length': 0 });
      res.end();
      return;
    }

    // ---- 2. Solo GET -------------------------------------------------------
    if (metodo !== 'GET') {
      res.setHeader('Allow', 'GET');
      json(res, 405, {
        error: `Metodo ${metodo} no permitido. Este servicio es de solo lectura.`,
      });
      log(`${metodo} ${ruta} -> 405 (solo se admite GET)`);
      return;
    }

    // ---- 3. Buscar la ruta -----------------------------------------------
    const encontrada = router.find(metodo, ruta);
    if (!encontrada) {
      json(res, 404, { error: `Ruta no encontrada: ${ruta}` });
      log(`${metodo} ${ruta} -> 404 en ${Date.now() - inicio}ms`);
      return;
    }

    // ---- 4. Ejecutar el manejador ----------------------------------------
    // El contexto que recibe cada manejador es lo unico que necesita:
    //   - res:    para responder (lo tipico en un framework seria res.json)
    //   - query:  los QUERY PARAMS ya parseados
    //   - params: los PATH PARAMS que el router capturo
    //   - req/url: por si algun manejador necesita la peticion completa
    const ctx = { req, res, url, query: url.searchParams, params: encontrada.params };

    try {
      await encontrada.manejador(ctx);
    } catch (error) {
      // Si el manejador ya habia empezado a responder y falla despues (por
      // ejemplo al serializar), no se puede escribir una segunda cabecera:
      // Node lanza ERR_HTTP_HEADERS_SENT y el cliente se queda colgado. En ese
      // caso lo unico sensato es registrar el fallo y dejar que la respuesta
      // a medias sea la que llegue.
      if (res.headersSent) {
        log(`error DESPUES de responder: ${error.message}`);
        return;
      }

      const { status, mensaje } = clasificarError(error);

      // El detalle real se registra SIEMPRE, pero al cliente solo se le manda un
      // mensaje generico si es un 5xx. Asi un fallo de la base se puede
      // diagnosticar en el log de Render sin filtrar el host de la base por la
      // red.
      log(`${status}: ${error.message}`);
      json(res, status, { error: mensaje });
      return;
    }

    log(`${metodo} ${ruta} -> ${res.statusCode} en ${Date.now() - inicio}ms`);
  });
}