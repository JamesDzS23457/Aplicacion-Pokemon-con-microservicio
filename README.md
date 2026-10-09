# APP_Pokemon

Aplicación web Expo (SDK 57) con Pokédex, buscador de personajes de One Piece y
listado de docentes de Uninpahu.
Los datos se sirven desde **microservicios propios**, cada uno con **su propia base
de datos**. Pokémon y One Piece se cargaron una vez desde las APIs públicas de
PokéAPI y One Piece; los docentes se cargaron a mano en su propia base de Supabase
o se editan desde su Table Editor (ver `DATOS.md`).

Cada microservicio se diferencia en **dos** cosas, que es lo que pide el
enunciado:

| Microservicio | Lenguaje | Base de datos | Cómo recibe los datos |
|---|---|---|---|
| Pokémon | Node.js / Express | **Relacional**: PostgreSQL en Supabase | body (`POST /search`) |
| One Piece | Python / FastAPI | **No relacional**: MongoDB en Atlas | body (`POST /search`) |
| Docentes | Node.js **sin framework** | **Relacional**: PostgreSQL en Supabase | **lectura por URL, escritura con JSON** |

El tercero es el que cumple los requisitos adicionales: está escrito sin ningún
framework de HTTP (solo `node:http`, y su única dependencia es el driver `pg`).
Las consultas entran por la URL (path y query params) y la escritura
(`POST` crear, `PUT` actualizar, `DELETE` borrar) recibe JSON en el cuerpo. Los
tres publican su documentación **Swagger**.

## Arquitectura

```
┌──────────────────────────────┐
│  FRONTEND (Expo + Router)    │
│  app/(tabs)/* + context/*    │
└──────────────┬───────────────┘
               │ POST /api/{pokemon,characters}/search
               │ GET  /api/docentes?carrera=...   /api/docentes/:id
               │ nunca consulta las APIs externas
               ▼
┌──────────────────────────────┐
│   API GATEWAY (BFF) :3000    │  ← única URL que conoce el frontend
        │              │      │          │
        ▼              ▼      ▼          ▼
┌──────────────┐ ┌────────────┐ ┌──────────────────┐
│ pokemon-svc  │ │ onepiece-svc│ │  docentes-svc    │  procesos
│ Node.js      │ │ Python      │ │ Node.js SIN      │  independientes,
│ Express      │ │ FastAPI     │ │ framework HTTP   │  desplegables por
│    :4001     │ │    :4002    │ │      :4003       │  separado, cada
└──────┬───────┘ └──────┬─────┘ └────────┬─────────┘  uno con su /docs
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────────┐
│ Supabase/    │ │   MongoDB    │ │    Supabase/    │  20 registros
│ postgres     │ │   (Atlas)    │ │    postgres     │  cada una
│ RELACIONAL   │ │NO RELACIONAL │ │   RELACIONAL    │  fuente de verdad
└──────▲───────┘ └──────▲───────┘ └─────────────────┘
       │                │
       │ solo escritura,│
       │ durante el seed│
  ┌────┴────────────────┴──┐
  │  api.api-onepiece      │
  │  pokeapi.co            │
  └────────────────────────┘

  Los docentes NO tienen flecha desde una API externa: sus datos salen de
  backend/scripts/docentes-datos.js y el seed los copia a la base. No hace falta
  internet para cargarlos ni para consultarlos.
```

**Regla clave:** hay dos flujos distintos.

| Flujo | ¿Quién llama a la API externa? | ¿Cuándo? |
|---|---|---|
| Consulta | Nadie, solo la base de datos | En cada búsqueda |
| Carga (`seed`) | El microservicio | Una vez, con script aparte |

Tras correr el seed, el sistema **funciona sin internet**.

## Documentación Swagger

Cada microservicio se documenta solo (es un requisito del trabajo):

| Servicio | Swagger UI | Contrato OpenAPI |
|---|---|---|
| Pokémon (Node + Express) | `/docs` | `/openapi.json` |
| One Piece (Python + FastAPI) | `/docs` y `/redoc` | `/openapi.json` |
| Docentes (Node sin framework) | `/docs` | `/openapi.json` |

En local: <http://localhost:4001/docs>, <http://localhost:4002/docs> y
<http://localhost:4003/docs>. En producción, la misma ruta sobre el subdominio
del servicio en Render.

El de docentes está **escrito a mano**: el contrato es un objeto OpenAPI 3.0.3
en `src/docs/openapi.js` y la interfaz es una página HTML propia que carga
Swagger UI desde un CDN, sin `swagger-jsdoc` ni `swagger-ui-express`. Esa página
necesita internet; `/openapi.json` se sirve siempre.

