// ---------------------------------------------------------------------------
// CLIENTE HTTP HACIA LOS MICROSERVICIOS
//
// El gateway SI tiene que hacer fetch a la red, pero a la red INTERNA
// (otros procesos nuestros), nunca a las APIs externas. Esa distincion es
// justamente lo que el profesor pedia: el frontend no toca las APIs de
// terceros, y el unico que las tocaba era el seed.
//
// Que NO hay logica aqui dentro: solo reenvia y normaliza fallos. Si un
// microservicio esta caido, se responde 503, no se rompe el gateway entero.
// ---------------------------------------------------------------------------

const TIMEOUT_MS = 10_000; // 10s: si un servicio no responde, se corta

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
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