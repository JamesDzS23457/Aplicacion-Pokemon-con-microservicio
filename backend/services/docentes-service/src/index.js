// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA  (microservicio docentes-service, puerto 4003)
//
// Es el unico archivo que arranca algo. Todo lo demas (el servidor, el router,
// las rutas, la base de datos) son modulos que se importan, de modo que se
// pueden probar sin abrir un puerto.
//
// -----------------------------------------------------------------------------
// ORDEN DE ARRANQUE
// -----------------------------------------------------------------------------
// Primero se crea el esquema y DESPUES se escucha. Al reves, el servicio
// aceptaria peticiones durante un instante en el que la tabla `docentes` todavia
// no existe y todas responderian 500. Si el esquema no se puede crear, el
// proceso muere con codigo 1 y un mensaje que dice que variable falta: es mucho
// mas facil de diagnosticar que un 500 en la primera busqueda.
//
// -----------------------------------------------------------------------------
// POR QUE 4003
// -----------------------------------------------------------------------------
// Cada microservicio tiene su puerto: pokemon 4001, onepiece 4002, docentes
// 4003. El 4000 esta libre pero se deja por si algun dia se agrega otro servicio.
// En Render NO se fija el puerto: la plataforma lo detecta y lo inyecta en la
// variable PORT, asi que aqui solo se usa como valor por defecto para el
// desarrollo local. Fijarlo a mano en el despliegue ya rompio el routing del
// gateway una vez (ver la nota de render.yaml).
// ---------------------------------------------------------------------------

import { createServer } from './server.js';
import { ensureSchema, closePool, DB_HOST, ERROR_CONFIGURACION } from './db/connection.js';
import { crearLog, ENTORNO } from './lib/log.js';

const log = crearLog('docentes-service');
const PORT = process.env.PORT || 4003;

if (ERROR_CONFIGURACION) {
  log(`ARRANQUE DEGRADADO: ${ERROR_CONFIGURACION}`);
} else {
  try {
    await ensureSchema();
  } catch (error) {
    // No se muere el proceso: Supabase a veces da ETIMEDOUT en el primer
    // intento. Morir aqui = deploy fallido en Render = Manual Deploy.
    log(`AVISO: la base no responde todavia: ${error.message}`);
  }
}

const server = createServer();

  // Cierra el pool al apagar el proceso, para no cortar conexiones de golpe.
  // En Render el SIGTERM llega cuando el servicio se suspende o se reinicia.
  for (const senal of ['SIGINT', 'SIGTERM']) {
    process.on(senal, async () => {
      log(`${senal} recibido, cerrando...`);
      server.close();
      await closePool();
      process.exit(0);
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    // Deja claro, desde el arranque, en que entorno corre y contra que base
    // habla. Es la primera linea que se mira si una busqueda "no encuentra
    // nada": si ENTORNO=LOCAL, se esta consultando el Postgres local, no
    // Supabase.
    log(`ENTORNO=${ENTORNO} | BD=${DB_HOST} | escuchando en :${PORT}`);
    log('documentacion en /docs  |  contrato en /openapi.json');
  });