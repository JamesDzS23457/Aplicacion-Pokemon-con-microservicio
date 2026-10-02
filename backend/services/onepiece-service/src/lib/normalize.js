// ---------------------------------------------------------------------------
// NORMALIZACION DE NOMBRES
//
// Regla unica: minusculas, sin acentos, sin puntuacion, sin el sufijo
// "/ Alias" que usa la API (ej. 'Charlotte Linlin / Big Mom').
//
// Esto es lo que hace que 'Tony-Tony Chopper', 'tony tony chopper' y
// 'tonytonychopper' colisionen en la MISMA clave, que es lo que queremos:
// el usuario escribe como le salga y el servidor encuentra igual.
//
// Esta funcion es critica: si se cambia, hay que cambiarla en los DOS
// servicios (pokemon-service y onepiece-service). Los datos ya guardados en
// search_key se basan en esta normalizacion.
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
