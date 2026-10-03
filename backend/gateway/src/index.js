// ---------------------------------------------------------------------------
// PUNTO DE ENTRADA DEL GATEWAY  (puerto 3000)
//
// El gateway es la UNICA pieza que el frontend conoce. Los dos
// microservicios quedan ocultos detras de el, y de ahi el nombre "BFF"
// (Backend for Frontend): existe para darle al frontend una interfaz
// simple, sin que el frontend sepa cuantos microservicios hay.
//
// IMPORTANTE: el gateway NO tiene base de datos y NO llama a las APIs
// externas. Solo reenvia peticiones HTTP a los servicios internos. Por eso
// puede caerse uno de los servicios sin que el gateway se caiga.
// ---------------------------------------------------------------------------

import express from 'express';
import cors from 'cors';
import pokemonRoutes from './routes/pokemon.routes.js';
import characterRoutes from './routes/characters.routes.js';
import docenteRoutes from './routes/docentes.routes.js';
import indexRoutes from './routes/index.routes.js';
import { config } from './config.js';
import { crearLog, ENTORNO, clasificarDestino } from './lib/log.js';

const app = express();
const log = crearLog('gateway');

// CORS abierto porque el frontend corre en otro origen (puerto 8081 de Expo
// en desarrollo, o el dominio de Vercel en produccion). En un proyecto real
// esto se restringiria a los dominios permitidos.
app.use(cors());

// express.json() lee el cuerpo de las peticiones POST y lo convierte a objeto.
// Sin esto, req.body.name seria undefined y toda busqueda daria 400.
app.use(express.json({ limit: '10kb' }));

// Ninguna respuesta del gateway se puede cachear.
//
// El motivo concreto: los datos vienen de una base de datos que el usuario puede
// editar en cualquier momento, asi que una respuesta guardada en cualquier capa
// intermedia (el edge de Render, un proxy, el navegador) puede mostrar un dato
// que ya no existe. `no-store` lo prohibe de forma explicita en lugar de
// confiar en que ninguna capa se porte bien.
//
// Se pone aqui, antes de los routers, para que cubra TODAS las rutas, incluidas
// las de /health.
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
  next();
});

/** Healthcheck del gateway. Lo usa Render para saber si esta vivo. */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

app.use('/', indexRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/docentes', docenteRoutes);

/**
 * 404 global. Va DESPUES de todos los routers: si una ruta no coincidio con
 * ninguna, cae aqui. No es un middleware de errores (no lleva los 4
 * parametros), asi que responde directamente.
 */
app.use((_req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// 0.0.0.0 y no localhost: en un contenedor (Render, Docker) la app tiene que
// escuchar en todas las interfaces para que se le pueda llegar desde fuera.
// Con localhost solo se podria acceder desde dentro del propio contenedor.
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  // Al arrancar se dice en que entorno corre y a donde apunta cada
  // microservicio, marcando si el destino es LOCAL o DESPLEGADO. Asi, con
  // solo mirar las primeras lineas del log, ya se sabe si el frontend va a
  // hablar con el backend local o con el de Render.
  log(`ENTORNO=${ENTORNO} | escuchando en :${PORT}`);
  log(`pokemon  -> ${config.POKEMON_SERVICE_URL} (${clasificarDestino(config.POKEMON_SERVICE_URL)})`);
  log(`onepiece -> ${config.ONEPIECE_SERVICE_URL} (${clasificarDestino(config.ONEPIECE_SERVICE_URL)})`);
  log(`docentes -> ${config.DOCENTES_SERVICE_URL} (${clasificarDestino(config.DOCENTES_SERVICE_URL)})`);
});