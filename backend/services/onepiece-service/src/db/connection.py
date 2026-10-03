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
import sys
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

# Si falta la URI NO se revienta al importar. Este modulo antes hacia
# `raise RuntimeError` aqui, y como lo importa `src.main`, el proceso moria ANTES
# de escuchar: Render marcaba el despliegue como fallido en bucle y no dejaba
# ninguna URL a la que preguntarle nada. La unica pista era el log, que solo
# decia "falta la variable" sin decir que variables veia.
#
# Ahora el servicio arranca igualmente, `/health` responde 503 con el motivo
# exacto y las rutas de datos devuelven ese mismo motivo. Un despliegue mal
# configurado se diagnostica con un `curl`, sin depender del panel de Render.
# El fallo NO se pierde: `get_client()` sigue lanzandolo, solo cambia de momento
# y de superficie (log + HTTP, en vez de "el deploy fallo").
ERROR_CONFIGURACION = None


# ---------------------------------------------------------------------------
# DIAGNOSTICO DE UN ATLAS QUE RECHAZA LA CONEXION
# ---------------------------------------------------------------------------
# El sintoma clasico de Atlas es `SSL handshake failed: ... [SSL:
# TLSV1_ALERT_INTERNAL_ERROR] tlsv1 alert internal error`, y es muy engañoso por
# dos motivos: lo MANDA EL SERVIDOR (durante el TLS) y el nombre no tiene nada
# que ver con la causa. No es "el certificado esta mal" ni "el codigo esta mal":
# con la misma URI y desde otra maquina la misma pila conecta sin problema.
#
# La causa real, casi siempre, es una de estas dos:
#
#   1. LA IP NO ESTA EN LA NETWORK ACCESS LIST de Atlas. El filtrado por IP se
#      aplica al ESTABLECER la conexion, ANTES de autenticar, asi que Atlas
#      corta el TLS y el driver solo puede reportar un alert. Y Render no tiene
#      IP de salida fija, de modo que cualquier lista que no incluya
#      `0.0.0.0/0` lo deja fuera en algun despliegue.
#   2. La contrasena esta mal. Atlas responde tambien con alert de TLS en ese
#      caso, lo cual hace que los dos fallos sean indistinguibles por el error.
#
# Por eso este helper NO intenta adivinar: dice las dos posibilidades y como
# distinguirlas en un paso, en vez de repetir un error de 800 caracteres que no
# lleva a ninguna parte.
# ---------------------------------------------------------------------------
PISTAS_ATLAS_TLS = (
    "Atlas ha rechazado la conexion ANTES de autenticar, asi que el alert de TLS "
    "no habla de certificados ni del codigo. Las dos causas posibles son:\n"
    "  a) La IP de salida NO esta en la Network Access List de Atlas. Es lo mas "
    "probable: el filtrado por IP ocurre al establecer la conexion, antes del "
    "TLS, y Render NO tiene IP de salida fija. Solucion: en Atlas > Network "
    "Access List, anade '0.0.0.0/0' (Allow access from anywhere) o quita la "
    "restriccion.\n"
    "  b) La contrasena de la URI no es la del usuario. Atlas tambien corta el "
    "TLS en ese caso. Se distingue en un paso: la cadena del error trae "
    "'bad auth' si la contrasena falla de verdad; si solo dice 'tlsv1 alert', "
    "es la lista de IPs."
)


