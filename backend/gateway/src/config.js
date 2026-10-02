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

const POKEMON_SERVICE_URL = process.env.POKEMON_SERVICE_URL || 'http://localhost:4001';
const ONEPIECE_SERVICE_URL = process.env.ONEPIECE_SERVICE_URL || 'http://localhost:4002';

export const config = { POKEMON_SERVICE_URL, ONEPIECE_SERVICE_URL };