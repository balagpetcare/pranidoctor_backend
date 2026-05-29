/**
 * Rewrites @/ path aliases in copied legacy files to backend-relative imports.
 * Run after copying from pranidoctor-web: node scripts/fix-legacy-imports.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'src', 'legacy', 'web');

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) files.push(p);
  }
  return files;
}

function depthFromLegacyWeb(filePath) {
  const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
  const parts = rel.split(/[/\\]/);
  return parts.length - 1;
}

function toGeneratedPrefix(depth) {
  return '../'.repeat(depth + 3) + 'generated/prisma/index.js';
}

function toLibPrefix(depth, subpath) {
  return '../'.repeat(depth + 1) + subpath;
}

function toSharedPrefix(depth, subpath) {
  return '../'.repeat(depth + 3) + 'shared/' + subpath;
}

function rewrite(content, depth) {
  let out = content;
  out = out.replace(/from ["']@\/generated\/prisma\/client["']/g, `from "${toGeneratedPrefix(depth)}"`);
  out = out.replace(/from ["']@\/generated\/prisma["']/g, `from "${toGeneratedPrefix(depth)}"`);
  out = out.replace(/from ["']@\/lib\/([^"']+)["']/g, (_, libPath) => {
    return `from "${toLibPrefix(depth, libPath)}"`;
  });
  out = out.replace(/from ["']@\/shared\/([^"']+)["']/g, (_, sharedPath) => {
    return `from "${toSharedPrefix(depth, sharedPath)}"`;
  });
  return out;
}

const files = walk(ROOT);
let changed = 0;
for (const file of files) {
  const depth = depthFromLegacyWeb(file);
  const before = readFileSync(file, 'utf8');
  const after = rewrite(before, depth);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`Updated ${changed} / ${files.length} legacy files`);
