// ---------------------------------------------------------------------------
// CONFIGURACION DE SWAGGER  (documentacion del asistente)
//
// Igual que pokemon-service: `swagger-jsdoc` lee las anotaciones @openapi de
// routes/ e index.js y arma el documento OpenAPI; `swagger-ui-express` lo sirve
// en /docs. Se usan rutas absolutas para que la documentacion se vea tambien
// cuando el servicio se arranca desde otra carpeta (dev.js lo lanza desde
// backend/).
// ---------------------------------------------------------------------------

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import swaggerJsdoc from 'swagger-jsdoc';
import { RESPUESTA_FUERA_DE_CONTEXTO } from './services/asistente.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Asistente API',
      version: '1.0.0',
      description:
        'Microservicio de IA de la app pokeanime. Consulta una IA publica ' +
        '(Google Gemini, plan gratuito) y limita las respuestas al contexto de ' +
        'la aplicacion: los Pokemon, los personajes de One Piece y los docentes ' +
        'de Uninpahu que estan en su propia base de datos. Fuera de ese contexto ' +
        `responde: "${RESPUESTA_FUERA_DE_CONTEXTO}"`,
    },
    tags: [
      { name: 'Asistente', description: 'Preguntas al asistente de IA.' },
      { name: 'Salud', description: 'Estado del servicio.' },
    ],
    components: {
      schemas: {
        RespuestaAsistente: {
          type: 'object',
          properties: {
            respuesta: {
              type: 'string',
              example: 'Pikachu es de tipo electrico.',
            },
            modo: { type: 'string', enum: ['restringido', 'abierto'], example: 'restringido' },
            enAlcance: {
              type: 'boolean',
              description: 'false cuando la pregunta no era del tema de la app.',
              example: true,
            },
            motor: {
              type: 'string',
              enum: ['gemini', 'guardia'],
              description: 'guardia = la frase de fuera de contexto la puso el servidor sin llamar a la IA.',
              example: 'gemini',
            },
            coincidencias: {
              type: 'array',
              description: 'Entidades de la base de datos detectadas en la pregunta.',
              items: { type: 'string' },
              example: ['pikachu'],
            },
          },
        },
        Error: {
          type: 'object',
          properties: { error: { type: 'string', example: 'La pregunta es obligatoria.' } },
        },
      },
    },
  },
  apis: [path.join(__dirname, 'routes', '*.js'), path.join(__dirname, 'index.js')],
});
