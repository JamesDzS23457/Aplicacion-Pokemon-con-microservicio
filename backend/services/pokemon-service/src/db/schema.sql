-- Esquema de la base de datos de Pokemon (PostgreSQL).
--
-- Se aplica UNA vez con:  node scripts/db-setup.js
-- Es idempotente: se puede reejecutar sin romper nada.

CREATE TABLE IF NOT EXISTS pokemons (
  id                INTEGER PRIMARY KEY,
  name              TEXT    NOT NULL UNIQUE,

  -- Nombre normalizado (minusculas, sin acentos ni puntuacion).
  -- Es lo que se indexa y se compara en las busquedas.
  search_key        TEXT    NOT NULL,

  -- PokeAPI los da en decametros y hectogramos (multiplos de 10).
  -- Se guardan en crudo a proposito: la UI los muestra asi.
  height            INTEGER,
  weight            INTEGER,

  -- Traducido desde el gender_rate de la ESPECIE (probabilidad, no genero real).
  genero            TEXT,
  especie           TEXT,

  sprite_default    TEXT,
  sprite_shiny      TEXT,
  sprite_back_shiny TEXT,

  -- La API devuelve arrays de objetos anidados. En lugar de una tabla
  -- secundaria se guardan como TEXT con JSON: se leen enteros, no se consultan.
  -- Es una decision consciente: la app los muestra, no los filtra.
  types             TEXT,
  moves             TEXT,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pokemons_search_key ON pokemons (search_key);


-- --------------------------------------------------------------------------
-- LIMITE DE 20 POKEMON
--
-- Mismo mecanismo que en One Piece: un trigger BEFORE INSERT que cuenta las
-- filas y aborta si ya hay 20. Ver el comentario largo en el schema de
-- One Piece para el "por que".
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_pokemons_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM pokemons) >= 20
     AND NOT EXISTS (SELECT 1 FROM pokemons WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Limite de 20 pokemon alcanzado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pokemons_max_20 ON pokemons;

CREATE TRIGGER pokemons_max_20
  BEFORE INSERT ON pokemons
  FOR EACH ROW
  EXECUTE FUNCTION enforce_pokemons_limit();