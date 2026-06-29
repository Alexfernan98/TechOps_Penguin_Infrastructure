#!/usr/bin/env bash
# reload-env.sh — recrea un servicio para que tome cambios del .env.
# Uso tras editar .env en la VM (ej. swap de DRIVE_FOLDER_*, SMTP_PASS, etc.).
#
# IMPORTANTE: `docker compose restart` NO relee env_file — solo reinicia el
# proceso con el environment ya cargado en el container. Para recargar el .env
# hay que RECREAR el container con --force-recreate. Eso hace este script.
#
# Uso:
#   ./scripts/reload-env.sh backend            # un servicio
#   ./scripts/reload-env.sh backend frontend   # varios
#   ./scripts/reload-env.sh                    # todos los que usan env_file
set -euo pipefail
cd "$(dirname "$0")/.."

SERVICES=("$@")
if [[ ${#SERVICES[@]} -eq 0 ]]; then
  SERVICES=(backend frontend)
fi

echo "── Recreando: ${SERVICES[*]}"
docker compose up -d --force-recreate "${SERVICES[@]}"

sleep 6
docker compose ps
echo ""
echo "✓ ${SERVICES[*]} recreado. Verificá:"
for s in "${SERVICES[@]}"; do
  echo "  docker compose exec ${s} env | grep <VAR>"
done
