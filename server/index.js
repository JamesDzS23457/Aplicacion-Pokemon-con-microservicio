const http = require('node:http');

const port = Number(process.env.PORT || 3000);
const pokeApiUrl = 'https://pokeapi.co/api/v2/pokemon/';

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  });
  response.end(JSON.stringify(body));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error('Request body too large'));
        request.destroy();
      }
    });

    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });

    request.on('error', reject);
  });
}

async function getPokemon(name) {
  const normalizedName = String(name || '').trim().toLowerCase();

  if (!normalizedName) {
    const error = new Error('Pokemon name is required');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`${pokeApiUrl}${encodeURIComponent(normalizedName)}`);

  if (!response.ok) {
    const error = new Error('Pokemon not found');
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }

  const pokemon = await response.json();
  const speciesResponse = await fetch(pokemon.species.url);

  if (speciesResponse.ok) {
    const species = await speciesResponse.json();
    const genderRate = species.gender_rate;
    pokemon.gender = genderRate === -1
      ? 'Sin genero'
      : `${genderRate === 0 ? 0 : 100 - genderRate * 12.5}% macho / ${genderRate * 12.5}% hembra`;
    pokemon.habitat = species.habitat?.name ?? 'N/A';
    pokemon.especie = species.genera?.find((item) => item.language?.name === 'en')?.genus ?? 'N/A';
  }

  return pokemon;
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { status: 'ok' });
    return;
  }

  if (request.method === 'POST' && request.url === '/api/pokemon') {
    try {
      const body = await readBody(request);
      const pokemon = await getPokemon(body.name);
      sendJson(response, 200, pokemon);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(response, statusCode, {
        error: statusCode === 404 ? 'Pokemon not found' : error.message,
      });
    }
    return;
  }

  sendJson(response, 404, { error: 'Route not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Pokemon service running on http://localhost:${port}`);
});
