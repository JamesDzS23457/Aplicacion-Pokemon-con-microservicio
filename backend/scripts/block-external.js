// ---------------------------------------------------------------------------
// BLOQUEADOR DE ACCESO EXTERNO  (se usa solo en pruebas)
//
// Que hace: reemplaza globalThis.fetch por una version que RECHAZA cualquier
// peticion que no vaya a localhost. Si algo intenta salir a internet, lo
// registra con las letras BLOQUEADO y lanza un error.
//
// ---------------------------------------------------------------------------
// POR QUE ESTO Y NO CORTAR LA RED
//
// La version anterior de esta prueba usaba `unshare -rn` para crear una
// "isla" de red sin salida. Con SQLite funcionaba, porque el archivo .db
// estaba en el propio disco y no necesitala red.
//
// Con Postgres ya no vale: la base esta en otro host y es inalcanzable
// desde una isla sin red. Tendriamos que levantar un Postgres tambien
// dentro de la isla, que es mucho lio para una prueba.
//
// Bloquear fetch es MEJOR prueba por dos motivos:
//
//   1. No necesita root ni namespaces de red. Funciona en cualquier equipo.
//   2. Es mas estricta. Cortar la red solo demuestra "no necesita internet".
//      Esto demuestra algo mas fuerte: "ni siquiera INTENTA llamar a la API
//      externa". Si alguien reintrodujera un fetch a PokeAPI en un service o
//      en un repository, el log lo delata en el Acto, aunque ese fetch luego
//      fallara igual por un error de red.
//
// Ademas funciona igual con Supabase: el acceso a la base lo hace la libreria
// `pg` por socket, no pasa por fetch, asi que no la bloquea.
//
// Uso:  node --import ./scripts/block-external.js scripts/dev.js
// ---------------------------------------------------------------------------

const SOLO_LOCAL = /^(localhost|127\.(\d{1,3}\.){3}\d{1,3}|\[::1\]|0\.0\.0\.0)$/;

const fetchReal = globalThis.fetch;

// Si el script se cargara dos veces (por ejemplo con --import repetido), este
// aviso evita apilar dos envoltorios y acabar bloqueando localhost tambien.
if (fetchReal?.[Symbol.for('blockExternal')]) {
  console.log('[block-external] ya estaba activo');
} else {
  const fetchBloqueado = (entrada, opciones) => {
    const url = typeof entrada === 'string' ? entrada : entrada?.url;
    let host;

    try {
      host = new URL(url).hostname;
    } catch {
      // Una URL no parseable significa que el codigo ya esta roto. Se deja
      // pasar la excepcion original de fetch en vez de enmascararla.
      return fetchReal(entrada, opciones);
    }

    if (!SOLO_LOCAL.test(host)) {
      // El mensaje va a stderr para que se distinga del log normal del
      // servicio, y se usa mayusculas para que grep lo encuentre sin
      // ambiguedad con otro texto.
      console.error(`[BLOQUEADO] intento de fetch a ${host} (${url})`);
      return Promise.reject(
        new Error(
          `Acceso externo bloqueado en modo prueba: ${url}. ` +
            'Solo se permite localhost.',
        ),
      );
    }

    return fetchReal(entrada, opciones);
  };

  fetchBloqueado[Symbol.for('blockExternal')] = true;
  globalThis.fetch = fetchBloqueado;
}
