// ---------------------------------------------------------------------------
// REGISTRO (LOGS) DEL MICROSERVICIO
//
// Formato de una linea, pensado para leerse igual en la terminal local y en
// el visor de logs de Render:
//
//   [2026-10-02 18:45:03] [LOCAL] [pokemon-service] busqueda "pikachu" -> 1
//
// ENTORNO se deduce de RENDER: Render define RENDER=true en todos sus
// servicios, asi que no hay que configurar nada. Si la variable no esta,
// estamos en la maquina del developer.
//
// Este archivo esta duplicado en gateway y en los dos microservicios a
// proposito: cada uno es un paquete independiente y no debe importar codigo
// del otro (esa separacion es la que permite desplegarlos por separado). Si
// se cambia el formato, cambiarlo en los tres.
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
 *   const log = crearLog('pokemon-service');
 *   log('mensaje');
 */
export function crearLog(nombre) {
  return (mensaje) => console.log(`[${ahora()}] [${ENTORNO}] [${nombre}] ${mensaje}`);
}
