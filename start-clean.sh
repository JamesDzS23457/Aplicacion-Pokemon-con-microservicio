#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

for p in 3000 4001 4002 4003; do
  PIDS=$(lsof -ti tcp:$p 2>/dev/null || true)
  [ -n "$PIDS" ] && kill -9 $PIDS 2>/dev/null || true
done

pkill -9 -f "gateway\|pokemon-service\|docentes-service\|onepiece-service\|uvicorn.*src.main" 2>/dev/null || true
sleep 1
exec node backend/scripts/dev.js
