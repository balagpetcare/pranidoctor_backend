# Backend Stabilization Phase 1 — Implementation Report

**Date:** 2026-05-29  
**Status:** Implemented (Phase 1 safety + infrastructure)  
**Plan reference:** [backend-stabilization-phase-1.md](./backend-stabilization-phase-1.md)

---

## Summary

Phase 1 focused on **crash prevention**, **route/middleware deduplication**, **centralized errors**, **auth rate limiting**, and **production config guards** — without changing legacy `{ ok, data }` response contracts.

---

## Changes delivered

### 1. Crash prevention (stub foundation modules)

| Change | Files |
|--------|-------|
| Stub modules **unmounted by default** (`animals`, `clinics`, `notifications`) | `foundation-modules.config.ts`, `modules/index.ts` |
| Opt-in via `FOUNDATION_MOUNT_STUB_MODULES=true` | `.env.example` |
| Stub repos throw `501 NOT_IMPLEMENTED` instead of generic `Error` | `animals/clinics/notifications/ai.repository.ts` |
| Doctor `create()` returns `501` with guidance | `doctors.repository.ts` |
| SMS/push on foundation notifications service → `501` | `notifications.service.ts` |

**Impact:** Legacy `/api/mobile/animals`, `/api/notifications`, etc. unchanged. Foundation `/api/animals` no longer mounted → **404** instead of **500** (safer).

### 2. Duplicate route mounting

- Removed **notifications** modular router from default mount → fixes shadowing of legacy `GET /api/notifications`.
- Documented stub module policy in `foundation-modules.config.ts`.

### 3. Duplicate middleware / validation

- `createValidationMiddleware` now delegates to shared `validateBody` (single Zod path → consistent `422` + `ValidationError`).
- Auth routes use `validateBody` directly.

### 4. Centralized error handling

| Addition | Purpose |
|----------|---------|
| `NotImplementedError` (501) | Stub/unimplemented features |
| `mapPrismaError()` | P2002 → 409, P2025 → 404, etc. |
| `error.handler.ts` | Applies Prisma mapper before generic 500 |

### 5. Auth & rate limiting

| Layer | Change |
|-------|--------|
| `/api/auth/*` | `rateLimitOtpRequest`, `rateLimitOtpVerify`, `rateLimitLogin` via `whenRateLimitAvailable` |
| Compat `/api` router | `createCompatAuthRateLimitMiddleware` for mobile/admin/doctor/technician login paths |
| Global | `rateLimitApi` on app when Redis available |
| Media uploads | `whenRateLimitAvailable(rateLimitUpload)` — no crash if Redis down |

`whenRateLimitAvailable` skips limits when Redis is disabled (dev), avoiding startup crashes.

### 6. File upload validation

- `media.upload.middleware.ts` rejects disallowed MIME types using config allowlists.

### 7. Environment / production defaults

- `config.schema.ts`: production requires `redis.enabled` and forbids `skipStartupValidation`.
- `.env.example`: documents `FOUNDATION_MOUNT_STUB_MODULES`.

### 8. Prisma

- Index `Notification(userId, createdAt)` for list queries.
- Migration: `prisma/migrations/20260529120000_notification_user_created_index/`

### 9. TypeScript / build hygiene

- Fixed duplicate `"include"` in `tsconfig.build.json`.

### 10. Startup logging

- `server.ts` logs mounted module count and stub mount flag.

---

## Git commit batches (recommended)

1. `feat(stabilization): shared errors, prisma mapper, rate-limit safe wrapper`
2. `fix(stabilization): unmount stub foundation modules and fix notifications collision`
3. `feat(stabilization): auth rate limits and validation deduplication`
4. `feat(stabilization): production config guards, upload MIME check, prisma index`
5. `docs: phase 1 implementation report`

---

## Verification run

```bash
npx vitest run src/shared/errors   # passed (5 tests)
```

Full `npm run build` still reports **pre-existing** TypeScript errors in legacy storage paths and dev seeds (not introduced by this phase). Track under remaining issues.

---

## Remaining known issues

### P0 / high (next phase)

| ID | Issue |
|----|-------|
| R-01 | **Dual session stores** — Redis (`session.storage`) vs Prisma (`UserSession`); mobile middleware bridges both |
| R-02 | **Response format duality** — legacy `{ok}` vs foundation `{success}`; needs adapter, not breaking change |
| R-03 | **Location API triplication** — `/api/area-engine`, `/api/locations`, `/api/mobile/locations` |
| R-04 | Full `npm run build` typecheck failures in `legacy/web/lib/storage/*`, dev seeds, offline repository types |

### P1 / medium

| ID | Issue |
|----|-------|
| R-05 | Implement `animals` / `clinics` / `notifications` repositories or keep unmounted until ready |
| R-06 | `AiModule` still not in `createAllModules()` |
| R-07 | Worker has no BullMQ processors |
| R-08 | Global rate limit may be strict for high-traffic staging — tune presets |
| R-09 | `pnpm-lock.yaml` + `package-lock.json` both present — standardize package manager |
| R-10 | Legacy tree excluded from production `tsc` — enable `typecheck:legacy` in CI incrementally |

### P2 / lower

| ID | Issue |
|----|-------|
| R-11 | SMS/push/email provider integration |
| R-12 | AI completion placeholder in `ai.service.ts` |
| R-13 | Helmet CSP still disabled |
| R-14 | OpenTelemetry / metrics not wired |
| R-15 | `env.validation.ts` test fixture missing `STORAGE_ENABLED` (typecheck debt) |

---

## Safer alternatives considered

| Decision | Alternative | Why chosen |
|----------|-------------|------------|
| Unmount stub modules | Mount + 501 middleware | Unmount avoids Express shadowing; 404 is clearer for accidental foundation clients |
| Skip rate limit without Redis | Fail closed in prod | Prod schema now requires Redis; dev can run without |
| Keep legacy response shape | Force `{success}` everywhere | Would break mobile/admin clients |

---

## Enable stub modules (development only)

```env
FOUNDATION_MOUNT_STUB_MODULES=true
```

Expect `501 NOT_IMPLEMENTED` on all stub repository operations.

---

*End of implementation report*
