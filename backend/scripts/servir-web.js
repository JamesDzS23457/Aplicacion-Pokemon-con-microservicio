// ---------------------------------------------------------------------------
// SERVIR LA EXPORTACION WEB CON CABECERAS DE AISLAMIENTO
//
//   npm run web:build && npm run web:serve
//
// POR QUE EXISTE
// El modo sin conexion de la pestana de Docentes guarda un espejo en SQLite
// (expo-sqlite). En WEB eso usa WebAssembly + SharedArrayBuffer, y el navegador
// solo lo habilita en un "contexto aislado": la pagina tiene que venir con
// Cross-Origin-Opener-Policy y Cross-Origin-Embedder-Policy.
//
// El servidor de desarrollo de Expo (`npm run web`) NO manda esas cabeceras,
// asi que ahi el espejo local no arranca y la app cae al modo sin respaldo.
// Este script sirve la carpeta `dist/` (el `expo export`) con las cabeceras
// puestas, replicando lo que hace vercel.json en produccion.
//
// Se usa COEP `credentialless` (no `require-corp`) porque credentialless igual
// aisla la pagina pero deja cargar las fotos externas de los docentes (las de
// linkedin), que con require-corp el navegador bloquearia.
//
// USO
//   npx expo export --platform web          (genera dist/)
//   node backend/scripts/servir-web.js dist 8088
//   abrir http://127.0.0.1:8088/docentes
//
// ES SOLO PARA DESARROLLO/PRUEBAS. No es el servidor de produccion.
// ---------------------------------------------------------------------------

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(process.argv[2] || 'dist');
const PUERTO = Number(process.argv[3] || 8088);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function archivoPara(url) {
  const limpia = decodeURIComponent(url.split('?')[0]).replace(/^\/+/, '');
  const completo = path.join(RAIZ, limpia);
  // SPA: cualquier ruta que no sea un archivo real vuelve a index.html,
  // igual que el *rewrite* de vercel.json. Sin esto, /docentes daria 404.
  if (completo.startsWith(RAIZ) && existsSync(completo) && statSync(completo).isFile()) {
    return completo;
  }
  return path.join(RAIZ, 'index.html');
}

const servidor = http.createServer((req, res) => {
  const archivo = archivoPara(req.url || '/');
  const ext = path.extname(archivo).toLowerCase();
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] || 'application/octet-stream',
    // Aislamiento para wa-sqlite (SharedArrayBuffer).
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    // Pruebas: nada de cache, para ver siempre la ultima exportacion.
    'Cache-Control': 'no-store',
  });
  createReadStream(archivo).pipe(res);
});

if (!existsSync(path.join(RAIZ, 'index.html'))) {
  console.error(`No hay ${path.join(RAIZ, 'index.html')}. Corre primero: npx expo export --platform web`);
  process.exit(1);
}

servidor.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Sirviendo ${RAIZ} en http://127.0.0.1:${PUERTO}`);
  console.log('Abre http://127.0.0.1:' + PUERTO + '/docentes');
});
