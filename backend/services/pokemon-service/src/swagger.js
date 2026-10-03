// ---------------------------------------------------------------------------
// CONFIGURACION DE SWAGGER  (documentacion del microservicio de Pokemon)
//
// Este archivo existe para cumplir un requisito del trabajo: documentar el
// microservicio. `swagger-jsdoc` lee los comentarios @openapi que estan en
// routes/pokemon.routes.js e index.js y construye con ellos el documento
// OpenAPI. `swagger-ui-express` lo sirve como interfaz web.
//
// POR QUE SE USAN RUTAS ABSOLUTAS EN `apis`:
// `swagger-jsdoc` resuelve los globs desde el directorio de trabajo. Si el
// servicio se lanza desde otra carpeta (por ejemplo el script dev.js, que lo
// arranca desde backend/), un glob relativo no encontraria los archivos y la
// documentacion saldria vacia. Con fileURLToPath se calcula la ruta real de
// este archivo y se parte de ahi.
// ---------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Pokemon API',
      version: '1.0.0',
      description:
        'Microservicio propio de Pokemon escrito en Node.js/Express. Consume ' +
        'una base de datos PostgreSQL (Supabase) con 20 Pokemon cargados una ' +
        'sola vez durante el seed. En tiempo de peticion NO consulta la ' +
        'PokeAPI: la respuesta sale de la base de datos local.',
    },
    tags: [
      { name: 'Pokemon', description: 'Consulta de los Pokemon guardados.' },
      { name: 'Salud', description: 'Estado del servicio.' },
    ],
    // Esquemas reutilizables. Se describen los campos que devuelve el
    // repository, para que la interfaz de Swagger muestre ejemplos utiles.
    components: {
      schemas: {
        Pokemon: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 25 },
            name: { type: 'string', example: 'pikachu' },
            height: { type: 'integer', nullable: true, description: 'Decimetros, tal como lo da PokeAPI.', example: 4 },
            weight: { type: 'integer', nullable: true, description: 'Hectogramos, tal como lo da PokeAPI.', example: 60 },
            genero: { type: 'string', nullable: true, example: 'Macho o hembra' },
            especie: { type: 'string', nullable: true, example: 'Pokémon Ratón' },
            sprites: {
              type: 'object',
              properties: {
                front_default: { type: 'string', nullable: true },
                front_shiny: { type: 'string', nullable: true },
                back_shiny: { type: 'string', nullable: true },
              },
            },
            types: {
              type: 'array',
              description: 'Tipos del Pokemon, tal como los entrega PokeAPI.',
              items: { type: 'object' },
            },
            moves: {
              type: 'array',
              description: 'Solo los nombres de los movimientos, con su indice.',
              items: { type: 'object' },
            },
          },
        },
        PokemonList: {
          type: 'object',
          properties: {
            count: { type: 'integer', example: 20 },
            data: { type: 'array', items: { $ref: '#/components/schemas/Pokemon' } },
          },
        },
        SearchResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Pokemon' } },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'Pokemon no encontrado' } },
        },
      },
    },
  },
  // Archivos que contienen las anotaciones @openapi.
  apis: [
    path.join(__dirname, 'routes', '*.js'),
    path.join(__dirname, 'index.js'),
  ],
});
