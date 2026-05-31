# AI API Keys — Option A Permission Alignment Report

**Date:** 2026-06-01  
**Scope:** API Keys vault only (`ai.secrets.view` / `ai.secrets.manage`). No other AI Center capabilities changed.

## Summary

Implemented product Option A: **ADMIN** gets read-only vault access plus test/disable/audit; **SUPER_ADMIN** retains full vault management; **SUPPORT** has no API Keys access.

## Files changed

### Backend (`pranidoctor-backend`)

| File | Change |
|------|--------|
| `src/modules/ai/admin/ai-permissions.ts` | Added `ai.secrets.view`; granted to SUPER_ADMIN + ADMIN |
| `src/modules/ai/admin/ai-permissions.test.ts` | Updated role matrix expectations |
| `src/modules/ai/admin/ai-secrets-permissions.test.ts` | **New** — Option A endpoint matrix tests |
| `src/legacy/web/routes/admin/ai-ops/secrets/route.ts` | **New** — GET (`view`), POST (`manage`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/route.ts` | **New** — GET (`view`), PUT (`manage`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/audit/route.ts` | **New** — GET (`view`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/test/route.ts` | **New** — POST (`view`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/disable/route.ts` | **New** — POST (`view`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/rotate/route.ts` | **New** — POST (`manage`) |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/primary/route.ts` | **New** — PUT (`manage`) |

**Unchanged (by design):** `providers/[id]/test-connection` remains `ai.secrets.manage` (SUPER_ADMIN).

### Frontend (`pranidoctor-web`)

| File | Change |
|------|--------|
| `src/lib/admin-auth/permissions-core.ts` | Added `ai.secrets.view`; ADMIN + SUPER_ADMIN granted |
| `src/lib/admin-auth/permissions-secrets.test.ts` | **New** — web matrix tests |
| `src/components/admin-ui/admin-nav.tsx` | API Keys nav → `ai.secrets.view` |
| `src/app/admin/(dashboard)/ai-ops/api-keys/page.tsx` | Page gate + `canOperateSecrets` prop |
| `src/components/admin/ai-ops/ApiKeysPanel.tsx` | Split manage vs operate actions |
| `src/components/admin/settings/PermissionsAdminPanel.tsx` | Document `ai.secrets.view` |
| `src/app/api/admin/ai-ops/secrets/[id]/route.ts` | Added GET proxy |

## Permission matrix

| Capability | SUPER_ADMIN | ADMIN | SUPPORT |
|------------|:-----------:|:-----:|:-------:|
| `ai.secrets.view` | ✓ | ✓ | ✗ |
| `ai.secrets.manage` | ✓ | ✗ | ✗ |

## Endpoint matrix

| Method | Path | Capability | SUPER_ADMIN | ADMIN | SUPPORT |
|--------|------|------------|:-----------:|:-----:|:-------:|
| GET | `/secrets` | `ai.secrets.view` | ✓ | ✓ | ✗ |
| GET | `/secrets/:id` | `ai.secrets.view` | ✓ | ✓ | ✗ |
| GET | `/secrets/:id/audit` | `ai.secrets.view` | ✓ | ✓ | ✗ |
| POST | `/secrets/:id/test` | `ai.secrets.view` | ✓ | ✓ | ✗ |
| POST | `/secrets/:id/disable` | `ai.secrets.view` | ✓ | ✓ | ✗ |
| POST | `/secrets` | `ai.secrets.manage` | ✓ | ✗ | ✗ |
| PUT | `/secrets/:id` | `ai.secrets.manage` | ✓ | ✗ | ✗ |
| POST | `/secrets/:id/rotate` | `ai.secrets.manage` | ✓ | ✗ | ✗ |
| PUT | `/secrets/:id/primary` | `ai.secrets.manage` | ✓ | ✗ | ✗ |

## Security validation

| Check | Status |
|-------|--------|
| List/detail APIs use `AiApiKeyPublic` (metadata + `secretHint` only) | Pass — `toPublic()` in `ai-secret.service.ts` |
| No `encryptedSecret` or plaintext in list/get responses | Pass |
| Plaintext only accepted on create/update/rotate request bodies (manage capability) | Pass |
| SUPPORT denied at capability matrix and nav/page gates | Pass |
| BFF ↔ backend route parity | Pass — `ai-ops-route-parity.test.ts` |

## Test results

```text
# Backend
npx vitest run src/modules/ai/admin/ai-permissions.test.ts \
  src/modules/ai/admin/ai-secrets-permissions.test.ts \
  src/modules/compat-web/ai-ops-route-parity.test.ts
→ 3 files, 10 tests passed

# Web
npx vitest run src/lib/admin-auth/permissions-secrets.test.ts
→ 1 file, 2 tests passed
```

## UI behavior

| Role | Nav API Keys | Page | Actions |
|------|:------------:|:----:|---------|
| SUPER_ADMIN | Visible | Yes | Full: add, test, audit, primary, rotate, revoke |
| ADMIN | Visible | Yes | View list, test, audit, revoke — no add/rotate/primary |
| SUPPORT | Hidden | Blocked (`ai.secrets.view`) | — |
