// ---------------------------------------------------------------------------
// CAPA LOCAL SQLITE - DOCENTES
//
// Unica capa del frontend que contiene SQL. Replica el mismo patron de aislamiento
// que el backend: repositories/ es el unico sitio con SQL.
//
// Tablas:
//   docentes_local  - espejo de la nube + cambios locales
//   cola            - outbox de operaciones pendientes (FIFO)
// ---------------------------------------------------------------------------

import * as SQLite from 'expo-sqlite';
import { normalizeSearchKey, normalizeFilter } from '../lib/normalize';

// ---------------------------------------------------------------------------
// TIPOS
// ---------------------------------------------------------------------------

export type DocenteLocal = {
  id: number;
  nombre: string;
  cargo?: string | null;
  departamento?: string | null;
  carrera?: string | null;
  facultad?: string | null;
  email?: string | null;
  foto_url?: string | null;
  resumen?: string | null;
  biografia?: string | null;
  areas: string[];
  formacion: string[];
  search_key: string;
  carrera_key: string | null;
  departamento_key: string | null;
  sincronizado: boolean;
  accion: 'crear' | 'actualizar' | 'borrar' | null;
  fecha_local: number;
};

type ColaItem = {
  orden: number;
  tipo: 'crear' | 'actualizar' | 'borrar';
  id_local: number;
  payload: string; // JSON del docente o solo {id} para borrar
};

// ---------------------------------------------------------------------------
// INICIALIZACION Y MIGRACIONES
// ---------------------------------------------------------------------------

let db: SQLite.SQLiteDatabase | null = null;

const ESQUEMA = `
-- Tabla espejo de docentes
CREATE TABLE IF NOT EXISTS docentes_local (
  id              INTEGER PRIMARY KEY,
  nombre          TEXT    NOT NULL,
  cargo           TEXT,
  departamento    TEXT,
  carrera         TEXT,
  facultad        TEXT,
  email           TEXT,
  foto_url        TEXT,
  resumen         TEXT,
  biografia       TEXT,
  areas           TEXT    NOT NULL DEFAULT '[]',
  formacion       TEXT    NOT NULL DEFAULT '[]',
  search_key      TEXT    NOT NULL,
  carrera_key     TEXT,
  departamento_key TEXT,
  sincronizado    INTEGER NOT NULL DEFAULT 1,
  accion          TEXT,
  fecha_local     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_docentes_search_key ON docentes_local (search_key);
CREATE INDEX IF NOT EXISTS idx_docentes_carrera_key ON docentes_local (carrera_key);
CREATE INDEX IF NOT EXISTS idx_docentes_departamento_key ON docentes_local (departamento_key);
CREATE INDEX IF NOT EXISTS idx_docentes_sincronizado ON docentes_local (sincronizado);

-- Cola de operaciones pendientes (outbox)
CREATE TABLE IF NOT EXISTS cola (
  orden       INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo        TEXT    NOT NULL CHECK (tipo IN ('crear','actualizar','borrar')),
  id_local    INTEGER NOT NULL,
  payload     TEXT    NOT NULL,
  creado_en   INTEGER NOT NULL
);
`;

const LIMITE_DOCENTES = 20;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('docentes.db');
    await db.execAsync(ESQUEMA);
    // WAL para mejor concurrencia
    await db.execAsync('PRAGMA journal_mode = WAL;');
  }
  return db;
}

/** Convierte "" en null (igual que textoOpcional del servicio) y deja undefined intacto. */
function nuloSiVacio(valor: string | null | undefined): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = valor.trim();
  return texto === '' ? null : texto;
}

function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRow(row: any): DocenteLocal {
  return {
    id: row.id,
    nombre: row.nombre,
    cargo: row.cargo,
    departamento: row.departamento,
    carrera: row.carrera,
    facultad: row.facultad,
    email: row.email,
    foto_url: row.foto_url,
    resumen: row.resumen,
    biografia: row.biografia,
    areas: parseJsonArray(row.areas),
    formacion: parseJsonArray(row.formacion),
    search_key: row.search_key,
    carrera_key: row.carrera_key,
    departamento_key: row.departamento_key,
    sincronizado: !!row.sincronizado,
    accion: row.accion,
    fecha_local: row.fecha_local,
  };
}

