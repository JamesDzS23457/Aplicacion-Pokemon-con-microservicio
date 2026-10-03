-- Esquema de la base de datos de One Piece (PostgreSQL).
--
-- Lo aplica el propio servicio (y el seed) al arrancar, leyendo este archivo
-- desde src/db/connection.py. Usa IF NOT EXISTS en todo para que se pueda
-- volver a ejecutar sin romper nada.
--
-- CONVENCION: cada fila se identifica con el id que da la API externa, y el
-- seed hace upsert sobre ese id. Las columnas que derivamos del texto
-- (search_key) las rellena el codigo al guardar, no la base de datos.

CREATE TABLE IF NOT EXISTS characters (
  id                INTEGER PRIMARY KEY,
  name              TEXT    NOT NULL UNIQUE,

  -- Version normalizada del nombre (sin acentos, sin puntuacion, sin "/ Alias").
  -- Es lo que realmente se indexa y se compara en las busquedas.
  search_key        TEXT    NOT NULL,

  size              TEXT,
  age               TEXT,
  bounty            TEXT,
  job               TEXT,
  status            TEXT,

  -- crew aplanado: la API devuelve un objeto, aqui son dos columnas.
  crew_name         TEXT,
  crew_is_yonko     BOOLEAN NOT NULL DEFAULT FALSE,

  -- fruit tambien viene anidado, se aplana igual.
  fruit_name        TEXT,
  fruit_type        TEXT,
  fruit_description TEXT,

  image_url         TEXT,

  -- Raza curada a mano: la API NO expone este dato.
  race              TEXT,
  -- Marca si la raza se calculo por defecto (el personaje no estaba en el mapa).
  race_estimated    BOOLEAN NOT NULL DEFAULT FALSE,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice para las busquedas por nombre normalizado.
CREATE INDEX IF NOT EXISTS idx_characters_search_key ON characters (search_key);


-- --------------------------------------------------------------------------
-- LIMITE DE 20 PERSONAJES
--
-- El requisito del profesor es "maximo 20". Se impone con un TRIGGER, no con
-- un if en JavaScript: asi es la base de datos la que lo garantiza y ningun
-- camino de escritura (seed, API, SQL manual) puede saltarselo.
--
-- BEFORE INSERT + RAISE EXCEPTION = la fila se rechaza antes de escribirse.
-- La condicion "AND NOT EXISTS (ya existe ese id)" permite re-ejecutar el seed
-- sin que el propio seed se bloquee a si mismo en la fila 21.
--
-- Por que no un CHECK: un CHECK solo mira la fila que se inserta, y no puede
-- contar las filas que ya hay en la tabla.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_characters_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM characters) >= 20
     AND NOT EXISTS (SELECT 1 FROM characters WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Limite de 20 personajes alcanzado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS characters_max_20 ON characters;

CREATE TRIGGER characters_max_20
  BEFORE INSERT ON characters
  FOR EACH ROW
  EXECUTE FUNCTION enforce_characters_limit();