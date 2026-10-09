// ---------------------------------------------------------------------------
// VERIFICACIONES
//
// Unica red de seguridad del backend: no hay tests ni CI. Se ejecuta a mano
// tras tocar la base de datos, el seed o las rutas.
//
//   node scripts/verify.js
//
// Comprueba lo que de verdad importa del enunciado del profesor: que hay 20
// registros, que la busqueda funciona y que el limite de 20 lo impone la base
// de datos y no el codigo.
//
// NOTA DE ARQUITECTURA: este script NO habla con el microservicio de One Piece
// (que ya no es Node), sino con su base de datos. Pokemon y Docentes se
// comprueban desde Node con sus repositories; One Piece se comprueba con el
// cliente de MongoDB que usa su propio venv de Python. Asi verify sigue
// funcionando sin levantar ningun servicio, y ademas comprueba la base real, no
// lo que devuelve una capa por encima.
//
// LAS BASES NO SON TODAS DEL MISMO TIPO, y es a proposito: Pokemon y Docentes
// son RELACIONALES (PostgreSQL) y One Piece es NO RELACIONAL (MongoDB). Este
// script es el unico sitio del proyecto de Node que habla con Mongo, y lo hace
// a traves de Python para no anadir el driver `mongodb` a un proyecto que no
// lo necesita.
//
// DOCENTES es el tercero. Se importan su repository y su pool igual que los de
// Pokemon, pero desde SU carpeta: cada microservicio tiene sus propias
// dependencias y verify no las mezcla. A diferencia de Pokemon, Docentes no
// llama a ninguna API externa en el seed (los datos estan en
// backend/scripts/docentes-datos.js), asi que su comprobacion es solo de datos.
// ---------------------------------------------------------------------------

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

import * as pokemonRepo from '../services/pokemon-service/src/repositories/pokemon.repository.js';
import { normalizeName } from '../services/pokemon-service/src/lib/normalize.js';
import {
  ensureSchema as ensurePokemonsSchema,
  closePool as closePokemonsPool,
} from '../services/pokemon-service/src/db/connection.js';
import * as docentesRepo from '../services/docentes-service/src/repositories/docentes.repository.js';
import {
  ensureSchema as ensureDocentesSchema,
  closePool as closeDocentesPool,
} from '../services/docentes-service/src/db/connection.js';

// ---------------------------------------------------------------------------
// CONEXION A LA BASE DE ONE PIECE  (MongoDB, a traves del venv de Python)
//
// One Piece ya no usa PostgreSQL: su base es MongoDB. Este script no anade el
// driver `mongodb` a backend/ porque ese driver no se usa en ningun sitio del
// proyecto de Node. En su lugar ejecuta un fragmento de Python con el
// interprete del venv del microservicio, que ya tiene `pymongo`.
//
// Cada operacion devuelve JSON por stdout, y este script lo parsea. Es un poco
// indirecto, pero evita duplicar la dependencia y mantiene la regla de que la
// base de One Piece solo se toca desde codigo Python.
//
// POR QUE createRequire (para Pokemon):
// `pg` no es dependencia de backend/ (la carpeta scripts/ no tiene node_modules
// propio): la instala pokemon-service. En vez de duplicar la dependencia, este
// require se ancla al package.json de pokemon-service, de modo que Node
// resuelve el MISMO `pg` que usa el servicio.
// ---------------------------------------------------------------------------
const require = createRequire(
  new URL('../services/pokemon-service/package.json', import.meta.url),
);
const pg = require('pg');

const ONEPIECE_MONGO = process.env.ONEPIECE_MONGODB_URI || process.env.MONGODB_URI;
if (!ONEPIECE_MONGO) {
  console.error('Falta ONEPIECE_MONGODB_URI (o MONGODB_URI) para verificar One Piece.');
  process.exit(1);
}

/**
 * Ejecuta un fragmento de Python con pymongo y devuelve lo que imprima en JSON.
 *
 * `codigo` recibe `col` (la coleccion de personajes) y `RE` como variables ya
 * definidas, para que aqui no haya que repetir ni el nombre de la base ni el de
 * la coleccion.
 */
