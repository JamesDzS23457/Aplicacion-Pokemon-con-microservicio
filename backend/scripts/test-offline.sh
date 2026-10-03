#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# PRUEBA DE AISLAMIENTO
#
# Levanta el backend con las llamadas a internet BLOQUEADAS y comprueba que
# responde igual. Demuestra el requisito del profesor: en tiempo de peticion el
# sistema no toca las APIs externas, solo su base de datos.
#
#   npm run backend:offline-test
#
# ---------------------------------------------------------------------------
# COMO FUNCIONA
#
# El script exporta BLOCK_EXTERNAL=1 y arranca el backend. dev.js lee esa
# variable y hace que los procesos NODE (pokemon-service y gateway) hereden
# NODE_OPTIONS con el preload de block-external.js, que sustituye globalThis.fetch
# por una version que rechaza todo lo que no sea localhost. Se hace por variable
# de entorno y no por flags de linea de comandos porque los procesos hijos NO
# heredan los flags del padre, solo el entorno.
#
# Si alguien metiera un fetch a PokeAPI dentro de un service o un repository
# (donde NO deberia haberlo), el log imprimiria BLOQUEADO y esta prueba
# fallaria. Esa es la gracia de la prueba.
#
# EL SERVICIO DE ONE PIECE ES PYTHON y no usa fetch de Node. Su aislamiento es
# ESTRUCTURAL: los modulos de external/ (los unicos con httpx) los importa solo
# seed.py, nunca main.py. Por eso el servicio en marcha no tiene siquiera
# cargado el cliente HTTP y no puede salir a internet.
#
# El acceso a PostgreSQL NO se bloquea: lo hace asyncpg/pg por socket, no pasa
# por fetch. Por eso esto funciona igual con Docker local que con Supabase.
#
# REQUISITO: las bases de datos deben tener las 20 filas cargadas
# (npm run backend:seed). Esta prueba NO necesita internet, al contrario.
# ---------------------------------------------------------------------------

set -u

cd "$(dirname "$0")/.."

LOG=/tmp/backend-offline.log
: > "$LOG"

echo "== 1. Levantar el backend con fetch externo bloqueado =="
# BLOCK_EXTERNAL=1 hace que dev.js bloquee el fetch de los procesos Node.
BLOCK_EXTERNAL=1 node --import ./scripts/block-external.js scripts/dev.js > "$LOG" 2>&1 &
DEV_PID=$!

# Si este script termina o se interrumpe (Ctrl+C), el servidor tambien.
# Por eso se ejecuta el kill en la salida sea cual sea el motivo.
trap 'kill $DEV_PID 2>/dev/null' EXIT

sleep 6

echo "== 2. Los tres servicios estan arriba =="
for puerto in 3000 4001 4002; do
  printf "  :%s -> " "$puerto"
  curl -s -m 5 "localhost:$puerto/health"
  echo
done

echo
echo "== 3. Busqueda de One Piece SIN acceso a la API externa =="
curl -s -m 8 -X POST localhost:3000/api/characters/search \
  -H 'Content-Type: application/json' -d '{"name":"luffy"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const c=JSON.parse(d).data[0];console.log('  OK ->',c.name,'| raza:',c.race,'| recompensa:',c.bounty);}catch(e){console.log('  FALLA ->',d.slice(0,140));process.exit(1);}});"

echo
echo "== 4. Busqueda de Pokemon SIN acceso a la API externa =="
curl -s -m 8 -X POST localhost:3000/api/pokemon/search \
  -H 'Content-Type: application/json' -d '{"name":"pikachu"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const p=JSON.parse(d).data[0];console.log('  OK ->',p.name,'| #'+p.id,'| especie:',p.especie,'| movimientos:',p.moves.length);}catch(e){console.log('  FALLA ->',d.slice(0,140));process.exit(1);}});"

echo
echo "== 5. Listado completo servido desde PostgreSQL =="
printf "  onepiece: "; curl -s -m 5 localhost:3000/api/characters \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count+' personajes'));"

printf "  pokemon:  "; curl -s -m 5 localhost:3000/api/pokemon \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).count+' pokemon'));"

echo
echo "== 6. Ningun intento de salir a internet =="
# Este es el paso que realmente demuestra el aislamiento. Si alguien reintrodujo
# un fetch externo, apareceria aqui y la prueba no pasaria.
if grep -q 'BLOQUEADO' "$LOG"; then
  echo "  FALLA: el backend intento salir a internet:"
  grep 'BLOQUEADO' "$LOG"
  exit 1
fi
echo "  OK: cero peticiones externas"

echo
echo "RESULTADO: el backend funciona entero sin tocar las APIs externas."
