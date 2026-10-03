# ---------------------------------------------------------------------------
# REPOSITORY DE PERSONAJES  (SQL)
#
# Esta es la UNICA capa del servicio que habla SQL. Las de arriba (service y
# router) no saben si los datos vienen de PostgreSQL, de SQLite o de otro
# sitio. Eso es lo que permitio portar el servicio de Node a Python sin tocar
# las reglas de negocio ni el contrato HTTP.
#
# SINTAXIS POSTGRES:
#   - Parametros posicionales $1, $2, ... (asyncpg no admite $nombre).
#   - ILIKE = comparacion sin distinguir mayusculas (exclusivo de Postgres).
#   - NOW() para la marca de tiempo.
#
# TRADUCCION FILA <-> OBJETO:
#   La base guarda la tripulacion y la fruta APLANADAS (columnas sueltas),
#   pero el contrato con el frontend las quiere ANIDADAS. `_map_row` reconstruye
#   esa forma. Tambien traduce `image_url` a `image` y `race_estimated` a
#   `raceEstimated`, igual que hacia la version Node.
# ---------------------------------------------------------------------------

from ..db.connection import query, query_one
from ..lib.normalize import normalize_name

# Columnas que se piden al SELECT. Se escriben una vez y se reutilizan en todas
# las consultas para no olvidarse de ninguna.
COLUMNS = """
  id, name, search_key, size, age, bounty, job, status,
  crew_name, crew_is_yonko, fruit_name, fruit_type,
  fruit_description, image_url, race, race_estimated
"""


def _as_text(value):
    """Convierte un valor a texto, o None.

    asyncpg es ESTRICTO con los tipos: si se le pasa un numero a una columna
    TEXT, lanza DataError. La API externa a veces devuelve la recompensa como
    numero, asi que aqui se normaliza a texto antes de guardar. La version Node
    no necesitaba esto porque `pg` coercionaba solo.
    """
    if value is None:
        return None
    return str(value)


def _map_row(row):
    """Convierte una fila de PostgreSQL en el objeto que espera el frontend."""
    if row is None:
        return None

    return {
        "id": row["id"],
        "name": row["name"],
        "size": row["size"],
        "age": row["age"],
        "bounty": row["bounty"],
        "job": row["job"],
        "status": row["status"],
        # La base guarda crew_name/crew_is_yonko; el contrato quiere un objeto.
        "crew": (
            {"name": row["crew_name"], "is_yonko": row["crew_is_yonko"]}
            if row["crew_name"]
            else None
        ),
        # Igual con la fruta: tres columnas -> un objeto anidado.
        "fruit": (
            {
                "name": row["fruit_name"],
                "type": row["fruit_type"],
                "description": row["fruit_description"],
            }
            if row["fruit_name"]
            else None
        ),
        "image": row["image_url"],
        "race": row["race"],
        "raceEstimated": row["race_estimated"],
    }


async def count():
    """Cuantos personajes hay guardados. Lo usa /health y el seed."""
    row = await query_one("SELECT COUNT(*)::int AS n FROM characters")
    return row["n"]


async def find_all():
    """Los 20 personajes, ordenados por id."""
    rows = await query(f"SELECT {COLUMNS} FROM characters ORDER BY id")
    return [_map_row(row) for row in rows]


async def find_by_id(character_id):
    """Un personaje por su id, o None."""
    row = await query_one(f"SELECT {COLUMNS} FROM characters WHERE id = $1", character_id)
    return _map_row(row)


async def search(key):
    """Busqueda tolerante sobre search_key (ya normalizada).

    Por eso 'luffy', 'LUFFY', 'monkey d luffy' y 'monkey d. luffy' encuentran lo
    mismo. Tambien busca dentro del nombre de la tripulacion (ILIKE) para que
    escribir 'sombrero' encuentre a toda la crew.

    El ORDER BY usa CASE para priorizar: primero la coincidencia EXACTA, luego
    la que empieza por el termino, luego la que solo lo contiene. Asi 'nami'
    aparece antes que un personaje que solo tenga 'nami' en medio.
    """
    if not key:
        return []

    rows = await query(
        f"""SELECT {COLUMNS}
              FROM characters
             WHERE search_key = $1
                OR search_key LIKE $2
                OR search_key LIKE $3
                OR crew_name ILIKE $3
             ORDER BY
               CASE
                 WHEN search_key = $1    THEN 0
                 WHEN search_key LIKE $2 THEN 1
                 ELSE 2
               END,
               name
             LIMIT 20""",
        key,
        f"{key}%",
        f"%{key}%",
    )
    return [_map_row(row) for row in rows]


async def upsert(character):
    """INSERT ... ON CONFLICT DO UPDATE = "si el id ya existe, actualizalo".

    Hace que el seed sea idempotente: se puede ejecutar N veces y siempre deja
    los mismos 20 registros, sin duplicar ni fallar.

    NOTA: el trigger del limite de 20 se dispara en el INSERT, pero permite
    reinsertar una fila que ya existe, asi que el seed nunca se bloquea a si
    mismo al reejecutarse.
    """
    name = character["name"]
    await query(
        """INSERT INTO characters (
              id, name, search_key, size, age, bounty, job, status,
              crew_name, crew_is_yonko, fruit_name, fruit_type,
              fruit_description, image_url, race, race_estimated, updated_at
           ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8,
              $9, $10, $11, $12,
              $13, $14, $15, $16, NOW()
           )
           ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              search_key = EXCLUDED.search_key,
              size = EXCLUDED.size,
              age = EXCLUDED.age,
              bounty = EXCLUDED.bounty,
              job = EXCLUDED.job,
              status = EXCLUDED.status,
              crew_name = EXCLUDED.crew_name,
              crew_is_yonko = EXCLUDED.crew_is_yonko,
              fruit_name = EXCLUDED.fruit_name,
              fruit_type = EXCLUDED.fruit_type,
              fruit_description = EXCLUDED.fruit_description,
              -- Si esta ejecucion no consiguio imagen (Jikan caido o con
              -- limite de peticiones), se CONSERVA la que ya estaba guardada.
              -- Sin este COALESCE, un re-seed con Jikan caido borraria todas
              -- las imagenes de la base, que es justo lo que paso la primera
              -- vez. Para insertar de cero si se usa el valor nuevo.
              image_url = COALESCE(EXCLUDED.image_url, characters.image_url),
              race = EXCLUDED.race,
              race_estimated = EXCLUDED.race_estimated,
              updated_at = NOW()""",
        int(character["id"]),
        name,
        normalize_name(name),
        _as_text(character.get("size")),
        _as_text(character.get("age")),
        _as_text(character.get("bounty")),
        _as_text(character.get("job")),
        _as_text(character.get("status")),
        _as_text(character.get("crew_name")),
        bool(character.get("crew_is_yonko") or False),
        _as_text(character.get("fruit_name")),
        _as_text(character.get("fruit_type")),
        _as_text(character.get("fruit_description")),
        _as_text(character.get("image_url")),
        _as_text(character.get("race")),
        bool(character.get("race_estimated") or False),
    )


async def clear():
    """Borra todo. Solo lo usa el seed si algun dia se agrega --reset."""
    await query("DELETE FROM characters")
