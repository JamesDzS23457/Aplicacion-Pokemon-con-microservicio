// ---------------------------------------------------------------------------
// MIGRACION DE ONE PIECE: PostgreSQL (Supabase) -> MongoDB (Atlas)
//
// Copia los 20 personajes de la base RELACIONAL antigua a la base NO RELACIONAL
// nueva, sin volver a llamar a la API externa. Se hace asi, y no reejecutando
// el seed, por una razon concreta: la columna `race` esta curada a mano y las
// imagenes se resolverian de nuevo contra Jikan, que a veces falla. Importando
// lo que ya estaba, MongoDB recibe EXACTAMENTE los mismos 20 personajes.
//
//   cd backend && node scripts/migrate-characters-to-mongodb.js
//
// Es idempotente: hace upsert por id, asi que se puede ejecutar las veces que
// haga falta. NO borra nada de PostgreSQL: al terminar, esa base ya se puede
// tirar.
//
// Este script es una herramienta de UNA sola vez, no parte del servicio. Por eso
// NO usa `mongodb` de node_modules: la dependencia vive en Python, para no
// anadir un driver de Mongo al proyecto de Node, que no habla con MongoDB en
// ningun momento. Se usa el cliente oficial de Python que ya esta instalado en
// el venv del microservicio.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = join(AQUI, '..', 'services', 'onepiece-service');
const PYTHON = join(SERVICE_DIR, '.venv', 'bin', 'python');

// ---------------------------------------------------------------------------
// Carga del .env de la raiz (mismo criterio que el resto del backend: se sube
// hacia arriba hasta encontrarlo, y NO pisa variables ya definidas). El script
// Python hijo tambien los carga, pero hacerlo aqui permite pasarlos por el
// entorno de forma explicita.
// ---------------------------------------------------------------------------
function cargarEnv(inicio) {
  let dir = inicio;
  for (let intento = 0; intento < 6; intento += 1) {
    try {
      for (const linea of readFileSync(join(dir, '.env'), 'utf8').split('\n')) {
        const limpia = linea.trim();
        if (!limpia || limpia.startsWith('#') || !limpia.includes('=')) continue;
        const i = limpia.indexOf('=');
        const clave = limpia.slice(0, i).trim();
        const valor = limpia.slice(i + 1).trim().replace(/^["']|["']$/g, '');
        if (clave && !(clave in process.env)) process.env[clave] = valor;
      }
      return;
    } catch {
      const padre = dir.split('/').slice(0, -1).join('/') || '/';
      if (padre === dir) return;
      dir = padre;
    }
  }
}

cargarEnv(process.cwd());

// El origen y el destino son alternativas: se acepta el nombre especifico del
// servicio o el generico, igual que hacen connection.py (Python) y
// connection.js (Node). Por eso se comprueba la pareja, no las cuatro.
const PG_URL = process.env.ONEPIECE_DATABASE_URL || process.env.DATABASE_URL;
const MONGO_URI = process.env.ONEPIECE_MONGODB_URI || process.env.MONGODB_URI;

if (!PG_URL) {
  console.error('Falta ONEPIECE_DATABASE_URL (o DATABASE_URL): no se de donde leer.');
  process.exit(1);
}
if (!MONGO_URI) {
  console.error('Falta ONEPIECE_MONGODB_URI (o MONGODB_URI): no se de donde escribir.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// El trabalho de verdad (conectar, leer, escribir) se hace con pymongo en el
// venv del microservicio. Este archivo solo lanza ese script y le pasa las
// variables de entorno ya cargadas.
// ---------------------------------------------------------------------------
const SCRIPT_PYTHON = `
import asyncio, os, sys
sys.path.insert(0, ${JSON.stringify(SERVICE_DIR)})

from src.db import connection
from src.lib.normalize import normalize_name
from pymongo import AsyncMongoClient
import asyncpg

COLUMNAS = """
  id, name, search_key, size, age, bounty, job, status,
  crew_name, crew_is_yonko, fruit_name, fruit_type,
  fruit_description, image_url, race, race_estimated
"""

# El texto se normaliza igual que en src/repositories/characters_repository.py:
# PostgreSQL es estricto con los tipos y la API externa a veces manda numeros.
def como_texto(v):
    return None if v is None else str(v)

def a_documento(f):
    return {
        "id": f["id"],
        "name": f["name"],
        "search_key": f["search_key"],
        "size": como_texto(f["size"]),
        "age": como_texto(f["age"]),
        "bounty": como_texto(f["bounty"]),
        "job": como_texto(f["job"]),
        "status": como_texto(f["status"]),
        # crew y fruit ANIDADOS: la diferencia que hace natural a MongoDB.
        "crew": (
            {"name": como_texto(f["crew_name"]), "is_yonko": bool(f["crew_is_yonko"])}
            if f["crew_name"] else None
        ),
        "fruit": (
            {
                "name": como_texto(f["fruit_name"]),
                "type": como_texto(f["fruit_type"]),
                "description": como_texto(f["fruit_description"]),
            }
            if f["fruit_name"] else None
        ),
        "image": como_texto(f["image_url"]),
        "race": como_texto(f["race"]),
        "raceEstimated": bool(f["race_estimated"]),
    }

async def main():
    pool = await asyncpg.create_pool(dsn=os.environ["ONEPIECE_DATABASE_URL"], ssl=False)
    filas = await pool.fetch(f"SELECT {COLUMNAS} FROM characters ORDER BY id")
    await pool.close()
    print(f"Leidos {len(filas)} personajes de PostgreSQL.")
    if not filas:
        print("La base de origen esta vacia: no se migra nada.")
        sys.exit(1)

    cliente = AsyncMongoClient(os.environ["ONEPIECE_MONGODB_URI"])
    col = cliente[connection.DB_NAME][connection.COLLECTION_NAME]
    # Mismos indices que ensure_indexes() del servicio.
    await col.create_index([("name", 1)], unique=True, name="uniq_characters_name")
    await col.create_index([("search_key", 1)], name="idx_characters_search_key")

    for f in filas:
        await col.replace_one({"id": f["id"]}, a_documento(f), upsert=True)
        print(f"  + {f['name']} (raza: {f['race'] or 'sin dato'})")

    total = await col.count_documents({})
    print(f"\\nMigrados {len(filas)} personajes. MongoDB tiene {total}.")
    await cliente.close()
    print("\\nListo. La base antigua de One Piece ya se puede descartar.")

asyncio.run(main())
`;

console.log('== Migrando One Piece: PostgreSQL -> MongoDB ==\n');
execFileSync(PYTHON, ['-c', SCRIPT_PYTHON], {
  stdio: 'inherit',
  cwd: SERVICE_DIR,
});
