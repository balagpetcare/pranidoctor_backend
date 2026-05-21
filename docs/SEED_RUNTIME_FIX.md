# Seed Runtime Fix — Logger Bootstrap for CLI Scripts

Date: 2026-05-22  
Scope: seed and bootstrap script execution only (no logger redesign, no production app changes).

---

## Problem

After production logging was introduced, `createPrismaClient()` in `src/shared/database/prisma.ts` calls `getLogger()` for Prisma event handlers and disconnect logging.

Standalone scripts that called `createPrismaClient()` **without** first calling `createLogger()` failed:

```
Error: Logger not initialized. Call createLogger first.
```

**Affected command:** `npm run area:seed` → `scripts/area-seed.ts`

**Unaffected (already bootstrapped):**

| Command | Entry | Logger init path |
|---------|-------|------------------|
| `npm run db:seed` | `prisma/seed.ts` | `src/compat/legacy-prisma.ts` → `createLogger()` on first `prisma` access |
| `npm run db:seed:admin` | `prisma/seed-admin.ts` | Same legacy Prisma shim |

---

## Solution

### 1. Seed-safe logger bootstrap — `scripts/seed-runtime.ts`

New shared module that mirrors server startup order **without** starting HTTP:

```
loadEnvironment() → loadConfig() → createLogger(config) → createPrismaClient({ config })
```

Exports:

| Export | Purpose |
|--------|---------|
| `bootstrapScriptRuntime()` | One-call env + structured pino logger + shared Prisma singleton |
| `shutdownScriptRuntime()` | Graceful `disconnectPrisma()` + runtime reset |
| `ScriptRuntime` | `{ config, logger, prisma }` for typed script use |

Properties:

- Uses the same `createLogger()` / `createPrismaClient()` as `server.ts` — **production log format unchanged**
- Idempotent within a process (second call returns existing runtime)
- Optional `{ loadEnv: false }` when caller already loaded `.env`

### 2. Script execution bootstrap — `scripts/area-seed.ts`

**Before:**

```ts
loadEnvironment();
const config = loadConfig();
createPrismaClient({ config }); // throws — logger not initialized
```

**After:**

```ts
const { logger, prisma } = bootstrapScriptRuntime();
// … seed work …
logger.info({ msg: 'Area seed applied', result });
await shutdownScriptRuntime();
```

Structured pino logs replace raw `console.log` for success paths. Error path uses `getLogger().error()` when available.

### 3. Prisma compatibility

- Scripts using `bootstrapScriptRuntime()` share the **same** `prismaInstance` in `src/shared/database/prisma.ts` as the HTTP server.
- Prisma query/error/warn events continue to flow through the structured logger.
- `disconnectPrisma()` emits `INFO` `"Disconnecting Prisma client"` via pino (observed in validation runs).
- Legacy seed entrypoints (`prisma/seed*.ts`) remain on `src/lib/prisma` → `legacy-prisma.ts`, which already calls `createLogger()` before `createPrismaClient()`.

### 4. Structured logs preserved

Area seed output example (development, `LOG_FORMAT=pretty`):

```
INFO: | Area seed applied
    service: "pranidoctor-api"
    version: "1.0.0"
    env: "development"
    result: { version: "2026.05.21-area-engine-1", villagesSeeded: 1 }
```

Same bindings (`service`, `version`, `env`), redaction rules, and pino formatters as production server logs.

---

## Validation

All commands passed locally (2026-05-22):

```bash
npm run area:seed      # exit 0
npm run db:seed        # exit 0
npm run db:seed:admin  # exit 0
```

---

## Usage for new seed/CLI scripts

```ts
import { bootstrapScriptRuntime, shutdownScriptRuntime } from './seed-runtime.js';

async function main(): Promise<void> {
  const { logger, prisma } = bootstrapScriptRuntime();

  try {
    // … work …
    logger.info({ msg: 'Done', count: 42 });
  } finally {
    await shutdownScriptRuntime();
  }
}
```

Do **not** mix `bootstrapScriptRuntime()` with `src/lib/prisma` lazy init in the same process — both call `createPrismaClient()` on the same singleton.

---

## Files changed

| File | Change |
|------|--------|
| `scripts/seed-runtime.ts` | **New** — shared script bootstrap |
| `scripts/area-seed.ts` | Uses `bootstrapScriptRuntime` / `shutdownScriptRuntime` |

No changes to `src/shared/logger/*`, `src/shared/database/prisma.ts`, or server/worker boot paths.

---

*Fix complete — scripts-only, logger behavior unchanged for production HTTP/worker.*
