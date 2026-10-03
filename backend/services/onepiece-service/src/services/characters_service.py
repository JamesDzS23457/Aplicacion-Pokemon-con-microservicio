# ---------------------------------------------------------------------------
# CAPA DE REGLAS DE NEGOCIO  (servicio de One Piece)
#
# Que hace y que NO hace:
#   - Valida entradas y decide el codigo de error (400 vs 404).
#   - NO sabe nada de SQL: pide datos al repository.
#   - NO conoce HTTP: no toca request ni response.
#
# Misma logica que la version Node. Se separa del repository para poder cambiar
# de base de datos sin tocar esta capa.
# ---------------------------------------------------------------------------

from ..lib.errors import ApiError
from ..lib.normalize import normalize_name
from ..repositories import characters_repository as repo


async def list_characters():
    """GET /api/characters -> los 20 personajes guardados."""
    data = await repo.find_all()
    return {"count": len(data), "data": data}


async def get_character_by_id(raw_id):
    """GET /api/characters/{id} -> un personaje o 404.

    Si el id no es un numero, se responde 404 (no existe) en lugar de un error
    de conversion: desde fuera, un id invalido es simplemente "no encontrado".
    """
    try:
        character_id = int(raw_id)
    except (TypeError, ValueError):
        raise ApiError(404, "Personaje no encontrado")

    character = await repo.find_by_id(character_id)
    if not character:
        raise ApiError(404, "Personaje no encontrado")
    return character


async def search_characters(term):
    """POST /api/characters/search  { name }

    Dos validaciones que se confunden facil:
      - 400: el usuario no escribio nada. Es un error de quien llama.
      - 404: escribio algo, pero no esta en la base de datos local.
    """
    key = normalize_name(term)
    if not key:
        raise ApiError(400, "El nombre del personaje es obligatorio")

    results = await repo.search(key)
    if not results:
        raise ApiError(404, "Personaje no encontrado en la base de datos local")

    return results
