// ---------------------------------------------------------------------------
// REGISTRO (LOGS) DEL MICROSERVICIO
//
// Mismo formato de una linea que los otros servicios:
//
//   [2026-10-17 09:12:44] [LOCAL] [asistente-service] pregunta "..." -> ...
//
// ENTORNO se deduce de RENDER, igual que en pokemon-service.
//
// Este archivo esta duplicado a proposito en cada microservicio: cada paquete es
// independiente y no debe importar codigo de otro (esa separacion es la que
// permite desplegarlos por separado). Si se cambia el formato, hay que cambiarlo
// en todos.
// ---------------------------------------------------------------------------

export const ENTORNO = process.env.RENDER ? 'DESPLEGADO' : 'LOCAL';

// Fecha y hora en hora LOCAL del servidor (no UTC), para que coincida con el
// reloj de quien mira la consola.
function ahora() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

/**
 * Crea una funcion de log ya etiquetada con el nombre del servicio.
 *
 *   const log = crearLog('asistente-service');
 *   log('mensaje');
 */
export function crearLog(nombre) {
  return (mensaje) => console.log(`[${ahora()}] [${ENTORNO}] [${nombre}] ${mensaje}`);
}
