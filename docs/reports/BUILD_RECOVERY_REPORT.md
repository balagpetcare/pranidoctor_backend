# BUILD Recovery Report — BLOCKER-1

**Date:** 2026-05-30  
**Engineer scope:** Next.js + TypeScript production build recovery  
**Status:** **RESOLVED**

---

## Summary

Production builds now pass with **zero TypeScript errors** in both repositories:

| Repo | `npm run build` | `npm test` | Notes |
|------|-----------------|------------|-------|
| `pranidoctor-web` | **PASS** | **114/114 PASS** | Next.js 16.2.6, 324 static pages |
| `pranidoctor-backend` | **PASS** | **505/505 PASS** | `typecheck` + `tsc -p tsconfig.build.json` |

`pranidoctor-web` lint: **0 errors**, 2 pre-existing unused-var warnings.

---

## Error categories (backend — primary failure)

The backend GA blocker was **TypeScript** (not Next.js runtime). Errors fell into these buckets:

| Category | Count (approx.) | Root cause |
|----------|-----------------|------------|
| **TypeScript** | ~70 | `exactOptionalPropertyTypes: true` — optional props set to `undefined` instead of omitted |
| **Legacy / Prisma JSON** | ~15 | `Record<string, unknown>` assigned to `InputJsonValue`; null vs `Prisma.JsonNull` |
| **Legacy admin-auth** | 0 (already fixed) | `getExpressRequest` missing from `next-shim.d.ts` — resolved in prior P0 fix |
| **API / Routing** | 0 | No missing routes or handler errors at compile time |
| **Next.js / App Router** | N/A (web repo) | Web build already green |

---

## Failing files (backend — before fix)

| File | Error type |
|------|------------|
| `src/modules/ai/admin/ai-admin-route.util.ts` | `UsageAnalyticsFilters` optional props |
| `src/modules/ai/admin/ai-admin.guard.ts` | `ipAddress?: string` vs `undefined` |
| `src/modules/ai/admin/ai-operations.service.ts` | Route hop `modelKey` optional |
| `src/modules/ai/admin/ai-prompt-admin.service.ts` | Wrong Prisma import path + filter DTO |
| `src/modules/ai/admin/ai-registry-admin.service.ts` | Scope/json/Prisma unchecked updates |
| `src/modules/ai/admin/ai-vault-admin.service.ts` | Vault PUT optional fields |
| `src/modules/ai/ai.controller.ts` | Prompt `kind` narrowed to `PromptKind` |
| `src/modules/ai/marketplace/*.ts` | JSON + optional props + `source` literals |
| `src/modules/ai/prompts/management/*.ts` | Prompt CRUD + JSON null handling |
| `src/modules/ai/providers/provider-config.ts` | `DEFAULTS[key]` possibly undefined |
| `src/modules/ai/orchestrator/ai-orchestrator.service.ts` | Security context optional IDs |
| `src/modules/ai/security/ai-prompt-security.service.ts` | Audit context optional IDs |
| `src/modules/ai/usage/ai-usage.service.ts` | Usage log dimensions |
| `src/modules/ai/vault/ai-secret.service.ts` | Prisma create/update + provider relation typing |
| `src/modules/ai/vault/key-rotation.service.ts` | Rotation audit + nullable user IDs |

**Web (already green):** `proxy-to-backend.ts` compression header fix; `AiDisclaimerAdminPanel.tsx` PUT body (documented in AI Disclaimer bug report).

---

## Root causes

### 1. `exactOptionalPropertyTypes` (main)

With strict optional semantics, `{ foo?: string }` accepts **absent** `foo` or `string` — not `foo: undefined`. Many AI admin/marketplace/vault services passed `undefined` explicitly from `?? undefined`, Zod optional fields, or spread DTOs.

**Pattern applied:** existing `omitUndefined()` from `src/shared/types/object.utils.ts`, conditional property spreads, and explicit `Prisma.*UncheckedUpdateInput` builders.

### 2. Prisma JSON columns

`Record<string, unknown>` and raw arrays are not assignable to `InputJsonValue`. Nullable clears require `Prisma.JsonNull`, not JavaScript `null`.

**Fix:** new helpers in `src/shared/database/prisma-json.ts`:

- `toInputJson()` — serialize for create
- `toNullableInputJson()` — null → `JsonNull` for updates

### 3. Wrong generated import (prompt admin)

`ai-prompt-admin.service.ts` imported `../../../../../generated/prisma` (6 levels) instead of `../../../generated/prisma` (3 levels from `src/modules/ai/admin/`).

### 4. Prior BLOCKER-1 — legacy `next/headers` shim (already fixed)

`src/types/next-shim.d.ts` now exports `getExpressRequest`, `runWithExpressRequest`, and `cookies()` matching `shims/next-compat/headers.js`. Legacy admin-auth (`api-guard.ts`, `session.ts`) typechecks when pulled in via non-legacy imports.

---

## Fixes applied

| Change | Files |
|--------|-------|
| `omitUndefined()` at API/filter boundaries | 15+ AI admin + marketplace + vault files |
| `prisma-json.ts` helpers | New + registry/prompt/vault services |
| `Prisma.*UncheckedUpdateInput` explicit builders | Registry routes/failover, prompt drafts, API keys |
| `resolveScopeKey` / `scopeKey()` signatures | Allow `| undefined` on optional scope fields |
| Prisma import path correction | `ai-prompt-admin.service.ts` |
| Provider config exhaustiveness | Guard `DEFAULTS[key]` before switch |
| Web BFF proxy body buffering | `pranidoctor-web/src/lib/proxy-to-backend.ts` (prior) |

**No `@ts-ignore`, no `any` abuse, strict mode unchanged.**

---

## Validation

### Backend

```bash
cd pranidoctor-backend
npm run build   # PASS — zero TS errors
npm test        # PASS — 505/505 (115 files)
```

### Web

```bash
cd pranidoctor-web
npm run build   # PASS — Next.js 16.2.6, 324 pages
npm test        # PASS — 114/114 (27 files)
npm run lint    # PASS — 0 errors, 2 warnings (unused `_session` in panel-access)
```

### Final backend build output (excerpt)

```text
> pranidoctor-backend@1.0.0 build
> npm run typecheck && tsc -p tsconfig.build.json

> pranidoctor-backend@1.0.0 typecheck
> tsc --noEmit -p tsconfig.build.json

(exit 0)
```

### Final web build output (excerpt)

```text
▲ Next.js 16.2.6 (Turbopack)
✓ Compiled successfully
✓ Finished TypeScript
✓ Generating static pages (324/324)
```

---

## Success criteria

| Criterion | Result |
|-----------|--------|
| Production build succeeds | **Yes** (both repos) |
| Zero TypeScript errors | **Yes** |
| No ts-ignore / strict bypass | **Yes** |
| Tests pass | **Yes** (505 backend + 114 web) |

---

## Follow-up (non-blocking)

1. **Backend lint debt:** `npm run lint` still reports repo-wide legacy issues — track separately from GA build gate.
2. **Shared PUT helper:** Consider a typed `buildAdminPutBody()` for settings panels that omit read-only fields (`updatedAt`).
3. **CI gate:** Ensure both `pranidoctor-web` and `pranidoctor-backend` run `npm run build` on every PR.
