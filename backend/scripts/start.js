#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..', '..');

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { stdio: 'pipe' }).toString().trim();
    if (pids) {
      for (const pid of pids.split(/\s+/)) {
        if (pid) {
          try { process.kill(parseInt(pid), 'SIGKILL'); } catch {}
        }
      }
      console.log(`[start] Puerto ${port} liberado`);
    }
  } catch {}
}

const PORTS = [3000, 4001, 4002, 4003];
for (const p of PORTS) killPort(p);

try { execSync('pkill -9 -f "gateway|pokemon-service|docentes-service|onepiece-service"', { stdio: 'pipe' }); } catch {}
try { execSync('pkill -9 -f "uvicorn.*src.main"', { stdio: 'pipe' }); } catch {}

console.log('[start] Arrancando backend...');
process.chdir(root);
const child = spawn('node', ['backend/scripts/dev.js'], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
