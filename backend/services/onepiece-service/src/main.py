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
    #    sin forma de consultarlo. Ahora el servicio levanta en modo degradado,
    #    `/health` devuelve 200 con `status: error` y el motivo exacto, y las
    #    rutas de datos devuelven ese mismo motivo. Todo eso se lee con un curl.
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
    # El shard se resuelve al LEVANTAR y no solo cuando se usa la base: lo
    # necesita el sondeo TCP de `/health` para separar "Atlas me cierra la puerta"
    # de "no llego al puerto 27017". Resolver un SRV es una consulta DNS, no una
    # conexion, asi que no puede fallar por lo que este fallando.
    log(f"SHARD: {connection.resolver_shard()}")

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
    propias variables de entorno, y llamarlo "error interno" solo obliga a ir a
    mirar el log de Render. Un despliegue mal configurado tiene que poder
    diagnosticarse desde fuera.

    Aqui el 503 SI es correcto, a diferencia del de `/health`: esto no lo consulta
    `healthCheckPath`, y un 503 en una ruta de datos es exactamente lo que la app
    necesita ver para pintar su aviso de error.
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
        "Cuando la configuracion esta mal o la base no responde, responde **200** "
        "con `status: error` y el motivo exacto dentro. Sigue siendo 200 a "
        "proposito: `healthCheckPath` de Render reinicia la instancia ante un 503, "
        "y con 503 el servicio se reiniciaba en bucle y quedaba inalcanzable, sin "
        "poder consultarse ni desde la app ni con un curl."
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
    # vivo y `/health` responde con `status: error` y la causa exacta. Antes, en
    # ese mismo caso, el proceso moria al importar y no habia ninguna URL que
    # consultar; y con 503, Render reiniciaba la instancia en bucle y tampoco
    # habia forma de leerlo desde fuera.
    if connection.ERROR_CONFIGURACION:
        log(f"health: {connection.ERROR_CONFIGURACION}")
        return {
            "status": "error",
            "service": "onepiece-service",
            "error": connection.ERROR_CONFIGURACION,
        }

    try:
        personajes = await repo.count()
    except Exception as exc:  # noqa: BLE001 - aqui el motivo SI es util
        # POR QUE 200 Y NO 503 (y no es casualidad, es lo unico que funciona):
        #
        # `healthCheckPath: /health` de Render trata un 503 como "el servicio esta
        # caido" y REINICIA la instancia. Con 503 aqui se entra en un bucle en el
        # que Render reinicia el proceso cada pocos segundos, el origen deja de
        # atender y el servicio queda INALCANZABLE: ni la app ni un curl Contestan.
        # Eso se quedaba de verdad: con /health en 503, `curl` al servicio devolvia
        # error de conexion en vez de su mensaje de diagnostico. Para enterarse
        # habia que bajar a los logs de Render, que es justo lo que se queria
        # evitar.
        #
        # Asi que el codigo HTTP responde "el proceso vive y sirve", que es lo
        # que Render necesita saber, y el estado de la base va DENTRO, en
        # `status: error`. Se lee igual de bien con un curl y el servicio no se
        # reinicia. Cuando la base este bien, `status` pasa a `ok` sin tocar nada.
        #
        # El motivo va YA TRADUCIDO: la excepcion de pymongo para un fallo de
        # Atlas son ~900 caracteres de TopologyDescription con los tres shards
        # repetidos, de los que hay que extraer mentalmente una sola conclusion.
        #
        # Y se acompana de un SONDEO TCP al shard, que es lo que separa las dos
        # causas que el alert de TLS deja indistinguibles.
        motivo = connection.diagnosticar_error(exc)
        detalle = {}
        if "tlsv1 alert" in str(exc) or "SSL handshake failed" in str(exc):
            sondeo = await connection.sondear_alcance(
                connection.SHARD_HOST, connection.SHARD_PORT
            )
            detalle = {
                "tcp_al_shard": sondeo["tcp"],
                "tcp_detalle": connection.formatear_sondeo(sondeo),
            }
            motivo = f"{motivo}\n{detalle['tcp_detalle']}"

        log(f"health: {motivo}")
        return {
            "status": "error",
            "service": "onepiece-service",
            "error": motivo,
            **detalle,
        }

    return {"status": "ok", "service": "onepiece-service", "characters": personajes}


app.include_router(characters_router.router)
