// ---------------------------------------------------------------------------
// LEVANTAR LOS 3 PROCESOS A LA VEZ  (desarrollo)
//
//   node scripts/dev.js
//
// Cada microservicio corre como un proceso de Node independiente, igual que
// en produccion. No es un detalle: así se reproduce de verdad el
// comportamiento de microservicios (si uno se cae, se nota).
//
// Ctrl+C detiene los tres.
//
// NOTA: cada servicio lee su propia variable de base de datos
// (POKEMON_DATABASE_URL / ONEPIECE_DATABASE_URL). Si faltan, los procesos
// mueren al arrancar y el log dice cual es.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const PROCESSES = [
  { name: 'pokemon-service', cwd: path.join(root, 'services/pokemon-service'), color: '\x1b[36m' },
  { name: 'onepiece-service', cwd: path.join(root, 'services/onepiece-service'), color: '\x1b[35m' },
  { name: 'gateway', cwd: path.join(root, 'gateway'), color: '\x1b[32m' },
];

const children = [];

for (const proc of PROCESSES) {
  const child = spawn('node', ['src/index.js'], {
    cwd: proc.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env, // se heredan las variables de entorno del proceso actual
  });

  const prefix = `${proc.color}[${proc.name}]\x1b[0m`;

  // Separa por lineas para poder prefijar cada una con el nombre del servicio.
  const pipe = (stream, target) => {
    stream.setEncoding('utf8');
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) target.write(`${prefix} ${line}\n`);
    });
  };

  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    console.log(`${prefix} termino con codigo ${code}`);
  });

  children.push(child);
}

const shutdown = () => {
  console.log('\nDeteniendo servicios...');
  for (const child of children) child.kill('SIGTERM');
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);