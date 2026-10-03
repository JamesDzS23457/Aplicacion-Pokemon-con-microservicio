# ---------------------------------------------------------------------------
# CONEXION A MONGODB  (pymongo, cliente asincrono)
#
# QUE CAMBIA RESPECTO A LA VERSION CON POSTGRESQL:
#
# Este servicio es la parte NO RELACIONAL del proyecto. El de Pokemon sigue en
# PostgreSQL; aqui se guardan DOCUMENTOS, no filas. La diferencia no es solo de
# sintaxis, es de modelo:
#
#   - No hay `CREATE TABLE` ni SQL. El esquema lo definen los indices, que se
#     crean con `ensure_indexes()` y son idempotentes igual que el schema.sql
#     de la version anterior.
#   - No hay pool de conexiones que abrir y cerrar a mano: el cliente de Mongo
#     mantiene su propio conjunto de conexiones y abre/cierra por peticion. Se
#     crea una vez por proceso (`get_client`) y se reutiliza.
#   - La base y la coleccion se nombran aqui: `onepiece` > `characters`.
#
# POR QUE EL CLIENTE ASINCRONO:
# FastAPI es async. El cliente sincrono de pymongo bloquearia el event loop y el
# servicio atenderia una peticion a la vez. `AsyncMongoClient` mantiene la misma
# API pero con `await`.
#
# SSL/TLS: MongoDB Atlas lo exige siempre y lo negocia el driver por SRV, asi
# que aqui no hay nada que configurar (a diferencia de Postgres, donde habia que
# desactivar la verificacion del certificado de Supabase).
# ---------------------------------------------------------------------------

import os
from pathlib import Path
from urllib.parse import urlsplit

from pymongo import AsyncMongoClient

# ---------------------------------------------------------------------------
# CARGA DEL .ENV LOCAL
#
# Este modulo lo importan el propio servicio y seed.py, asi que es el punto
# por el que pasa todo proceso que usa la base. Aqui se lee el .env de la raiz
# del proyecto sin depender de como se lance. En produccion (Render) no hay
# archivo .env: las variables llegan del entorno y esto no hace nada.
#
# No se usa python-dotenv porque no esta en requirements.txt; basta un parser
# minimo de lineas KEY=VALUE. No se sobreescribe lo que ya venga del entorno.
# ---------------------------------------------------------------------------
def _buscar_env(inicio: Path):
    actual = inicio
    for _ in range(6):
        candidato = actual / ".env"
        if candidato.is_file():
            return candidato
        if actual.parent == actual:
            return None
        actual = actual.parent
    return None


def _cargar_env_local() -> None:
    ruta = _buscar_env(Path.cwd())
    if ruta is None:
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        clave = clave.strip()
        valor = valor.strip().strip('"').strip("'")
        if clave and clave not in os.environ:
            os.environ[clave] = valor


_cargar_env_local()

# Cada microservicio tiene SU PROPIA base de datos. Por eso se lee primero la
# variable especifica del servicio y se cae a MONGODB_URI solo como valor por
# defecto (util para scripts locales).
MONGODB_URI = os.environ.get("ONEPIECE_MONGODB_URI") or os.environ.get("MONGODB_URI")

# Falla pronto y con un mensaje claro, en lugar de dejar que pymongo lance un
# error de conexion mas adelante y mas dificil de entender.
if not MONGODB_URI:
    raise RuntimeError("Falta ONEPIECE_MONGODB_URI (o MONGODB_URI) en el entorno.")

# Nombre de la base y de la coleccion. En Mongo no hay `schema`, asi que el
# equivalente de "la tabla characters" es la coleccion con ese nombre dentro de
# la base `onepiece`.
DB_NAME = os.environ.get("ONEPIECE_MONGODB_DB", "onepiece")
COLLECTION_NAME = "characters"


def _extraer_host():
    """Host del clustro, SIN usuario ni contrasena, solo para los logs de arranque.

    Sirve para responder de un vistazo a "contra que base estoy hablando":
    "cluster0.xxxxx.mongodb.net" = MongoDB Atlas; "localhost" = Mongo local.
    urlsplit entiende "mongodb+srv://..." igual que "postgresql://...", asi que lo
    que se imprime nunca incluye credenciales.
    """
    try:
        return urlsplit(MONGODB_URI).hostname or "desconocido"
    except Exception:
        return "desconocido"


DB_HOST = _extraer_host()

# El cliente se guarda a nivel de modulo y se crea una sola vez, en el primer
# uso, no al importar el modulo (importarlo no debe abrir ninguna conexion).
_client = None


async def get_client():
    """Devuelve el cliente de Mongo, creandolo la primera vez (lazy)."""
    global _client
    if _client is None:
        _client = AsyncMongoClient(
            MONGODB_URI,
            # Corta pronto si no hay red o el clustro esta dormido, para que el
            # servicio responda con un error claro en vez de colgarse. Atlas
            # wakea en unos segundos, asi que 15s deja margen de sobra.
            serverSelectionTimeoutMS=15_000,
            # Atlas enruta por el SRV; con un solo host basta con una prueba de
            # vida al empezar y el driver se encarga del resto.
            connectTimeoutMS=10_000,
        )
    return _client


async def get_collection():
    """Devuelve la coleccion `characters` de la base `onepiece`."""
    client = await get_client()
    return client[DB_NAME][COLLECTION_NAME]


async def ping():
    """Comprueba que hay conexion de verdad. Lo usa /health y el seed."""
    client = await get_client()
    await client.admin.command("ping")
    return True


async def ensure_indexes():
    """Crea los indices si no existen. Idempotente.

    En MongoDB el indice es lo mas parecido a lo que hacia el `CREATE INDEX` y
    el `CREATE UNIQUE` de la version con PostgreSQL, y se puede repetir sin
    romper nada. El indice unico de `name` es el equivalente al `UNIQUE` de la
    tabla: no admite dos personajes con el mismo nombre.

    El indice de `search_key` es el campo por el que se hacen las busquedas
    tolerantes (ver repositories/characters_repository.py).
    """
    coleccion = await get_collection()
    await coleccion.create_index([("name", 1)], unique=True, name="uniq_characters_name")
    await coleccion.create_index([("search_key", 1)], name="idx_characters_search_key")


async def close_pool():
    """Cierra el cliente. Necesario en los scripts que terminan (seed)."""
    global _client
    if _client is not None:
        await _client.close()
        _client = None
