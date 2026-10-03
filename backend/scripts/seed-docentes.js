// ---------------------------------------------------------------------------
// SEED DE DOCENTES
//
// Carga los 20 registros de backend/scripts/docentes-datos.js en la base de
// datos de este microservicio. A diferencia de Pokemon y One Piece, aqui NO hay
// ninguna API externa de la que descargar nada: los datos ya estan escritos en el
// archivo, asi que el seed funciona SIEMPRE, sin internet.
//
//   node scripts/seed-docentes.js
//   npm run backend:seed:docentes
//
// -----------------------------------------------------------------------------
// IDEMPOTENTE
// -----------------------------------------------------------------------------
// Se puede ejecutar N veces sin duplicar nada, porque el repository hace upsert
// por id. Ademas vacia la tabla antes con TRUNCATE, para que si se borra un
// docente del archivo de datos tambien desaparezca de la base.
//
// OJO con TRUNCATE y el trigger del limite de 20: TRUNCATE no dispara triggers
// de INSERT, asi que se puede vaciar la tabla sin que el trigger lance la
// excepcion de "limite alcanzado". Es justo lo que se necesita para poder
// recargar los datos.
//
// -----------------------------------------------------------------------------
// LA FOTO
// -----------------------------------------------------------------------------
// `foto_url` va en null en todos los registros de demostracion: son datos
// inventados, asi que no tienen foto. La app lo tiene en cuenta y dibuja un
// retrato de reserva con las iniciales, de modo que la pantalla nunca se ve
// rota ni queda un hueco vacio. Cuando carges la foto real de un docente,
// escribe su URL publica en el archivo de datos y el seed la guardara.
// ---------------------------------------------------------------------------

import { DOCENTES } from './docentes-datos.js';
import * as repo from '../services/docentes-service/src/repositories/docentes.repository.js';
import {
  ensureSchema,
  closePool,
} from '../services/docentes-service/src/db/connection.js';

// Crea la tabla antes de insertar. Asi el resultado del seed queda
// autocontenido y facil de leer en una defensa.
await ensureSchema();

// Se avisa ANTES de vaciar: si despues el seed falla, la base se queda vacia y
// el mensaje tiene que haber salido antes, no despues.
console.log('== Cargando docentes ==');
console.log(`registros en el archivo de datos: ${DOCENTES.length}`);

if (DOCENTES.length > 20) {
  console.error(
    `\nEl archivo tiene ${DOCENTES.length} docentes y la base admite 20. ` +
      'Quita los que sobren antes de seguir: el trigger va a rechazar el resto.',
  );
  await closePool();
  process.exit(1);
}

await repo.clear();

for (const docente of DOCENTES) {
  await repo.upsert(docente);
  console.log(`  ${String(docente.id).padStart(2, '0')}  ${docente.nombre}`);
}

const total = await repo.count();

console.log('\n== Resumen ==');
console.log(`docentes: ${total}`);

if (total === 0) {
  console.error('\nEl seed fallo: la base de datos de docentes quedo vacia.');
  await closePool();
  process.exit(1);
}

// Comprobacion de humo: la busqueda se hace por el mismo camino que usa la app,
// asi que si esto falla, el buscador de la quinta pestana tambien va a fallar.
const primera = await repo.search(DOCENTES[0].nombre.split(' ')[0]);
console.log(
  `busqueda "${DOCENTES[0].nombre.split(' ')[0]}" -> ${primera.length} resultado(s)`,
);

// Cerrar el pool: sin esto el proceso se queda vivo esperando conexiones.
await closePool();

console.log('\nListo. El servicio de docentes ya no necesita internet para responder.');