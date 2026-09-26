const http = require('node:http');

const port = Number(process.env.PORT || 3000);
const pokeApiUrl = 'https://pokeapi.co/api/v2/pokemon/';
const onePieceApiUrl = 'https://api.api-onepiece.com/v2/characters/en';
let onePieceCharacters;

// La API de api-onepiece.com no trae raza ni imagenes, asi que mantenemos un
// mapa local para los personajes mas conocidos. Si un personaje no esta aqui,
// se asume "Humano" (la raza mas comun en la serie) y se marca como estimado.
const raceMap = {
  'monkey d luffy': 'Humano',
  'roronoa zoro': 'Humano',
  nami: 'Humano',
  usopp: 'Humano',
  sanji: 'Humano',
  'tony tony chopper': 'Humano-Reno (fruta Zoan)',
  'nico robin': 'Humano',
  franky: 'Cyborg (humano modificado)',
  brook: 'Esqueleto (fruta Yomi Yomi)',
  jinbe: 'Pez-hombre (Fishman)',
  'portgas d ace': 'Humano',
  sabo: 'Humano',
  shanks: 'Humano',
  'edward newgate': 'Humano',
  'gol d roger': 'Humano',
  'silvers rayleigh': 'Humano',
  'trafalgar law': 'Humano',
  'eustass kid': 'Humano',
  'marshall d teach': 'Humano',
  'boa hancock': 'Humano',
  'donquixote doflamingo': 'Humano',
  kaido: 'Humano-Pez dragon (fruta Zoan mitica)',
  'charlotte linlin': 'Humano-Gigante',
  'nefertari vivi': 'Humano',
  crocodile: 'Humano',
  arlong: 'Pez-hombre (Fishman)',
  'little oars jr': 'Gigante',
  dorry: 'Gigante',
  brogy: 'Gigante',
  inuarashi: 'Mink',
  nekomamushi: 'Mink',
  carrot: 'Mink',
};

function getRace(name) {
  const key = String(name || '').trim().toLowerCase();
  const found = raceMap[key];
  return found ? { race: found, estimated: false } : { race: 'Humano', estimated: true };
}

async function getCharacterImage(name) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${name} One Piece`)}&format=json&origin=*`;
    const searchResponse = await fetch(searchUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!searchResponse.ok) {
      console.error(`[one-piece] Wikipedia (busqueda) respondio ${searchResponse.status} para "${name}"`);
      return null;
    }
    const searchData = await searchResponse.json();
    const title = searchData?.query?.search?.[0]?.title;
    if (!title) {
      console.error(`[one-piece] Wikipedia no encontro pagina para "${name}"`);
      return null;
    }

    const summaryController = new AbortController();
    const summaryTimeout = setTimeout(() => summaryController.abort(), 6000);
    const summaryResponse = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: summaryController.signal });
    clearTimeout(summaryTimeout);
    if (!summaryResponse.ok) {
      console.error(`[one-piece] Wikipedia (resumen) respondio ${summaryResponse.status} para "${title}"`);
      return null;
    }
    const summary = await summaryResponse.json();
    const url = summary?.thumbnail?.source || summary?.originalimage?.source || null;
    if (!url) {
      console.error(`[one-piece] La pagina de Wikipedia "${title}" no tiene imagen`);
    }
    return url;
  } catch (error) {
    console.error(`[one-piece] Error consultando Wikipedia para "${name}":`, error.message);
    return null;
  }
}

function getGenero(genderRate) {
  if (genderRate === undefined || genderRate === null || genderRate === -1) return 'Sin genero definido';
  if (genderRate === 0) return 'Siempre macho';
  if (genderRate === 8) return 'Siempre hembra';
  return 'Macho o hembra';
}

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
    const error = new Error('El nombre del Pokemon es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  const response = await fetch(`${pokeApiUrl}${encodeURIComponent(normalizedName)}`);
  if (!response.ok) {
    const error = new Error('Pokemon no encontrado');
    error.statusCode = 404;
    throw error;
  }
  const pokemon = await response.json();

  let genero = 'Sin genero definido';
  let especie = '';
  try {
    const speciesResponse = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(normalizedName)}`);
    if (speciesResponse.ok) {
      const species = await speciesResponse.json();
      genero = getGenero(species.gender_rate);
      const genus = (species.genera || []).find((g) => g.language?.name === 'es') || (species.genera || []).find((g) => g.language?.name === 'en');
      especie = genus?.genus || '';
    }
  } catch {
    // si falla la consulta de especie, dejamos los valores por defecto
  }

  return { ...pokemon, genero, especie };
}

async function getOnePiece(name) {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (!normalizedName) {
    const error = new Error('El nombre del personaje es obligatorio');
    error.statusCode = 400;
    throw error;
  }

  if (!onePieceCharacters) {
    const listResponse = await fetch(onePieceApiUrl);
    if (!listResponse.ok) throw new Error('No se pudo consultar la API de One Piece');
    onePieceCharacters = await listResponse.json();
  }

  const character = onePieceCharacters.find((item) => item.name.toLowerCase() === normalizedName);
  if (!character) {
    const error = new Error('Personaje de One Piece no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const response = await fetch(`${onePieceApiUrl}/${character.id}`);
  if (!response.ok) {
    const error = new Error('Personaje de One Piece no encontrado');
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }
  const details = await response.json();
  const [image, raceInfo] = await Promise.all([
    getCharacterImage(details.name || normalizedName),
    Promise.resolve(getRace(details.name || normalizedName)),
  ]);

  return { ...details, image, race: raceInfo.race, raceEstimated: raceInfo.estimated };
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
      sendJson(response, 200, await getPokemon(body.name));
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(response, statusCode, {
        error: statusCode === 404 ? 'Pokemon no encontrado' : error.message,
      });
    }
    return;
  }

  if (request.method === 'POST' && request.url === '/api/one-piece') {
    try {
      const body = await readBody(request);
      sendJson(response, 200, await getOnePiece(body.name));
    } catch (error) {
      const statusCode = error.statusCode || 500;
      sendJson(response, statusCode, {
        error: statusCode === 404 ? 'Personaje de One Piece no encontrado' : error.message,
      });
    }
    return;
  }

  sendJson(response, 404, { error: 'Route not found' });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Pokemon service running on http://localhost:${port}`);
});
