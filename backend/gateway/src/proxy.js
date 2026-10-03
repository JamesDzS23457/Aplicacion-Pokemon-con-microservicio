// ---------------------------------------------------------------------------
// CLIENTE HTTP HACIA LOS MICROSERVICIOS
//
// El gateway SI tiene que hacer fetch a la red, pero a la red INTERNA
// (otros procesos nuestros), nunca a las APIs externas. Esa distincion es
// justamente lo que el profesor pedia: el frontend no toca las APIs de
// terceros, y el unico que las tocaba era el seed.
//
// Que NO hay logica aqui dentro: solo reenvia, registra y normaliza fallos.
// Si un microservicio esta caido, se responde 503, no se rompe el gateway.
// ---------------------------------------------------------------------------

import { crearLog, clasificarDestino } from './lib/log.js';

const log = crearLog('gateway');

// Timeout de la peticion al microservicio.
//
// 60s y no 10s: los servicios estan en el plan FREE de Render, que los
// "duerme" a los 15 minutos sin trafico y tarda alrededor de un minuto en
// despertarlos. Con 10s, la primera peticion despues de un rato de inactividad
// abortaba SIEMPRE, aunque el microservicio estuviera a punto de responder.
// 60s cubre el arranque en frio. El coste es que un servicio realmente caido
// tarda mas en reportarse como 503, pero para esta app prima que la primera
// busqueda funcione.
const TIMEOUT_MS = 60_000;

/**
 * Reenvia una peticion y devuelve { status, payload }.
 * Devolver ambos y que sea la ruta quien haga res.status() permite que el
 * codigo de error del microservicio llegue intacto al cliente (por ejemplo,
 * un 404 de "personaje no encontrado" sigue siendo un 404 real, no un 500).
 */
export async function proxy(serviceUrl, path, { method = 'GET', body } = {}) {
  // El .replace quita la barra final por si la URL ya venia con ella y
  // concatenar las dos podria dejar "//api/..." en el medio.
  const url = `${serviceUrl.replace(/\/$/, '')}${path}`;

  // Datos para la linea de log. Se calculan ANTES de la peticion porque
  // `destino` y `buscado` describen la INTENCION (a donde iba y que se
  // buscaba), no el resultado.
  const inicio = Date.now();
  const destino = clasificarDestino(serviceUrl);
  // Solo las busquedas traen cuerpo con `name`; en un listado o un GET por id
  // no se anade nada a la linea.
  const buscado = body?.name !== undefined ? ` name="${body.name}"` : '';

  /** Escribe una unica linea por peticion con su resultado y duracion. */
  const registrar = (status) => {
    const ms = Date.now() - inicio;
    log(`${method} ${path}${buscado} | destino=${destino} ${serviceUrl} | ${status} en ${ms}ms`);
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        // Se pide explicitamente que la respuesta NO se guarde en ningun cache
        // intermedio (el edge de Render, proxies, la cache del navegador).
        //
        // Sin esto, Express responde con un ETag debil y NINGUN Cache-Control, y
        // cualquier capa intermedia puede aplicar "heuristic caching": servir un
        // `GET /api/pokemon` viejo sin preguntar al servicio. El sintoma es
        // exactamente "cambie el dato en la base y la app sigue mostrando el
        // anterior". Los `POST /search` no se cachean, pero los listados si.
        //
        // `no-cache` obliga a revalidar contra el origen en cada peticion, que
        // es lo que queremos: la respuesta refleja el estado actual de la base.
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      // undefined = sin cuerpo (GET). JSON.stringify(undefined) seria "undefined"
      // literal, asi que se comprueba antes.
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    // Se lee como texto y despues se intenta parsear. Si el microservicio
    // devolviera HTML (por ejemplo el error 404 por defecto de Express al
    // caerse) el JSON.parse falla y se devuelve un error controlado en vez de
    // una excepcion sin contexto.
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: 'Respuesta invalida del microservicio' };
    }

    registrar(response.status);
    return { status: response.status, payload };
  } catch (error) {
    // AbortError = se paso el timeout. Cualquier otro error = conexion
    // rechazada (servicio caido). En ambos casos es 503 Service Unavailable.
    //
    // `detail` expone el codigo real del sistema (ENOTFOUND, ECONNREFUSED,
    // ETIMEDOUT...) porque "Microservicio no disponible" no distingue entre
    // "el nombre interno no resuelve" y "el puerto esta cerrado", y desde
    // fuera de Render esa diferencia no se puede observar. No contiene
    // credenciales: las URLs de servicio no llevan usuario ni clave.
    const isTimeout = error.name === 'AbortError';
    const detail = error.cause?.code || error.cause?.message || error.message;
    registrar(503);
    log(`  causa: ${detail}`);
    return {
      status: 503,
      payload: {
        error: isTimeout
          ? 'El microservicio tardo demasiado en responder'
          : 'Microservicio no disponible',
        detail,
      },
    };
  } finally {
    // Sin este clearTimeout, cada peticion dejaria un timer pendiente y
    // acabaria manteniendo el proceso vivo innecesariamente.
    clearTimeout(timer);
  }
}