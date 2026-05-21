import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const modulesDir = 'src/modules';

const controllerImports = `import { requireParam } from '../../shared/http/params.js';
import { omitUndefined } from '../../shared/types/object.utils.js';
`;

function ensureImports(content) {
  if (content.includes('requireParam')) return content;
  const marker = "import type { Request, Response, NextFunction } from 'express';";
  if (!content.includes(marker)) return content;
  return content.replace(marker, `${marker}\n${controllerImports}`);
}

function patchController(content) {
  let next = ensureImports(content);

  // Route params: id!, ownerId!, etc.
  next = next.replace(/await this\.(\w+Service)\.(\w+)\((\w+)!/g, 'await this.$1.$2(requireParam($3');
  next = next.replace(/requireParam\((\w+), '(\w+)'\)!/g, "requireParam($1, '$2')");
  next = next.replace(/requireParam\((\w+)\)!/g, 'requireParam($1)');

  // Service calls with body DTOs
  next = next.replace(
    /await this\.(\w+Service)\.(create|update|sendSms|sendPush|createNotification|addMedicalRecord|addService|assign|convert)\((data)\)/g,
    'await this.$1.$2(omitUndefined($3))'
  );

  // list filters
  next = next.replace(
    /const filter = req\.query as unknown as (\w+);\s*\n\s*const \{ page, pageSize \} = normalizePagination\(filter\);\s*\n\s*const result = await this\.(\w+Service)\.list\(filter, page, pageSize\);/g,
    'const filter = req.query as unknown as $1;\n      const { page, pageSize, ...listFilter } = filter;\n      const pagination = normalizePagination({ page, pageSize });\n      const result = await this.$2.list(omitUndefined(listFilter), pagination.page, pagination.pageSize);'
  );

  return next;
}

function patchDto(content) {
  if (!content.includes('export function to') || content.includes('omitUndefined')) {
    return content;
  }
  const importLine = "import { omitUndefined } from '../../shared/types/object.utils.js';\n";
  const firstImport = content.indexOf('import ');
  if (firstImport === -1) return content;
  const endFirst = content.indexOf('\n', firstImport);
  content = content.slice(0, endFirst + 1) + importLine + content.slice(endFirst + 1);

  return content.replace(
    /export function (to\w+)\(([^)]+)\): (\w+) \{\s*return \{/g,
    'export function $1($2): $3 {\n  return omitUndefined({'
  ).replace(/(\n\}\n\nexport function to)/g, '\n  }) as $3;\n$1').replace(/(\n\}\n$)/, '\n  }) as $3;\n');
}

// Simpler dto patch: wrap return object only
function patchDtoSimple(content) {
  if (!content.match(/export function to\w+/) || content.includes('omitUndefined')) {
    return content;
  }
  if (!content.includes("from '../../shared/types/object.utils.js'")) {
    content = content.replace(
      /(import type \{[^}]+\} from '\.\/[^']+';\n)/,
      "$1import { omitUndefined } from '../../shared/types/object.utils.js';\n"
    );
  }
  return content.replace(
    /return \{(\n    id:)/g,
    'return omitUndefined({$1'
  ).replace(
    /(export function to\w+\([^)]+\): \w+ \{[\s\S]*?)(\n\};?\n\})/g,
    (m, head, tail) => {
      if (!head.includes('omitUndefined({')) return m;
      const typeMatch = head.match(/: (\w+) \{/);
      const typeName = typeMatch?.[1] ?? 'unknown';
      return `${head.replace(/\n\}$/, `\n  }) as ${typeName};\n}`)}`;
    }
  );
}

for (const mod of readdirSync(modulesDir)) {
  const dir = join(modulesDir, mod);
  const ctrl = join(dir, `${mod}.controller.ts`);
  const dto = join(dir, `${mod}.dto.ts`);
  try {
    if (ctrl.match(/controller\.ts$/)) {
      const raw = readFileSync(ctrl, 'utf8');
      writeFileSync(ctrl, patchController(raw));
    }
  } catch {}
  try {
    if (dto.endsWith('.dto.ts')) {
      const raw = readFileSync(dto, 'utf8');
      writeFileSync(dto, patchDtoSimple(raw));
    }
  } catch {}
}

console.log('Controllers and DTOs patched');
