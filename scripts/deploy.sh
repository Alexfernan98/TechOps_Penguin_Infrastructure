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

echo "── 5) Esperar a que arranque"
sleep 12
docker compose ps
echo "── últimas líneas backend:"
docker compose logs --tail=15 backend

echo ""
echo "✓ Deploy completado. Versión: $(git describe --tags --always) ($(git rev-parse --short HEAD))"
echo ""
echo "Si algo salió mal:"
echo "  ./scripts/rollback.sh ${TAG}    # vuelve al código anterior + restaura DB"