def diagnosticar_error(exc) -> str:
    """Convierte una excepcion de pymongo en un mensaje corto y accionable.

    Sin esto, `/health` devuelve la exception entera del driver: cuatro lineas
    de TopologyDescription con los tres shards y sus RTT, unos 900 caracteres
    que hay que leer a ojo para sacar una sola conclusion.
    """
    texto = str(exc)
    if "TLSV1_ALERT" in texto or "SSL handshake failed" in texto:
        # Los shards no aportan nada aqui y son lo que hace el mensaje ilegible.
        return PISTAS_ATLAS_TLS
    if "bad auth" in texto or "Authentication failed" in texto:
        return (
            "Atlas rechazo la contrasena de la URI (bad auth). El usuario de la "
            "cadena mongodb+srv:// no es el del proyecto del clustro, o la "
            "contrasena no es la suya."
        )
    if "ServerSelectionTimeoutError" in texto or "timed out" in texto:
        return (
            "Atlas no respondio a tiempo. Suele ser lo mismo que la lista de IPs "
            "(ver PISTAS_ATLAS_TLS), o un clustro M0 dormido que tarda en despertar."
        )
    # Cualquier otro error se devuelve entero: si no es un caso conocido, callar
    # la mitad de la informacion seria peor que verboso.
    return texto


if not MONGODB_URI:
    # -----------------------------------------------------------------------
    # DIAGNOSTICO DEL ARRANQUE
    #
    # Este es el error mas comun de este servicio en Render, y con el mensaje
    # corto ("falta la variable") no hay forma de saber por que: la variable
    # puede estar mal escrita, puesta en otro servicio, o no guardada. Como no
    # hay SSH al contenedor, el log de Render es la UNICA pista, asi que antes
    # de reventar se imprime exactamente que ve el proceso.
    #
    # Solo se imprimen NOMBRES de variable, nunca valores: los valores son
    # credenciales y Render las muestra en pantalla cifradas.
    # -----------------------------------------------------------------------
    import difflib  # stdlib; se importa aqui porque solo hace falta al fallar

    esperadas = ("ONEPIECE_MONGODB_URI", "MONGODB_URI")
    presentes = sorted(os.environ)

    sugerencias = {}
    for clave in presentes:
        for esperada in esperadas:
            # Solo se avisa si el nombre se parece a una variable de Mongo: asi
            # el aviso sale cuando el nombre esta cerca de verdad, y no por cada
            # variable del entorno que coincida en alguna letra.
            if 'mongo' not in clave.lower() and clave not in ('URI', 'URL', 'DATABASE_URL'):
                continue
            if clave.upper() == esperada:
                continue
            parecidas = difflib.get_close_matches(clave.upper(), esperadas, n=1, cutoff=0.5)
            if parecidas:
                sugerencias[parecidas[0]] = clave

    lineas = [
        '',
        '=' * 74,
        '  ONEDIECE: no encuentro la variable de conexion a MongoDB.',
        '=' * 74,
        f'  Esperaba una de: {", ".join(esperadas)}',
        f'  Variables de entorno que VE el proceso ({len(presentes)}):',
    ]
    lineas += [f'      {nombre}' for nombre in presentes]
    if sugerencias:
        lineas += ['', '  SOSPECHOSO: el nombre se parece al que busco, pero NO coincide:']
        lineas += [f'      pusiste "{real}"  ->  quizas quisiste decir "{wanted}"'
                   for wanted, real in sugerencias.items()]
    lineas += [
        '',
        '  En Render, este error casi siempre es uno de estos tres:',
        '    1. La variable se puso en OTRO servicio (el gateway o pokemon-service',
        '       no la necesitan; tiene que estar en onepiece-service).',
        '    2. El nombre esta mal escrito o con guiones bajos de mas.',
        '    3. Se pulso "Save Changes" pero NO se relanzo el despliegue: Render',
        '       solo injecta las variables en los procesos NUEVOS.',
        '=' * 74,
        '',
    ]
    print("\n".join(lineas), file=sys.stderr, flush=True)

    # El servicio NO se detiene aqui: arranca igualmente y lo dice en /health.
    ERROR_CONFIGURACION = (
        "Falta ONEPIECE_MONGODB_URI (o MONGODB_URI) en el entorno de Render. "
        "El log de arranque lista las variables que ve el proceso."
    )

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
    if not MONGODB_URI:
        return "SIN CONFIGURAR"
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
    if ERROR_CONFIGURACION:
        # Sin esto, `AsyncMongoClient(None)` fallaria con un error de pymongo
        # mucho mas dificil de leer que este.
        raise RuntimeError(ERROR_CONFIGURACION)
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
