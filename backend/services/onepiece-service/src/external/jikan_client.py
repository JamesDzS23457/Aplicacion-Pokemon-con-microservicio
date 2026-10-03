# ---------------------------------------------------------------------------
# CLIENTE DE IMAGENES  (Jikan / MyAnimeList)
#
# POR QUE EXISTE ESTE ARCHIVO:
# La API de datos de One Piece (onepiece_client.py) NO devuelve ninguna imagen.
# Sin este cliente, la columna image_url se quedaria siempre en NULL y la ficha
# mostraria el recuadro "OP" en vez del retrato del personaje.
#
# POR QUE JIKAN Y NO OTRAS FUENTES (probado a mano, no es una suposicion):
#   - Wikipedia: devuelve 429 de forma sistematica y, cuando responde, su
#     miniatura no siempre es del personaje.
#   - Fandom: su API funciona, pero su CDN responde 403 con un reto de
#     Cloudflare, lo que rompe tanto la descarga como el hotlink.
#   - Jikan: su API y su CDN (cdn.myanimelist.net) responden 200 y permiten
#     hotlinking, que es justo lo que hace el frontend.
#
# COMO FUNCIONA (una sola peticion para los 20):
# El endpoint /anime/{id}/characters devuelve TODOS los personajes del anime
# One Piece (id 21) con su imagen, en una sola respuesta. Se descarga una vez,
# se indexa por nombre normalizado y cada personaje se resuelve contra ese
# indice en memoria. Asi no se hace una peticion por personaje.
#
# Solo se guarda la URL del CDN, no se copia el archivo. En una app real habria
# que revisar los terminos de uso de MyAnimeList.
# ---------------------------------------------------------------------------

import httpx

from ..lib.normalize import normalize_name

BASE_URL = "https://api.jikan.moe/v4"

# ID de One Piece en MyAnimeList. Es estable y es lo que permite traer la lista
# completa de personajes de una sola vez.
ONEPIECE_ANIME_ID = 21

# 20s: la respuesta trae mas de 1400 personajes y en una conexion lenta puede
# tardar. Si aun asi no llega, el seed sigue sin imagenes en lugar de fallar.
TIMEOUT = 20.0

# Traduccion de nuestra grafia a la de MyAnimeList. MAL escribe algunos nombres
# distinto (coma en lugar de punto, otra romanizacion). Claves y valores van YA
# normalizados, asi que no dependen de tildes ni puntuacion.
MAL_NAME_ALIASES = {
    "trafalgardwaterlaw": "trafalgarlaw",
    "donquijotedoflamingo": "donquixotedoflamingo",
    "kaido": "kaidou",
}

# Cache del indice a nivel de modulo. Se guarda el RESULTADO (no la promesa,
# como en Node) porque el seed es secuencial: no hay dos descargas simultaneas.
_index = None

# Marca de fallo. Si la descarga del indice falla (Jikan caido, 504, limite de
# peticiones), no tiene sentido reintentar la MISMA descarga una vez por
# personaje: se apunta el fallo y los siguientes se guardan sin imagen sin
# volver a salir a internet. Sin esto, un 504 transitorio provocaba 20
# peticiones fallidas seguidas.
_index_failed = False


async def _fetch_json(url):
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()


async def _build_index():
    """Descarga los personajes de One Piece y los indexa por nombre normalizado.

    El valor guardado es la URL de la imagen. Cuando MAL tiene el mismo nombre
    repetido, gana el personaje con mas favoritos: es el que suele ser el
    canonico y evita quedarnos con una variante secundaria.
    """
    json = await _fetch_json(f"{BASE_URL}/anime/{ONEPIECE_ANIME_ID}/characters")

    entries = json.get("data") if isinstance(json, dict) else None
    # Se valida la forma de la respuesta: si Jikan cambiara el formato, mejor
    # fallar con un mensaje claro que con un error de indice mas abajo.
    if not isinstance(entries, list):
        raise RuntimeError("Respuesta inesperada de Jikan")

    index = {}
    for entry in entries:
        character = entry.get("character") or {}
        images = character.get("images") or {}
        # jpg primero por ser el formato universal; webp como respaldo.
        image = (images.get("jpg") or {}).get("image_url") or (images.get("webp") or {}).get("image_url")
        if not image:
            continue

        key = normalize_name(character.get("name"))
        if not key:
            continue

        favorites = entry.get("favorites") or 0
        current = index.get(key)
        if current is None or favorites > current["favorites"]:
            index[key] = {"image": image, "favorites": favorites}

    return index


async def _load_index():
    global _index
    if _index is None:
        _index = await _build_index()
    return _index


async def find_character_image(name):
    """Imagen del personaje, o None si no se encuentra.

    Aplica el alias de grafia si existe. Cualquier fallo de red se traduce en
    None en lugar de una excepcion: una imagen es un adorno y no debe tumbar la
    carga de los 20 personajes.
    """
    global _index_failed

    key = normalize_name(name)
    if not key:
        return None

    # Si la descarga del indice ya fallo, no se reintenta (ver _index_failed).
    if _index_failed:
        return None

    lookup_key = MAL_NAME_ALIASES.get(key, key)

    try:
        index = await _load_index()
        entry = index.get(lookup_key)
        return entry["image"] if entry else None
    except Exception as error:
        _index_failed = True
        print(f"  ! imagen: Jikan no disponible ({error}). Se guardara sin imagen.")
        return None
