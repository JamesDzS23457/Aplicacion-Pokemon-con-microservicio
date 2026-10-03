// ---------------------------------------------------------------------------
// CONFIGURACION DE LA API + LOGS DEL FRONTEND
//
// Centraliza dos cosas que antes estaban repetidas en cada contexto:
//   1. La URL del gateway (vivir en un solo sitio evita que se desincronicen).
//   2. El registro de a quien se consulta y que se busca.
//
// La app NUNCA llama a PokeAPI ni a One Piece API: solo a este gateway.
// ---------------------------------------------------------------------------

// La URL del gateway. Tiene que leerse como process.env.EXPO_PUBLIC_API_URL,
// literal: Expo solo reemplaza por el valor real aquellas referencias escritas
// asi. Con destructuring (const { X } = process.env) NO se inlina y en
// produccion quedaria undefined.
//
// El respaldo localhost solo sirve en el navegador del propio equipo: en un
// movil fisico, "localhost" es el telefono, no tu ordenador.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// De donde salen los datos: tu maquina o Render. Mismo criterio que el backend:
// localhost/127.0.0.1 = LOCAL; cualquier otro host = DESPLEGADO.
export const ENTORNO = /^https?:\/\/(localhost|127\.0\.0\.1)/i.test(API_URL)
  ? 'LOCAL'
  : 'DESPLEGADO';

/**
 * Log del frontend. Se imprime en la consola del navegador (web) o en la
 * terminal de Expo (movil). El prefijo deja claro que la linea viene del
 * cliente y no del servidor.
 */
export function log(mensaje: string) {
  console.log(`[frontend] [${ENTORNO}] ${mensaje}`);
}

// Se ejecuta UNA vez al importar este modulo, es decir al arrancar la app.
// Sirve para ver de un vistazo, antes de buscar nada, contra quien se va a
// hablar: el backend local o los microservicios desplegados.
log(
  `API = ${API_URL} (` +
    (ENTORNO === 'LOCAL'
      ? 'backend LOCAL en tu maquina'
      : 'microservicios DESPLEGADOS en Render') +
    ')',
);
