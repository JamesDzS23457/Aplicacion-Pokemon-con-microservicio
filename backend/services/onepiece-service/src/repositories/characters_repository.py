# ---------------------------------------------------------------------------
# REPOSITORY DE PERSONAJES  (MongoDB)
#
# Esta es la UNICA capa del servicio que habla con la base de datos. Las de
# arriba (service y router) no saben si los datos vienen de MongoDB, de otro
# servicio o de un fichero. Eso es lo que permitio cambiar de PostgreSQL a
# MongoDB sin tocar las reglas de negocio ni el contrato HTTP.
#
# QUE CAMBIA RESPECTO A LA VERSION CON SQL:
#
#   - Se guardan DOCUMENTOS. El historial guardaba la tripulacion y la fruta
#     APLANADAS en columnas sueltas porque en una tabla relacional no hay otra
#     manera; aqui se guardan anidadas tal cual las usa el frontend, que es
#     justo lo que aporta una base de documentos.
#   - La busqueda deja de ser SQL. `ILIKE` no existe, asi que el mismo criterio
#     se expresa con un filtro de REGEX. Se sigue buscando dentro del nombre de
#     la tripulacion.
#   - `INSERT ... ON CONFLICT` se convierte en `replace_one(upsert=True)`, que es
#     el equivalente exacto: si el id existe se sustituye, si no, se crea.
#
# TRADUCCION DOCUMENTO <-> OBJETO:
#   `_map_doc` quita los dos campos internos (`_id` y `search_key`) y devuelve el
#   documento tal cual, porque ahora la forma anidada se guarda directamente en
#   lugar de reconstruirse.
# ---------------------------------------------------------------------------

import os
import re

from ..db.connection import get_collection

# Limite de personajes. Con PostgreSQL lo imponia un trigger de la base de
# datos; MongoDB no tiene triggers, asi que el mismo limite se comprueba aqui
# ANTES de insertar un documento nuevo. Sigue sin depender de quien escriba:
# seed, API o consola de Mongo pasan por esta funcion.
MAX_PERSONAJES = int(os.environ.get("ONEPIECE_MAX_PERSONAJES", "20"))


class LimiteAlcanzadoError(RuntimeError):
    """Se intenta guardar un personaje nuevo y ya hay MAX_PERSONAJES.

    Sustituye al trigger `enforce_characters_limit` de la version con
    PostgreSQL, con el mismo efecto observable: el registro NO se escribe.
    """


def _as_text(value):
    """Convierte un valor a texto, o None.

    La API externa a veces devuelve la recompensa como numero. En PostgreSQL
    hacia falta porque `asyncpg` es estricto con los tipos; en Mongo no habria
    ninguna excepcion, pero se mantiene la normalizacion para que el documento
    guardado sea siempre del mismo tipo y el contrato con el frontend no cambie.
    """
    if value is None:
        return None
    return str(value)


def _map_doc(doc):
    """Convierte un documento de MongoDB en el objeto que espera el frontend."""
    if doc is None:
        return None

    # Se copia sin los campos internos. `_id` es el identificador que genera
    # MongoDB y `search_key` es auxiliar de busqueda: ninguno forma parte del
    # contrato con la app.
    limpio = {k: v for k, v in doc.items() if k not in ("_id", "search_key")}
    return limpio


async def count():
    """Cuantos personajes hay guardados. Lo usa /health y el seed.

    Se usa `count_documents` y no el contador estimado de Mongo: /health informa
    de si la base esta llena o vacia, y ese numero tiene que ser EXACTO.
    """
    coleccion = await get_collection()
    return await coleccion.count_documents({})


async def find_all():
    """Los personajes guardados, ordenados por id."""
    coleccion = await get_collection()
    cursor = coleccion.find().sort("id", 1)
    return [_map_doc(doc) async for doc in cursor]


async def find_by_id(character_id):
    """Un personaje por su id, o None."""
    coleccion = await get_collection()
    doc = await coleccion.find_one({"id": int(character_id)})
    return _map_doc(doc)


