// ---------------------------------------------------------------------------
// CONTRATO OPENAPI 3.0.3  (microservicio de docentes)
//
// Este es el documento que se sirve en /openapi.json y que alimenta la interfaz
// de Swagger en /docs. Cumple el ultimo requisito del enunciado: el
// microservicio tiene que estar documentado con Swagger.
//
// -----------------------------------------------------------------------------
// POR QUE ESTE ARCHIVO ESTA ESCRITO A MANO
// -----------------------------------------------------------------------------
// pokemon-service genera el mismo documento con `swagger-jsdoc`, que lee los
// comentarios @openapi del codigo. Aqui no se puede, y es precisamente por eso
// que este servicio es agnostico: `swagger-jsdoc` y `swagger-ui-express` son
// librerias de terceros, y el enunciado pide no depender de ellas.
//
// La alternativa es escribir el documento como un objeto de JavaScript normal,
// que es lo que hace este archivo. Se serializa con JSON.stringify, asi que el
// resultado es exactamente el mismo JSON que daria swagger-jsdoc. Se pierde la
// comodidad de tener la anotacion pegada a la ruta, pero se gana que el servicio
// arranca sin instalar nada mas que el driver de PostgreSQL.
//
// La UI de Swagger SI se carga de un CDN (jsdelivr). Eso no viola el requisito:
// es una pagina de documentacion que se abre en el navegador de una persona, no
// codigo que el servicio ejecute. El microservicio no descarga nada; lo unico
// que sale de su parte es el HTML. Y si el navegador no tiene red, la pagina
// avisa abajo que necesita conexion, mientras que /openapi.json sigue
// funcionando sin ella (ver la pagina HTML en documentacion.routes.js).
// ---------------------------------------------------------------------------

