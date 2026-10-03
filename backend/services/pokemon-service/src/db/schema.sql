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


-- --------------------------------------------------------------------------
-- SEARCH_KEY AL RENOMBRAR UN POKEMON
--
-- `search_key` es la version normalizada del nombre y la columna por la que de
-- verdad se busca. El seed la rellena, pero si alguien edita `name` a mano desde
-- el Table Editor de Supabase y no toca `search_key`, la fila se queda con una
-- clave que ya no corresponde con su nombre: buscar por el nombre NUEVO da 404
-- y el nombre VIEJO sigue encontrando al personaje renombrado.
--
-- Este trigger recalcula la clave cada vez que cambia el nombre, para que la
-- base quede coherente sin depender de que quien edita se acuerde. Es la unica
-- forma de garantizarlo, porque un trigger de PostgreSQL si puede observar los
-- UPDATE; en la base no relacional de One Piece esto no aplica y se resuelve en
-- el codigo.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_pokemons_search_key() RETURNS TRIGGER AS $$
DECLARE
  base text;
BEGIN
  -- Se replica EXACTAMENTE la regla de src/lib/normalize.js, que es:
  --   1. cortar por '/' y quedarse con la parte anterior;
  --   2. pasar a minusculas;
  --   3. quitar los acentos (NFD + eliminar el diacritico U+0300-U+036F);
  --   4. quitar todo lo que no sea [a-z0-9].
  -- Si esta consulta y el codigo no coinciden, un Pokemon con acento o con guion
  -- se guardaria con una clave distinta de la que busca el servicio.
  base := split_part(NEW.name, '/', 1);
  base := lower(base);
  -- translate() quita los signos mas usados; unaccent() cubre el resto, pero
  -- solo esta disponible con la extension "unaccent" instalada. Se usa
  -- translate porque no depende de ninguna extension extra.
  base := translate(base, 'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc');
  NEW.search_key := regexp_replace(base, '[^a-z0-9]', '', 'g');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pokemons_search_key ON pokemons;

CREATE TRIGGER pokemons_search_key
  BEFORE INSERT OR UPDATE OF name ON pokemons
  FOR EACH ROW
  EXECUTE FUNCTION refresh_pokemons_search_key();