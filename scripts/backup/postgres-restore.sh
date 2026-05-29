#!/usr/bin/env sh
# Restore from gzip SQL dump produced by postgres-backup.sh
# Usage: DATABASE_URL=... ./scripts/backup/postgres-restore.sh path/to/backup.sql.gz

set -eu

BACKUP_FILE="${1:?Usage: postgres-restore.sh <backup.sql.gz>}"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

echo "Restoring $BACKUP_FILE — this will overwrite data in the target database."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --set ON_ERROR_STOP=on
echo "Restore complete."
