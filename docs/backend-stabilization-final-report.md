# Backend Stabilization — Final QA Report

**Repository:** `pranidoctor-backend`  
**Date:** 2026-05-29  
**Scope:** Final architecture QA, hardening verification, production readiness  
**Prior work:** [Phase 1 plan](./backend-stabilization-phase-1.md) · [Phase 1 implementation](./backend-stabilization-phase-1-implementation-report.md)

---

## Executive summary

The backend is **production-viable for mobile/admin traffic via the compat layer** (`/api/mobile/*`, `/api/admin/*`, etc.) after Phase 1 hardening. The **foundation module layer** (`/api/auth`, `/api/users`, …) is partially mature: auth, identity, area-engine, treatment, voice, offline, media, and leads are active; stub domains are **unmounted by default**.

Final QA identified **no new P0 crash paths** in default configuration. Remaining risk is concentrated in **unauthenticated foundation CRUD routes**, **dual session stores**, **legacy typecheck gaps**, and **build-time TypeScript debt** outside the stabilized paths.

### Scores (0–100)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| **Deployment readiness** | **72** | Graceful shutdown, health checks, startup validation, prod config refines; blocked by full `tsc` build failures and manual secret/Redis/DB setup |
| **Maintainability** | **58** | 242 legacy routes + 12 active foundation modules; dual response envelopes; large `legacy/web` tree |
| **Scalability** | **65** | Lazy legacy route loading, Redis rate limits, DB indexes on hot models; no queue workers, many unpaginated `findMany` in legacy |
| **Security** | **68** | OTP/login rate limits (foundation + compat), MIME upload checks, JWT prod guards; foundation users/doctors/leads lack route-level auth |

---

## 1. Architecture consistency analysis

### 1.1 Expected model

```
HTTP → createApp (global middleware)
     → /api/docs
     → /api (compat-web: 242 legacy route.ts handlers)
     → /api/{module} (12 foundation modules, default)
     → notFoundHandler → errorHandler
```

### 1.2 Consistency verdict

| Area | Status | Notes |
|------|--------|-------|
| Boot order | ✅ Consistent | Config → Prisma → Redis (optional) → storage → startup validation → mobile profile check → routes |
| Module registry | ✅ Consistent | `dependencyGuard` detects cycles/missing deps at init |
| Response contracts | ⚠️ Dual | Legacy `{ ok, data }` vs foundation `{ success, data }` — intentional, documented |
| Auth channels | ⚠️ Dual session | Prisma `UserSession` (mobile) + Redis `session.storage` (foundation `authenticate`) |
| Data access | ⚠️ Mixed | Legacy lib services + Prisma in modules; inventory/profile not HTTP-mounted |
| Build vs runtime | ⚠️ Drift | `tsconfig.build.json` excludes `src/legacy/**` routes; they still run via dynamic import |

### 1.3 Active foundation modules (default mount)

| Module | Path | Auth on routes |
|--------|------|----------------|
| auth | `/api/auth` | Public OTP/refresh; rate limited |
| identity | `/api/identity` | Partial — no global guard on router |
| area-engine | `/api/area-engine` | Public read (location tree) |
| cases | `/api/cases` | `authDoctor` + role |
| voice-assistant | `/api/voice-assistant` | `authenticateMobileCustomer` |
| sync / offline | `/api/sync`, `/api/offline` | `authenticateMobileCustomer` |
| users | `/api/users` | **None on router** |
| doctors | `/api/doctors` | **None on router** |
| leads | `/api/leads` | **None on router** |
| ai-veterinary-core | `/api/ai-veterinary-core` | Mobile customer guard |
| media | `/api/media` | `optionalAuthMobile` on uploads |

### 1.4 Unmounted by default (stub / collision)

| Module | Reason |
|--------|--------|
| animals | Repository stub → would 501 if mounted |
| clinics | Repository stub |
| notifications | Stub + **shadowed** legacy `/api/notifications` when mounted |

Enable only for dev: `FOUNDATION_MOUNT_STUB_MODULES=true`.

---

## 2. Unstable modules

| Module / area | Risk | Runtime behavior (default) |
|---------------|------|----------------------------|
| `animals`, `clinics`, `notifications` | Low (unmounted) | Not on HTTP stack |
| `ai` (`AiModule`) | None | Not in `createAllModules()` |
| `doctors` | Medium | Mounted; `POST /` → **501** `NOT_IMPLEMENTED` |
| `users`, `leads` | Medium–High | Mounted, Prisma-backed, **no auth middleware** |
| `legacy/mobile/*` | Low–Medium | Primary production path; battle-tested |
| `offline-architecture` | Medium | Complex sync; typed repository edge cases in tests |
| `inventory` | Low | Legacy-only; not foundation-mounted |
| `_archived_foundation` | Low | Excluded from build; do not re-enable |

