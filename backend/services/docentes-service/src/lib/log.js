// ---------------------------------------------------------------------------
// REGISTRO (LOGS) DEL MICROSERVICIO DE DOCENTES
//
// Formato de una linea, IGUAL que en pokemon-service y en el gateway, para que
// los tres se lean igual en la terminal local y en el visor de logs de Render:
//
//   [2026-10-03 21:10:44] [LOCAL] [docentes-service] GET /api/docentes?q=ana
//
// ENTORNO se deduce de RENDER: Render define RENDER=true en todos sus
// servicios, asi que no hay que configurar nada.
//
// Este archivo esta duplicado en los demas servicios a proposito: cada uno es un
// paquete independiente y no debe importar codigo del otro (esa separacion es
// la que permite desplegarlos por separado). Si se cambia el formato, cambiarlo
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
 *   const log = crearLog('docentes-service');
 *   log('mensaje');
 */
export function crearLog(nombre) {
  return (mensaje) => console.log(`[${ahora()}] [${ENTORNO}] [${nombre}] ${mensaje}`);
}