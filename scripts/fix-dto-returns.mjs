import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

for (const mod of readdirSync('src/modules')) {
  const path = join('src/modules', mod, `${mod}.dto.ts`);
  let content;
  try {
    content = readFileSync(path, 'utf8');
  } catch {
    continue;
  }

  if (!content.includes('export function to')) continue;

  content = content.replace(
    /export function (to\w+)\([^)]+\): \w+ \{\n  return \{/g,
    'export function $1($2): $3 {\n  return omitUndefined({'
  );

  // Fix closing of omitUndefined calls before next export or EOF
  content = content.replace(
    /(export function to[\s\S]*?return omitUndefined\(\{[\s\S]*?)(\n  \};)(\n\})/g,
    '$1\n  });$3'
  );

  writeFileSync(path, content);
  console.log('Fixed', path);
}
