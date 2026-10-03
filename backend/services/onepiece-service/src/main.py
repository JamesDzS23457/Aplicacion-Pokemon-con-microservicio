# ---------------------------------------------------------------------------
# PUNTO DE ENTRADA  (microservicio onepiece-service, puerto 4002)
#
# Version Python (FastAPI) del servicio que antes estaba en Node. El contrato
# HTTP es el mismo, asi que el gateway y el frontend no cambian.
#
# Orden de arranque, importante:
#
#   1. lifespan -> ensure_indexes() crea los indices si no existen.
#                  Se hace ANTES de aceptar peticiones: asi ningun cliente
#                  recibe un 500 en los primeros milisegundos.
#   2. La app empieza a servir.
#
# Swagger: FastAPI genera la documentacion OpenAPI y la sirve sola. Aquellas
# rutas son requisito del trabajo:
#     /docs         -> Swagger UI (interfaz para probar la API)
#     /redoc        -> documentacion alternativa
#     /openapi.json -> el contrato en bruto
# ---------------------------------------------------------------------------

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .db import connection
from .lib.errors import ApiError
from .lib.log import ENTORNO, crear_log
from .models.character import HealthResponse
from .repositories import characters_repository as repo
from .routers import characters as characters_router

log = crear_log("onepiece-service")


@asynccontextmanager
async def lifespan(_app):
    """Arranque y parada del servicio (sustituye a los eventos on_event)."""
    # 1. Indices antes de escuchar. Es idempotente, asi que arrancar varias
    #    veces no rompe nada.
    await connection.ensure_indexes()
    puerto = os.environ.get("PORT", "4002")
    # Se imprime el entorno y CONTRA QUE BASE se habla (el host, nunca las
    # credenciales). Es lo primero que se mira si una busqueda "no encuentra
    # nada": si ENTORNO=LOCAL, estas consultando tu Mongo local, no Atlas.
    log(f"ENTORNO={ENTORNO} | BD={connection.DB_HOST} | escuchando en :{puerto}")

    yield

    # 2. Al parar, se cierra el cliente para no dejar conexiones abiertas.
    await connection.close_pool()


app = FastAPI(
    title="One Piece API",
    description=(
        "Microservicio propio de personajes de anime (One Piece) escrito en "
        "Python con FastAPI. Consume una base de datos NO RELACIONAL "
        "(MongoDB Atlas) con 20 personajes cargados una sola vez durante el "
        "seed. En tiempo de peticion NO consulta ninguna API externa: la "
        "respuesta sale de la base de datos local."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS abierto: el servicio lo consume el gateway (otro proceso) y, en
# desarrollo, se prueba desde el navegador. En un proyecto real se restringiria
# a los dominios permitidos.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ApiError)
async def api_error_handler(_request: Request, exc: ApiError):
    """Traduce un ApiError del service a la respuesta JSON del contrato.

    La forma es {"error": "..."} y no {"detail": "..."} (el formato que usa
    FastAPI por defecto) para que coincida EXACTAMENTE con la version Node y
    con lo que el gateway y el frontend ya esperan.
    """
    log(f"{exc.status}: {exc.message}")
    return JSONResponse(status_code=exc.status, content={"error": exc.message})


@app.exception_handler(Exception)
async def generic_error_handler(_request: Request, exc: Exception):
    """Errores inesperados (BD caida, bug) -> 500 generico.

    El detalle se registra completo en el log, pero al cliente se le devuelve un
    mensaje generico para no filtrar informacion interna. Mismo criterio que el
    middleware de errores de Express.
    """
    log(f"500: {exc}")
    return JSONResponse(status_code=500, content={"error": "Error interno del servidor"})


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Salud"],
    summary="Estado del servicio",
    description="Comprueba que el servicio responde y cuantos personajes hay en la base.",
)
async def health():
    # Incluye el conteo porque un servicio que responde pero tiene 0 personajes
    # es un servicio "sano pero inservible", y conviene poder detectarlo.
    # El conteo sale del repository, no de una consulta escrita aqui: la base
    # solo se toca desde repositories/.
    return {"status": "ok", "service": "onepiece-service", "characters": await repo.count()}


app.include_router(characters_router.router)