// ---------------------------------------------------------------------------
// ESPEJO LOCAL (lectura/escritura sincronizada desde la nube)
// ---------------------------------------------------------------------------

/** Reemplaza todo el espejo local con lo que viene de la nube. */
export async function reemplazarEspejo(docentes: any[]): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.execAsync('DELETE FROM docentes_local;');
    for (const d of docentes) {
      await database.runAsync(
        `INSERT INTO docentes_local (
          id, nombre, cargo, departamento, carrera, facultad, email,
          foto_url, resumen, biografia, areas, formacion,
          search_key, carrera_key, departamento_key,
          sincronizado, accion, fecha_local
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?)`,
        [
          d.id,
          d.nombre,
          d.cargo ?? null,
          d.departamento ?? null,
          d.carrera ?? null,
          d.facultad ?? null,
          d.email ?? null,
          d.foto_url ?? null,
          d.resumen ?? null,
          d.biografia ?? null,
          JSON.stringify(d.areas ?? []),
          JSON.stringify(d.formacion ?? []),
          normalizeSearchKey(d.nombre),
          normalizeFilter(d.carrera) || null,
          normalizeFilter(d.departamento) || null,
          Date.now(),
        ],
      );
    }
  });
}

/** Cuenta docentes locales (para validar limite 20). */
export async function contarLocales(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) as n FROM docentes_local WHERE accion IS NULL OR accion != 'borrar'"
  );
  return row?.n ?? 0;
}

/** Listado con filtros y paginacion, igual que el servicio remoto. */
export async function listarLocales(
  q: string,
  carrera: string,
  departamento: string,
  limite: number,
  offset: number
): Promise<DocenteLocal[]> {
  const database = await getDb();
  const condiciones: string[] = [];
  const params: any[] = [];

  const agregar = (fragmento: string, valor: any) => {
    params.push(valor);
    condiciones.push(fragmento.replace('?', `?`)); // SQLite usa ? posicional
  };

  if (q) agregar('search_key LIKE ?', `%${normalizeSearchKey(q)}%`);
  if (carrera) agregar("carrera_key LIKE '%' || ? || '%'", carrera);
  if (departamento) agregar("departamento_key LIKE '%' || ? || '%'", departamento);

  // Solo los que no estan marcados como borrados
  condiciones.push("accion IS NULL OR accion != 'borrar'");

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

  const rows = await database.getAllAsync<any>(
    `SELECT * FROM docentes_local ${where} ORDER BY nombre LIMIT ? OFFSET ?`,
    [...params, limite, offset],
  );

  return rows.map(mapRow);
}

