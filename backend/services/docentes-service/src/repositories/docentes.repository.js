// ---------------------------------------------------------------------------
// REPOSITORY DE DOCENTES
//
// UNICA capa del microservicio que contiene SQL. Si alguna vez aparece un
// SELECT fuera de este archivo, es un error de arquitectura: las reglas del
// proyecto exigen que el SQL este aqui y en ningun otro sitio.
//
// CONVENCIONES DE POSTGRESQL (no de SQLite), por si se toca este archivo:
//   - Los parametros van POSICIONALES ($1, $2), nunca interpolados en el texto.
//     Es lo que evita la inyeccion SQL: el usuario escribe "o'; DROP TABLE..." y
//     Postgres lo trata como texto, no como codigo.
//   - Todo es async. Un `await` olvidado devuelve la respuesta VACIA y sin
//     ningun error visible: es el fallo clasico al tocar estos archivos.
// ---------------------------------------------------------------------------

import { query, queryOne } from '../db/connection.js';
import { normalizeSearchKey, normalizeFilter } from '../lib/normalize.js';

const COLUMNS = `
  id, nombre, search_key, cargo, departamento, carrera, facultad, email,
  foto_url, resumen, biografia, areas, formacion
`;

// ---------------------------------------------------------------------------
// CONVERSIONES
// ---------------------------------------------------------------------------

/**
 * Convierte el JSON guardado en array.
 *
 * Si el texto viniera corrupto devuelve [] en vez de romper toda la respuesta:
 * es preferible que un campo salga vacio a que la pantalla entera se caiga.
 */
