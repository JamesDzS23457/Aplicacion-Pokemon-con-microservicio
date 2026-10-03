-- ---------------------------------------------------------------------------
-- ESQUEMA DE LA BASE DE DATOS DE DOCENTES  (PostgreSQL en Supabase)
--
-- Se aplica automaticamente al arrancar el microservicio (ver ensureSchema en
-- src/db/connection.js) y tambien al correr el seed. Es IDEMPOTENTE: se puede
-- reejecutar mil veces sin romper nada.
--
-- Que guarda esta tabla: el detalle de los docentes de Uninpahu que la quinta
-- pestana de la app muestra. Es la unica tabla del microservicio; a diferencia
-- de Pokemon, aqui no hace falta una tabla porPokemon porque un docente tiene
-- una sola ficha.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS docentes (
  id            INTEGER PRIMARY KEY,

  nombre        TEXT    NOT NULL UNIQUE,

  -- Clave de busqueda: nombre normalizado (minusculas, sin acentos, sin
  -- espacios ni puntuacion). Se genera con lib/normalize.js en el seed y es lo
  -- unico que se indexa y se compara en las busquedas del buscador.
  search_key    TEXT    NOT NULL,

  cargo         TEXT,
  departamento  TEXT,
  carrera       TEXT,
  facultad      TEXT,
  email         TEXT,

  -- Claves NORMALIZADAS de carrera y departamento, para poder filtrar por ellas.
  --
  -- Estas dos columnas existen por un problema concreto. El filtro llega ya
  -- normalizado desde la capa de servicios ("ingenieria en sistemas", sin
  -- tildes y en minusculas) y se compara contra la columna, que guarda el texto
  -- COMO SE ESCRIBE ("Ingeniería en Sistemas"). `ILIKE` distingue mayusculas,
  -- pero NO ignora los acentos: al comparar las dos formas, "ingenieria" jamas
  -- encuentra "Ingeniería" y el filtro devuelve siempre cero resultados.
  --
  -- La solucion NO es `unaccent()`, porque es una extension que hay que instalar
  -- y eso ataria el despliegue a una configuracion concreta de la base. Es
  -- guardar la misma cadena ya normalizada en su propia columna, con la MISMA
  -- funcion de JavaScript que genera `search_key`. Asi los dos filtros se
  -- comportan igual de bien: el usuario escribe como quiera y encuentra.
  --
  -- No se exponen en el JSON de la API: son un detalle interno de la busqueda.
  carrera_key       TEXT,
  departamento_key  TEXT,

  -- URL publica de la foto. ES OPCIONAL a proposito: la app trae un retrato
  -- de reserva dibujado con las iniciales cuando esta columna viene vacia, de
  -- modo que el servicio funciona aunque todavia no haya fotos cargadas.
  foto_url      TEXT,

  -- Descripcion BREVE: es lo que cabe en la tarjeta de la quinta pestana, junto
  -- al boton "Leer mas".
  resumen       TEXT,

  -- Descripcion COMPLETA: es lo que se lee en la pantalla de detalle, a la que
  -- se llega pulsando "Leer mas".
  biografia     TEXT,

  -- Listas de texto (areas de trabajo y formacion academica). Se guardan como
  -- TEXT con JSON en vez de crear tablas hijas porque la app solo las LEE y las
  -- muestra: nunca las filtra ni las ordena. Misma decision que `types` y
  -- `moves` en el esquema de Pokemon.
  areas         TEXT,
  formacion     TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice de la columna por la que se busca. Las de carrera/departamento/facultad
-- NO se indexan: son texto libre y la tabla tiene 20 filas, asi que un indice
-- extra solo costaria mantenimiento, no tiempo.
CREATE INDEX IF NOT EXISTS idx_docentes_search_key ON docentes (search_key);

-- ---------------------------------------------------------------------------
-- MIGRACION DE LAS COLUMNAS DE FILTRO
--
-- `CREATE TABLE IF NOT EXISTS` no anade columnas a una tabla que YA existe, asi
-- que una base creada antes de estas columnas se quedaria sin ellas y el filtro
-- por carrera fallaria con un error de "columna no existe". Por eso se anaden
-- aparte, con `IF NOT EXISTS`, que es idempotente como el resto del esquema.
--
-- Con esto la tabla queda lista, pero las columnas nuevas estan VACIAS: hay que
-- volver a correr el seed (`npm run backend:seed:docentes`), que es quien las
-- rellena. El servicio NO las rellena solo al arrancar, y a proposito: eso
-- seria escribir en la base al arrancar, y este servicio es de solo lectura.
-- ---------------------------------------------------------------------------
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS carrera_key TEXT;
ALTER TABLE docentes ADD COLUMN IF NOT EXISTS departamento_key TEXT;


-- ---------------------------------------------------------------------------
-- LIMITE DE 20 DOCENTES
--
-- Mismo mecanismo que Pokemon y One Piece: un trigger BEFORE INSERT que cuenta
-- las filas y aborta si ya hay 20. Es el requisito del profesor ("base de datos
-- de maximo 20 registros") y, por eleccion, lo impone el MOTOR y no el codigo
-- de la aplicacion: aunque alguien se conecte por psql, la base se sigue
-- negando a crecer.
--
-- La condicion `AND NOT EXISTS (... WHERE id = NEW.id)` es la que permite que el
-- seed se pueda reejecutar: si el registro ya existe, se trata como UPDATE y no
-- cuenta como un docente nuevo.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_docentes_limit() RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM docentes) >= 20
     AND NOT EXISTS (SELECT 1 FROM docentes WHERE id = NEW.id) THEN
    RAISE EXCEPTION 'Limite de 20 docentes alcanzado';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS docentes_max_20 ON docentes;

CREATE TRIGGER docentes_max_20
  BEFORE INSERT ON docentes
  FOR EACH ROW
  EXECUTE FUNCTION enforce_docentes_limit();

-- ---------------------------------------------------------------------------
-- CLAVES DE BUSQUEDA AL INSERTAR O RENOMBRAR A MANO
--
-- `search_key`, `carrera_key` y `departamento_key` son columnas CALCULADAS: las
-- genera el codigo (src/lib/normalize.js) y las comparan todas las busquedas y
-- todos los filtros. El problema: si alguien inserta un docente directamente
-- desde el Table Editor de Supabase y deja esas columnas vacias, el docente
-- aparece en el listado (que sin `q` no las mira) pero NO se encuentra al
-- buscarlo por nombre, y sus filtros de carrera y departamento no funcionan.
--
-- Este trigger las recalcula siempre, en cada INSERT y en cada UPDATE de los
-- campos de los que dependen, para que la base quede coherente sin depender de
-- que quien edita se acuerde de esos tres campos auxiliares.
--
-- Replica EXACTAMENTE las dos funciones de src/lib/normalize.js:
--   - normalizeSearchKey (para search_key): minusculas, sin acentos, sin
--     puntuacion y SIN ESPACIOS. "Elfar Didier" -> "elfardidier".
--   - normalizeFilter (para carrera_key y departamento_key): lo mismo pero
--     conservando un espacio simple entre palabras. "Ingenieria en Sistemas" ->
--     "ingenieria en sistemas", que es justo como llega el filtro desde la app.
--
-- Se usa translate() y no unaccent() porque unaccent() es una EXTENSION que hay
-- que instalar, y eso ataria el despliegue a una configuracion concreta de la
-- base. Las tres claves deben acabar con el mismo formato que produce el codigo:
-- si divergen, el filtro "sin tilde" deja de encontrar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION refresh_docentes_keys() RETURNS TRIGGER AS $$
BEGIN
  -- search_key: se retira TODO lo que no sea letra o digito, incluidos los
  -- espacios. OJO: aqui NO se corta por "/". El normalize.js de este servicio
  -- (lib/normalize.js) no descarta el alias, al contrario que el de Pokemon, asi
  -- que esta consulta replica solo sus dos reglas: minusculas y quitar lo que
  -- no sea letra o digito. Nada mas.
  NEW.search_key := regexp_replace(
    translate(
      lower(NEW.nombre),
      'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]', '', 'g');

  -- carrera_key / departamento_key: los mismos caracteres, pero un espacio
  -- simple entre palabras en lugar de nada. El `btrim` quita el espacio sobrante
  -- del principio y del final, igual que el `.trim()` de normalizeText, y el
  -- NULLIF evita guardar cadenas vacias (el codigo usa `|| null`).
  NEW.carrera_key := NULLIF(btrim(regexp_replace(
    translate(lower(coalesce(NEW.carrera, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')), '');

  NEW.departamento_key := NULLIF(btrim(regexp_replace(
    translate(lower(coalesce(NEW.departamento, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñç', 'aaaaaaeeeeiiiiooooouuuunc'),
    '[^a-z0-9]+', ' ', 'g')), '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS docentes_search_keys ON docentes;

CREATE TRIGGER docentes_search_keys
  BEFORE INSERT OR UPDATE OF nombre, carrera, departamento ON docentes
  FOR EACH ROW
  EXECUTE FUNCTION refresh_docentes_keys();
