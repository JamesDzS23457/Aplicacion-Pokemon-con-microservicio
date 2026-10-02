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
import indexRoutes from './routes/index.routes.js';

const app = express();

// CORS abierto porque el frontend corre en otro origen (puerto 8081 de Expo
// en desarrollo, o el dominio de Vercel en produccion). En un proyecto real
// esto se restringiria a los dominios permitidos.
app.use(cors());

// express.json() lee el cuerpo de las peticiones POST y lo convierte a objeto.
// Sin esto, req.body.name seria undefined y toda busqueda daria 400.
app.use(express.json({ limit: '10kb' }));

/** Healthcheck del gateway. Lo usa Render para saber si esta vivo. */
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' });
});

/** Endpoint temporal para verificar que commit esta desplegado. */
app.get('/test', (_req, res) => {
  res.json({ commit: '40c517c', service: 'gateway' });
});

app.use('/', indexRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/characters', characterRoutes);

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
  console.log(`gateway escuchando en :${PORT}`);
});