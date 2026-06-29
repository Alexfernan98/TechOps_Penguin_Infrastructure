#!/usr/bin/env bash
# rollback.sh — vuelve a un tag anterior y restaura el dump pre-deploy de ese tag.
# Uso: ./scripts/rollback.sh v0.7.0
set -euo pipefail
cd "$(dirname "$0")/.."

TARGET="${1:-}"
if [[ -z "${TARGET}" ]]; then
  echo "Uso: $0 <tag o commit hash>"
  echo ""
  echo "Tags disponibles:"
  git tag -l | sort -V | tail -10
  echo ""
  echo "Backups pre-deploy disponibles:"
  ls -lh /opt/backups/db/pre-deploy/ 2>/dev/null | tail -10
  exit 1
fi

echo "⚠  Vas a hacer ROLLBACK a ${TARGET}."
echo "    Esto va a:"
echo "    1. Hacer un backup del estado ACTUAL antes de revertir."
echo "    2. Volver el código al tag/commit ${TARGET}."
echo "    3. Restaurar el dump pre-deploy del paso anterior (opcional, manual)."
read -p "Continuar? (yes/no): " CONFIRM
[[ "${CONFIRM}" == "yes" ]] || { echo "Cancelado."; exit 1; }

# Safety net: dump ANTES del rollback
TS=$(date +%Y%m%d-%H%M%S)
SAFETY="/opt/backups/db/pre-deploy/nethub-pre-rollback-${TS}.sql.gz"
docker compose exec -T postgres pg_dump -U techops -d techopshub --clean --if-exists --no-owner | gzip > "${SAFETY}"
echo "✓ Safety dump: ${SAFETY}"

# Volver el código
git fetch origin --tags
git checkout "${TARGET}"
docker compose up -d --build
sleep 10
docker compose ps

echo ""
echo "✓ Código revertido a ${TARGET}."
echo ""
echo "Ahora si querés ALSO restaurar la DB al estado anterior al deploy fallido:"
echo "  gunzip -c /opt/backups/db/pre-deploy/<archivo>.sql.gz | docker compose exec -T postgres psql -U techops -d techopshub"
echo ""
echo "  Backups disponibles (más reciente primero):"
ls -t /opt/backups/db/pre-deploy/*.sql.gz | head -5
