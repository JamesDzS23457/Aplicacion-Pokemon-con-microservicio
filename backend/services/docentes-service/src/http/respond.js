// ---------------------------------------------------------------------------
// UTILIDADES HTTP  (microservicio de docentes)
//
// Lo que en Express viene gratis (res.json, res.status, el 404 final, el CORS
// automatico) y que aqui hay que escribir a mano sobre `node:http`. Todas son
// funciones puras de salida: escriben en el `res` y no saben nada del dominio.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE SERVICIO NO LEE EL CUERPO DE LAS PETICIONES
// -----------------------------------------------------------------------------
// El enunciado pide usar "path params o query params (no body params)". La
// forma mas limpia de cumplirlo es NO LEER NUNCA el cuerpo: no hay ninguna ruta
// que acepte POST, PUT, PATCH o DELETE, y el unico metodo que este servicio
// atiende es GET, cuyo cuerpo siempre viene vacio.
//
// En vez de caer en el mismo 404 que una ruta inexistente, cualquier otro metodo
// recibe un 405 explicito con la cabecera `Allow: GET`, que es lo que manda el
// protocolo. Asi el cliente puede distinguir "me equivoque de ruta" de "no se
// admite este metodo".
// ---------------------------------------------------------------------------

/**
 * Cabeceras de CORS.
 *
 * El frontend corre en otro origen (el dev server de Expo o el dominio de
 * Vercel), asi que sin esto el navegador bloquearia todas las peticiones. En
 * produccion esto se restringiria a los dominios permitidos; aqui se deja
 * abierto, igual que el gateway, porque no hay datos sensibles.
 */
export function cabecerasCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * Envia una respuesta JSON.
 *
 * `Content-Type` se pone SIEMPRE, tambien en los errores: un 404 sin cabecera
 * de contenido hace que algunos clientes lo interpreten como una respuesta vacia
 * en vez de como el error que dice el cuerpo.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status  Codigo HTTP.
 * @param {*} cuerpo       Lo que se serializa a JSON.
 */
export function json(res, status, cuerpo) {
  const texto = JSON.stringify(cuerpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texto),
    'Cache-Control': 'no-store',
  });
  res.end(texto);
}

/**
 * Envia una respuesta HTML.
 *
 * Solo la usa la pagina de Swagger (/docs). El texto va con cabeceras
 * explicitas y `nosniff`, porque es contenido que se sirve desde nuestro
 * propio dominio.
 *
 * @param {import('node:http').ServerResponse} res
 * @param {number} status Codigo HTTP.
 * @param {string} html   Documento HTML completo.
 */
export function html(res, status, cuerpo) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(cuerpo),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  });
  res.end(cuerpo);
}

/**
 * Error de negocio ya marcado con su codigo HTTP.
 *
 * Reune el patron que usa pokemon-service (un `Error` normal con `status`) con
 * los dos codigos de error propios de este servicio:
 *
 *   - 400: el parametro llego pero no es utilizable (id "abc", limite "-5",
 *     termino de busqueda vacio). Se responde con el mensaje tal cual, porque
 *     explica QUE corregir, que es justo lo que necesita quien lo escribe.
 *   - 5xx: error nuestro (la base no responde, el seed fallo...). Se registra
 *     el detalle real pero al cliente solo se le da un mensaje generico: los
 *     mensajes internos pueden traer el nombre del host de la base.
 *
 * @param {Error} error Error lanzado por cualquier capa.
 * @returns {{status: number, mensaje: string}} Lo que hay que responder.
 */
export function clasificarError(error) {
  const status = Number(error?.status) || 500;

  if (status >= 400 && status < 500) {
    return { status, mensaje: error.message };
  }

  return {
    status: 500,
    mensaje: 'Error interno del servidor',
  };
}