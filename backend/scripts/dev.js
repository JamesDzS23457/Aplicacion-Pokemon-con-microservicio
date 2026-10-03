// ---------------------------------------------------------------------------
// LEVANTAR LOS 3 PROCESOS A LA VEZ  (desarrollo)
//
//   node scripts/dev.js
//
// Cada microservicio corre como un proceso independiente, igual que en
// produccion. No es un detalle: asi se reproduce de verdad el comportamiento
// de microservicios (si uno se cae, se nota).
//
// DIFERENCIA IMPORTANTE: Pokemon y el gateway son Node; One Piece es Python.
// Por eso cada entrada de PROCESSES indica su comando y sus argumentos, en vez
// de asumir `node src/index.js`. El servicio Python se lanza con el intérprete
// de su entorno virtual (.venv), que es donde estan instaladas sus
// dependencias. Si el venv no existe, se cae a `python3` y se avisa.
//
// Ctrl+C detiene los tres.
// ---------------------------------------------------------------------------

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// Carga las variables del .env de la RAIZ del proyecto. Los scripts se lanzan
// sin dotenv y sin --env-file, asi que sin esto los dos microservicios mueren
// al arrancar con "Falta POKEMON_DATABASE_URL (o DATABASE_URL) en el entorno."
// y solo queda vivo el gateway (parece que "no arranca nada").
// loadEnvFile no pisa variables ya definidas en el entorno (verificado en Node
// 24), asi que exportar algo a mano siempre tiene prioridad sobre el archivo.
const envFile = path.join(root, '..', '.env');
if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}

// Directorio y interprete del servicio Python.
const onepieceDir = path.join(root, 'services/onepiece-service');
const venvPython = path.join(onepieceDir, '.venv', 'bin', 'python');
const python = existsSync(venvPython) ? venvPython : process.env.PYTHON || 'python3';

if (!existsSync(venvPython)) {
  console.warn(
    '[dev] No se encontro el venv del servicio Python. ' +
      'Ejecuta "npm run backend:setup" (o "cd backend && npm run onepiece:env"). ' +
      `Se intentara con "${python}".`,
  );
}

// Modo prueba offline. Cuando BLOCK_EXTERNAL=1 (lo define test-offline.sh),
// los procesos Node heredan NODE_OPTIONS con el preload block-external.js, que
// rechaza cualquier fetch que no sea a localhost. Se hace asi y no con un
// `--import` en la linea de comandos porque los procesos hijos no heredan los
// flags del padre, solo las variables de entorno.
const blockExternalPath =
  process.env.BLOCK_EXTERNAL === '1' ? path.join(__dirname, 'block-external.js') : null;

const PROCESSES = [
  {
    name: 'pokemon-service',
    command: 'node',
    args: ['src/index.js'],
    cwd: path.join(root, 'services/pokemon-service'),
    color: '\x1b[36m',
  },
  {
    name: 'onepiece-service',
    command: python,
    args: ['-m', 'uvicorn', 'src.main:app', '--host', '0.0.0.0', '--port', '4002'],
    cwd: onepieceDir,
    color: '\x1b[35m',
  },
  {
    name: 'gateway',
    command: 'node',
    args: ['src/index.js'],
    cwd: path.join(root, 'gateway'),
    color: '\x1b[32m',
  },
];

const children = [];

for (const proc of PROCESSES) {
  // Se heredan las variables de entorno del proceso actual. En modo offline se
  // anade el preload solo a los procesos Node (el Python no usa fetch).
  const env = { ...process.env };
  if (blockExternalPath && proc.command === 'node') {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import ${blockExternalPath}`.trim();
  }

  const child = spawn(proc.command, proc.args, {
    cwd: proc.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
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