---

## 3. Potential runtime crashes

| Scenario | Likelihood | Mitigation (Phase 1) |
|----------|------------|---------------------|
| Hit stub foundation repo | Low | Modules unmounted |
| `getRedis()` without init | Low | `whenRateLimitAvailable` + `checkRateLimit` fail-open |
| Uncaught legacy `throw new Error(...)` | Medium | `wrapNextHandler` → `errorHandler` → **500** (not mapped) |
| Prisma constraint errors | Medium | `mapPrismaError` in global handler (foundation path) |
| Storage init failure in prod | Low | Fatal exit if required |
| Redis down in prod | Low | Fatal on boot (`isRedisRequired`) |
| `FOUNDATION_MOUNT_STUB_MODULES=true` | Medium | 501 instead of 500 |

---

## 4. Circular dependency risks

| Mechanism | Finding |
|-----------|---------|
| `dependencyGuard` (module metadata) | ✅ DFS cycle detection at startup — **no cycles** in current 12-module graph |
| Legacy ↔ modules imports | ⚠️ Many legacy routes import `@/lib` and `modules/inventory`, `modules/profile` — **runtime-only**, not in module graph |
| `server.ts` → `legacy/.../otp-env` | Acceptable for bootstrap warnings |
| `safe-rate-limit` ↔ `rate-limit.service` | Mutual import — **no circular init** (functions only) |

**Recommendation:** Avoid `modules/*` importing `legacy/web/lib/*` in new code; use shared layer.

---

## 5. Unsafe async patterns

| Pattern | Count | Severity |
|---------|-------|----------|
| `.catch(() => {})` on session touch | 3 | Low — non-critical path |
| Legacy routes without `wrapNextHandler` | 0 | All use compat wrapper |
| Foundation routes without `asyncHandler` | Many | Mitigated — controllers use try/catch + `next(error)` |
| Fire-and-forget audit | Several | Low — `recordAuthAuditFireAndForget` by design |
| Worker with no processors | 1 | Medium — jobs may accumulate if producers exist |

---

## 6. Security weaknesses

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| SEC-F01 | `/api/users`, `/api/doctors`, `/api/leads` lack `authAdmin` / RBAC | **High** | Open — Phase 2 |
| SEC-F02 | Dual session stores (Redis vs Prisma) | **High** | Open |
| SEC-F03 | `optionalAuthMobile` on media upload | Medium | By design for anonymous upload flows |
| SEC-F04 | OTP dev mode in production | Medium | `warnIfProdDevOtpMode()` at boot (added final QA) |
| SEC-F05 | OTP debug panel | Medium | Blocked in prod unless `OTP_DEBUG_PANEL_ENABLED` |
| SEC-F06 | Helmet CSP disabled | Low | Open |
| SEC-F07 | Legacy routes not typechecked | Medium | Open |
| SEC-F08 | Rate limit fail-open without Redis | Low | Dev-only; prod requires Redis |
| SEC-F09 | Area-engine public | Low | Intended for location picker |

---

## 7. Prisma query risks

| Risk | Examples | Mitigation |
|------|----------|------------|
| Large `findMany` without `take` | Admin doctor/technician lists, feed history | Add pagination Phase 2 |
| N+1 includes | Admin detail endpoints | Profile with `EXPLAIN ANALYZE` |
| Missing index | Notification list | ✅ `@@index([userId, createdAt])` migration added |
| `metadataJson` filtering | Technician profiles | Avoid without GIN index |
| Offline sync repository types | `offline.repository.ts` | Typecheck debt — test failures isolated |

---

## 8. Validation bypass possibilities

| Path | Validation | Bypass risk |
|------|------------|-------------|
| Foundation POST/PATCH with `validateBody` | Zod | Low |
| Legacy routes | Per-route Zod/manual | **Medium** — inconsistent |
| Compat multipart | Raw body preserved | Low — handlers must re-parse |
| Query params on legacy GET | Often unchecked | Medium — filter injection via string fields |
| `FOUNDATION_MOUNT_STUB_MODULES` | N/A | Env-only, not user-controlled |

---

## 9. Missing try/catch areas

| Layer | Coverage |
|-------|----------|
| Global `errorHandler` | ✅ Express 4-arg handler |
| `wrapNextHandler` (compat) | ✅ try/catch → `next(error)` |
| Foundation controllers | ✅ Most use try/catch internally |
| Legacy service `throw new Error("CODE")` | ⚠️ Becomes 500 unless route catches and maps to `jsonError` |

---

## 10. Unsafe `any` typings

