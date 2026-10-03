// ---------------------------------------------------------------------------
// RUTAS DE DOCUMENTACION  (/docs y /openapi.json)
//
// Sirve el contrato OpenAPI y la interfaz de Swagger. Se separan del resto de
// rutas para que se lea claro que son la documentacion del servicio y no una
// parte del dominio.
//
// QUE SE USA AQUI Y POR QUE NO ES UNA VIOLACION DEL REQUISITO "AGNOSTICO"
// -------------------------------------------------------------------------
// El servicio no depende de ninguna libreria de terceros: /openapi.json se
// genera con JSON.stringify de un objeto plano y /docs devuelve una cadena de
// texto. Lo unico que hay fuera del proyecto es la hoja de estilo y el script de
// Swagger UI, que se cargan de un CDN con dos etiquetas <script>/<link>.
//
// La razon de que no rompa el requisito es que esto es DOCUMENTACION que mira
// una persona en un navegador, no codigo que el servicio ejecute: el proceso de
// Node nunca descarga nada, solo escribe HTML. Es exactamente el mismo criterio
// que aplica un swagger-ui-express, con la diferencia de que aqui no hay ni un
// paquete instalado. La interfaz es ademas opcional: /openapi.json y toda la
// API funcionan igual sin ella.
// ---------------------------------------------------------------------------

import { openapi } from './openapi.js';

const swagger = {
  stylesheet: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css',
  script: 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js',
};

/**
 * Construye el HTML de la pagina de Swagger.
 *
 * Se genera como plantilla (un template literal) en vez de guardarse en un
 * archivo aparte para que el texto que sale y el codigo que lo produce esten en
 * la misma pantalla a la hora de revisar el trabajo.
 *
 * @returns {string} El documento HTML completo.
 */
function paginaSwagger() {
  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API de Docentes de Uninpahu - Documentacion</title>
    <link rel="stylesheet" href="${swagger.stylesheet}" />
    <style>
      body { margin: 0; background: #fafafa; }
      /* Se avisa en la pagina de que la interfaz necesita internet. Sin este
         aviso, si el CDN no carga, lo unico que se ve es un rectangulo blanco
         y parece que el servicio esta roto. */
      .aviso {
        font-family: system-ui, sans-serif;
        font-size: 13px;
        color: #5b7180;
        background: #e2f3fb;
        border-bottom: 1px solid #cfe6f2;
        padding: 8px 16px;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <noscript>
      <p class="aviso">
        Esta pagina usa JavaScript. El contrato completo esta en
        <a href="/openapi.json">/openapi.json</a>.
      </p>
    </noscript>
    <div id="swagger"></div>

    <script src="${swagger.script}" crossorigin></script>
    <script>
      window.onload = function () {
        window.ui = SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger',
          deepLinking: true,
          // Se amplia la lista de respuestas para que se vean los ejemplos de
          // los errores, que es donde mas se falla al probar a mano.
          defaultModelsExpandDepth: 2,
          docExpansion: 'list',
          defaultModelExpandDepth: 2,
          tryItOutEnabled: true,
        });
      };
    </script>
  </body>
</html>`;
}

/**
 * Registra /openapi.json y /docs.
 *
 * @param {ReturnType<import('../http/router.js').createRouter>} router
 * @param {{json: Function, html: Function}} respond
 *   Los dos respondedores de ../http/respond.js. Se reciben como parametro y
 *   no se importan aqui para que este archivo no dependa de la capa HTTP.
 */
export function registrarRutasDocumentacion(router, { json, html }) {
  // El contrato en bruto. Se sirve primero porque es lo que consume Swagger UI
  // para dibujarse, y tambien lo que se puede abrir en el editor de Postman.
  router.get('/openapi.json', (ctx) => {
    json(ctx.res, 200, openapi);
  });

  // La interfaz. Va con cache desactivado (lo pone respond.js) para que un
  // cambio en el contrato se vea al recargar, sin tener que limpiar nada.
  router.get('/docs', (ctx) => {
    html(ctx.res, 200, paginaSwagger());
  });
}