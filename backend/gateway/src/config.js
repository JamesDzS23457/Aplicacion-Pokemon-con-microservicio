// ---------------------------------------------------------------------------
// CONFIGURACION DEL GATEWAY
//
// El gateway no tiene base de datos propia: solo necesita saber DONDE estan
// los otros dos microservicios para reenviarles las peticiones.
//
// Cada microservicio lee una variable distinta a proposito. Si ambas usaran la
// misma DATABASE_URL, los dos apuntarian a la misma base y se pisarian entre
// si (y perderian la independencia que justifica tenerlos separados).
// ---------------------------------------------------------------------------

/**
 * Normaliza a una URL absoluta.
 *
 * Por que hace falta: en render.yaml el gateway referencia el hostname publico
 * del microservicio
 *   fromService: { name: pokemon-service, property: RENDER_EXTERNAL_HOSTNAME }
 * y Render inyecta el valor "pokemon-service-rtjy.onrender.com", es decir un
 * host SIN protocolo. Pero fetch() exige una URL ABSOLUTA: si se le pasa
 * "pokemon-service-rtjy.onrender.com/api/pokemon" lanza TypeError "fetch
 * failed" de inmediato, sin llegar a hacer DNS ni abrir conexion. El proxy lo
 * captura como "conexion rechazada" y responde 503 "Microservicio no
 * disponible", aunque el microservicio este perfectamente vivo.
 *
 * Ese fallo es dificil de ver porque el 503 parece "el servicio esta caido"
 * y el healthcheck del propio microservicio responde bien (el 503 lo genera
 * el gateway, no el servicio).
 *
 * Normalizar aqui y no en proxy.js deja proxy.js simple y con una sola
 * responsabilidad (reenviar), como esta comentado en su cabecera.
 *
 * http:// vs https://: los hosts locales (localhost, 127.0.0.1, ::1) son
 * desarrollo en el propio equipo, sin TLS, asi que van con http. Cualquier
 * otro host es el dominio publico de Render, que SI tiene TLS, y debe ir con
 * https. Antes se anteponia siempre http://, y eso rompia las llamadas a
 * Render: el microservicio solo habla https, la peticion por http se quedaba
 * esperando o la cortaba el proxy de Render.
 *
 * Se usa || y no ?? porque una variable definida pero vacia ("") no es null
 * ni undefined: con ?? se quedaria en "" y fetch volveria a fallar. || cae
 * al valor por defecto tanto con "" como con null/undefined.
 */
function normalizeUrl(value, fallback) {
  const url = value || fallback;
  if (/^https?:\/\//i.test(url)) return url; // ya trae protocolo, se respeta
  const esLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);
  return `${esLocal ? 'http' : 'https'}://${url}`;
}

export const config = {
  POKEMON_SERVICE_URL: normalizeUrl(process.env.POKEMON_SERVICE_URL, 'http://localhost:4001'),
  ONEPIECE_SERVICE_URL: normalizeUrl(process.env.ONEPIECE_SERVICE_URL, 'http://localhost:4002'),
};