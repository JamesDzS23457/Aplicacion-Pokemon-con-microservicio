import { execSync, spawn } from 'node:child_process';

function killPort(port) {
  try {
    const pids = execSync(`lsof -ti tcp:${port}`, { stdio: 'pipe' }).toString().trim();
    if (pids) {
      const list = pids.split(/\s+/);
      for (const pid of list) {
        if (pid) {
          try { process.kill(parseInt(pid), 'SIGKILL'); } catch {}
        }
      }
      console.log(`Liberado puerto ${port}`);
    }
  } catch {}
}

function pkill(pattern) {
  try {
    execSync(`pkill -9 -f "${pattern}"`, { stdio: 'pipe' });
  } catch {}
}

const PORTS = [3000, 4001, 4002, 4003];
for (const p of PORTS) killPort(p);

pkill('gateway|pokemon-service|docentes-service|onepiece-service');
pkill('uvicorn.*src.main');
pkill('node.*backend/gateway');
pkill('node.*backend/services/pokemon');
pkill('node.*backend/services/docentes');

console.log('Puertos liberados. Iniciando backend...');
