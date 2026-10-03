# ---------------------------------------------------------------------------
# POOL DE CONEXIONES A POSTGRESQL  (asyncpg)
#
# QUE CAMBIA RESPECTO A LA VERSION NODE:
#
# En Node se usaba la libreria `pg`, que es asincrona por callbacks/promesas.
# Aqui se usa `asyncpg`, que es asincrona con la sintaxis `await` de Python.
# El concepto es el mismo (un pool de conexiones reutilizables), pero cambian
# dos detalles que conviene tener claros:
#
#   1. `asyncpg` solo admite parametros POSICIONALES ($1, $2, ...), igual que
#      la libreria `pg`. Nunca se concatena texto: eso es lo que evita la
#      inyeccion SQL.
#   2. El pool se crea de forma ASINCRONA (await), no en el momento de
#      importar el modulo. Por eso hay una funcion `get_pool()` que lo crea la
#      primera vez y lo reutiliza despues.
#
# SSL: Supabase EXIGE conexion cifrada con un certificado propio. Node lo
# resolvia con `rejectUnauthorized: false`; aqui el equivalente es un
# SSLContext con check_hostname desactivado y verificacion de certificado
# desactivada. Con DATABASE_SSL=false se conecta a un Postgres local sin SSL.
# ---------------------------------------------------------------------------

import os
import ssl as ssl_module
from pathlib import Path
from urllib.parse import urlsplit

import asyncpg

# Ruta del esquema respecto a este archivo. Se usa Path y no un string relativo
# para que funcione sin importar desde que carpeta se lance el proceso.
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"

# Cada microservicio tiene SU PROPIA base de datos. Por eso se lee primero la
# variable especifica del servicio y se cae a DATABASE_URL solo como valor por
# defecto (util para scripts locales).
CONNECTION_STRING = os.environ.get("ONEPIECE_DATABASE_URL") or os.environ.get("DATABASE_URL")

# Falla pronto y con un mensaje claro, en lugar de dejar que asyncpg lance un
# error de conexion mas adelante y mas dificil de entender.
if not CONNECTION_STRING:
    raise RuntimeError("Falta ONEPIECE_DATABASE_URL (o DATABASE_URL) en el entorno.")


def _extraer_host():
    """Host de la base, SIN usuario ni contrasena, solo para los logs de arranque.

    Sirve para responder de un vistazo a "contra que base estoy hablando":
    "localhost" = Postgres local; "aws-0-...pooler.supabase.com" = Supabase.
    urlsplit entiende "postgresql://..." y separa el host, asi que lo que se
    imprime nunca incluye credenciales.
    """
    try:
        return urlsplit(CONNECTION_STRING).hostname or "desconocido"
    except Exception:
        return "desconocido"


DB_HOST = _extraer_host()

# Por defecto se pide SSL (lo que exige Supabase). DATABASE_SSL=false lo
# desactiva para un Postgres local (Docker) que no tenga SSL configurado.
_USE_SSL = os.environ.get("DATABASE_SSL") != "false"

# El pool se guarda a nivel de modulo y se crea una sola vez.
_pool = None


def _ssl_context():
    """Contexto SSL equivalente al `rejectUnauthorized: false` de Node."""
    if not _USE_SSL:
        return None
    ctx = ssl_module.create_default_context()
    # Supabase usa un certificado que Python no puede validar contra la cadena
    # de autoridades por defecto; se acepta igual que hacia la version Node.
    ctx.check_hostname = False
    ctx.verify_mode = ssl_module.CERT_NONE
    return ctx


async def get_pool():
    """Devuelve el pool, creandolo la primera vez (lazy)."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            dsn=CONNECTION_STRING,
            ssl=_ssl_context(),
            min_size=1,
            max_size=10,          # conexiones maximas simultaneas del proceso
            command_timeout=30,   # aborta una consulta que tarde mas de 30s
            # Supabase pone un pooler delante de PostgreSQL (Supavisor). En modo
            # TRANSACCION ese pooler reutiliza conexiones entre clientes y no
            # admite sentencias preparadas con nombre; asyncpg las usa por
            # defecto y fallaria con "prepared statement already exists".
            # Desactivar la cache (0) evita ese fallo y funciona igual con el
            # pooler en modo sesion. El coste es minimo para este trafico.
            statement_cache_size=0,
        )
    return _pool


async def query(text, *params):
    """Ejecuta una consulta y devuelve todas sus filas."""
    pool = await get_pool()
    return await pool.fetch(text, *params)


async def query_one(text, *params):
    """Igual que query(), pero devuelve solo la primera fila (o None)."""
    pool = await get_pool()
    return await pool.fetchrow(text, *params)


async def ensure_schema():
    """Crea la tabla y el trigger si no existen. Idempotente.

    `pool.execute` sin parametros usa el protocolo simple de PostgreSQL, que
    admite varios statements separados por punto y coma (CREATE TABLE, CREATE
    INDEX, CREATE FUNCTION, CREATE TRIGGER). Por eso schema.sql se puede enviar
    entero de una vez.
    """
    pool = await get_pool()
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    await pool.execute(sql)


async def close_pool():
    """Cierra el pool. Necesario en los scripts que terminan (seed)."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
