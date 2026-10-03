// ---------------------------------------------------------------------------
// ROUTER PROPIO  (microservicio de docentes)
//
// Este archivo es la razon de ser del microservicio: donde pokemon-service
// hace `app.get('/api/pokemon/:id', ...)` con Express, aqui se declara una ruta
// a la mano y se implementa el enrutado CON LO QUE TRAE NODE.
//
// Que NO se use ningun framework (Express, Fastify, Koa, Hapi, Restify, NestJS)
// es un requisito del enunciado, asi que no es una decision de gusto: es la
// condicion para que el servicio sea "agnostico". Node trae `node:http`, que ya
// sabe manejar sockets, cabeceras y respuestas; lo unico que falta es el
// enrutado, y eso son unas 40 lineas.
//
// -----------------------------------------------------------------------------
// COMO FUNCIONA EL ENRUTADO
// -----------------------------------------------------------------------------
// 1. Se registra cada ruta como (metodo, patron, manejador).
// 2. Al llegar una peticion se separan los segmentos de la URL y se comparan con
//    los del patron uno a uno:
//      - un segmento literal tiene que coincidir tal cual;
//      - `:nombre` captura ese segmento y lo guarda en `params` (PATH PARAMS);
//      - `*` captura el resto entero, incluidas las barras (COMODIN).
// 3. La primera ruta que coincide gana. Por eso el orden de registro importa:
//    `/api/docentes/facetas` DEBE declararse antes que `/api/docentes/:id`, o si
//    no el id se come la palabra "facetas" y la ruta de facetas nunca se
//    alcanzaria. En src/routes/docentes.routes.js el orden se respeta a
//    proposito y esta nota lo deja escrito.
//
// Que no haya emparejamiento por expresiones regulares es una decision
// consciente: comparar segmentos es mas rapido, es mas facil de leer y un
// patron mal escrito nunca se convierte en una expresion regular lenta.
// ---------------------------------------------------------------------------

/**
 * Convierte una URL en segmentos sin barras vacias.
 * '/api/docentes/7/' -> ['api', 'docentes', '7']
 */
function segmentar(ruta) {
  return ruta.split('/').filter((segmento) => segmento.length > 0);
}

/**
 * Intenta hacer coincidir una ruta con un patron.
 *
 * @param {string[]} segmentos Segmentos de la URL pedida.
 * @param {string[]} patron    Segmentos del patron de la ruta.
 * @returns {object|null} Los PATH PARAMS capturados, o null si no coincide.
 */
function coincidir(segmentos, patron) {
  const params = {};

  for (let i = 0; i < patron.length; i += 1) {
    const esperado = patron[i];

    // Comodin: se lleva todo lo que quede, incluidas las barras.
    if (esperado === '*') {
      params.wildcard = segmentos.slice(i).join('/');
      return params;
    }

    // La URL se acabo y al patron le faltan segmentos: no coincide.
    if (i >= segmentos.length) return null;

    const recibido = segmentos[i];

    if (esperado.startsWith(':')) {
      // Un path param no puede estar vacio. Como los segmentos vacios ya se
      // filtraron al dividir, solo hay que comprobar que no sea un separador
      // horriblemente codificado.
      if (recibido.length === 0) return null;
      params[esperado.slice(1)] = decodeURIComponent(recibido);
      continue;
    }

    if (esperado !== recibido) return null;
  }

  // Si al patron le sobraban segmentos, la URL era mas larga de lo previsto.
  if (segmentos.length !== patron.length) return null;

  return params;
}

/**
 * Crea un router vacio.
 *
 * @returns {{get: Function, find: Function, list: Function}}
 *   `get` registra rutas GET; `find` busca la ruta que corresponde a una
 *   peticion; `list` devuelve las rutas registradas (lo usa la pagina de
 *   documentacion para no repetir la lista a mano).
 */
export function createRouter() {
  const rutas = [];

  /** Registra una ruta. El patron admite `:param` y el comodin `*`. */
  function registrar(metodo, patron, manejador) {
    rutas.push({
      metodo,
      patron,
      segmentos: segmentar(patron),
      manejador,
    });
  }

  return {
    get(patron, manejador) {
      registrar('GET', patron, manejador);
    },

    /**
     * Busca la primera ruta que coincide con el metodo y la URL pedidos.
     *
     * @param {string} metodo Metodo HTTP en mayusculas.
     * @param {string} ruta   Ruta SIN query string (solo el pathname).
     * @returns {{manejador: Function, params: object}|null}
     *   La ruta encontrada con sus path params, o null si ninguna coincide.
     */
    find(metodo, ruta) {
      const segmentos = segmentar(ruta);
      for (const item of rutas) {
        if (item.metodo !== metodo) continue;
        const params = coincidir(segmentos, item.segmentos);
        if (params) return { manejador: item.manejador, params };
      }
      return null;
    },

    /** Lista las rutas registradas, para la pagina de documentacion. */
    list() {
      return rutas.map(({ metodo, patron }) => `${metodo} ${patron}`);
    },
  };
}