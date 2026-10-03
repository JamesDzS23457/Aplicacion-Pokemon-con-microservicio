// ---------------------------------------------------------------------------
// NORMALIZACION DE NOMBRES (Pokemon)
//
// Mismo criterio que onepiece-service. DEBE mantenerse en sincronía entre los
// dos servicios. El bug del mapa de razas se debio a NO usar esta normalizacion.
//
// Regla: minusculas, sin acentos, sin puntuacion, sin la parte tras '/'
// (por si algun nombre de API tuviera alias). Sirve para que 'Pikachu',
// 'pikachu', 'PIKACHU' busquen lo mismo.
// ---------------------------------------------------------------------------

/**
 * Normalizacion de nombres, compartida por todas las capas.
 *
 * Regla unica: minusculas, sin acentos, sin puntuacion, sin el sufijo
 * "/ Alias" que usa la API (ej. 'Charlotte Linlin / Big Mom').
 *
 * Esto es lo que hace que 'Tony-Tony Chopper', 'tony tony chopper' y
 * 'tonytonychopper' colisionen en la MISMA clave, que es lo que queremos:
 * el usuario escribe como le salga y el servidor encuentra igual.
 */
export function normalizeName(value) {
  return String(value ?? '')
    .split('/')[0]
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
