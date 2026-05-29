#!/usr/bin/env bash
# Install daily PostgreSQL backup cron (02:00 UTC).
# Usage: sudo ./scripts/backup/install-backup-cron.sh /app/pranidoctor-backend /var/backups/pranidoctor

set -euo pipefail

APP_DIR="${1:-/app/pranidoctor-backend}"
BACKUP_DIR="${2:-/var/backups/pranidoctor}"
CRON_FILE="/etc/cron.d/pranidoctor-postgres-backup"

if [[ ! -f "${APP_DIR}/scripts/backup/postgres-backup.sh" ]]; then
  echo "postgres-backup.sh not found under ${APP_DIR}" >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

cat > "${CRON_FILE}" <<EOF
# Prani Doctor PostgreSQL backup — daily 02:00 UTC
0 2 * * * root cd ${APP_DIR} && DATABASE_URL=\$(grep -E '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"') BACKUP_KEEP_COUNT=14 ${APP_DIR}/scripts/backup/postgres-backup.sh ${BACKUP_DIR} >> /var/log/pranidoctor-backup.log 2>&1
EOF

chmod 644 "${CRON_FILE}"
echo "Installed ${CRON_FILE}"
