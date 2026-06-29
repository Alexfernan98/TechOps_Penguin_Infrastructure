#!/usr/bin/env bash
# backup-daily.sh — corre diario via cron. Dumpea DB + uploads. Rota 14 días.
# Schedule sugerido: 0 3 * * * /opt/nethub/scripts/backup-daily.sh >> /opt/backups/cron.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

DATE=$(date +%Y-%m-%d)
DB_OUT="/opt/backups/db/daily/nethub-${DATE}.sql.gz"
UP_OUT="/opt/backups/uploads/uploads-${DATE}.tar.gz"

# DB
docker compose exec -T postgres pg_dump -U techops -d techopshub --clean --if-exists --no-owner | gzip > "${DB_OUT}"

# Uploads
docker run --rm -v nethub_prod_uploads_data:/src alpine tar czf - -C /src . > "${UP_OUT}"

# Rotación: 14 días daily
find /opt/backups/db/daily/ -name '*.sql.gz' -mtime +14 -delete
find /opt/backups/uploads/ -name '*.tar.gz' -mtime +14 -delete

echo "[$(date -Iseconds)] Backup OK: $(du -h ${DB_OUT} ${UP_OUT} | awk '{print $1}' | tr '\n' ' ')"