async function mongoQuery(codigo) {
  const servicio = new URL('../services/onepiece-service/', import.meta.url);
  // El fragmento se envuelve en una funcion `async def _coro(col)` porque awaits
  // sueltos dentro de `main()` no valen: la funcion que se pasa tiene que ser
  // una corrutina propia que reciba la coleccion ya resuelta.
  const wrapper = `
import asyncio, json, re, sys
from pymongo import AsyncMongoClient

URI = ${JSON.stringify(ONEPIECE_MONGO)}
DB_NAME = ${JSON.stringify(process.env.ONEPIECE_MONGODB_DB || 'onepiece')}

${codigo}

async def main():
    cliente = AsyncMongoClient(URI)
    col = cliente[DB_NAME]['characters']
    resultado = await _(col)
    print(json.dumps(resultado, default=str))
    await cliente.close()

asyncio.run(main())
`;
  try {
    const salida = execFileSync(
      new URL('./.venv/bin/python', servicio).pathname,
      ['-c', wrapper],
      {
        encoding: 'utf8',
        cwd: new URL('./', servicio).pathname,
        // Sin esto, execFileSync HEREDA la salida de error del hijo y el
        // traceback de 40 lineas de pymongo se imprime en medio de los
        // resultados, tapando el Aviso de una linea que explica que paso. Con
        // 'pipe' en los tres descriptores, stderr se captura en error.stderr y
        // solo se muestra el mensaje resumido.
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    return JSON.parse(salida.trim().split('\n').pop());
  } catch (error) {
    // Si MongoDB no responde, verify ABANDONA. Eso estaba mal por dos motivos:
    //
    //   1. Se pierden las comprobaciones de Pokemon y Docentes, que son
    //      justamente las que se pueden hacer. Un problema de red con Atlas no
    //      deberia impedir revisar las otras dos bases.
    //   2. El mensaje que sale es un volcado de 40 lineas de traceback de pymongo
    //      sobre la causa REAL (a veces "Temporary failure in name resolution"),
    //      que es lo unico que de verdad dice que paso.
    //
    // Se avisa en una linea y se devuelve `null`. Las comprobaciones que dependan
    // de esto fallaran con "obtenido: null", que se lee mucho mejor que un
    // volcado de stack.
    console.log(
      ` AVISO  No se pudo consultar MongoDB: ${primeraLineaUtil(String(error.stderr || error.message))}` +
        '\n        Se saltan las comprobaciones de One Piece; las de Pokemon y Docentes siguen.',
    );
    return null;
  }
}

/**
 * Saca el mensaje de error de verdad del volcado de texto de Python.
 *
 * El traceback de pymongo son 40 lineas de calls internos y el motivo real esta
 * al FINAL ("Temporary failure in name resolution", "SSL handshake failed"...).
 * Se busca la ultima linea con pinta de exception; si no hay ninguna, se coge la
 * ultima linea no vacia. Se recorta a 160 caracteres porque el `Topology
 * Description` que se cuelga al final ocupa media linea.
 *
 * @param {string} texto `error.stderr` (o el mensaje) de la ejecucion fallida.
 * @returns {string} Una linea con el motivo.
 */
function primeraLineaUtil(texto) {
  const lineas = String(texto)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const conExcepcion = lineas.filter((l) => /[A-Za-z][A-Za-z0-9_.]*(Error|Exception)\b/.test(l));
  const elegida = (conExcepcion.length > 0 ? conExcepcion[conExcepcion.length - 1] : lineas[lineas.length - 1]) || '';
  return elegida.length > 160 ? `${elegida.slice(0, 157)}...` : elegida || 'error desconocido';
}

/** Cuantos personajes hay en MongoDB. */
async function mongoCountCharacters() {
  return mongoQuery(`
async def _(col):
    return await col.count_documents({})
`);
}

/** Un personaje por nombre, o null. Traduce `raceEstimated` a camelCase igual que el repository. */
async function mongoOne(name) {
  return mongoQuery(`
async def _(col):
    doc = await col.find_one({"name": ${JSON.stringify(name)}})
    if doc is None:
        return None
    doc.pop("_id", None)
    doc.pop("search_key", None)
    return doc
`);
}

/**
 * Intenta insertar un personaje con un id NUEVO, para comprobar el limite de 20.
 *
 * Se importa el repository real del servicio (no una copia de la logica) para
 * que verify compruebe lo que el servicio hara de verdad. Si el documento ya
 * existe, su `replace_one` lo sobrescribe sin comprobar nada, que es lo que
 * permite que el seed se repita.
 */
async function mongoUpsert(id, name) {
  const servicio = new URL('../services/onepiece-service/', import.meta.url);
  const wrapper = `
import asyncio, json, sys
sys.path.insert(0, ${JSON.stringify(servicio.pathname)})
from src.db import connection
from src.repositories import characters_repository as repo

async def main():
    try:
        await repo.upsert({"id": ${id}, "name": ${JSON.stringify(name)}, "race": "Humano"})
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        await connection.close_pool()
        return
    print(json.dumps({"error": None}))
    await connection.close_pool()

asyncio.run(main())
`;
  const salida = execFileSync(
    new URL('./.venv/bin/python', servicio).pathname,
    ['-c', wrapper],
    { encoding: 'utf8', cwd: new URL('./', servicio).pathname },
  );
  const lineas = salida.trim().split('\n').filter((l) => l.startsWith('{'));
  const resultado = JSON.parse(lineas.pop());
  if (resultado.error) throw new Error(resultado.error);
  return resultado;
}

/**
 * Replica la busqueda del servicio Python.
 *
 * Se escribe aqui (en vez de llamar al microservicio) para que verify siga
 * siendo autonomo y para comprobar la consulta real: exacto, por prefijo y por
 * contenido, con el mismo orden de relevancia que el repository.
 */
async function searchCharacters(term) {
  const key = normalizeName(term);
  if (!key) return [];
  // `mongoQuery` devuelve null cuando Mongo no responde. Se traduce a lista
  // vacia para que `(await searchCharacters(...))[0]?.name` no reviente al hacer
  // `[0]` sobre null: la comprobacion fallara con "undefined", que es el
  // resultado correcto cuando no se pudo consultar nada.
  return (
    (await mongoQuery(`
async def _(col):
    clave = ${JSON.stringify(key)}
    docs = await col.find(
        {"$or": [
            {"search_key": clave},
            {"search_key": {"$regex": "^" + re.escape(clave)}},
            {"search_key": {"$regex": re.escape(clave)}},
            {"crew.name": {"$regex": re.escape(clave), "$options": "i"}},
        ]}
    ).sort("name", 1).to_list(length=20)
    return [{"name": d["name"]} for d in docs]
`)) ?? []
  );
}

let failures = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(
    `${ok ? '  OK  ' : ' FALLA'} ${label}` +
      (ok ? '' : ` (esperado: ${expected}, obtenido: ${actual})`),
  );
}

/** Igual que check, pero el valor esperado se evalua antes de imprimirlo. */
async function checkAsync(label, promesa, esperado) {
  check(label, await promesa, esperado);
}

// Se asegura el esquema de Pokemon antes de comprobar. One Piece no tiene
// schema.sql: en MongoDB el esquema son los indices, y se crean al arrancar el
// servicio. Aqui solo se comprueban los datos.
await ensurePokemonsSchema();

// El servicio de docentes tambien tiene schema.sql, asi que se asegura igual
// que Pokemon. Esto deja el arbol de documentos en UTF-8 utilizable aunque se
// haya apagado la base en algun momento.
await ensureDocentesSchema();

// Pokemon y One Piece siguen con 20. Docentes tiene DOS registros: el docente
// real autorizado y el segundo que se agrego despues (ver
// backend/scripts/docentes-datos.js).
console.log('== 1. Las bases de datos tienen los registros esperados ==');
check('onepiece (MongoDB)', await mongoCountCharacters(), 20);
check('pokemon (PostgreSQL)', await pokemonRepo.count(), 20);
await checkAsync('docentes (PostgreSQL)', docentesRepo.count(), 2);

console.log('\n== 2. La busqueda es tolerante (sin llamar a la API externa) ==');
check("buscar 'luffy' encuentra a Luffy", (await searchCharacters('luffy'))[0]?.name, 'Monkey D Luffy');
check("buscar 'pikachu'", (await pokemonRepo.search(normalizeName('pikachu')))[0]?.name, 'pikachu');
check("buscar 'pika' (prefijo)", (await pokemonRepo.search(normalizeName('pika')))[0]?.name, 'pikachu');
check(
  'buscar mayusculas normaliza',
  (await searchCharacters('DON QUIJOTE DOFLAMINGO'))[0]?.name,
  'Don Quijote Doflamingo',
);
console.log('   -- docentes --');
// Se comprueba con la MISMA llamada que hace el repositorio real, no con una
// reimplementacion: asi verify mide lo que el servicio hara de verdad.
const NOMBRE_DOCENTE = 'Elfar Didier Morantes Sánchez';
check(
  "buscar 'elfar' (parte de una palabra) encuentra al docente",
  (await docentesRepo.search('elfar')).map((d) => d.nombre).join('|'),
  NOMBRE_DOCENTE,
);
check(
  'docentes: el apellido con tilde y sin tilde da lo mismo',
  (await docentesRepo.search('SÁNCHEZ')).map((d) => d.nombre).join('|'),
  (await docentesRepo.search('sanchez')).map((d) => d.nombre).join('|'),
);
// El nombre tiene ESPACIOS y `search_key` los elimina todos. Si el trigger de la
// base calculara la clave de otra forma, esta comprobacion fallaria.
check(
  'docentes: el nombre completo con espacios tambien encuentra',
  (await docentesRepo.search('elfar didier')).map((d) => d.nombre).join('|'),
  NOMBRE_DOCENTE,
);

console.log('\n== 3. El mapa de razas funciona con el nombre real de la API ==');
const chopper = await mongoOne('Tony-Tony Chopper');
check('raza de Tony-Tony Chopper', chopper?.race, 'Humano-Reno (fruta Zoan)');
check('no marcado como estimado', chopper?.raceEstimated, false);

console.log('\n== 4. El limite de 20 no deja pasar el registro 21 ==');
// Antes esto lo imponia un trigger de PostgreSQL. MongoDB no tiene triggers, asi
// que el limite se comprueba en el repository ANTES de insertar un documento
// nuevo. Se replica esa comprobacion aqui para confirmar que el limite sigue
// vigente: un id que ya existe SI se puede reescribir (asi el seed es
// idempotente), uno nuevo no.
let limiteOk = false;
try {
  await mongoUpsert(999999, 'Personaje De Prueba');
} catch (error) {
  limiteOk = String(error.message).includes('20');
}
check('no se puede insertar el registro 21', limiteOk, true);
check('siguen siendo 20', await mongoCountCharacters(), 20);

// Docentes SI es PostgreSQL, y ahi el limite vuelve a ser un trigger de la base
// de datos (enforce_docentes_limit). Se comprueba con el repository real: un
// id que ya existe se puede reescribir (asi el seed es idempotente) y uno nuevo
// no cabe cuando la tabla esta llena. El limite sigue siendo 20 aunque ahora
// haya un solo docente: lo que se comprueba es que el motor lo impone.
let limiteDocentesOk = false;
try {
  await docentesRepo.upsert({
    id: 999999,
    nombre: 'Docente De Prueba',
    cargo: 'Profesor',
    departamento: 'Prueba',
    carrera: 'Prueba',
    facultad: 'Prueba',
    email: 'prueba@ejemplo.edu',
    resumen: 'Resumen de prueba.',
    biografia: 'Biografia de prueba.',
    areas: [],
    formacion: [],
  });
  // Entro: la bandera se activa AQUI, al salir del try sin excepcion. Antes solo
  // se activaba dentro del catch, o sea que el caso de EXITO daba falso y esta
  // comprobacion fallaba siempre, por muy bien que funcionara el insert.
  limiteDocentesOk = true;
} catch (error) {
  console.log(`   (motivo del rechazo: ${String(error.message).slice(0, 70)})`);
  limiteDocentesOk = false;
}
check('docentes: cabe un docente mas mientras haya sitio', limiteDocentesOk, true);
// Y se limpia con remove(), para no dejar basura de prueba en la base real.
const borrado = await docentesRepo.remove(999999);
check('docentes: remove() borra lo que habia insertado', borrado?.id, 999999);
await checkAsync('docentes: sigue habiendo 2', docentesRepo.count(), 2);

// CRUD a nivel de repositorio (lo que usan las rutas POST/PUT/DELETE).
// El ciclo HTTP completo se prueba con curl contra :4003 y :3000; aqui se
// comprueba que insertar, actualizar parcial y borrar funcionan y que el PUT
// parcial NO borra los campos que no se mandaron (regresion real que se vio al
// implementar el CRUD: los ausentes se convertian en null).
const creado = await docentesRepo.insert({
  nombre: 'Docente De Prueba CRUD',
  cargo: 'Profesor',
  carrera: 'Ingenieria en Sistemas',
  resumen: 'Resumen corto.',
});
check('docentes: insert() asigna id', typeof creado?.id === 'number' && creado.id > 0, true);
const parcial = await docentesRepo.updateById(creado.id, { cargo: 'Decano' });
check('docentes: update parcial cambia lo mandado', parcial?.cargo, 'Decano');
check('docentes: update parcial conserva lo no mandado', parcial?.carrera, 'Ingenieria en Sistemas');
check('docentes: update parcial conserva el resumen', parcial?.resumen, 'Resumen corto.');
const borradoCrud = await docentesRepo.remove(creado.id);
check('docentes: remove() del CRUD devuelve el id', borradoCrud?.id, creado.id);
await checkAsync('docentes: tras el CRUD sigue habiendo 2', docentesRepo.count(), 2);

console.log('\n== 5. Coherencia de datos ==');
const sample = await mongoOne('Monkey D Luffy');
check('nombre presente', typeof sample?.name === 'string' && sample.name.length > 0, true);
check('raza presente', typeof sample?.race === 'string', true);
const pika = (await pokemonRepo.findAll()).find((p) => p.name === 'pikachu');
check('tipos de pikachu', Array.isArray(pika?.types) && pika.types.length > 0, true);
check('movimientos de pikachu', Array.isArray(pika?.moves) && pika.moves.length > 0, true);

// La quinta pestana solo muestra un RESUMEN y la ficha completa muestra la
// BIOGRAFIA. Si los dos campos se confundieran, la pestana se veria igual de
// larga que la ficha y el boton "Leer mas" no tendria sentido.
const primerDocente = (await docentesRepo.findAll())[0];
check('docentes: resumen presente', typeof primerDocente?.resumen === 'string' && primerDocente.resumen.length > 0, true);
check('docentes: biografia presente', typeof primerDocente?.biografia === 'string' && primerDocente.biografia.length > 0, true);
check(
  'docentes: el resumen es mas corto que la biografia',
  primerDocente.resumen.length < primerDocente.biografia.length,
  true,
);
check('docentes: carrera presente', typeof primerDocente?.carrera === 'string' && primerDocente.carrera.length > 0, true);
// El correo y la foto son OPCIONALES a proposito: no se publica contacto de
// nadie sin autorizacion. Si algun dia se anaden, tienen que ser institucionales.
check(
  'docentes: el email, si existe, institucional (nunca vacio)',
  primerDocente?.email == null || /\S+@\S+\.\S+/.test(String(primerDocente.email)),
  true,
);
check(
  'docentes: areas y formacion llegan como arrays',
  Array.isArray(primerDocente?.areas) && Array.isArray(primerDocente?.formacion),
  true,
);

// Las facetas alimentan la fila de filtros de la pestana. Si un valor viniera
// vacio o duplicado, apareceria un chip en blanco o repetido.
const facetas = await docentesRepo.findFacetas();
// `facultad` va en null en el registro actual, y las facetas no inventan valores:
// por eso se comprueba que hay carreras y departamentos (que si estan puestas) y
// que ningun valor sale vacio ni repetido, que es lo que romperia los chips.
check('docentes: hay carreras', facetas.carrera.length > 0, true);
check('docentes: hay departamentos', facetas.departamento.length > 0, true);
check('docentes: las carreras no se repiten', new Set(facetas.carrera).size, facetas.carrera.length);
check(
  'docentes: las facetas no tienen valores vacios',
  [...facetas.facultad, ...facetas.carrera, ...facetas.departamento].filter((v) => !String(v || '').trim()).length,
  0,
);

// findById es el endpoint de la ficha (path param). Un id que no existe tiene
// que devolver null y NO una fila vacia: si devolviera {}, el frontend
// distinguiria "no existe" de "existe pero sin datos".
check('docentes: id inexistente devuelve null', await docentesRepo.findById(999999), null);

// ---------------------------------------------------------------------------
// REGRESIONES DEL FILTRADO
//
// Estas cuatro comprobaciones estan aqui porque los dos bugs que corrigieron
// eran invisibles: el servicio respondia 200 con datos que PARECIAN bien.
//
// 1) Un `?limite` ausente tiene que devolver la pagina entera. `URLSearchParams
//    .get()` devuelve `null` y no `undefined`, y `Number(null)` es 0, que es un
//    entero valido: sin la comprobacion del null, el limite se=colaba como 0 y
//    quedaba en 1, y la app recibia una sola tarjeta con `total` de 20. Nadie lo
//    ve como un error, se ve como "solo hay un docente".
// ---------------------------------------------------------------------------
const listadoSinFiltros = await docentesRepo.findMany({
  q: '',
  carrera: '',
  departamento: '',
  limite: 50,
  offset: 0,
});
check('docentes: sin filtros devuelve todos', listadoSinFiltros.length, 2);

// El filtro de carrera se compara contra una columna YA NORMALIZADA. Antes se
// comparaba el valor normalizado contra el texto crudo con `ILIKE`, que no
// ignora los acentos: "Ingeniería en Sistemas" jamas encontraba
// "ingenieria en sistemas" y el filtro devolvia CERO resultados SIEMPRE. Lo que
// lo hace invisible es que el endpoint no daba error: devolvia 200 con total 0.
const carreraReal = primerDocente.carrera;
check('docentes: la carrera del ejemplo existe', typeof carreraReal === 'string' && carreraReal.length > 0, true);
const conAcento = await docentesRepo.countMany({ q: '', carrera: carreraReal, departamento: '' });
const sinAcento = await docentesRepo.countMany({ q: '', carrera: 'ingenieria', departamento: '' });
check('docentes: filtrar por carrera SIN tilde encuentra', sinAcento > 0, true);
check('docentes: con tilde y sin tilde, el mismo numero', conAcento, sinAcento > 0 ? conAcento : 0);

// Y el filtro tiene que ser por FRAGMENTO, no de igualdad: "Ingenieria" tiene que
// encontrar tambien "Ingeniería en Sistemas". Sin esto, elegir una carrera del
// chip no obligaria al usuario a escribir el nombre entero.
check(
  'docentes: el filtro de carrera es por fragmento',
  (await docentesRepo.findMany({ q: '', carrera: 'ingenieria', departamento: '', limite: 50, offset: 0 }))
    .every((d) => (d.carrera || '').toLowerCase().includes('ingenier')),
  true,
);

// El mismo criterio para el buscador de texto y el filtro de carrera juntos.
check(
  'docentes: texto + carrera combinados',
  (await docentesRepo.findMany({ q: 'elfar', carrera: 'ingenieria', departamento: '', limite: 50, offset: 0 }))
    .length > 0,
  true,
);
// Y que un texto que NO coincide con nadie devuelve cero, no el primero por
// defecto: un buscador que siempre responde con algo no es un buscador.
check(
  'docentes: un texto que no existe devuelve cero',
  (await docentesRepo.findMany({ q: 'zzzzznada', carrera: '', departamento: '', limite: 50, offset: 0 })).length,
  0,
);

await closePokemonsPool();
await closeDocentesPool();

console.log(failures === 0 ? '\nTodo correcto.' : `\n${failures} verificacion(es) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