## Puesta en marcha

```bash
# 1. Copia la configuración y rellena las URLs de Supabase
cp .env.example .env

# 2. Instala dependencias (incluye el entorno virtual de Python) y carga los datos
npm run backend:setup

# 3. Levanta gateway + los 3 microservicios
npm run backend

# 4. En otra terminal, la app
npm start          # o: npm run web
```

`backend:setup` crea el entorno virtual del servicio Python en
`backend/services/onepiece-service/.venv`. Si prefieres crearlo por separado:
`npm run backend:onepiece:env`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run backend:setup` | Instala los paquetes de los 3 servicios + el venv Python y corre los seeds |
| `npm run backend` | Levanta los 4 procesos con logs coloreados |
| `npm run backend:docentes` | Levanta solo el microservicio de docentes (`:4003`) |
| `npm run backend:onepiece:env` | Solo crea/actualiza el entorno virtual de Python |
| `npm run backend:seed` | Recarga los 20 personajes y 20 Pokémon (requiere internet) |
| `npm run backend:seed:pokemon` | Solo el seed de Pokémon (Node) |
| `npm run backend:seed:onepiece` | Solo el seed de One Piece (Python) |
| `npm run backend:seed:docentes` | Solo el seed de docentes (**no** necesita internet) |
| `npm run backend:datos` | Regenera `DATOS.md` consultando el gateway |
| `npm run backend:verify` | Comprueba la BD, la búsqueda y el límite de 20 |
| `npm run backend:offline-test` | Levanta el backend SIN red y comprueba que responde |

## Base de datos

Tres bases de datos, una por microservicio, y de **tipo distinto** a propósito:

- **Pokémon → PostgreSQL en Supabase** (relacional). El límite de 20 lo impone un
  **trigger de la base de datos**, no una validación en el código: es
  PostgreSQL el que lo garantiza, así que ningún camino de escritura puede
  saltárselo.
- **One Piece → MongoDB en Atlas** (no relacional). Guarda *documentos*, no
  filas, y por eso `crew` y `fruit` se guardan **anidados** en lugar de
  aplanados en columnas. MongoDB no tiene triggers, así que el mismo límite de
  20 se comprueba en `characters_repository.py` **antes** de insertar un
  documento nuevo, y solo entonces: reejecutar el seed con los mismos ids nunca
  se bloquea a sí mismo.
- **Docentes → PostgreSQL en Supabase** (relacional), en su propio proyecto de
  Supabase. Mismo motor que Pokémon pero en una base distinta, y con el límite
  de 20 otro vez garantizado por un **trigger**. No tiene API externa: los datos salen
de `backend/scripts/docentes-datos.js`, así que su seed corre **sin internet**.

Para verlas: panel de **Supabase** → Table Editor (Pokémon y docentes), y panel
de **MongoDB Atlas** → Collections.

### Desarrollo local con Docker (sin Supabase ni Atlas)

```bash
# Pokémon necesita un PostgreSQL
docker run -d --name pg-local -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_USER=postgres -p 5432:5432 postgres:16-alpine
docker exec pg-local psql -U postgres -c "CREATE DATABASE pokemon;"

# Docentes necesita OTRO PostgreSQL (base distinta en el mismo servidor)
docker exec pg-local psql -U postgres -c "CREATE DATABASE docentes;"

