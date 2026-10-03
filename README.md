# APP_Pokemon

Aplicación web Expo (SDK 57) con Pokédex y buscador de personajes de One Piece.
Los datos se sirven desde **microservicios propios** backed por **PostgreSQL en
Supabase**, que se cargaron una vez desde las APIs públicas de PokéAPI y One Piece.

## Arquitectura

```
┌──────────────────────────────┐
│  FRONTEND (Expo + Router)    │
│  app/(tabs)/* + context/*    │
└──────────────┬───────────────┘
               │ POST /api/{pokemon,characters}/search
               │ nunca consulta las APIs externas
               ▼
┌──────────────────────────────┐
│   API GATEWAY (BFF) :3000    │  ← única URL que conoce el frontend
└───────┬──────────────┬───────┘
        │              │
        ▼              ▼
┌──────────────┐  ┌──────────────┐
│ pokemon-svc  │  │ onepiece-svc │  procesos independientes,
│    :4001     │  │    :4002     │  desplegables por separado
└──────┬───────┘  └──────┬───────┘
       │                 │
       ▼                 ▼
┌──────────────┐  ┌──────────────┐
│ Supabase/    │  │ Supabase/    │  PostgreSQL, 20 filas cada una
│ postgres (1) │  │ postgres (2) │  fuente de verdad
└──────────────┘  └──────▲───────┘
                        │ solo escritura, durante el seed
              ┌─────────┴──────────┐
              │  api.api-onepiece  │
              │  pokeapi.co        │
              └────────────────────┘
```

**Regla clave:** hay dos flujos distintos.

| Flujo | ¿Quién llama a la API externa? | ¿Cuándo? |
|---|---|---|
| Consulta | Nadie, solo la base de datos | En cada búsqueda |
| Carga (`seed`) | El microservicio | Una vez, con script aparte |

Tras correr el seed, el sistema **funciona sin internet**.

## Puesta en marcha

```bash
# 1. Copia la configuración y rellena las URLs de Supabase
cp .env.example .env

# 2. Instala dependencias del backend y carga los 20+20 registros
npm run backend:setup

# 3. Levanta gateway + los 2 microservicios
npm run backend

# 4. En otra terminal, la app
npm start          # o: npm run web
```

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run backend:setup` | Instala los 3 paquetes y corre el seed |
| `npm run backend` | Levanta los 3 procesos con logs coloreados |
| `npm run backend:seed` | Recarga los 20 personajes y 20 Pokémon (requiere internet) |
| `npm run backend:verify` | Comprueba la BD, la búsqueda y el límite de 20 |
| `npm run backend:offline-test` | Levanta el backend SIN red y comprueba que responde |

## Base de datos

Dos bases de datos PostgreSQL, una por microservicio, alojadas en Supabase.

El límite de 20 registros lo impone un **trigger de la base de datos**, no una
validación en JavaScript: es PostgreSQL el que lo garantiza, así que ningún
camino de escritura puede saltárselo.

Para verlas: panel de Supabase → Table Editor.

### Desarrollo local con Docker (sin Supabase)

```bash
docker run -d --name pg-local -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_USER=postgres -p 5432:5432 postgres:16-alpine
docker exec pg-local psql -U postgres -c "CREATE DATABASE pokemon;"
docker exec pg-local psql -U postgres -c "CREATE DATABASE onepiece;"
```

Y en `.env`: `DATABASE_SSL=false` (un Postgres local no tiene SSL).

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

La búsqueda es **tolerante**: normaliza el texto (minúsculas, sin acentos, sin
puntuación) antes de comparar. Así `luffy`, `LUFFY`, `tony tony chopper` y
`Tony-Tony Chopper` son la misma búsqueda. También busca dentro del nombre de la
tripulación.

```bash
curl -X POST localhost:3000/api/characters/search \
  -H 'Content-Type: application/json' -d '{"name":"luffy"}'
```

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
├── gateway/src/{index,config,proxy}.js + routes/
├── services/
│   ├── pokemon-service/src/{db,repositories,services,routes,external,lib}/
│   └── onepiece-service/src/{db,repositories,services,routes,external,lib}/
└── scripts/{seed,seed-characters,seed-pokemon,verify,dev}.js
```

| Capa | Responsabilidad |
|---|---|
| `routes/` | HTTP. Traduce request/response. Sin lógica. |
| `services/` | Reglas de negocio y validaciones. Sin SQL. |
| `repositories/` | **Todo el SQL vive aquí.** |
| `external/` | **Única capa que hace `fetch` a internet.** |

Aislar el SQL en `repositories/` es lo que permitió cambiar de SQLite a
PostgreSQL sin tocar el resto del sistema.

## Despliegue

```bash
render blueprint launch
```

`render.yaml` define los 3 servicios. Las URLs de base de datos se configuran
en el dashboard de Render (`sync: false` evita que aparezcan en los logs).

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
2. Deja la configuración por defecto: manda `vercel.json`.
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
  en `external/raceMap.js`; los personajes fuera del mapa devuelven `"Humano"`
  con `raceEstimated: true`.
- **`genero`** de Pokémon se deduce del *gender rate* de la especie
  (probabilidad), no del género real. No existe endpoint que lo devuelva.
- **Imágenes de One Piece**: `image` es `null`. La API de Wikipedia devuelve
  `429` de forma sistemática, así que no se cargan imágenes.
- Los datos de One Piece vienen en **francés** (`"19 ans"`, `"vivant"`) y se
  muestran sin traducir.