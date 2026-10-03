# docentes-service

Microservicio de **docentes de Uninpahu** (Universidad Privada Nacional
Guillermo CMOS Valderrama). Es el **tercer** microservicio del proyecto y el
que alimenta la quinta pestana de la app.

| | |
|---|---|
| Puerto local | `4003` |
| Base de datos | PostgreSQL en **Supabase** (propia: `DOCENTES_DATABASE_URL`) |
| Variables | `DOCENTES_DATABASE_URL`, `DATABASE_SSL`, `PORT` (opcional) |
| Documentacion | `http://localhost:4003/docs` (Swagger UI) |
| Especificacion | `http://localhost:4003/openapi.json` (OpenAPI 3.0.3) |

---

## Que significa "agnostico" aqui

El enunciado pide un microservicio **agnostico**: que no dependa de un
framework de HTTP. En el codigo eso se traduce en una sola regla:

> **Lo unico que se importa de fuera de Node es el driver de la base de datos.**

```json
"dependencies": { "pg": "^8.13.1" }
```

Y esa dependencia no es opcional en ningun sentido: **Node no incluye un
cliente de PostgreSQL en su biblioteca estandar.** Habria que hablar HTTP con
la base a mano, implementando el protocolo de PostgreSQL por sockets, lo cual
seria mas "agnostico" todavia pero resolveria menos el problema real (hablar
con la base) y crearia uno enorme (hablar con la base).

Lo que si se evita, y es de donde viene el valor de la palabra:

| Necesidad | En `pokemon-service` | Aqui |
|---|---|---|
| Servidor HTTP | `express` | `node:http` |
| Enrutado | `app.get(...)` | `src/http/router.js`, escrito a mano |
| CORS | `cors` | cabeceras escritas a mano |
| Manejo de errores | middleware de Express | `src/http/respond.js` + `src/lib/errors.js` |
| Documentacion | `swagger-jsdoc` | objeto OpenAPI escrito a mano + Swagger UI desde un CDN |
| UI de la documentacion | `swagger-ui-express` | una pagina HTML en `src/docs/documentacion.routes.js` |

La consecuencia practica es que **cambiar de framework HTTP no obliga a tocar
nada**: el servidor entero son unas 200 lineas de `node:http` y un router
propio (`src/server.js` + `src/http/router.js`). El servicio arranca con
`node src/index.js` y no hay nada que compilar ni transpilar.

---

## Solo path params y query params. Nunca body

El enunciado pide que los datos viajen por parametros de ruta o de consulta,
**nunca por el body**. Este servicio cumple eso de la forma mas fuerte posible:

**No tiene ni un solo verbo que escriba. Solo `GET`.**

Un `POST` con body es lo unico que podria "colar" parametros de cuerpo, y no
existe. Ademas el body se **ignora de forma explicita**: `src/server.js` no lo
lee, no lo parsea y no lo pasa a nadie. No es una convencia, es que el codigo
que lo haria no esta escrito.

Los dos mecanismos admitidos:

- **Path params** — `GET /api/docentes/7` busca el docente `id = 7`.
- **Query params** — `GET /api/docentes?carrera=Ingenieria&limite=10` filtra y
  pagina. El gateway acepta una lista blanca (`FILTROS_ACEPTADOS` en
  `backend/gateway/src/routes/docentes.routes.js`) y descarta lo que no este
  en ella.

---

## Endpoints

| Metodo | Ruta | Que hace |
|---|---|---|
| `GET` | `/` | Descripcion del servicio y sus endpoints |
| `GET` | `/health` | Sonda de vida; la usa Render para decidir si el servicio esta vivo |
| `GET` | `/docs` | Swagger UI |
| `GET` | `/openapi.json` | La especificacion OpenAPI en JSON |
| `GET` | `/api/docentes` | Lista con filtros: `q`, `carrera`, `departamento`, `limite`, `pagina` |
| `GET` | `/api/docentes/facetas` | Valores distintos de carrera y departamento, para la fila de filtros |
| `GET` | `/api/docentes/buscar/:termino` | Busqueda por nombre, tolerante a mayusculas y acentos |
| `GET` | `/api/docentes/:id` | Ficha completa de un docente (path param) |

Todos respondem `200` con JSON. Un `404` con `{"error": ...}` si no existe, un
`400` si el parametro no tiene sentido (`limite=0`, `pagina=abc`, `id=xyz`), y
un `405` si se usa un verbo que no existe.

> **Orden de las rutas.** El router usa *la primera que coincide gana*, asi que
> las rutas literales (`/facetas`, `/buscar/:termino`) se registran **antes**
> que `/:id`. Si fuera al reves, `/api/docentes/facetas` se interpretaria como
> "el docente de id `facetas`".

---

## Estructura

```
src/
  index.js                        punto de entrada (solo lee PORT y arranca)
  server.js                       tuberia de la peticion: OPTIONS -> 405 -> 404 -> manejador
  http/
    router.js                     enrutado hecho a mano (:param y comodin *)
    respond.js                    respuestas JSON y error HTTP
  lib/
    errors.js                     ErrorDeNegocio y problemas de validacion
    normalize.js                  normalizacion de texto (minusculas, sin acentos)
    log.js                        logs con marca de tiempo
  db/
    connection.js                 pool de PostgreSQL + carga del .env local
    schema.sql                    tabla `docentes` + trigger del limite de 20
  repositories/
    docentes.repository.js        TODO el SQL vive aqui
  services/
    docentes.service.js          reglas de negocio y validacion
  docs/
    openapi.js                    el objeto OpenAPI 3.0.3, escrito a mano
    documentacion.routes.js       la pagina HTML con Swagger UI
```

Son las mismas cuatro capas que los otros dos microservicios, con los mismos
nombres, para que se lea igual: **HTTP -> servicios -> repositorios -> base de
datos.** No hay SQL fuera de `repositories/`.

---

## Correrlo

```bash
# La primera vez, desde la raiz del proyecto
npm install --prefix backend/services/docentes-service

# Cargar los docentes desde backend/scripts/docentes-datos.js (idempotente, sin internet)
npm run backend:seed:docentes

# Arrancar solo este servicio
npm run backend:docentes
```

Desde el proyecto completo, `npm run backend` levanta los cuatro procesos a la
vez (gateway, pokemon, onepiece y este).

## Desplegar

`render.yaml` ya lo declara. Como `sync: false`, Render **no** muestra la clave:
hay que ir a mano a `Environment` del servicio y pegar la URI de Supabase
(`Project > Settings > Database > Connection string`, la del **Session
pooler**, puerto 5432). Si no se pega, el servicio arranca y muere enseguida
con `Falta DOCENTES_DATABASE_URL en el entorno` — que es a proposito: morirse
al arrancar es mucho mas facil de diagnosticar que devolver `500` en cada
peticion.

---

## Sobre los datos

Los 20 registros son **de demostración** y estan en
`backend/scripts/docentes-datos.js`. Son ficticios. Para poner datos reales hay
que editar ese archivo (o cargar las filas directamente) y correr el seed otra
vez. `foto_url` es opcional: si un docente no tiene foto, la app dibuja un
avatar con sus iniciales, asi que la quinta pestaña nunca queda con huecos.

El limite de 20 lo impone **la base de datos**, no este codigo: el trigger
`enforce_docentes_limit()` de `src/db/schema.sql` rechaza el registro 21. Por
eso los `upsert` del seed se pueden repetir (reescriben los que ya existen)
pero insertar un docente nuevo con la tabla llena falla.