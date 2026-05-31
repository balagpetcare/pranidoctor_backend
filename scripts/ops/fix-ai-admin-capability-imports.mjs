import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const routesRoot = path.join(root, 'src/legacy/web/routes/admin/ai-ops');

function walk(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, acc);
    else if (ent.name === 'route.ts') acc.push(full);
  }
  return acc;
}

const idxImportRe = /import \{([^}]+)\} from '([^']*modules\/ai\/admin\/index\.js)';/;

let updated = 0;
for (const file of walk(routesRoot)) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('requireAiAdminCapability(')) continue;
  const orig = src;

  src = src.replace(/import \{ requireAiAdminActor \} from '[^']*ai-admin\.guard\.js';\r?\n/g, '');

  const m = src.match(idxImportRe);
  if (m && !m[1].includes('requireAiAdminCapability')) {
    const names = m[1]
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const actorIdx = names.indexOf('requireAiAdminActor');
    if (actorIdx >= 0) names[actorIdx] = 'requireAiAdminCapability';
    else names.unshift('requireAiAdminCapability');
    src = src.replace(idxImportRe, `import { ${names.join(', ')} } from '${m[2]}';`);
  }

  if (src !== orig) {
    fs.writeFileSync(file, src);
    updated += 1;
  }
}

console.log(`Updated ${updated} files`);
