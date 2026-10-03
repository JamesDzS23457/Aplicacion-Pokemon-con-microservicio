# ---------------------------------------------------------------------------
# CLIENTE DE LA API DE ONE PIECE
#
# UNICA capa que hace peticiones a internet junto con jikan_client.py. Se usa
# SOLO desde el seed: en el flujo normal de busqueda nunca se llama, porque la
# respuesta sale de MongoDB.
#
# Esa separacion es el requisito del profesor: si el servidor externo se cae,
# la app sigue funcionando con los 20 registros guardados.
#
# Version Python de onepiece.client.js. Usa httpx en modo asincrono para no
# bloquear el event loop mientras el seed descarga los datos.
# ---------------------------------------------------------------------------

import httpx

from ..lib.normalize import normalize_name

BASE_URL = "https://api.api-onepiece.com/v2/characters/en"
# 10s: si la API no responde en ese tiempo, se abandona la peticion.
TIMEOUT = 10.0


async def _get_json(url):
    """GET que devuelve JSON y lanza excepcion si el status no es 2xx.

    httpx aplica el timeout por peticion. A diferencia de Node, httpx no
    necesita AbortController: el propio cliente corta la conexion al vencer.
    """
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def list_characters():
    """Descarga la lista completa de personajes (786 en total)."""
    data = await _get_json(BASE_URL)
    # Se valida que sea una lista: si la API cambiara el formato, conviene
    # fallar aqui con un mensaje claro que mas abajo con "object is not iterable".
    if not isinstance(data, list):
        raise RuntimeError("Respuesta inesperada de One Piece API")
    return data


async def find_character_by_name(name):
    """Busca por nombre en memoria.

    La API ignora el query param ?name= (siempre devuelve los 786), asi que se
    descarga la lista y se filtra comparando el nombre YA normalizado.
    """
    key = normalize_name(name)
    if not key:
        return None
    for item in await list_characters():
        if normalize_name(item.get("name")) == key:
            return item
    return None


async def get_character_by_id(character_id):
    """Detalle completo de un personaje por su id."""
    return await _get_json(f"{BASE_URL}/{character_id}")
