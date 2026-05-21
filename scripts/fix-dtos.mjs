import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const importLine = "import { omitUndefined } from '../../shared/types/object.utils.js';\n";

for (const mod of readdirSync('src/modules')) {
  const dtoPath = join('src/modules', mod, `${mod}.dto.ts`);
  let content;
  try {
    content = readFileSync(dtoPath, 'utf8');
  } catch {
    continue;
  }

  if (!content.includes('export function to') || content.includes('omitUndefined')) {
    continue;
  }

  const firstFrom = content.indexOf("from './");
  if (firstFrom !== -1) {
    const lineEnd = content.indexOf('\n', content.indexOf("';", firstFrom));
    content = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
  }

  content = content.replace(/export function (to\w+)\([^)]+\): (\w+) \{\n  return \{/g, 'export function $1($2): $3 {\n  return omitUndefined({');

  writeFileSync(dtoPath, content);
  console.log('Patched', dtoPath);
}
