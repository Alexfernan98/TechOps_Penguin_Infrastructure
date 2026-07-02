#!/usr/bin/env bash
# deploy.sh — actualiza NetHub a la última versión de main.
# Hace dump pre-deploy, pull, rebuild y restart. Idempotente.
# Uso: ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

echo "── 1) Fetch + check"
git fetch origin
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
if [[ "$LOCAL" == "$REMOTE" ]]; then
  echo "✓ Ya estás en la última versión: $(git describe --tags --always)"
  exit 0
fi
echo "  Local:  $(git rev-parse --short HEAD)"
echo "  Remote: $(git rev-parse --short origin/main)"

echo "── 2) Backup pre-deploy"
TS=$(date +%Y%m%d-%H%M%S)
TAG=$(git describe --tags --always)
DUMP="/opt/backups/db/pre-deploy/nethub-${TAG}-${TS}.sql.gz"
docker compose exec -T postgres pg_dump -U techops -d techopshub --clean --if-exists --no-owner | gzip > "${DUMP}"
echo "✓ DB dump: ${DUMP} ($(du -h ${DUMP} | cut -f1))"

# Rotación: mantener los últimos 5 pre-deploy
ls -t /opt/backups/db/pre-deploy/*.sql.gz | tail -n +6 | xargs -r rm -v

echo "── 3) git pull"
git pull --ff-only origin main

echo "── 4) Build + up (Prisma aplica migraciones al arrancar)"
docker compose up -d --build

# ── 4b) Sincronizar dependencias del contenedor ────────────────────────────────
# El volumen anónimo /app/node_modules PERSISTE entre rebuilds y le gana al
# `npm install` del Dockerfile: las dependencias nuevas (ej. exceljs) no llegan
# al contenedor y el backend crashea con MODULE_NOT_FOUND. Instalamos dentro del
# contenedor (con dev deps, porque corre nodemon) y regeneramos el cliente Prisma
# para que conozca modelos/tablas nuevos. El retry cubre el caso en que el backend
# esté en loop de reinicio por una dep faltante.
echo "── 4b) Sincronizar dependencias en el contenedor (evita node_modules stale del volumen)"
tries=0
until docker compose exec -T backend npm install --include=dev; do
  tries=$((tries + 1))
  if [[ $tries -ge 20 ]]; then echo "✗ No se pudo instalar deps en el contenedor tras 20 intentos"; break; fi
  echo "  contenedor reiniciando, reintento $tries…"; sleep 3
done
docker compose exec -T backend npx prisma generate
docker compose restart backend

echo "── 5) Esperar a que arranque"
sleep 10
docker compose ps
echo "── últimas líneas backend:"
docker compose logs --tail=15 backend

echo ""
echo "✓ Deploy completado. Versión: $(git describe --tags --always) ($(git rev-parse --short HEAD))"
echo ""
echo "Si algo salió mal:"
echo "  ./scripts/rollback.sh ${TAG}    # vuelve al código anterior + restaura DB"
