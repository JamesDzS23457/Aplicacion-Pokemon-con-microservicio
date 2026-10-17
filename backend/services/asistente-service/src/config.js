// ---------------------------------------------------------------------------
// CONFIGURACION DEL ASISTENTE
//
// Este servicio no tiene base de datos propia: su "base de datos" es la de la
// app (Pokemon, One Piece y Docentes) y la consulta a traves de los otros
// microservicios. Por eso necesita saber:
//
//   - Donde estan esos microservicios (las 3 URLs).
//   - Como hablar con la IA PUBLICA (Gemini): la clave y el modelo.
//
// La CLAVE NUNCA va en el frontend: vive solo aqui, en el servidor. El frontend
// habla con el gateway, y el gateway con este servicio, y este con la IA.
// ---------------------------------------------------------------------------

/**
 * Normaliza a una URL absoluta. Copia deliberada de gateway/src/config.js (ver
 * alli el porque): en Render, `fromService` inyecta el host SIN protocolo, y
 * fetch() exige una URL absoluta. Los hosts locales van con http y el resto
 * (dominio de Render) con https.
 */
function normalizeUrl(value, fallback) {
  const url = value || fallback;
  if (/^https?:\/\//i.test(url)) return url;
  const esLocal = /^(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(url);
  return `${esLocal ? 'http' : 'https'}://${url}`;
}

export const config = {
  // Puerto por defecto en local. En Render la plataforma lo inyecta en PORT.
  PORT: Number(process.env.PORT || 4004),

  // Los tres microservicios que tienen los datos de la app.
  POKEMON_SERVICE_URL: normalizeUrl(process.env.POKEMON_SERVICE_URL, 'http://localhost:4001'),
  ONEPIECE_SERVICE_URL: normalizeUrl(process.env.ONEPIECE_SERVICE_URL, 'http://localhost:4002'),
  DOCENTES_SERVICE_URL: normalizeUrl(process.env.DOCENTES_SERVICE_URL, 'http://localhost:4003'),

  // IA publica (Google Gemini, plan gratuito). Sin clave el servicio arranca,
  // pero sus respuestas avisan de que la IA no esta configurada en vez de
  // morir al importar (mismo criterio que onepiece-service con MongoDB).
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  // Modelo por defecto. Se puede cambiar SIN tocar el codigo con GEMINI_MODEL.
  //
  // Se usa gemini-3.5-flash-lite: es el que Google recomienda para proyectos
  // nuevos y, medido el 2026-10-17, respondio en ~0.9 s mientras que
  // gemini-3.8-flash se quedo colgado a los 75 s (sobrecarga) y
  // gemini-flash-latest tardo 46 s. NO se usa la serie 2.5: Google la retiro
  // para proyectos nuevos (su API responde "no longer available to new users").
  // Alternativas de mas calidad (mas lentas / mas cuota): gemini-3.5-flash y
  // gemini-3.8-flash.
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  // Endpoint de la API de Gemini.
  GEMINI_BASE_URL:
    process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/models',

  // Cuanto tiempo se reutiliza el catalogo de entidades antes de volver a
  // pedirlo a los microservicios (ms). 5 minutos: los datos cambian poco y asi
  // una conversacion no golpea los servicios en cada mensaje.
  CATALOGO_TTL_MS: Number(process.env.CATALOGO_TTL_MS || 300_000),

  // Timeout de la llamada a la IA (ms). Gemini puede tardar; 45s deja margen
  // sin colgar la peticion del usuario para siempre.
  IA_TIMEOUT_MS: Number(process.env.IA_TIMEOUT_MS || 45_000),
};

/** true si hay clave de IA configurada. */
export const IA_CONFIGURADA = config.GEMINI_API_KEY.length > 0;