function parseJson(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Aplana una fila de la tabla al JSON que ve el cliente. */
function mapRow(row) {
  if (!row) return null;

  return {
    id: row.id,
    nombre: row.nombre,
    cargo: row.cargo,
    departamento: row.departamento,
    carrera: row.carrera,
    facultad: row.facultad,
    email: row.email,
    foto_url: row.foto_url,
    // Las dos descripciones se mandan siempre: la TARJETA de la pestana usa
    // `resumen` y la pantalla de detalle usa `biografia`. Mandar las dos evita
    // una segunda peticion al abrir "Leer mas".
    resumen: row.resumen,
    biografia: row.biografia,
    areas: parseJson(row.areas),
    formacion: parseJson(row.formacion),
  };
}

// ---------------------------------------------------------------------------
// CONSULTAS
// ---------------------------------------------------------------------------

export async function count() {
  const row = await queryOne('SELECT COUNT(*)::int AS n FROM docentes');
  return row.n;
}

export async function findAll() {
  const rows = await query(`SELECT ${COLUMNS} FROM docentes ORDER BY nombre`);
  return rows.map(mapRow);
}

export async function findById(id) {
  const row = await queryOne(`SELECT ${COLUMNS} FROM docentes WHERE id = $1`, [id]);
  return mapRow(row);
}

/**
 * Listado con filtros y paginacion, todo por QUERY PARAMS.
 *
 * El filtro de texto (`q`) se compara contra `search_key`, que ya viene
 * normalizado; por eso el usuario puede escribir con acentos o sin ellos. Los
 * filtros de carrera y departamento comparan contra las columnas NORMALIZADAS
 * `carrera_key` y `departamento_key`, no contra el texto crudo. La razon esta
 * explicada en src/db/schema.sql: el valor del filtro llega ya normalizado
 * ("ingenieria en sistemas") y `ILIKE` no ignora los acentos, asi que compararlo
 * con la columna cruda ("Ingeniería en Sistemas") daria siempre CERO
 * resultados. La comparacion sigue siendo por fragmento (`%...%`) y no de
 * igualdad, para que el filtro "Ingenieria" encuentre tambien "Ingeniería en
 * Sistemas".
 */
export async function findMany({ q, carrera, departamento, limite, offset }) {
  const condiciones = [];
  const params = [];

  /** Anade una condicion y su valor, y devuelve el indice del parametro. */
  const agregar = (fragmento, valor) => {
    params.push(valor);
    condiciones.push(fragmento.replace('?', `$${params.length}`));
  };

  if (q) agregar('search_key LIKE ?', `%${normalizeSearchKey(q)}%`);
  if (carrera) agregar("carrera_key ILIKE '%' || ? || '%'", carrera);
  if (departamento) agregar("departamento_key ILIKE '%' || ? || '%'", departamento);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  // LIMIT y OFFSET NO son parametros en Postgres: admiten solo literales
  // enteros. Por eso llegan ya validados y convertidos con Number() en la capa
  // de servicios (ver alli `parseLimite`): es seguro porque no pueden ser
  // negativos ni NaN. Van al final porque el LIMIT de Postgres exige que los
  // parametros del WHERE esten ya numerados.
  const rows = await query(
    `SELECT ${COLUMNS} FROM docentes ${where} ORDER BY nombre LIMIT ${limite} OFFSET ${offset}`,
    params,
  );
  return rows.map(mapRow);
}

/** Cuenta los resultados de un listado CON LOS MISMOS filtros que findMany. */
export async function countMany({ q, carrera, departamento }) {
  const condiciones = [];
  const params = [];

  const agregar = (fragmento, valor) => {
    params.push(valor);
    condiciones.push(fragmento.replace('?', `$${params.length}`));
  };

  if (q) agregar('search_key LIKE ?', `%${normalizeSearchKey(q)}%`);
  if (carrera) agregar("carrera_key ILIKE '%' || ? || '%'", carrera);
  if (departamento) agregar("departamento_key ILIKE '%' || ? || '%'", departamento);

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const row = await queryOne(`SELECT COUNT(*)::int AS n FROM docentes ${where}`, params);
  return row.n;
}

/**
 * Busqueda por termino, con prioridad de coincidencia.
 *
 * Igual que la busqueda de pokemon: primero el nombre EXACTO, luego los que
 * EMPIEZAN por el termino y por ultimo los que solo lo CONTIENEN. Asi "Ana"
 * devuelve primero a "Ana Beatriz Rios" y no a "Mariana Fernandez".
 *
 * A diferencia de los servicios anteriores, aqui NO hay paginacion: la tabla
 * tiene 20 filas y el limite de seguridad de 20 va como literal en el SQL (ver
 * la nota de LIMIT y OFFSET mas arriba, en findMany).
 */
export async function search(termino) {
  const key = normalizeSearchKey(termino);
  if (!key) return [];

  const rows = await query(
    `SELECT ${COLUMNS}
       FROM docentes
      WHERE search_key = $1
         OR search_key LIKE $2
         OR search_key LIKE $3
      ORDER BY
        CASE
          WHEN search_key = $1    THEN 0
          WHEN search_key LIKE $2 THEN 1
          ELSE 2
        END,
        nombre
      LIMIT 20`,
    [key, `${key}%`, `%${key}%`],
  );

  return rows.map(mapRow);
}

/**
 * Valores distintos de las columnas por las que se filtra.
 *
 * Lo consume la fila de filtros de la quinta pestana. Se pide en UNA sola
 * consulta con `UNION` en lugar de tres consultas sueltas, porque cada consulta
 * a la base es un viaje de ida y vuelta: con una sola se ahorran dos viajes y
 * las tres listas salen coherentes entre si (mismo instante de lectura).
 *
 * `UNION` y no `UNION ALL` porque aqui no interesa repetir valores: al final
 * se deduplica con un Set.
 */
export async function findFacetas() {
  const rows = await query(
    `SELECT 'facultad' AS campo, facultad AS valor FROM docentes WHERE facultad IS NOT NULL
     UNION
     SELECT 'carrera' AS campo, carrera AS valor FROM docentes WHERE carrera IS NOT NULL
     UNION
     SELECT 'departamento' AS campo, departamento AS valor FROM docentes WHERE departamento IS NOT NULL
     ORDER BY campo, valor`,
  );

  // Se agrupa en un objeto porque es lo que espera la capa de servicios, y de
  // paso se quita cualquier duplicado que haya sobrevivido al UNION.
  const facetas = { facultad: [], carrera: [], departamento: [] };
  for (const fila of rows) {
    const destino = facetas[fila.campo];
    if (destino && !destino.includes(fila.valor)) destino.push(fila.valor);
  }
  return facetas;
}

// ---------------------------------------------------------------------------
// ESCRITURA (solo la usa el seed)
// ---------------------------------------------------------------------------

/**
 * Upsert idempotente: reejecutar el seed no duplica ni falla.
 *
 * El trigger del limite de 20 mira `id = NEW.id` para permitir el re-seed: si el
 * docente ya existe, el ON CONFLICT lo actualiza en vez de insertar, y el
 * trigger no lo cuenta como nuevo. Insertar un docente 21 SI falla, y lo hace la
 * base de datos, no este codigo.
 */
export async function upsert(docente) {
  await query(
    `INSERT INTO docentes (
        id, nombre, search_key, cargo, departamento, carrera,
        carrera_key, departamento_key, facultad, email,
        foto_url, resumen, biografia, areas, formacion, updated_at
     ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15, NOW()
     )
     ON CONFLICT (id) DO UPDATE SET
        nombre = EXCLUDED.nombre,
        search_key = EXCLUDED.search_key,
        cargo = EXCLUDED.cargo,
        departamento = EXCLUDED.departamento,
        carrera = EXCLUDED.carrera,
        carrera_key = EXCLUDED.carrera_key,
        departamento_key = EXCLUDED.departamento_key,
        facultad = EXCLUDED.facultad,
        email = EXCLUDED.email,
        foto_url = EXCLUDED.foto_url,
        resumen = EXCLUDED.resumen,
        biografia = EXCLUDED.biografia,
        areas = EXCLUDED.areas,
        formacion = EXCLUDED.formacion,
        updated_at = NOW()`,
    [
      docente.id,
      docente.nombre,
      normalizeSearchKey(docente.nombre),
      docente.cargo ?? null,
      docente.departamento ?? null,
      docente.carrera ?? null,
      // Las claves de filtro se generan AQUI, con la misma funcion de
      // normalizacion que genera `search_key`, para que las tres columnas
      // produzcan siempre el mismo formato. Ver la nota de estas columnas en
      // src/db/schema.sql. `|| null` evita guardar cadenas vacias.
      normalizeFilter(docente.carrera) || null,
      normalizeFilter(docente.departamento) || null,
      docente.facultad ?? null,
      docente.email ?? null,
      docente.foto_url ?? null,
      docente.resumen ?? null,
      docente.biografia ?? null,
      JSON.stringify(docente.areas ?? []),
      JSON.stringify(docente.formacion ?? []),
    ],
  );
}

/** Borra todos los docentes. Lo usa el seed con TRUNCATE para empezar limpio. */
export async function clear() {
  await query('TRUNCATE TABLE docentes');
}