# One Piece necesita un MongoDB
docker run -d --name mongo-local -p 27017:27017 mongo:7
```

Y en `.env`:

```bash
POKEMON_DATABASE_URL=postgresql://postgres:testpass@localhost:5432/pokemon
DOCENTES_DATABASE_URL=postgresql://postgres:testpass@localhost:5432/docentes
DATABASE_SSL=false                     # un Postgres local no tiene SSL
ONEPIECE_MONGODB_URI=mongodb://localhost:27017
```

Para cambiar de base se usaron estas variables:

| Variable | Base |
|---|---|
| `POKEMON_DATABASE_URL` | PostgreSQL de Pokémon (o `DATABASE_URL`) |
| `DOCENTES_DATABASE_URL` | PostgreSQL de docentes (o `DATABASE_URL`) |
| `ONEPIECE_MONGODB_URI` | MongoDB de One Piece (o `MONGODB_URI`) |

Cada servicio lee la suya, y como `connection.js` de docentes lee
`DOCENTES_DATABASE_URL` **antes** que `DATABASE_URL`, nunca apunta por error a la
base de Pokémon. Las tres se cargan en los **módulos de conexión** de cada
servicio, así que da igual desde dónde se lance el proceso.

## API del gateway

| Método | Ruta | Body / Params |
|---|---|---|
| `GET` | `/health` | — |
| `POST` | `/api/characters/search` | `{ "name": "luffy" }` |
| `GET` | `/api/characters` | lista los 20 |
| `GET` | `/api/characters/:id` | — |
| `POST` | `/api/pokemon/search` | `{ "name": "pikachu" }` |
| `GET` | `/api/pokemon` | lista los 20 |
| `GET` | `/api/pokemon/:id` | — |
| `GET` | `/api/docentes` | query params: `q`, `carrera`, `departamento`, `limite`, `pagina` |
| `GET` | `/api/docentes/facetas` | — |
| `GET` | `/api/docentes/buscar/:termino` | el término va en el **path** |
| `GET` | `/api/docentes/:id` | el id va en el **path** |

Ojo con la diferencia entre las tres familias de rutas: Pokémon y One Piece
reciben el dato de la búsqueda en el **cuerpo** (`POST` + JSON), mientras que
Docentes **solo acepta `GET`** y todo lo que necesita viaja en la URL. No es un
detalle de estilo: es el requisito del trabajo, y por eso el gateway tampoco
declara ningún `POST` en `/api/docentes`.

La documentación interactiva de cada microservicio está en su `/docs` (ver
[Documentación Swagger](#documentación-swagger)).

La búsqueda es **tolerante**: normaliza el texto (minúsculas, sin acentos, sin
puntuación) antes de comparar. Así `luffy`, `LUFFY`, `tony tony chopper` y
`Tony-Tony Chopper` son la misma búsqueda. También busca dentro del nombre de la
tripulación.

```bash
curl -X POST localhost:3000/api/characters/search \
  -H 'Content-Type: application/json' -d '{"name":"luffy"}'

# los docentes se filtran por la URL, sin cuerpo
curl 'localhost:3000/api/docentes?carrera=Ingenier%C3%ADa%20en%20Sistemas'
curl localhost:3000/api/docentes/buscar/garcia
curl localhost:3000/api/docentes/1
```

El gateway aplica una **lista blanca** de query params a `/api/docentes`: solo
reenvía `q`, `carrera`, `departamento`, `limite` y `pagina`, y reconstruye la
cadena con `URLSearchParams`. Lo que llegue de más no pasa.

## Logs (saber qué se busca y contra quién)

Cada búsqueda deja una línea en el log del proceso que la atiende. El formato
empieza por el entorno, para responder de un vistazo a "¿esto es local o
desplegado?":

```
[2026-10-02 18:45:03] [DESPLEGADO] [gateway] POST /api/pokemon/search name="pikachu" | destino=DESPLEGADO https://pokemon-service-rtjy.onrender.com | 200 en 320ms
[2026-10-02 18:45:03] [DESPLEGADO] [pokemon-service] busqueda "pikachu" -> 1 resultado(s)
[2026-10-02 18:45:03] [DESPLEGADO] [frontend] POST /api/pokemon/search name="pikachu" -> https://gateway-wm3a.onrender.com
[2026-10-02 18:45:03] [DESPLEGADO] [frontend]   200 en 340ms: encontrado "pikachu"
```

Cómo decide cada pieza si es LOCAL o DESPLEGADO:

| Proceso | Cómo lo detecta |
|---|---|
| Gateway y microservicios | Render define `RENDER=true`. Si la variable no está, es local. |
| Frontend | Si `EXPO_PUBLIC_API_URL` es `localhost`/`127.0.0.1`, es local. |

Al arrancar, cada microservicio dice además contra qué base de datos habla
(el host, nunca las credenciales):

```
[2026-10-02 18:45:00] [DESPLEGADO] [pokemon-service] ENTORNO=DESPLEGADO | BD=aws-0-us-east-2.pooler.supabase.com | escuchando en :10000
```

- Los logs del backend salen en la terminal local y en Render → Logs.
- Los del frontend salen en la consola del navegador (F12 → Console) o en la
  terminal de Expo si es móvil.

La ruta `GET /` del gateway también incluye `entorno` y `destinos`, por si se
quiere ver sin mirar logs.

## Estructura del backend

```
backend/
├── gateway/src/{index,config,proxy}.js + routes/     (Node)
├── services/
│   ├── pokemon-service/                              (Node + Express)
│   │   └── src/{db,repositories,services,routes,external,lib}/ + swagger.js
│   ├── onepiece-service/                             (Python + FastAPI)
│   │   ├── src/{db,repositories,services,routers,external,lib}/ + main.py
│   │   ├── requirements.txt
│   │   └── seed.py
│   └── docentes-service/                             (Node SIN framework)
│       └── src/{db,repositories,services,routes,http,lib,docs}/
└── scripts/
    ├── {seed,seed-pokemon,generate-datos,verify,dev}.js + onepiece-env.sh
    ├── docentes-datos.js        (los docentes; se edita o se deja el Table Editor)
    └── seed-docentes.js         (los carga; no necesita internet)
