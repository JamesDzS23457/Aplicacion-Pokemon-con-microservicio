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
 * Anade "http://" si la URL viene sin protocolo.
 *
 * Por que hace falta: en render.yaml el gateway usa
 *   fromService: { name: pokemon-service, property: hostport }
 * y Render inyecta el valor "pokemon-service:4001", es decir host:port SIN
 * protocolo. Pero fetch() exige una URL ABSOLUTA: si se le pasa
 * "pokemon-service:4001/api/pokemon" lanza TypeError "fetch failed" de
 * inmediato, sin llegar a hacer DNS ni abrir conexion. El proxy lo captura
 * como "conexion rechazada" y responde 503 "Microservicio no disponible",
 * aunque el microservicio este perfectamente vivo.
 *
 * Ese fallo es dificil de ver porque el 503 parece "el servicio esta caido"
 * y el healthcheck del propio microservicio responde bien (el 503 lo genera
 * el gateway, no el servicio).
 *
 * Normalizar aqui y no en proxy.js deja proxy.js simple y con una sola
 * responsabilidad (reenviar), como esta comentado en su cabecera.
 *
 * "http://" y no "https://" a proposito: son URLs INTERNAS de Render, dentro
 * de la misma red privada, donde el trafico no se cifra. La API publica (la
 * que ve el movil) si es https, y esa la da el dominio de Render.
 *
 * Se usa || y no ?? porque una variable definida pero vacia ("") no es null
 * ni undefined: con ?? se quedaria en "" y fetch volveria a fallar. || cae
 * al valor por defecto tanto con "" como con null/undefined.
 */
function normalizeUrl(value, fallback) {
  const url = value || fallback;
  return /^https?:\/\//i.test(url) ? url : `http://${url}`;
}

export const config = {
  POKEMON_SERVICE_URL: normalizeUrl(process.env.POKEMON_SERVICE_URL, 'http://localhost:4001'),
  ONEPIECE_SERVICE_URL: normalizeUrl(process.env.ONEPIECE_SERVICE_URL, 'http://localhost:4002'),
};