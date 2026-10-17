# APP_Pokemon

Aplicación web Expo (SDK 57) con Pokédex, buscador de personajes de One Piece,
listado de docentes de Uninpahu y un **asistente de IA** que responde preguntas
sobre esos mismos datos.
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

Hay un **cuarto microservicio**, el **asistente de IA** (Node.js / Express), que es
la **excepción deliberada**: **no tiene base de datos propia**. Arma el contexto
pidiéndole los datos a los otros tres por HTTP, se los pasa a una **IA pública y
gratuita** (Google Gemini) y limita las respuestas a esa información. Su detalle
está en [Asistente de IA](#asistente-de-ia-actividad-en-clase-13).

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

**El asistente de IA (cuarto microservicio) tiene su propio camino**, y por eso no
está en el dibujo de arriba: no tiene base de datos, les pide los datos a los otros
tres por HTTP y consulta una IA pública.

```
  FRONTEND ──► GATEWAY :3000 ──► asistente-service :4004 ──► Google Gemini
                                        │                      (IA pública,
                                        │                       plan gratuito)
                                        └──► pokemon / onepiece / docentes
                                             (les pide los datos, por HTTP)
```

El asistente es **el único que sale a internet durante una consulta normal**; los
otros tres solo salen en su `seed`. Su capa `external/` es la única del backend que
habla con una API externa al atender una petición de usuario.

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
| Asistente (Node + Express) | `/docs` | `/openapi.json` |

En local: <http://localhost:4001/docs>, <http://localhost:4002/docs>,
<http://localhost:4003/docs> y <http://localhost:4004/docs>. En producción, la
misma ruta sobre el subdominio del servicio en Render.

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

# 3. Levanta gateway + los 4 microservicios
npm run backend

# 4. En otra terminal, la app
npm start          # o: npm run web
```

`backend:setup` crea el entorno virtual del servicio Python en
`backend/services/onepiece-service/.venv`. Si prefieres crearlo por separado:
`npm run backend:onepiece:env`.

Para que el asistente responda de verdad hace falta una **clave gratuita de
Gemini** en `.env` (`GEMINI_API_KEY`; ver [Asistente de IA](#asistente-de-ia-actividad-en-clase-13)).
Sin ella el resto de la app funciona igual: el asistente arranca en modo degradado
y lo avisa en su `/health`.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run backend:setup` | Instala los paquetes de los 4 servicios + el venv Python y corre los seeds |
| `npm run backend` | Levanta los 5 procesos con logs coloreados |
| `npm run backend:docentes` | Levanta solo el microservicio de docentes (`:4003`) |
| `npm run backend:asistente` | Levanta solo el microservicio de IA (`:4004`) |
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
| `POST` | `/api/asistente` | `{ "pregunta": "...", "modo": "restringido"\|"abierto", "historial": [{"rol","texto"}] }` |

Ojo con la diferencia entre las tres familias de rutas: Pokémon y One Piece
reciben el dato de la búsqueda en el **cuerpo** (`POST` + JSON), mientras que
Docentes **solo acepta `GET`** y todo lo que necesita viaja en la URL. No es un
detalle de estilo: es el requisito del trabajo, y por eso el gateway tampoco
declara ningún `POST` en `/api/docentes`.

`POST /api/asistente` es el único `POST` que **no** es una búsqueda: lleva el
cuerpo con la pregunta y el modo, y el gateway lo filtra con una **lista blanca**
(`pregunta`, `modo`, `historial`). La clave de Gemini **no pasa por el gateway**:
vive solo en el microservicio.

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
│   ├── docentes-service/                             (Node SIN framework)
│   │   └── src/{db,repositories,services,routes,http,lib,docs}/
│   └── asistente-service/                            (Node + Express + IA)
│       └── src/{repositories,services,routes,external,lib}/ + swagger.js
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

El servicio del asistente tiene la diferencia contraria: **no tiene `db/`** (no
tiene base propia) y su `repositories/` habla con las bases **ajenas** a través de
los otros tres microservicios. Es el único con `external/` que sale a internet en
tiempo de consulta.

| Capa | Responsabilidad |
|---|---|
| `routes/` (Node) · `routers/` (Python) | HTTP. Traduce request/response. Sin lógica. |
| `services/` | Reglas de negocio y validaciones. Sin acceso a la base. |
| `repositories/` | **Única capa que habla con los datos** (SQL en Pokémon y docentes, consultas de MongoDB en One Piece; en el asistente, peticiones a los otros microservicios). |
| `external/` | **Única capa que hace peticiones a internet.** Pokémon y One Piece la tienen (solo en el seed), docentes no, y en el asistente es la llamada a la IA. |

Aislar el acceso a datos en `repositories/` es lo que permitió cambiar de SQLite
a PostgreSQL, reescribir el servicio de One Piece de Node a Python y después
migrar ese mismo servicio a MongoDB, **sin tocar routers, servicios ni el
contrato HTTP**. La API pública es idéntica en los tres casos.

## Interfaz

El diseño vive en piezas compartidas, para que las seis pantallas no se
desincronicen:

- `lib/theme.ts`: colores, espaciados, radios y sombras. Cada sección tiene su
  acento (azul para Pokémon, coral para One Piece, verde institucional para
  Docentes y violeta para el Asistente).
- `components/ui.tsx`: encabezado, buscador, mosaicos de datos, estados vacíos,
  avisos y animación de entrada. Comunes a todas.
- `components/docentes.tsx`: solo de la quinta pestaña. Photo-or-initials,
  tarjeta, botón «Leer más» y chips de filtro. Van aparte a propósito: si se
  metieran en `ui.tsx`, Pokémon y One Piece arrastrarían código que no usan.
- `components/chat.tsx`: solo de la sexta pestaña. Burbujas, indicador de
  «escribiendo», interruptor de modo, chips de sugerencia y barra de entrada.

Los valores técnicos se humanizan antes de mostrarse: la altura y el peso de
PokéAPI (decímetros y hectogramos) pasan a metros y kilos, y las recompensas de
One Piece se agrupan con separador de miles (`฿ 3.000.000.000`).

## Modo offline y monitor de la nube (Docentes)

La pestaña de Docentes funciona **sin conexión** y se sincroniza sola. La nube
(Supabase) sigue siendo la base principal; el dispositivo guarda un **espejo** en
SQLite (`expo-sqlite`) que también sirve de cola de operaciones pendientes.

- **Sin red** (`lib/conexion.ts` lo detecta con NetInfo): las lecturas salen del
  espejo local y las altas/ediciones/borrados se guardan localmente y se encolan.
  Un `503` **no** es "sin red" (es un arranque en frío de Render), así que nunca
  activa el modo offline.
- **Al volver la red**: la cola se sube en orden FIFO y luego se recarga. Los ids
  locales se reescriben con el id real que asigna el microservicio.
- **Monitor periódico**: cada 2s/10s/30s (o apagado) el frontend pregunta a la
  nube si cambió algo. Si no hay pendientes, actualiza en silencio; si los hay,
  sincroniza primero para no pisar los cambios locales.
- **Indicador "nuevo"**: un docente que aparece en la nube y que el usuario aún no
  consultó lleva una insignia **NUEVO** (y un aviso), que desaparece al abrir su
  ficha.
- **Conflictos**: si un alta local choca con un nombre ya insertado en la nube
  (la columna `nombre` es `UNIQUE`), en vez de descartarla se **fusiona**: se
  actualiza la ficha existente con los datos locales (gana lo local) y queda un
  único registro.

### Probar el modo offline y el monitor

En **web** el respaldo SQLite usa `SharedArrayBuffer`, y el navegador solo lo
habilita en un *contexto aislado*. El servidor de desarrollo de Expo (`npm run
web`) **no** manda esas cabeceras, así que el espejo local no arrancaría. Para
probarlo hay un servidor mínimo que sirve la exportación con las cabeceras
puestas (las mismas de `vercel.json`):

```bash
npm run web:build        # genera dist/ (usa la URL de gateway de .env)
npm run web:serve        # sirve en http://127.0.0.1:8088/docentes
```

Con la pestaña abierta:

1. **Monitor**: los chips `2s/10s/30s/Off` cambian cada cuánto se revisa la nube
   y a la derecha sale la hora de la última revisión.
2. **Nuevo**: inserta un docente en la nube (Table Editor de Supabase, o
   `curl -X POST <gateway>/api/docentes -H "Content-Type: application/json" -d '{"nombre":"Prueba"}'`).
   En el siguiente ciclo aparece con la insignia **NUEVO**; al abrir su ficha se quita.
3. **Offline**: en las DevTools, pestaña *Network*, marca **Offline** y crea un
   docente. Avisa «Sin conexión - 1 pendiente(s)». (Navega primero y desconecta
   después: `Offline` bloquea también esta página.)
4. **Conflictos**: sin conexión crea un docente; mientras, crea el mismo nombre
   en la nube. Reconecta: al sincronizar sale el aviso de fusión y en la nube
   queda **un solo** registro.

En **móvil** (Expo Go o build nativa) no hacen falta cabeceras: el modo avión
deja la app sin red y SQLite es nativo.

## Asistente de IA (Actividad en Clase 13)

La sexta pestaña (**Asistente**) es un chat que responde preguntas sobre los datos
de la propia app con una **IA pública y gratuita**: **Google Gemini** (plan free).

La actividad tenía **dos fases**, y las dos están implementadas en la misma
pantalla, con un interruptor:

| Fase | Modo | Qué hace |
|---|---|---|
| 1. Conectar la IA | **Abierto** | Responde cualquier pregunta (para demostrar la conexión). |
| 2. Limitar al contexto | **Solo mi base de datos** | Solo responde de los Pokémon, los personajes de One Piece y los docentes de la app. |

Cuando la pregunta se sale del contexto, el asistente responde **exactamente**:

```
No estoy programada para dar ese tipo de preguntas.
```

### Cómo está separado (front / back / IA)

```
app/(tabs)/asistente.tsx ─► AsistenteContext ─► GATEWAY :3000 ─► asistente-service :4004 ─► Gemini
      (chat)                  (estado)          POST /api/asistente        (contexto)         (IA pública)
```

- **El frontend nunca ve la clave de la IA** ni habla con Gemini: solo conoce el
  gateway, como el resto de la app.
- **El gateway tampoco la ve**: reenvía la pregunta y filtra el cuerpo con una
  lista blanca.
- **El asistente-service** es el único que tiene la clave y el único que sale a
  internet (`src/external/gemini.client.js`).

### Cómo arma el contexto (y por qué no hay "RAG")

No tiene base propia: en `repositories/contexto.repository.js` les pide los
catálogos a los otros tres microservicios (`GET /api/pokemon`,
`GET /api/characters`, `GET /api/docentes`), los cachea 5 minutos y arma dos
bloques:

- un **CATALOGO** con el nombre de las 42 entidades (20 + 20 + 2), que es la lista
  de lo que la IA *puede* tocar;
- un **CONTEXTO** con la ficha completa de las entidades que la pregunta menciona.

Para buscar la mención normaliza el texto (sin acentos ni mayúsculas), igual que
el resto del backend. Como el catálogo es pequeño (42), no hace falta ninguna
técnica de recuperación: cabe entero en el prompt.

### Dos capas de defensa (y por qué)

1. **Guardia en el servidor** (`services/asistente.service.js`): si la pregunta no
   menciona ninguna entidad del catálogo y no es una pregunta claramente de la app,
   devuelve la frase de rechazo **sin llamar a la IA**. Es determinista y **gasta
   cuota cero**.
2. **Instrucción de sistema**: el prompt le repite la regla a la IA para los casos
   dudosos (una pregunta que menciona a Pikachu pero deriva a otro tema).

Dentro del tema, la IA **sí** puede usar su conocimiento general para completar
datos de una entidad permitida (por ejemplo, «¿en qué capítulo sale Pikachu?»): lo
que no puede es salirse de las entidades de la app.

### Configuración

En `.env` (solo del backend; el `.env.example` ya trae la plantilla):

| Variable | Para qué | Por defecto |
|---|---|---|
| `GEMINI_API_KEY` | Clave de Gemini. **Sin ella el servicio arranca en degradado** y lo avisa. | — |
| `GEMINI_MODEL` | Modelo gratis. Se cambia sin tocar código. | `gemini-3.5-flash-lite` |
| `GEMINI_BASE_URL` | Base de la API (útil para apuntar a un mock en pruebas). | Gemini |
| `CATALOGO_TTL_MS` | Cuánto se cachea el catálogo. | `300000` (5 min) |
| `IA_TIMEOUT_MS` | Tiempo máximo de espera de la IA. | `45000` |

Clave gratuita: <https://aistudio.google.com/> → *Get API key*. Google retiró la
serie 2.5 para proyectos nuevos (su API responde *«no longer available to new
users»*), así que el defecto es `gemini-3.5-flash-lite`, que fue el más rápido en
la prueba (~0.9 s); `gemini-3.5-flash` y `gemini-3.8-flash` dan más calidad a más
latencia.

### Probar el asistente

```bash
# Pregunta dentro del contexto (necesita GEMINI_API_KEY)
curl -X POST localhost:3000/api/asistente -H 'Content-Type: application/json' \
  -d '{"pregunta":"que tipos tiene Pikachu?","modo":"restringido"}'

# Pregunta fuera del contexto: responde la frase exacta SIN gastar cuota
curl -X POST localhost:3000/api/asistente -H 'Content-Type: application/json' \
  -d '{"pregunta":"quien gano el mundial 2022?","modo":"restringido"}'

# Modo abierto: la misma pregunta ahora se responde
curl -X POST localhost:3000/api/asistente -H 'Content-Type: application/json' \
  -d '{"pregunta":"quien gano el mundial 2022?","modo":"abierto"}'
```

La respuesta trae `modo`, `enAlcance` y `motor`: `"guardia"` cuando la negó el
servidor sin llamar a la IA, y `"gemini"` cuando respondió el modelo.

## Despliegue

```bash
render blueprint launch
```

`render.yaml` define los 5 servicios. Las URLs de base de datos y la clave de la
IA se configuran en el dashboard de Render (`sync: false` evita que aparezcan en
los logs).

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

**Pasos para el microservicio del asistente en Render:**

1. Crear el servicio desde el blueprint (`rootDir`
   `backend/services/asistente-service`, runtime `node`).
2. En `Environment`, pegar `GEMINI_API_KEY` con `sync: false`: **no aparece sola**.
   Sin ella el servicio **arranca igual** (en degradado) y su `/health` dice
   `ia: sin configurar`, pero no responde preguntas.
3. En el servicio `gateway`, `ASISTENTE_SERVICE_URL` se inyecta sola (`fromService`);
   si el gateway ya existía antes de este cambio, hay que **añadirla a mano**.
4. `GEMINI_MODEL` sí va fijada en el blueprint (`gemini-3.5-flash-lite`), así que se
   puede cambiar ahí sin tocar código.

El asistente **no tiene base de datos**, así que no necesita ninguna URL de
Supabase ni de Atlas. Consigue los datos por HTTP de los otros tres servicios, que
sí las tienen.

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
| `headers` (COOP/COEP) | `expo-sqlite` en web usa `SharedArrayBuffer` y exige contexto aislado. Se usa `Cross-Origin-Embedder-Policy: credentialless` (y no `require-corp`) porque `credentialless` mantiene el aislamiento y a la vez deja cargar las fotos externas de los docentes, que `require-corp` bloquea |

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