# ---------------------------------------------------------------------------
# REGISTRO (LOGS) DEL MICROSERVICIO EN PYTHON
#
# Formato de una linea, pensado para leerse igual en la terminal local y en el
# visor de logs de Render:
#
#   [2026-10-02 18:45:03] [LOCAL] [onepiece-service] busqueda "luffy" -> 1
#
# ENTORNO se deduce de la variable RENDER: Render la define como "true" en
# todos sus servicios, asi que no hay que configurar nada. Si la variable no
# esta, estamos en la maquina del desarrollador.
#
# Este archivo es la version Python del que tienen el gateway y pokemon-service
# en JavaScript. Se mantiene el MISMO formato a proposito: los logs de los tres
# servicios se leen juntos y conviene que las columnas coincidan.
# ---------------------------------------------------------------------------

import os
from datetime import datetime

# Igual que en JS: cualquier valor presente en RENDER cuenta como desplegado.
ENTORNO = "DESPLEGADO" if os.environ.get("RENDER") else "LOCAL"


def _ahora():
    """Fecha y hora local del servidor, para que coincida con el reloj de quien mira la consola."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def crear_log(nombre):
    """Devuelve una funcion de log ya etiquetada con el nombre del servicio.

    Uso:
        log = crear_log("onepiece-service")
        log("busqueda \\"luffy\\" -> 1 resultado(s)")
    """

    def log(mensaje):
        print(f"[{_ahora()}] [{ENTORNO}] [{nombre}] {mensaje}", flush=True)

    return log
