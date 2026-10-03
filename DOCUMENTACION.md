# DOCUMENTACION.md - Mapa del proyecto

Guia corta del repositorio. Cada linea dice **que hace** un archivo o carpeta y
**con quien se conecta**. No sustituye al `README.md` (que explica el montaje,
las decisiones y el despliegue): este documento es el mapa rapido para saber
donde vive cada cosa sin leer todo el codigo.

Inventario de datos cargados: `DATOS.md`.

## Como funciona en una linea

```
App (Expo)  ->  Gateway :3000  ->  pokemon-service :4001 (Node)     ->  PostgreSQL (Supabase)
   frontend      unica URL         onepiece-service :4002 (Python)  ->  PostgreSQL (Supabase)
                                 (solo el seed llama a las APIs externas)
```

El frontend **solo conoce el gateway**. El gateway **solo reenvia** a los
microservicios. Cada microservicio tiene **su propia base de datos**. Internet
(PokeAPI, One Piece API, Jikan) **solo lo tocan los seeds**, nunca una busqueda.

## Frontend (Expo / React Native)

- `app/_layout.tsx` - raiz de expo-router; envuelve la app en los providers de
  Pokemon y One Piece.
- `app/+not-found.tsx` - pantalla 404 ("esta pantalla no existe").
- `app/(tabs)/_layout.tsx` - barra de las 4 pestanas (Pokemon, Ficha, One Piece,
  Ficha OP) con su color e icono.
- `app/(tabs)/index.tsx` - pantalla de busqueda de Pokemon.
- `app/(tabs)/about.tsx` - ficha/detalle del Pokemon encontrado.
- `app/(tabs)/one-piece.tsx` - pantalla de busqueda de personajes.
- `app/(tabs)/one-piece-about.tsx` - ficha/detalle del personaje encontrado.
- `components/ui.tsx` - piezas de UI reutilizables (encabezado, buscador,
  mosaicos, avisos, estado vacio, animacion); no consultan la API.
- `context/PokemonContext.tsx` - estado de la busqueda de Pokemon; **unico punto
  del frontend que llama al gateway** (`/api/pokemon/search`).
- `context/OnePieceContext.tsx` - igual, para personajes
  (`/api/characters/search`).
- `lib/api.ts` - URL del gateway (`EXPO_PUBLIC_API_URL`) y logs del cliente.
- `lib/format.ts` - formateadores puros (altura, peso, recompensa, talla).
- `lib/theme.ts` - tokens de diseno (colores, espaciado, sombras, tipografia).
- `assets/` - iconos, splash y favicon.
- `app.json` - configuracion de Expo.
- `tsconfig.json` - configuracion de TypeScript (`strict: false`).
- `vercel.json` - build web (`expo export`) y rewrites de SPA para Vercel.

## Gateway (Node / Express, puerto 3000)

- `backend/gateway/src/index.js` - arranque; CORS, JSON y montaje de rutas.
- `backend/gateway/src/config.js` - resuelve y normaliza las URLs de los dos
  microservicios (`POKEMON_SERVICE_URL`, `ONEPIECE_SERVICE_URL`).
- `backend/gateway/src/proxy.js` - reenvia la peticion al microservicio, mide el
  tiempo, aplica timeout de 60s y responde 503 si el servicio no contesta.
- `backend/gateway/src/routes/index.routes.js` - `GET /`: diagnostico (entorno y
  destinos).
- `backend/gateway/src/routes/pokemon.routes.js` - `/api/pokemon*` reenviadas a
  pokemon-service.
- `backend/gateway/src/routes/characters.routes.js` - `/api/characters*`
  reenviadas a onepiece-service.
- `backend/gateway/src/lib/log.js` - logs con fecha y clasificacion
  LOCAL/DESPLEGADO.
- `backend/gateway/package.json` y `package-lock.json` - dependencias.

## pokemon-service (Node / Express + PostgreSQL, puerto 4001)

- `src/index.js` - arranque; crea el esquema, monta `/docs`, `/openapi.json` y las
  rutas; middleware de errores.
- `src/swagger.js` - configuracion de Swagger/OpenAPI (lee los `@openapi`).
- `src/routes/pokemon.routes.js` - capa HTTP y anotaciones `@openapi` que
  documentan cada endpoint.
- `src/services/pokemon.service.js` - reglas de negocio; valida y decide el
  codigo (400 falta nombre, 404 no encontrado).
- `src/repositories/pokemon.repository.js` - **unico lugar con SQL** (listar, por
  id, buscar por `search_key`, upsert). `types` y `moves` se guardan como JSON
  en texto.
- `src/external/pokeapi.client.js` - **unica capa que llama a PokeAPI**; solo la
  usa el seed.
- `src/db/connection.js` - pool de PostgreSQL (`pg`) y `ensureSchema`.
- `src/db/schema.sql` - tabla `pokemon` y trigger que impone el limite.
- `src/lib/normalize.js` - normaliza el nombre para buscar (minusculas, sin
  acentos ni puntuacion).
- `src/lib/log.js` - logs del microservicio.
- `package.json` y `package-lock.json` - dependencias.

## onepiece-service (Python / FastAPI + PostgreSQL, puerto 4002)

Mismo contrato HTTP que el servicio Node anterior, para que el gateway y el
frontend no cambien.

- `src/main.py` - app FastAPI; en el `lifespan` crea el esquema, sirve Swagger
  (`/docs`, `/redoc`, `/openapi.json`) y traduce `ApiError` a `{"error": ...}`.
