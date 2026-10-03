#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# ENTORNO PYTHON DEL SERVICIO DE ONE PIECE
#
# Crea el entorno virtual (si no existe) e instala las dependencias de
# requirements.txt. Se ejecuta una vez antes de arrancar o sembrar el servicio:
#
#   cd backend && npm run onepiece:env
#
# Por que un venv y no instalar global:
# Las dependencias (FastAPI, asyncpg...) son de ESTE servicio. Un venv las
# aisla del Python del sistema y evita romper otros proyectos.
#
# Por que se prefiere uv cuando esta disponible:
# uv crea el entorno e instala en segundos y, si hace falta, descarga un
# interprete compatible. Si no esta, se cae al venv y pip clasicos de Python.
# ---------------------------------------------------------------------------

set -e

SERVICE_DIR="$(cd "$(dirname "$0")/../services/onepiece-service" && pwd)"
cd "$SERVICE_DIR"

if [ ! -d .venv ]; then
  echo "== Creando entorno virtual =="
  if command -v uv >/dev/null 2>&1; then
    # 3.12 es una version estable con ruedas precompiladas de todas las
    # dependencias; evita que pip tenga que compilar nada.
    uv venv --python 3.12 .venv
  else
    python3 -m venv .venv
  fi
else
  echo "== El entorno virtual ya existe =="
fi

echo "== Instalando dependencias =="
if command -v uv >/dev/null 2>&1; then
  uv pip install --python .venv/bin/python -r requirements.txt
else
  .venv/bin/python -m pip install --upgrade pip
  .venv/bin/python -m pip install -r requirements.txt
fi

echo "Entorno Python listo en $SERVICE_DIR/.venv"