```

El servicio de docentes tiene una diferencia estructural con los otros dos: como
no usa Express, **no tiene `routes/`** al uso de la librería ni capa `external/`.
Su capa HTTP es `src/http/` (router y respuestas escritas a mano) y no necesita
`external/` porque no habla con ninguna API externa. El resto de capas
(`services/`, `repositories/`, `db/`, `lib/`) son idénticas en nombre y
responsabilidad, para que los tres se lean igual.

| Capa | Responsabilidad |
|---|---|
| `routes/` (Node) · `routers/` (Python) | HTTP. Traduce request/response. Sin lógica. |
| `services/` | Reglas de negocio y validaciones. Sin acceso a la base. |
| `repositories/` | **Única capa que habla con la base de datos** (SQL en Pokémon y docentes, consultas de MongoDB en One Piece). |
| `external/` | **Única capa que hace peticiones a internet.** Pokémon y One Piece la tienen; docentes no, porque no llama a ninguna API externa. |

Aislar el acceso a datos en `repositories/` es lo que permitió cambiar de SQLite
a PostgreSQL, reescribir el servicio de One Piece de Node a Python y después
migrar ese mismo servicio a MongoDB, **sin tocar routers, servicios ni el
contrato HTTP**. La API pública es idéntica en los tres casos.

## Interfaz

El diseño vive en piezas compartidas, para que las cinco pantallas no se
desincronicen:

- `lib/theme.ts`: colores, espaciados, radios y sombras. Cada sección tiene su
  acento (azul para Pokémon, coral para One Piece, verde institucional para
  Docentes).
- `components/ui.tsx`: encabezado, buscador, mosaicos de datos, estados vacíos,
  avisos y animación de entrada. Comunes a todas.
- `components/docentes.tsx`: solo de la quinta pestaña. Photo-or-initials,
  tarjeta, botón «Leer más» y chips de filtro. Van aparte a propósito: si se
  metieran en `ui.tsx`, Pokémon y One Piece arrastrarían código que no usan.

Los valores técnicos se humanizan antes de mostrarse: la altura y el peso de
PokéAPI (decímetros y hectogramos) pasan a metros y kilos, y las recompensas de
One Piece se agrupan con separador de miles (`฿ 3.000.000.000`).

## Despliegue

```bash
render blueprint launch
```

`render.yaml` define los 4 servicios. Las URLs de base de datos se configuran
en el dashboard de Render (`sync: false` evita que aparezcan en los logs).

**Pasos para el microservicio de docentes en Render:**

1. Crear el servicio desde el blueprint (o `New > Web Service` apuntando a
   `backend/services/docentes-service`, runtime `node`).
2. En `Environment`, pegar `DOCENTES_DATABASE_URL` con la URI de Supabase. Como
   es `sync: false`, **no aparece sola**: hay que escribirla a mano. Sin ella el
   servicio arranca y muere enseguida con
   `Falta DOCENTES_DATABASE_URL en el entorno`, que es a propósito (morirse al
   arrancar es mucho más fácil de diagnosticar que devolver `500` en cada
   petición).
3. En el servicio `gateway`, `DOCENTES_SERVICE_URL` se inyecta sola desde el
   blueprint (`fromService`), así que no hay que hacer nada. Si el gateway ya
   existía antes de este cambio, hay que **añadirla a mano**.
4. No se fija `PORT`: Render detecta el puerto y lo inyecta.

El microservicio de One Piece declara `runtime: python` (el único que no es
Node) y fija `PYTHON_VERSION=3.12.7`: es una versión con ruedas precompiladas de
`asyncpg`/`uvloop`, así que el `pip install` del build es rápido y fiable. Si
cambias el `runtime` de un servicio que ya existe en Render, hay que **borrarlo
y crearlo de nuevo** (Render no cambia el runtime de un servicio en caliente);
el nombre debe seguir siendo `onepiece-service` para que el gateway lo resuelva
por `fromService`.

Al usar una base de datos gestionada y no un archivo en disco, **el backend ya
no depende del sistema de archivos del servidor**: funciona en Render, Railway,
Vercel o cualquier host.

### Frontend en Vercel

El frontend es una exportación estática de Expo (`expo export --platform web`),
así que Vercel solo sirve archivos: no ejecuta Node en producción. El archivo
`vercel.json` ya trae la configuración exacta:

| Ajuste | Por qué |
|---|---|
| `buildCommand` | `npx expo export --platform web` genera la carpeta `dist/` |
| `outputDirectory` | `dist` es lo que Vercel publica |
| `framework: null` | Evita que Vercel detecte "Expo" y aplique su propio preset |
| `rewrites` | expo-router es una SPA: toda ruta desconocida vuelve a `index.html` |

`EXPO_PUBLIC_API_URL` se incrusta en el bundle **en tiempo de build**, no de
ejecución. Por eso vive en `.env.production` (se commitea, no es secreta) y no
basta con cambiarla después en Vercel. En producción apunta al gateway.

Pasos:

1. Importa este repositorio en Vercel (Add New → Project).
2. Si Vercel autodetecta un preset distinto de **Other**, selecciona **Other**.
   Confirma en *Build & Output Settings*: Build Command
   `npx expo export --platform web` y Output Directory `dist`. No hace falta
   definir variables de entorno: `.env.production` ya trae la URL del gateway.
3. Deploy. Cada `git push` a `main` vuelve a desplegar.
4. (Opcional) Si prefieres definir la variable en el panel en vez de en
   `.env.production`: Settings → Environment Variables →
   `EXPO_PUBLIC_API_URL` = `https://gateway-wm3a.onrender.com`. El panel tiene
   prioridad sobre los archivos `.env` del repo; vuelve a desplegar después.

