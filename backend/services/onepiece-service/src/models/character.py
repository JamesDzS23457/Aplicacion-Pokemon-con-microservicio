# ---------------------------------------------------------------------------
# MODELOS DE RESPUESTA DEL MICROSERVICIO
#
# IMPORTANTE: los nombres de los campos son el CONTRATO con el frontend. La
# version Node devolvia exactamente esta forma (crew y fruit anidados, `image`
# en vez de `image_url`, y `raceEstimated` en camelCase). Cambiar un nombre
# aqui obligaria a tocar la app, asi que se respeta al pie de la letra.
#
# Estos modelos cumplen ademas una funcion extra: FastAPI los lee para generar
# la documentacion Swagger, asi que la respuesta queda descrita sin escribir
# YAML a mano.
# ---------------------------------------------------------------------------

from pydantic import BaseModel, Field


class Crew(BaseModel):
    """Tripulacion del personaje (la API la entrega como objeto anidado)."""

    name: str | None = None
    is_yonko: bool = False


class Fruit(BaseModel):
    """Fruta del diablo. El nombre y el tipo se guardan traducidos al espanol."""

    name: str | None = None
    type: str | None = None
    description: str | None = None


class Character(BaseModel):
    """Un personaje tal como lo consume el frontend."""

    id: int
    name: str
    size: str | None = None
    age: str | None = None
    bounty: str | None = None
    job: str | None = None
    status: str | None = None
    crew: Crew | None = None
    fruit: Fruit | None = None
    image: str | None = None
    race: str | None = None
    raceEstimated: bool = Field(
        default=False,
        description="True si la raza se calculo por defecto (el personaje no estaba en el mapa curado).",
    )


class CharacterList(BaseModel):
    """Respuesta de GET /api/characters."""

    count: int
    data: list[Character]


class SearchResponse(BaseModel):
    """Respuesta de POST /api/characters/search."""

    data: list[Character]


class SearchRequest(BaseModel):
    """Cuerpo de la busqueda. `name` puede faltar: el service devuelve 400."""

    name: str | None = None


class HealthResponse(BaseModel):
    """Respuesta del healthcheck, con el conteo para detectar una BD vacia."""

    status: str
    service: str
    characters: int


class ErrorResponse(BaseModel):
    """Forma uniforme de error, identica a la del servicio en Node."""

    error: str
