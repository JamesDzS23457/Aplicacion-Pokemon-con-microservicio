#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"

# Kill processes using our ports
PORTS=(3000 4001 4002 4003)
for PORT in "${PORTS[@]}"; do
  PIDS=$(lsof -ti tcp:$PORT 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Killing processes on port $PORT: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
done

# Kill our known processes
pkill -9 -f "gateway\|pokemon-service\|docentes-service\|onepiece-service" 2>/dev/null || true
pkill -9 -f "uvicorn.*src.main" 2>/dev/null || true
pkill -9 -f "node.*backend/gateway" 2>/dev/null || true
pkill -9 -f "node.*backend/services/pokemon" 2>/dev/null || true
pkill -9 -f "node.*backend/services/docentes" 2>/dev/null || true

sleep 1

echo "Starting backend..."
cd "$ROOT"
exec node backend/scripts/dev.js
