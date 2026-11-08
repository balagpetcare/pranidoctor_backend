// Type-checks admin route files that the main tsconfig excludes.
// Fails only on errors located in the route files / admin-directory service themselves;
// transitive baseline errors elsewhere (see typecheck baseline) are printed but not fatal.
import { spawnSync } from "node:child_process";

const r = spawnSync("npx", ["tsc", "-p", "tsconfig.routes.json"], { encoding: "utf8", shell: true });
const lines = `${r.stdout}${r.stderr}`.split(/\r?\n/).filter((l) => /error TS/.test(l));
const own = lines.filter((l) => /^src[\\/]legacy[\\/]web[\\/](routes|lib[\\/]admin-directory)[\\/]/.test(l));
for (const l of own) console.error(l);
console.log(`admin routes typecheck: ${own.length} error(s) in route files, ${lines.length - own.length} transitive baseline error(s) elsewhere`);
process.exit(own.length ? 1 : 0);
