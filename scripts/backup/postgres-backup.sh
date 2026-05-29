#!/usr/bin/env sh
# PostgreSQL logical backup — run via cron on host or backup container.
# Usage: DATABASE_URL=... ./scripts/backup/postgres-backup.sh [output_dir]

set -eu

OUTPUT_DIR="${1:-./backups/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$OUTPUT_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

FILE="$OUTPUT_DIR/pranidoctor_${TIMESTAMP}.sql.gz"
pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip -9 > "$FILE"
echo "Backup written: $FILE"

# Retain last 14 daily backups (optional; adjust KEEP)
KEEP="${BACKUP_KEEP_COUNT:-14}"
ls -1t "$OUTPUT_DIR"/pranidoctor_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
