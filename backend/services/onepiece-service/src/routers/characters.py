# ---------------------------------------------------------------------------
# CAPA HTTP  (servicio de One Piece, FastAPI)
#
# Responsabilidad unica: traducir HTTP <-> funciones del service. No hay logica
# de negocio aqui ni SQL.
#
# El router declara las rutas con el path COMPLETO (/api/characters, sin usar
# `prefix`) para que coincidan exactamente con las que exponia la version Node.
# El gateway reenvia a esas rutas, asi que no pueden cambiar.
#
# Los `response_model` y `responses` no son decoracion: FastAPI los usa para
# generar la documentacion Swagger, que es un requisito del trabajo.
# ---------------------------------------------------------------------------

from fastapi import APIRouter

from ..lib.log import crear_log
from ..models.character import Character, CharacterList, ErrorResponse, SearchRequest, SearchResponse
from ..services import characters_service as service

router = APIRouter()
log = crear_log("onepiece-service")


@router.get(
    "/api/characters",
    response_model=CharacterList,
    tags=["Personajes"],
    summary="Lista los personajes guardados",
    description="Devuelve los 20 personajes de la base de datos local, ordenados por id.",
)
async def list_characters():
    return await service.list_characters()


@router.post(
    "/api/characters/search",
    response_model=SearchResponse,
    tags=["Personajes"],
    summary="Busca un personaje por nombre",
    description=(
        "Busca en la base de datos LOCAL, nunca en la API externa. "
        "La comparacion es tolerante: ignora mayusculas, acentos y puntuacion, "
        "y tambien busca dentro del nombre de la tripulacion."
    ),
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
async def search_characters(payload: SearchRequest | None = None):
    # El cuerpo puede faltar por completo: en ese caso `name` es None y el
    # service responde 400. Asi se evita el 422 automatico de FastAPI, que no
    # forma parte del contrato.
    term = payload.name if payload else None
    results = await service.search_characters(term)
    # Deja constancia de QUE se busco y CUANTOS resultados hubo. El termino se
    # imprime crudo, para poder detectar problemas de normalizacion.
    log(f'busqueda "{term}" -> {len(results)} resultado(s)')
    return {"data": results}


@router.get(
    "/api/characters/{character_id}",
    response_model=Character,
    tags=["Personajes"],
    summary="Obtiene un personaje por id",
    responses={404: {"model": ErrorResponse}},
)
async def get_character(character_id: str):
    return await service.get_character_by_id(character_id)
