// ---------------------------------------------------------------------------
// CLIENTE DE LA IA PUBLICA  (external/)
//
// ESTE es el UNICO archivo del servicio que sale a internet. Todo lo demas
// (rutas, service, repositories) trabaja con datos locales o con los otros
// microservicios. Es la misma regla que en los demas servicios: las llamadas
// externas viven en external/ y en ningun otro sitio.
//
// La IA elegida es Google Gemini (plan gratuito). La clave va como variable de
// entorno del SERVIDOR (GEMINI_API_KEY): el frontend nunca la ve.
//
// NOTA SOBRE EL CONTRATO DE GEMINI: se usa la API REST v1beta, que es la que
// expone el plan gratuito. El cuerpo lleva:
//   - systemInstruction: el "papel" del asistente y las reglas de contexto.
//   - contents: el historial de la conversacion (user/model).
//   - generationConfig: temperatura y tope de tokens de salida.
// ---------------------------------------------------------------------------

import { config } from '../config.js';

/**
 * Convierte el historial del frontend al formato `contents` de Gemini.
 *
 * El frontend manda [{ rol: 'usuario' | 'asistente', texto }]. Gemini espera
 * roles 'user' y 'model'. Se descartan los mensajes vacios y se recorta a los
 * ultimos turnos: mandar toda la conversacion gasta tokens y no aporta nada.
 *
 * @param {Array<{rol?: string, texto?: string}>} historial
 * @param {number} maximos Numero maximo de mensajes a conservar.
 * @returns {Array<{role: string, parts: Array<{text: string}>}>}
 */
function aContenido(historial, maximos = 8) {
  if (!Array.isArray(historial)) return [];
  return historial
    .slice(-maximos)
    .filter((m) => m && typeof m.texto === 'string' && m.texto.trim() !== '')
    .map((m) => ({
      role: m.rol === 'asistente' ? 'model' : 'user',
      parts: [{ text: m.texto }],
    }));
}

/**
 * Extrae el texto de la respuesta de Gemini.
 *
 * La respuesta trae `candidates[0].content.parts`, un array de fragmentos. Se
 * unen todos. Si la IA se bloqueo (por ejemplo por un filtro de seguridad) no
 * hay candidatos: se devuelve cadena vacia y el service decide que hacer.
 *
 * @param {any} data Respuesta JSON de la API.
 * @returns {string} Texto plano.
 */
function extraerTexto(data) {
  const partes = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(partes)) return '';
  return partes
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

/**
 * Pide una respuesta a la IA publica.
 *
 * @param {object} opciones
 * @param {string} opciones.systemPrompt Reglas + contexto (catalogo y fichas).
 * @param {string} opciones.pregunta La pregunta del usuario.
 * @param {Array} [opciones.historial] Turnos anteriores.
 * @returns {Promise<string>} El texto que responde la IA.
 * @throws {Error & {status?: number}} Con `status` para que la ruta lo traduzca.
 */
export async function generarRespuesta({ systemPrompt, pregunta, historial = [] }) {
  if (!config.GEMINI_API_KEY) {
    const error = new Error(
      'El asistente no tiene configurada la clave de la IA (GEMINI_API_KEY). ' +
        'Agregala en el entorno del servicio para que pueda responder.',
    );
    error.status = 503;
    throw error;
  }

  const url = `${config.GEMINI_BASE_URL}/${config.GEMINI_MODEL}:generateContent`;

  const cuerpo = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [
      ...aContenido(historial),
      { role: 'user', parts: [{ text: pregunta }] },
    ],
    generationConfig: {
      // Temperatura baja: se busca fidelidad a los datos, no creatividad.
      temperature: 0.35,
      maxOutputTokens: 1024,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.IA_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // La clave viaja en la cabecera, no en la URL: asi no queda escrita en
        // los logs de proxies ni en el historial de peticiones.
        'x-goog-api-key': config.GEMINI_API_KEY,
      },
      body: JSON.stringify(cuerpo),
      signal: controller.signal,
    });
  } catch (error) {
    // AbortError = timeout. Cualquier otro = no se pudo conectar a la IA.
    const esTimeout = error?.name === 'AbortError';
    const fallo = new Error(
      esTimeout
        ? 'La IA tardo demasiado en responder.'
        : `No se pudo contactar a la IA: ${error?.cause?.code || error?.message || 'error de red'}`,
    );
    fallo.status = esTimeout ? 504 : 502;
    throw fallo;
  } finally {
    clearTimeout(timer);
  }

  const textoRespuesta = await response.text();
  let data;
  try {
    data = textoRespuesta ? JSON.parse(textoRespuesta) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    // Se propaga el mensaje de la IA (por ejemplo "API key not valid" o una
    // cuota agotada) porque es lo unico que explica el fallo. Google NO devuelve
    // la clave en el mensaje de error.
    const detalle = data?.error?.message || `HTTP ${response.status}`;
    const fallo = new Error(`La IA respondio con un error: ${detalle}`);
    fallo.status = 502;
    throw fallo;
  }

  const texto = extraerTexto(data);
  if (!texto) {
    const fallo = new Error('La IA no devolvio texto (puede haber bloqueado la respuesta).');
    fallo.status = 502;
    throw fallo;
  }
  return texto;
}