/** Cuenta total con los mismos filtros (sin paginar). */
export async function contarLocalesFiltrados(
  q: string,
  carrera: string,
  departamento: string
): Promise<number> {
  const database = await getDb();
  const condiciones: string[] = [];
  const params: any[] = [];

  const agregar = (fragmento: string, valor: any) => {
    params.push(valor);
    condiciones.push(fragmento.replace('?', `?`));
  };

  if (q) agregar('search_key LIKE ?', `%${normalizeSearchKey(q)}%`);
  if (carrera) agregar("carrera_key LIKE '%' || ? || '%'", carrera);
  if (departamento) agregar("departamento_key LIKE '%' || ? || '%'", departamento);
  condiciones.push("accion IS NULL OR accion != 'borrar'");

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const row = await database.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) as n FROM docentes_local ${where}`,
    params,
  );
  return row?.n ?? 0;
}

/** Busca por termino con prioridad (exacto > prefijo > contenido). */
export async function buscarLocales(termino: string): Promise<DocenteLocal[]> {
  const key = normalizeSearchKey(termino);
  if (!key) return [];
  const database = await getDb();
  const rows = await database.getAllAsync<any>(
    `SELECT * FROM docentes_local
       WHERE (accion IS NULL OR accion != 'borrar')
         AND (search_key = ? OR search_key LIKE ? OR search_key LIKE ?)
       ORDER BY
         CASE
           WHEN search_key = ?    THEN 0
           WHEN search_key LIKE ? THEN 1
           ELSE 2
         END,
         nombre
       LIMIT 20`,
    [key, `${key}%`, `%${key}%`, key, `${key}%`],
  );
  return rows.map(mapRow);
}

/** Un docente por id (local). */
export async function obtenerLocal(id: number): Promise<DocenteLocal | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<any>(
    `SELECT * FROM docentes_local WHERE id = ? AND (accion IS NULL OR accion != 'borrar')`,
    [id],
  );
  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// ESCRITURA LOCAL + OUTBOX
// ---------------------------------------------------------------------------

/** Genera un id local negativo temporal. */
async function siguienteIdLocal(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ n: number }>(
    'SELECT COALESCE(MIN(id), 0) - 1 AS n FROM docentes_local'
  );
  return row?.n ?? -1;
}

/** Crea localmente y encola para sincronizar. */
export async function crearLocal(docente: Omit<DocenteLocal, 'id' | 'search_key' | 'carrera_key' | 'departamento_key' | 'sincronizado' | 'accion' | 'fecha_local'>): Promise<number> {
  const database = await getDb();

  // Validar limite 20 en local
  const actuales = await contarLocales();
  if (actuales >= LIMITE_DOCENTES) {
    throw new Error('Límite de 20 docentes alcanzado. Borra uno antes de agregar otro.');
  }

  const id = await siguienteIdLocal();
  const fecha = Date.now();
  const nombre = (docente.nombre ?? '').trim();
  if (!nombre) {
    throw new Error('El nombre del docente es obligatorio.');
  }
  const search_key = normalizeSearchKey(nombre);
  const carrera_key = normalizeFilter(docente.carrera) || null;
  const departamento_key = normalizeFilter(docente.departamento) || null;

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `INSERT INTO docentes_local (
        id, nombre, cargo, departamento, carrera, facultad, email,
        foto_url, resumen, biografia, areas, formacion,
        search_key, carrera_key, departamento_key,
        sincronizado, accion, fecha_local
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'crear', ?)`,
      [
        id,
        nombre,
        nuloSiVacio(docente.cargo) ?? null,
        nuloSiVacio(docente.departamento) ?? null,
        nuloSiVacio(docente.carrera) ?? null,
        nuloSiVacio(docente.facultad) ?? null,
        nuloSiVacio(docente.email) ?? null,
        nuloSiVacio(docente.foto_url) ?? null,
        nuloSiVacio(docente.resumen) ?? null,
        nuloSiVacio(docente.biografia) ?? null,
        JSON.stringify(docente.areas ?? []),
        JSON.stringify(docente.formacion ?? []),
        search_key,
        carrera_key,
        departamento_key,
        fecha,
      ],
    );

    // Encolar
    await database.runAsync(
      'INSERT INTO cola (tipo, id_local, payload, creado_en) VALUES (?, ?, ?, ?)',
      ['crear', id, JSON.stringify(docente), fecha],
    );
  });

  return id;
}

/** Actualiza localmente y encola. */
export async function actualizarLocal(
  id: number,
  cambios: Partial<Omit<DocenteLocal, 'id' | 'search_key' | 'carrera_key' | 'departamento_key' | 'sincronizado' | 'accion' | 'fecha_local'>>
): Promise<boolean> {
  const database = await getDb();
  const fecha = Date.now();

  const sets: string[] = [];
  const params: any[] = [];

  const fijar = (col: string, val: any) => {
    params.push(val);
    sets.push(`${col} = ?`);
  };

  // undefined = el campo no venia y no se toca (igual que el servicio).
  // null o "" = vaciar a proposito. Asi un PUT parcial no borra lo ausente.
  if (cambios.nombre !== undefined) {
    const nombre = (cambios.nombre ?? '').trim();
    if (!nombre) throw new Error('El nombre del docente no puede quedar vacio.');
    fijar('nombre', nombre);
    fijar('search_key', normalizeSearchKey(nombre));
  }
  if (cambios.cargo !== undefined) fijar('cargo', nuloSiVacio(cambios.cargo) ?? null);
  if (cambios.departamento !== undefined) {
    fijar('departamento', nuloSiVacio(cambios.departamento) ?? null);
    fijar('departamento_key', normalizeFilter(cambios.departamento) || null);
  }
  if (cambios.carrera !== undefined) {
    fijar('carrera', nuloSiVacio(cambios.carrera) ?? null);
    fijar('carrera_key', normalizeFilter(cambios.carrera) || null);
  }
  if (cambios.facultad !== undefined) fijar('facultad', nuloSiVacio(cambios.facultad) ?? null);
  if (cambios.email !== undefined) fijar('email', nuloSiVacio(cambios.email) ?? null);
  if (cambios.foto_url !== undefined) fijar('foto_url', nuloSiVacio(cambios.foto_url) ?? null);
  if (cambios.resumen !== undefined) fijar('resumen', nuloSiVacio(cambios.resumen) ?? null);
  if (cambios.biografia !== undefined) fijar('biografia', nuloSiVacio(cambios.biografia) ?? null);
  if (cambios.areas !== undefined) fijar('areas', JSON.stringify(cambios.areas ?? []));
  if (cambios.formacion !== undefined) fijar('formacion', JSON.stringify(cambios.formacion ?? []));

  if (sets.length === 0) return false;

  fijar('sincronizado', 0);
  fijar('accion', 'actualizar');
  fijar('fecha_local', fecha);
  params.push(id);

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE docentes_local SET ${sets.join(', ')} WHERE id = ?`,
      params,
    );

    // Encolar solo los cambios (el servicio hace PUT parcial)
    await database.runAsync(
      'INSERT INTO cola (tipo, id_local, payload, creado_en) VALUES (?, ?, ?, ?)',
      ['actualizar', id, JSON.stringify(cambios), fecha],
    );
  });

  return true;
}

