import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import zlib from 'node:zlib';

import { BACKUP_SCRIPT, RESTORE_SCRIPT } from './paths.mjs';

/**
 * Verify backup scripts exist and optional backup files integrity (no restore).
 * @param {{ backupDir?: string }} opts
 */
export function verifyBackupInfrastructure(opts = {}) {
  const backupDir = opts.backupDir ?? process.env.BACKUP_VERIFY_DIR ?? '';
  const result = {
    scripts: {
      backupExists: fs.existsSync(BACKUP_SCRIPT),
      restoreExists: fs.existsSync(RESTORE_SCRIPT),
    },
    backups: [],
    ok: true,
    warnings: [],
  };

  if (!result.scripts.backupExists || !result.scripts.restoreExists) {
    result.ok = false;
    result.warnings.push('Backup or restore script missing from repository');
  }

  if (!backupDir || !fs.existsSync(backupDir)) {
    result.warnings.push(
      'No BACKUP_VERIFY_DIR — skipped on-disk backup file checks (set path to validate gzip integrity)',
    );
    return result;
  }

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('pranidoctor_') && f.endsWith('.sql.gz'))
    .map((f) => path.join(backupDir, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);

  for (const file of files.slice(0, 5)) {
    const stat = fs.statSync(file);
    let gzipOk = false;
    try {
      const buf = fs.readFileSync(file);
      zlib.gunzipSync(buf);
      gzipOk = true;
    } catch {
      gzipOk = false;
    }
    result.backups.push({
      file: path.basename(file),
      sizeBytes: stat.size,
      mtime: stat.mtime.toISOString(),
      gzipIntegrity: gzipOk,
    });
    if (!gzipOk) result.ok = false;
  }

  if (files.length === 0) {
    result.warnings.push(`No pranidoctor_*.sql.gz files in ${backupDir}`);
  }

  return result;
}

/** Dry-run: pg_dump --version available (no dump executed). */
export function verifyPgToolsAvailable() {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  return { available: r.status === 0, version: (r.stdout || r.stderr || '').trim() };
}
