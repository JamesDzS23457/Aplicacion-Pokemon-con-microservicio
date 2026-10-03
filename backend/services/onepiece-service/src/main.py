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
    #
    #    Pero si falta la URI de Mongo NO se aborta el arranque. Antes este await
    #    propagaba el RuntimeError de connection.py, el proceso moria sin
    #    escuchar y Render no daba ninguna URL: el despliegue fallaba en bucle
    #    sin forma de consultarlo. Ahora el el servicio levanta en modo degradado,
    #    `/health` devuelve 503 con el motivo exacto y las rutas de datos
    #    devuelven ese mismo motivo, que se puede leer con un curl.
    #
    #    `ensure_indexes` tambien puede fallar por la RED (Atlas dormido, IP
    #    bloqueada en la Network Access List). Es el mismo caso: es preferible
    #    un servicio que responde "no puedo leer la base" a uno que no existe.
    if connection.ERROR_CONFIGURACION:
        log(f"ARRANQUE DEGRADADO: {connection.ERROR_CONFIGURACION}")
    else:
        try:
            await connection.ensure_indexes()
        except Exception as exc:  # noqa: BLE001 - se registra y se sigue
            # Traducido tambien en el log: el de arranque es el primero que se
            # lee cuando algo va mal, y un TopologyDescription de 900
            # caracteres esconde el motivo real.
            log(f"AVISO: la base no responde todavia: {connection.diagnosticar_error(exc)}")
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

    EXCEPCION: si lo que falla es la CONFIGURACION (falta
    `ONEPIECE_MONGODB_URI`), si se devuelve el motivo. Ese error no contiene
    informacion interna: es un texto que el propio servicio escribio sobre sus
    propias variables de entorno, ycallarlo "error interno" solo obliga a ir a
    mirar el log de Render. Un despliegue mal configurado tiene que poder
    diagnosticarse desde fuera.
    """
    log(f"500: {exc}")
    if connection.ERROR_CONFIGURACION:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "onepiece-service",
                "error": connection.ERROR_CONFIGURACION,
            },
        )
    return JSONResponse(status_code=500, content={"error": "Error interno del servidor"})


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Salud"],
    summary="Estado del servicio",
    description=(
        "Comprueba que el servicio responde y cuantos personajes hay en la base. "
        "Devuelve **503** con el motivo exacto cuando la configuracion esta mal "
        "o la base de datos no responde: este es el endpoint de diagnostico en "
        "produccion, porque el servicio sigue vivo aunque la base no lo este."
    ),
)
async def health():
    # Incluye el conteo porque un servicio que responde pero tiene 0 personajes
    # es un servicio "sano pero inservible", y conviene poder detectarlo.
    # El conteo sale del repository, no de una consulta escrita aqui: la base
    # solo se toca desde repositories/.
    #
    # ESTE ES EL ENDPOINT DE DIAGNOSTICO EN PRODUCCION. Si el despliegue esta mal
    # configurado (falta ONEPIECE_MONGODB_URI) o Atlas no deja entrar, este es el
    # unico sitio donde se puede leer el motivo desde fuera: el servicio esta
    # vivo y `/health` responde 503 con la causa exacta. Antes, en ese mismo
    # caso, el proceso moria al importar y no habia ninguna URL que consultar.
    if connection.ERROR_CONFIGURACION:
        log(f"503: {connection.ERROR_CONFIGURACION}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "onepiece-service",
                "error": connection.ERROR_CONFIGURACION,
            },
        )

    try:
        personajes = await repo.count()
    except Exception as exc:  # noqa: BLE001 - aqui el motivo SI es util
        # A diferencia del resto de errores, aqui se devuelve el motivo. Y se
        # devuelve YA TRADUCIDO: la excepcion de pymongo para un fallo de Atlas
        # son ~900 caracteres de TopologyDescription con los tres shards, de los
        # que hay que extraer mentalmente una sola conclusion. `diagnosticar_error`
        # la deja en un texto corto que dice que hacer.
        #
        # Sin este endpoint un despliegue roto no se puede diagnosticar: el
        # servicio estaba vivo pero sin base, asi que no hay error de despliegue
        # que se vea en el panel, solo un 503 en cada peticion de la app.
        motivo = connection.diagnosticar_error(exc)
        log(f"503: {motivo}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "onepiece-service",
                "error": motivo,
            },
        )

    return {"status": "ok", "service": "onepiece-service", "characters": personajes}


app.include_router(characters_router.router)
