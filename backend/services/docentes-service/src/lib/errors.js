// ---------------------------------------------------------------------------
// ERRORES DE NEGOCIO
//
// Patron heredado de pokemon-service, donde los errores de negocio son
// `Error` normales con una propiedad `status`:
//
//   const error = new Error('Docente no encontrado');
//   error.status = 404;
//   throw error;
//
// y el manejador central de src/server.js decide el codigo HTTP a partir de
// esa propiedad. Asi las cuatro capas (routes -> services -> repositories) tiran
// el mismo tipo de error y no hace falta una clase propia.
//
// Se separa en su propio archivo para que quede documentado EN UN SITIO que
// este microservicio no usa clases de error propias ni codigos HTTP sueltos.
// ---------------------------------------------------------------------------

/**
 * Crea un error de negocio con su codigo HTTP.
 *
 * @param {string} mensaje Texto que vera el cliente.
 * @param {number} status  Codigo HTTP (400, 404, ...).
 * @returns {Error} El error, ya con la propiedad `status` puesta.
 */
export function httpError(mensaje, status) {
  const error = new Error(mensaje);
  error.status = status;
  return error;
}