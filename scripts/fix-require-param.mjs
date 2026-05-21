import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'src/modules';

for (const mod of readdirSync(dir)) {
  const ctrl = join(dir, mod, `${mod}.controller.ts`);
  let content;
  try {
    content = readFileSync(ctrl, 'utf8');
  } catch {
    continue;
  }

  // Fix missing closing paren: requireParam(x); at end of await call
  content = content.replace(/requireParam\((\w+)\);/g, 'requireParam($1));');

  // Fix wrong merge of multiple args into requireParam
  content = content.replace(
    /requireParam\((\w+), (data)\)/g,
    'requireParam($1), omitUndefined($2))'
  );
  content = content.replace(
    /requireParam\((\w+), (schedules)\)/g,
    'requireParam($1), $2)'
  );
  content = content.replace(
    /requireParam\((\w+), (data), (userId)\)/g,
    'requireParam($1), omitUndefined($2), $3)'
  );

  writeFileSync(ctrl, content);
}

console.log('Fixed requireParam calls');