- `src/routers/characters.py` - capa HTTP de `/api/characters` y modelos de
  respuesta para Swagger.
- `src/services/characters_service.py` - reglas de negocio; decide 400 vs 404.
- `src/repositories/characters_repository.py` - **unico lugar con SQL**; arma la
  busqueda y aplana/anida la fila (`crew`, `fruit`, `image`, `raceEstimated`).
- `src/models/character.py` - modelos Pydantic; definen el **contrato** con el
  frontend y alimentan Swagger.
- `src/db/connection.py` - pool de PostgreSQL con `asyncpg`.
- `src/db/schema.sql` - tabla `characters` y trigger del limite.
- `src/external/onepiece_client.py` - **llama a la API de One Piece**; solo seed.
- `src/external/jikan_client.py` - resuelve las imagenes (Jikan/MyAnimeList);
  solo seed.
- `src/external/race_map.py` - mapa de razas curado a mano; se consulta con
  nombre normalizado.
- `src/lib/normalize.py` - normalizacion, gemela exacta de la de Node.
- `src/lib/translations.py` - traduce tripulacion, oficio, estado y frutas al
  espanol durante el seed.
- `src/lib/log.py` - logs con el mismo formato que Node.
- `src/lib/errors.py` - `ApiError` (error de negocio con codigo HTTP).
- `seed.py` - carga los 20 personajes; unico punto que sale a internet junto a
  `external/`.
- `requirements.txt` - dependencias de Python.
- `src/**/__init__.py` - marcan cada carpeta como paquete Python.

## Scripts del backend

- `backend/scripts/dev.js` - levanta los 3 procesos a la vez (Node + Python).
- `backend/scripts/seed.js` - ejecuta el seed de Pokemon (crea esquema y carga).
- `backend/scripts/seed-pokemon.js` - lista de los 20 Pokemon y su carga desde
  PokeAPI.
- `backend/scripts/verify.js` - verificaciones: 20 registros, busqueda y que el
  trigger imponga el limite (habla directo con PostgreSQL).
- `backend/scripts/block-external.js` - bloquea `fetch` externo (preload); se usa
  en la prueba de aislamiento.
- `backend/scripts/generate-datos.js` - regenera `DATOS.md` desde el gateway.
- `backend/scripts/test-offline.sh` - prueba de aislamiento: el backend responde
  sin internet.
- `backend/scripts/onepiece-env.sh` - crea el venv de Python e instala
  `requirements.txt`.

## Configuracion y raiz

- `package.json` - scripts de npm del proyecto (app + `backend:*`).
- `backend/package.json` - scripts del backend (gateway, servicios, seed,
  verify, offline-test, setup).
- `render.yaml` - despliegue de los 3 servicios web en Render.
- `.env.example` - plantilla de variables (gateway y bases de datos).
- `.env.production` - URL publica del gateway para el build de Vercel.
- `.gitignore` - lo que no se versiona.
- `README.md` - documentacion tecnica detallada (montaje, API, despliegue).
- `DATOS.md` - inventario de los 20 Pokemon y los 20 personajes.
- `DOCUMENTACION.md` - este mapa.
- `LICENSE` - licencia.
- `package-lock.json` - versiones exactas de las dependencias del frontend.

## Endpoints (a traves del gateway)

| Metodo | Ruta | Que hace |
| --- | --- | --- |
| GET | `/` | Diagnostico del gateway y destinos. |
| GET | `/health` | Estado del gateway. |
| GET | `/api/pokemon` | Lista los 20 Pokemon. |
| GET | `/api/pokemon/:id` | Un Pokemon por id. |
| POST | `/api/pokemon/search` | Busca por nombre; body `{ "name": "pika" }`. |
| GET | `/api/characters` | Lista los 20 personajes. |
| GET | `/api/characters/:id` | Un personaje por id. |
| POST | `/api/characters/search` | Busca por nombre; body `{ "name": "luffy" }`. |

## Documentacion Swagger (requisito)

- pokemon-service: `/docs`, `/redoc`, `/openapi.json` (puerto 4001).
- onepiece-service: `/docs`, `/redoc`, `/openapi.json` (puerto 4002).
- Publicos: `https://pokemon-service-rtjy.onrender.com/docs` y
  `https://onepiece-service.onrender.com/docs`.

## Como correr (resumen)

```bash
npm install                 # dependencias del frontend
npm run backend:setup       # deps del backend + venv Python + seed (necesita internet)
npm run backend             # gateway + pokemon-service + onepiece-service
npm run web                 # la app en el navegador
npm run backend:verify      # comprobar BD, busqueda y limite de 20
```

## Que requisito cubre cada pieza

- Base de datos relacional propia -> PostgreSQL en Supabase (una por servicio).
- Microservicio en Node.js -> `backend/services/pokemon-service`.
- Microservicio en Python -> `backend/services/onepiece-service` (FastAPI).
- Documentado con Swagger -> `/docs` en ambos microservicios.
- Publico -> 3 servicios en Render + frontend en Vercel.
- El frontend no toca APIs externas -> los contextos solo llaman al gateway; las
  APIs externas viven en `external/` y solo las usa el seed.

## Carpetas que no entran a la entrega

`node_modules/`, `.venv/`, `__pycache__/`, `dist/`, `.expo/`, `.env` y los
archivos de asistencia (`.gitignore` de por medio). Todas se regeneran con
`npm run backend:setup` / `npm install`.