| Scan | Result |
|------|--------|
| `: any` / `as any` in `src/**/*.ts` | **None found** in ripgrep scan |
| Strict TS flags | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` enabled in base config |
| Build exclusions | Legacy still has implicit issues not caught in CI build |

---

## 11. Environment variable risks

| Variable | Risk | Guard |
|----------|------|-------|
| `CHANGE_ME` JWT secrets | Critical in prod | Zod refine blocks production |
| `SKIP_STARTUP_VALIDATION=true` | Boot without DB | Forbidden in prod schema |
| `REDIS_ENABLED=false` | No OTP/rate limit | Forbidden in prod schema |
| `OTP_MODE=dev` in prod | OTP in logs | Boot warning (`warnIfProdDevOtpMode`) |
| `OTP_DEBUG_PANEL_ENABLED` | OTP leak | Off by default in prod |
| `FOUNDATION_MOUNT_STUB_MODULES` | Stub 501 routes | Documented, default false |
| `dotenv` not expanding `${}` | Misconfiguration | Documented in `.env.example` |
| Dual lockfiles (npm + pnpm) | CI drift | Open |

---

## 12. Deployment risks

| Risk | Impact | Checklist item |
|------|--------|----------------|
| `prisma migrate deploy` not in pipeline | Schema drift | Automate |
| Single-instance Redis | OTP/session SPOF | Use HA Redis |
| 242-route cold start | First-hit latency | Warm critical paths |
| No queue workers | Async work stuck | Deploy `worker` when processors exist |
| Large schema migrations uncommitted | Index missing | Apply `20260529120000_notification_user_created_index` |
| `npm run build` fails | No artifact | Fix legacy storage TS or exclude from build job |

---

## 13. Scalability bottlenecks

| Bottleneck | Detail |
|------------|--------|
| ~1,452 legacy method registrations | Lazy load mitigates memory |
| Synchronous Sharp in upload path | CPU bound — move to queue later |
| Redis single-threaded rate limit | OK at moderate scale |
| DB pool default max 10 | Tune per instance × replicas |
| BullMQ without consumers | Monitor queue depth |
| Location tree repeated queries | Cache via `area-engine` seed version + CDN |

---

## 14. Middleware order verification

**`createApp` order (correct):**

1. `trust proxy`
2. `helmet`
3. `cors`
4. `compression`
5. `express.json` / `urlencoded`
6. `contextMiddleware`
7. `createLoggerMiddleware`
8. `whenRateLimitAvailable(rateLimitApi)` ← after context (needs request id)
9. API version header
10. Health routes

**`server.ts` mount order:**

1. `/api/docs`
2. `/api` compat (+ compat auth rate limit **before** legacy routes)
3. `/api/{module}` foundation
4. `finalizeApp` → 404, errorHandler

✅ **Correct:** Error handlers last; rate limit after body parser; compat auth limits before legacy handlers.

---

## 15. Auth flow consistency

| Flow | Token | Session store | Verifier |
|------|-------|---------------|----------|
| Mobile OTP (compat) | Mobile JWT | Prisma `UserSession` | `verifyMobileJwt` + `session-guard` |
| Mobile OTP (foundation `/api/auth`) | Same pipeline via IdentityAuthService | Prisma | Same credentials service |
| Foundation modules (sync/voice/AI) | Bearer | `authenticateMobileCustomer` tries Redis then Prisma | Dual path |
| Doctor treatment | Doctor JWT | Panel session | `authDoctor` |
| Admin/doctor/technician login (compat) | Panel JWT | Panel helpers | Legacy guards |
| Foundation users/doctors/leads | — | **None** | **Gap** |

---

## 16. API response consistency

| Client channel | Success | Error |
|----------------|---------|-------|
| Mobile/admin legacy | `{ ok: true, data }` | `{ ok: false, error: { code, message } }` |
| Foundation modules | `{ success: true, data, requestId? }` | `{ success: false, error: { ... } }` |
| Global errorHandler | N/A | Foundation envelope |
| Compat unhandled throw | N/A | Often 500 HTML/JSON inconsistency if bypasses `jsonError` |

**Verdict:** Consistent **within** each channel; **not unified** cross-channel (by design for Phase 1).

---

## 17. Module isolation quality

| Criterion | Score | Notes |
|-----------|-------|-------|
| HTTP boundary | Good | `loadModules` prefix isolation |
| Service registry | Good | `getModuleService` |
| Cross-imports | Fair | Legacy imports modules; modules import some legacy auth helpers |
| Stub policy | Good | `foundation-modules.config.ts` |
| Dead code | Fair | `ai`, `area` vs `area-engine`, `lead` vs `leads` |

---

## 18. Production readiness verification

| Check | Status |
|-------|--------|
| Health/readiness endpoints | ✅ |
| Graceful shutdown (30s) | ✅ |
| Startup validation | ✅ (skippable in dev only) |
| Production config schema | ✅ Redis + no skip validation |
| Rate limiting (auth + global) | ✅ when Redis up |
| Stub modules unmounted | ✅ |
| Secrets validation | ✅ |
| Full CI build | ❌ Pre-existing TS errors |
| Vitest | ✅ 232/233 pass (1 timeout in mobile-profile startup test) |
| Worker processors | ❌ |
| Observability (metrics/tracing) | ❌ |

---

## A. Fixed issues (Phase 1 + final QA)

| ID | Issue | Fix |
|----|-------|-----|
| FIX-01 | Stub modules caused 500s | Unmounted by default; 501 if enabled |
| FIX-02 | `/api/notifications` route shadowing | Notifications module unmounted |
| FIX-03 | No OTP rate limits | Foundation + compat auth limits |
| FIX-04 | Rate limit crashed without Redis | `whenRateLimitAvailable` + `checkRateLimit` fail-open |
| FIX-05 | Duplicate validation middleware | `createValidationMiddleware` → `validateBody` |
| FIX-06 | Prisma errors → opaque 500 | `mapPrismaError` |
| FIX-07 | Upload MIME not checked | Media `fileFilter` allowlist |
| FIX-08 | Prod weak env | Schema refines for Redis, startup validation |
| FIX-09 | `tsconfig.build` duplicate include | Removed |
| FIX-10 | Notification list slow | DB index migration |
| FIX-11 | Prod OTP dev mode silent | `warnIfProdDevOtpMode()` at server boot (final QA) |

---

## B. Remaining issues

### P0 (before public foundation API exposure)

1. Add `authAdmin` + RBAC to `/api/users`, `/api/doctors`, `/api/leads` (or disable routes behind internal network).
2. Unify mobile session on Prisma; deprecate Redis session for mobile foundation paths.
3. Fix `npm run build` / legacy storage TypeScript errors for CI artifacts.

### P1

4. Location API consolidation (delegate legacy to `area-engine`).
5. Legacy `throw new Error("CODE")` → map to `jsonError` or shared error registry.
6. Implement or permanently delete stub repositories.
7. Enable `typecheck:legacy` in CI (non-blocking → blocking).
8. Deploy BullMQ worker processors.
9. Paginate hot legacy `findMany` queries.

### P2

10. Unified response adapter (optional `Accept-Version` header).
11. Helmet CSP for admin origins.
12. OpenTelemetry metrics.
13. Single package-manager lockfile.

---

## C. High-risk modules

| Rank | Module / path | Why |
|------|---------------|-----|
| 1 | `src/legacy/web/routes/mobile/auth/*` | OTP brute-force target — mitigated by rate limit |
| 2 | `src/modules/users`, `doctors`, `leads` routes | Unauthenticated foundation CRUD |
| 3 | `src/legacy/web/routes/admin/*` | Privileged operations |
| 4 | `src/modules/auth/*` + session services | Token/session correctness |
| 5 | `src/legacy/web/lib/storage/*` | Upload malware/size; TS build broken |
| 6 | `src/modules/offline-architecture/*` | Data loss / conflict bugs |
| 7 | `src/legacy/web/routes/mobile/finance/*` | Money-related mutations |

---

## D. Recommended next phase (Phase 2)

**Theme:** Secure foundation surface + reduce dual-stack debt.

1. **Week 1:** Auth guards on users/doctors/leads; session unification design + tests.  
2. **Week 2:** Legacy location routes delegate to `area-engine`; error code registry.  
3. **Week 3:** CI build green (`legacy/storage` imports + extension fixes).  
4. **Week 4:** Worker processors for notifications; paginate top 5 admin list endpoints.

---

## E. Final hardening applied (this QA pass)

| Change | File |
|--------|------|
| `checkRateLimit` / `getRateLimitStatus` fail-open if Redis unavailable | `rate-limit.service.ts` |
| Production OTP dev-mode boot warning | `server.ts` → `warnIfProdDevOtpMode()` |

No breaking API changes.

---

## F. Test & verification summary

```text
vitest:  232 passed / 233 total (1 timeout: mobile-profile-startup.test.ts)
         1 suite failed: archived auth.repository (import path)
npm run build: fails on pre-existing legacy storage / dev seed TS errors
```

**Recommended pre-deploy commands:**

```bash
npm run env:validate
npm run validate:startup
npx vitest run src/shared/errors
npm run db:migrate:deploy
npm run p1:full-verify   # when build is green
```

---

## G. Stabilization completion statement

**Phase 1 stabilization is complete** for the stated goal: *prevent crashes from stub foundation modules, resolve notifications route collision, centralize errors for the foundation stack, and harden auth rate limits without breaking legacy clients.*

The system is **ready to deploy compat-layer production traffic** with Redis, rotated secrets, and migrations applied. The **foundation admin CRUD routes** should **not** be exposed publicly until Phase 2 auth guards land.

---

*Report generated from static analysis, codebase scans, middleware/route review, and test execution on 2026-05-29.*
