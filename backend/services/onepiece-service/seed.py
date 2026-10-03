# ---------------------------------------------------------------------------
# SCRIPT DE CARGA DE DATOS  (seed, en Python)
#
# Es el UNICO archivo de este microservicio que consulta las APIs externas,
# apoyandose en la carpeta external/. Despues de ejecutarlo, el servicio
# funciona 100% con la base de datos y no necesita internet.
#
#   cd backend/services/onepiece-service && python seed.py
#
# Es idempotente: se puede ejecutar N veces sin duplicar personajes, porque el
# repository hace upsert por id en lugar de un INSERT a secas.
#
# Port del antiguo scripts/seed-characters.js. Se traduce al espanol durante la
# carga: la descripcion larga de la fruta se deja en su idioma original porque
# no se muestra en las pantallas principales.
# ---------------------------------------------------------------------------

import asyncio
import sys

from src.db import connection
from src.external import jikan_client, onepiece_client
from src.external.race_map import get_race
from src.lib.normalize import normalize_name
from src.lib.translations import (
    translate_age,
    translate_crew,
    translate_fruit_name,
    translate_fruit_type,
    translate_job,
    translate_status,
)
from src.repositories import characters_repository as repo

# Los 20 personajes que se guardan.
#
# OJO: estos nombres tienen que coincidir con los que devuelve la API, no con
# los nombres "correctos" de la vida real. Por eso hay rarezas como
# 'Trafalgar D. Water Law' (no 'Trafalgar Law') o 'Don Quijote Doflamingo' (no
# 'Donquixote'). La busqueda es normalizada, asi que acentos y puntuacion no
# importan.
CHARACTER_SEED_NAMES = [
    "Monkey D Luffy",
    "Roronoa Zoro",
    "Nami",
    "Usopp",
    "Sanji",
    "Tony-Tony Chopper",
    "Nico Robin",
    "Franky",
    "Brook",
    "Jinbe",
    "Trafalgar D. Water Law",
    "Portgas D Ace",
    "Sabo",
    "Shanks",
    "Boa Hancock",
    "Don Quijote Doflamingo",
    "Kaido",
    "Charlotte Linlin",
    "Crocodile",
    "Gol D. Roger",
]


def _nested(details, key, field):
    """Lee un campo de un objeto anidado que puede venir ausente o null.

    La API entrega `crew` y `fruit` como objetos, pero en algunos personajes
    pueden faltar. Con `or {}` se evita el error de leer una clave sobre None.
    """
    obj = details.get(key) or {}
    return obj.get(field)


async def seed_characters():
    """Descarga los 20 personajes, los enriquece y los guarda en la base."""
    # Los indices deben existir antes de insertar.
    await connection.ensure_indexes()

    # 1. Descargar la lista completa una sola vez.
    lista = await onepiece_client.list_characters()

    # 2. Indexarla por nombre normalizado para buscar en O(1) en vez de recorrer
    #    los cientos de personajes con un find() por cada uno.
    by_key = {normalize_name(item.get("name")): item for item in lista}

    saved = 0
    missing = []

    # 3. Por cada nombre del seed, traer el detalle y guardarlo.
    for name in CHARACTER_SEED_NAMES:
        ref = by_key.get(normalize_name(name))
        if not ref:
            missing.append(name)
            print(f"  ! no encontrado en la API: {name}")
            continue

        details = await onepiece_client.get_character_by_id(ref["id"])
        race = get_race(details.get("name"))
        # La imagen se saca de Jikan/MyAnimeList porque la API de One Piece no
        # la trae. Puede devolver None: en ese caso la ficha muestra el recuadro
        # "OP", no un hueco roto.
        image_url = await jikan_client.find_character_image(details.get("name"))

        await repo.upsert(
            {
                "id": details.get("id", ref["id"]),
                "name": details.get("name"),
                "size": details.get("size"),
                # age, job, status, crew y fruit se guardan YA traducidos al
                # espanol. La descripcion de la fruta se deja tal cual.
                "age": translate_age(details.get("age")),
                "bounty": details.get("bounty"),
                "job": translate_job(details.get("job")),
                "status": translate_status(details.get("status")),
                "crew_name": translate_crew(_nested(details, "crew", "name")),
                "crew_is_yonko": _nested(details, "crew", "is_yonko") or False,
                "fruit_name": translate_fruit_name(_nested(details, "fruit", "name")),
                "fruit_type": translate_fruit_type(_nested(details, "fruit", "type")),
                "fruit_description": _nested(details, "fruit", "description"),
                "image_url": image_url,
                "race": race["race"],
                "race_estimated": race["estimated"],
            }
        )

        saved += 1
        estimada = " [estimada]" if race["estimated"] else ""
        imagen = ", con imagen" if image_url else ", SIN imagen"
        print(f"  + {details.get('name')} (raza: {race['race']}{estimada}{imagen})")

        # Respiro para no saturar la API externa. Sin esta pausa serian 20
        # peticiones seguidas y algunas APIs lo toman por abuso (error 429).
        await asyncio.sleep(0.15)

    return {"saved": saved, "missing": missing}


async def main():
    print("== Cargando One Piece ==")
    result = await seed_characters()

    total = await repo.count()
    print(f"\nonepiece: {total} personajes")

    # Cerrar el cliente: sin esto el proceso se queda vivo esperando conexiones.
    await connection.close_pool()

    # Si la base quedo vacia, algo fallo de verdad: salir con codigo 1 para que
    # un pipeline o un deploy se entere, en lugar de "terminar bien" con 0 filas.
    if total == 0:
        print("El seed fallo: la base de datos quedo vacia.")
        sys.exit(1)

    if result["missing"]:
        print(f"\n{len(result['missing'])} no se pudieron cargar: {', '.join(result['missing'])}")

    print("\nListo. El servicio ya no necesita internet para responder.")


if __name__ == "__main__":
    asyncio.run(main())