async def search(key):
    """Busqueda tolerante sobre search_key (ya normalizada).

    Por eso 'luffy', 'LUFFY', 'monkey d luffy' y 'monkey d. luffy' encuentran lo
    mismo. Tambien busca dentro del nombre de la tripulacion para que escribir
    'sombrero' encuentre a toda la crew.

    El criterio es el mismo que en la version SQL, escrito con REGEX:
      - coincidencia EXACTA de search_key;
      - la que EMPIEZA por el termino;
      - la que solo lo CONTIENE;
      - el nombre de la tripulacion (sin distinguir mayusculas).

    Se hace con `aggregate` porque hay que ORDENAR por relevancia (exacto,
    despues prefijo, despues contenido) y MongoDB no puede ordenar por una
    condicion con `find`. Es lo que hacía el `ORDER BY CASE` de PostgreSQL.

    `re.escape` no es opcional: sin el, un termino con `.*` o `(` se interpretaria
    como regex y la busqueda traeria personajes que no coinciden con lo escrito.
    """
    if not key:
        return []

    termino = re.escape(key)
    coleccion = await get_collection()

    pipeline = [
        {
            "$match": {
                "$or": [
                    {"search_key": key},
                    {"search_key": {"$regex": f"^{termino}"}},
                    {"search_key": {"$regex": termino}},
                    {"crew.name": {"$regex": termino, "$options": "i"}},
                ]
            }
        },
        # _rango es SOLO para ordenar: 0 = exacto, 1 = empieza por, 2 = contiene.
        {"$addFields": {"_rango": {"$cond": [
            {"$eq": ["$search_key", key]}, 0,
            {"$cond": [
                {"$regexMatch": {"input": "$search_key", "regex": f"^{termino}"}},
                1,
                2,
            ]},
        ]}}},
        {"$sort": {"_rango": 1, "name": 1}},
        {"$limit": 20},
        {"$unset": ["_rango"]},
    ]

    # `aggregate` es una COROUTINA: hay que esperarla con await para obtener el
    # cursor. `find` en cambio ya devuelve el cursor. La distincion no es
    # intuitiva y rompe en silencio si se olvida el await, asi que se deja
    # comentada.
    cursor = await coleccion.aggregate(pipeline)
    return [_map_doc(doc) async for doc in cursor]


async def upsert(character):
    """Equivalente al "INSERT ... ON CONFLICT" de PostgreSQL.

    Hace que el seed sea idempotente: se puede ejecutar N veces y siempre deja
    los mismos 20 registros, sin duplicar ni fallar. Si el `id` ya existe se
    sustituye el documento entero; si no, se crea.

    Dos detalles que antes daba el trigger y el COALESCE de SQL:

      1. El limite de personajes se comprueba aqui, y SOLO cuando el documento
         es nuevo. Asi un re-seed con los mismos 20 ids nunca se bloquea a si
         mismo.
      2. Si esta ejecucion no consiguió imagen (Jikan caido o con limite de
         peticiones), se CONSERVA la que ya estaba guardada. Sin esto, un re-seed
         con Jikan caido borraria todas las imagenes, que es justo lo que paso
         la primera vez.
    """
    from ..lib.normalize import normalize_name  # import local: evita ciclo

    name = character["name"]
    id_personaje = int(character["id"])

    doc = {
        "id": id_personaje,
        "name": name,
        # Version normalizada del nombre (sin acentos, sin puntuacion, sin
        # "/ Alias"). Es lo que realmente se indexa y se compara en las busquedas.
        "search_key": normalize_name(name),
        "size": _as_text(character.get("size")),
        "age": _as_text(character.get("age")),
        "bounty": _as_text(character.get("bounty")),
        "job": _as_text(character.get("job")),
        "status": _as_text(character.get("status")),
        # crew y fruit se guardan ANIDADOS, no aplanados: es la forma natural
        # en una base de documentos y evita la conversion de la version SQL.
        "crew": (
            {
                "name": _as_text(character.get("crew_name")),
                "is_yonko": bool(character.get("crew_is_yonko") or False),
            }
            if character.get("crew_name")
            else None
        ),
        "fruit": (
            {
                "name": _as_text(character.get("fruit_name")),
                "type": _as_text(character.get("fruit_type")),
                "description": _as_text(character.get("fruit_description")),
            }
            if character.get("fruit_name")
            else None
        ),
        "image": _as_text(character.get("image_url")),
        "race": _as_text(character.get("race")),
        "raceEstimated": bool(character.get("race_estimated") or False),
    }

    coleccion = await get_collection()
    previo = await coleccion.find_one({"id": id_personaje}, {"image": 1})

    if previo is None:
        total = await coleccion.count_documents({})
        if total >= MAX_PERSONAJES:
            raise LimiteAlcanzadoError(
                f"La base ya tiene {total} personajes (limite {MAX_PERSONAJES}). "
                "Borra uno antes de guardar otro nuevo."
            )
    elif doc.get("image") is None and previo.get("image"):
        doc["image"] = previo["image"]

    await coleccion.replace_one({"id": id_personaje}, doc, upsert=True)


async def clear():
    """Borra todo. Solo lo usa el seed si algun dia se agrega --reset."""
    coleccion = await get_collection()
    await coleccion.delete_many({})
