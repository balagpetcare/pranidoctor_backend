import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BACKEND_ROOT = path.resolve(__dirname, '../../..');
export const MIGRATIONS_DIR = path.join(BACKEND_ROOT, 'prisma', 'migrations');
export const SCHEMA_FILE = path.join(BACKEND_ROOT, 'prisma', 'schema.prisma');
export const REPORTS_DIR = path.join(BACKEND_ROOT, 'reports', 'db');
export const BACKUP_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'backup', 'postgres-backup.sh');
export const RESTORE_SCRIPT = path.join(BACKEND_ROOT, 'scripts', 'backup', 'postgres-restore.sh');

/** User-repo docs (sibling workspace). */
export function userDatabaseDocsDir() {
  return path.resolve(BACKEND_ROOT, '../pranidoctor_user/docs/database');
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readMigrationFolders() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort();
}