/** Marca como borrado localmente y encola. */
export async function borrarLocal(id: number): Promise<boolean> {
  const database = await getDb();
  const fecha = Date.now();

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE docentes_local SET sincronizado = 0, accion = 'borrar', fecha_local = ? WHERE id = ?`,
      [fecha, id],
    );

    await database.runAsync(
      'INSERT INTO cola (tipo, id_local, payload, creado_en) VALUES (?, ?, ?, ?)',
      ['borrar', id, JSON.stringify({ id }), fecha],
    );
  });

  return true;
}

// ---------------------------------------------------------------------------
// COLA OUTBOX (sincronizacion)
// ---------------------------------------------------------------------------

export type OperacionPendiente = {
  orden: number;
  tipo: 'crear' | 'actualizar' | 'borrar';
  id_local: number;
  payload: any;
};

/** Obtiene la cola completa en orden FIFO. */
export async function obtenerCola(): Promise<OperacionPendiente[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<any>(
    'SELECT orden, tipo, id_local, payload FROM cola ORDER BY orden'
  );
  return rows.map(r => ({
    orden: r.orden,
    tipo: r.tipo,
    id_local: r.id_local,
    payload: JSON.parse(r.payload),
  }));
}

/** Elimina una operacion de la cola (ya sincronizada). */
export async function eliminarDeCola(orden: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM cola WHERE orden = ?', [orden]);
}

/** Reescribe el id local temporal por el id real del servidor (tras crear). */
export async function reescribirIdLocal(id_local: number, id_real: number): Promise<void> {
  const database = await getDb();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE docentes_local SET id = ?, sincronizado = 1, accion = NULL WHERE id = ?',
      [id_real, id_local],
    );
    // Actualizar referencias en la cola (si hubiera operaciones posteriores sobre el mismo)
    await database.runAsync(
      'UPDATE cola SET id_local = ? WHERE id_local = ?',
      [id_real, id_local],
    );
  });
}

/** Marca un registro local como sincronizado (tras actualizar/borrar). */
export async function marcarSincronizado(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'UPDATE docentes_local SET sincronizado = 1, accion = NULL WHERE id = ?',
    [id],
  );
}

/** Cuenta operaciones pendientes. */
export async function contarPendientes(): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM cola');
  return row?.n ?? 0;
}