### Si el gateway responde `503 "Microservicio no disponible"`

El gateway expone `GET /`, que dice **a qué URL apunta** cada microservicio.
Míralo antes de tocar nada, porque cada síntoma tiene una causa distinta:

| Lo que ves en `GET /` | Causa | Arreglo |
|---|---|---|
| `...:5432` | Alguien fijó `PORT=5432` a mano en el dashboard | Borrar ese `PORT` (Render detecta el puerto solo) |
| Host sin `http(s)://` | `fetch()` exige URL absoluta | Ya lo normaliza `normalizeUrl()` en `config.js` |
| Respuesta con `"detail":"ENOTFOUND"` | El hostname **no existe**: estás usando la red privada en un servicio FREE | Usar la URL pública (ver abajo) |

**Límite del plan free.** Render documenta: *"Free web services can't receive
private network traffic."* Un servicio free **no tiene hostname en la red
privada**, así que `fromService` con `property: hostport` (por ejemplo
`pokemon-service:10000`) da `ENOTFOUND`. Por eso `render.yaml` referencia
`RENDER_EXTERNAL_HOSTNAME` (el subdominio público) y `config.js` antepone
`https://`. Sigue siendo nuestro propio microservicio; lo único que cambia es
que el salto gateway → microservicio sale a internet, porque la red privada no
está disponible en free.

**Arranque en frío.** El plan free duerme los servicios a los 15 minutos sin
tráfico y tarda ~1 minuto en despertarlos. El proxy del gateway espera hasta
**60 s** a propósito, para que la primera búsqueda tras un rato de inactividad
no falle. La primera petición del día puede tardar ese minuto: es normal, no
está roto.

## Notas sobre los datos

- **`race` (raza)** no existe en la API de One Piece. Es un mapa curado a mano
  en `external/race_map.py`; los personajes fuera del mapa devuelven `"Humano"`
  con `raceEstimated: true`.
- **`genero`** de Pokémon se deduce del *gender rate* de la especie
  (probabilidad), no del género real. No existe endpoint que lo devuelva.
- **Imágenes de One Piece**: se resuelven **solo en el seed** consultando el
  índice de personajes de **Jikan (MyAnimeList)** en `external/jikan_client.py`,
  y la URL del retrato se guarda en `image_url`. Wikipedia (`429` sistemático) y
  el CDN de Fandom (bloqueo de Cloudflare) quedaron descartados. En el flujo
  normal de búsqueda el backend nunca sale a internet. Jikan falla de vez en
  cuando (devuelve `504` porque no logra conectar con MyAnimeList); si eso pasa
  durante el seed, `COALESCE` **conserva la imagen que ya estaba guardada** en
  vez de borrarla.
- Los datos de One Piece vienen mezclados en **francés e inglés** (`"19 ans"`,
  `"vivant"`, `"Captain"`). Se traducen **en el seed** con el mapa curado
  `lib/translations.py`, así que la base de datos, la API y la app ya guardan y
  muestran español. Las descripciones largas de las frutas se dejaron en su
  idioma original porque no se muestran en las pantallas principales.