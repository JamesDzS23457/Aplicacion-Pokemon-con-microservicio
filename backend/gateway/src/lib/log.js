// ---------------------------------------------------------------------------
// REGISTRO (LOGS) DEL GATEWAY
//
// Formato de una linea, pensado para leerse igual en la terminal local y en
// el visor de logs de Render:
//
//   [2026-10-02 18:45:03] [LOCAL] [gateway] POST /api/pokemon/search ...
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
 *   const log = crearLog('gateway');
 *   log('mensaje');
 */
export function crearLog(nombre) {
  return (mensaje) => console.log(`[${ahora()}] [${ENTORNO}] [${nombre}] ${mensaje}`);
}

/**
 * Clasifica una URL de destino como LOCAL (tu maquina) o DESPLEGADO (Render).
 *
 * Solo lo usa el gateway, que es el unico que decide a donde reenviar. Con
 * esto, cada linea de log dice si la busqueda salio hacia el backend local o
 * hacia los microservicios desplegados:
 *
 *   destino=LOCAL http://localhost:4001
 *   destino=DESPLEGADO https://pokemon-service-rtjy.onrender.com
 *
 * Se compara el host y no la cadena entera para no confundir un localhost que
 * aparezca como parte de otro nombre.
 */
export function clasificarDestino(url) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url)
    ? 'LOCAL'
    : 'DESPLEGADO';
}