export const openapi = {
  openapi: '3.0.3',

  info: {
    title: 'API de Docentes de Uninpahu',
    version: '1.0.0',
    description: [
      'Microservicio propio de datos de docentes de Uninpahu.',
      '',
      '**Como esta hecho:** Node.js sin ningun framework de servidor web. No usa',
      'Express ni Fastify ni Koa: el enrutado, el CORS, el 404 y el 405 estan',
      'escritos sobre `node:http`, en `src/http/`. La unica dependencia del',
      'servicio es el driver `pg`, porque Node no incluye un cliente de',
      'PostgreSQL en su biblioteca estandar.',
      '',
      '**Parametros:** todos viajan en la URL, nunca en el cuerpo. Se usan',
      '*path params* (`:id`, `:termino`) y *query params* (`?q=`, `?carrera=`).',
      'El servicio es de SOLO LECTURA: solo atiende GET, y cualquier otro metodo',
      'recibe un 405 con la cabecera `Allow: GET`.',
      '',
      '**Datos:** salen de una base PostgreSQL en Supabase con 20 docentes,',
      'cargados una sola vez por el seed. En tiempo de peticion este servicio NO',
      'sale a internet: la respuesta sale siempre de la base de datos.',
    ].join('\n'),
    license: { name: 'Proyecto academico' },
  },

  servers: [
    { url: '/', description: 'Este mismo servicio' },
  ],

  tags: [
    {
      name: 'Docentes',
      description:
        'Consulta de los docentes guardados. Los filtros son query params y la ' +
        'ficha se pide por path param.',
    },
    { name: 'Salud', description: 'Estado del servicio.' },
    { name: 'Documentacion', description: 'El contrato y esta misma interfaz.' },
  ],

  paths: {
    '/health': {
      get: {
        tags: ['Salud'],
        summary: 'Estado del servicio',
        description:
          'Comprueba que el proceso responde y cuantos docentes hay en la base. ' +
          'Es el healthcheck que usa Render para decidir si el servicio esta vivo.',
        responses: {
          200: {
            description: 'Servicio vivo y base de datos accesible.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    service: { type: 'string', example: 'docentes-service' },
                    docentes: { type: 'integer', example: 20 },
                  },
                },
              },
            },
          },
          500: {
            description: 'El proceso vive pero la base de datos no responde.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    '/api/docentes': {
      get: {
        tags: ['Docentes'],
        summary: 'Lista los docentes, con filtros opcionales',
        description: [
          'Devuelve el listado de docentes guardados, ordenados por nombre.',
          '',
          'Todos los filtros son **query params** y todos son opcionales: sin',
          'ninguno devuelve el listado completo (los 20 registros).',
          '',
          'Los filtros se combinan entre si con AND. `q` busca en el nombre',
          'normalizado (minúsculas, sin acentos ni espacios), asi que',
          '`?q=JOSE` y `?q=josé` devuelven lo mismo. `carrera` y `departamento`',
          'buscan por fragmento, asi que `?carrera=Ingenieria` también devuelve',
          'los docentes de "Ingeniería en Sistemas".',
        ].join('\n'),
        parameters: [
          {
            in: 'query',
            name: 'q',
            required: false,
            description: 'Texto a buscar en el nombre del docente.',
            schema: { type: 'string' },
            example: 'ana',
          },
          {
            in: 'query',
            name: 'carrera',
            required: false,
            description: 'Fragmento de la carrera en la que dicta.',
            schema: { type: 'string' },
            example: 'Ingenieria',
          },
          {
            in: 'query',
            name: 'departamento',
            required: false,
            description: 'Fragmento del departamento al que pertenece.',
            schema: { type: 'string' },
            example: 'Matematica',
          },
          {
            in: 'query',
            name: 'limite',
            required: false,
            description:
              'Cuantos docentes devolver como maximo. Entre 1 y 50; por defecto 50.',
            schema: { type: 'integer', minimum: 1, maximum: 50, default: 50 },
          },
          {
            in: 'query',
            name: 'pagina',
            required: false,
            description: 'Numero de pagina, empezando en 1. Por defecto 1.',
            schema: { type: 'integer', minimum: 1, default: 1 },
          },
        ],
        responses: {
          200: {
            description: 'Listado con el total de resultados que hay en la base.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocenteListado' },
              },
            },
          },
          500: {
            description: 'La base de datos no responde.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    '/api/docentes/facetas': {
      get: {
        tags: ['Docentes'],
        summary: 'Valores disponibles para los filtros',
        description:
          'Devuelve la lista de facultades, carreras y departamentos que hay en ' +
          'la base, sin repetir. La quinta pestana de la app la usa para llenar ' +
          'los desplegables de filtro sin tener que inventarse las opciones.',
        responses: {
          200: {
            description: 'Las tres listas de valores.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        facultad: { type: 'array', items: { type: 'string' } },
                        carrera: { type: 'array', items: { type: 'string' } },
                        departamento: { type: 'array', items: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/docentes/buscar/{termino}': {
      get: {
        tags: ['Docentes'],
        summary: 'Busca docentes por nombre (path param)',
        description: [
          'Busqueda por termino, con el termino en el **path**. Es la misma',
          'busqueda que hace `?q=` en el listado, pero el termino va en la ruta',
          'en vez de en la query string.',
          '',
          'La comparacion es tolerante: ignora mayusculas, acentos, espacios y',
          'puntuacion, asi que `/buscar/ana`, `/buscar/Ana` y',
          '`/buscar/ANÁ` son la misma busqueda. Los resultados se ordenan por',
          'cercania: primero el nombre exacto, despues los que empiezan por el',
          'termino y por ultimo los que solo lo contienen.',
        ].join('\n'),
        parameters: [
          {
            in: 'path',
            name: 'termino',
            required: true,
            description: 'Texto a buscar en el nombre del docente.',
            schema: { type: 'string' },
            example: 'ana',
          },
        ],
        responses: {
          200: {
            description: 'Coincidencias encontradas.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DocenteBusqueda' },
              },
            },
          },
          400: {
            description: 'El termino llega vacio o es solo puntuacion.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'Ningun docente coincide con el termino.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    '/api/docentes/{id}': {
      get: {
        tags: ['Docentes'],
        summary: 'Ficha de un docente (path param)',
        description:
          'Devuelve un docente concreto. Es la pantalla a la que lleva el boton ' +
          '"Leer mas" de la quinta pestana: trae la foto y la descripcion ' +
          'completa.',
        parameters: [
          {
            in: 'path',
            name: 'id',
            required: true,
            description: 'Identificador del docente (numero entero).',
            schema: { type: 'integer', minimum: 1 },
            example: 1,
          },
        ],
        responses: {
          200: {
            description: 'La ficha del docente.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Docente' },
              },
            },
          },
          400: {
            description: 'El id no es un numero entero.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          404: {
            description: 'No hay ningun docente con ese id.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },

    '/openapi.json': {
      get: {
        tags: ['Documentacion'],
        summary: 'El contrato OpenAPI en bruto',
        description:
          'Este mismo documento. Se expone aparte de /docs porque algunas ' +
          'herramientas (y la propia interfaz de Swagger) lo consumen en crudo.',
        responses: {
          200: {
            description: 'Documento OpenAPI 3.0.3.',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },

    '/docs': {
      get: {
        tags: ['Documentacion'],
        summary: 'Interfaz de Swagger UI',
        description:
          'Pagina HTML con la interfaz de Swagger, para probar las rutas desde ' +
          'el navegador sin escribir una linea de codigo.',
        responses: {
          200: {
            description: 'La pagina de documentacion.',
            content: { 'text/html': { schema: { type: 'string' } } },
          },
        },
      },
    },
  },

  components: {
    schemas: {
      Docente: {
        type: 'object',
        description: 'Un docente de Uninpahu.',
        properties: {
          id: { type: 'integer', example: 1 },
          nombre: { type: 'string', example: 'Ana Beatriz Rios' },
          cargo: { type: 'string', example: 'Profesora Titular' },
          departamento: { type: 'string', example: 'Departamento de Matematica' },
          carrera: { type: 'string', example: 'Ingenieria en Sistemas' },
          facultad: {
            type: 'string',
            example: 'Facultad de Ingenieria',
          },
          email: {
            type: 'string',
            nullable: true,
            example: 'abrios@uninpahu.edu.py',
          },
          foto_url: {
            type: 'string',
            nullable: true,
            description:
              'URL publica de la foto. Es OPCIONAL: cuando viene vacia la app ' +
              'dibuja un retrato de reserva con las iniciales del nombre, de ' +
              'modo que la pantalla nunca se ve rota.',
          },
          resumen: {
            type: 'string',
            description:
              'Descripcion breve. Es la que aparece en la tarjeta de la ' +
              'pestana, encima del boton "Leer mas".',
            example: 'Docente del area de Calculo, con enfasis en modelado numerico.',
          },
          biografia: {
            type: 'string',
            description:
              'Descripcion completa, con saltos de linea. Es la que se lee en la ' +
              'pantalla de detalle.',
          },
          areas: {
            type: 'array',
            description: 'Areas de trabajo o de investigacion.',
            items: { type: 'string' },
            example: ['Modelado numerico', 'Metodos numericos'],
          },
          formacion: {
            type: 'array',
            description: 'Formacion academica, de mayor a menor grado.',
            items: { type: 'string' },
            example: ['Doctor en Matematica Aplicada, UTN', 'Licenciatura en Matematica, UNA'],
          },
        },
      },
      DocenteListado: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Cuantos docentes hay en total con esos filtros.',
            example: 20,
          },
          pagina: { type: 'integer', example: 1 },
          limite: { type: 'integer', example: 50 },
          filtros: {
            type: 'object',
            description: 'Los filtros que se aplicaron de verdad, ya normalizados.',
            properties: {
              q: { type: 'string', nullable: true, example: 'ana' },
              carrera: { type: 'string', nullable: true },
              departamento: { type: 'string', nullable: true },
            },
          },
          count: {
            type: 'integer',
            description: 'Cuantos docentes devuelve ESTA pagina.',
            example: 20,
          },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Docente' },
          },
        },
      },
      DocenteBusqueda: {
        type: 'object',
        properties: {
          count: { type: 'integer', example: 2 },
          data: {
            type: 'array',
            items: { $ref: '#/components/schemas/Docente' },
          },
        },
      },
      Error: {
        type: 'object',
        description:
          'Formato de error. Es el MISMO que usan pokemon-service, ' +
          'onepiece-service y el gateway: siempre un objeto con una propiedad ' +
          '`error`. Por eso el frontend puede mostrar el mensaje tal cual.',
        properties: {
          error: { type: 'string', example: 'Docente no encontrado' },
        },
      },
    },
  },
};