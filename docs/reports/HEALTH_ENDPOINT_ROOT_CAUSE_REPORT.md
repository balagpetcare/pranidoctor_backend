# Health Endpoint Root Cause Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Incident:** `GET /health` returned HTTP 500 (`INTERNAL_ERROR`)  
**Engineer role:** Principal Backend Incident Response

---

## Executive summary

| Check | Before | After | Status |
|-------|--------|-------|--------|
| `GET /health` | **500** `INTERNAL_ERROR` | **200** (aggregate `degraded` — optional deps off) | ✅ |
| `GET /live` | **500** | **200** | ✅ |
| `GET /health/db` | **500** | **200** | ✅ |
| `POST /api/admin/auth/login` | **500** (sanitize) / **405** (broken import cache) | **200** | ✅ |

**Root cause (health):** Express 5 makes `req.query` a read-only getter. Global `sanitizeInputMiddleware()` reassigned `req.query`, throwing before any health handler or dependency probe ran.

**Secondary fix (admin login):** Wrong relative import depth in `panel-legal.service.ts` resolved `auth-audit.service.js` under `src/legacy/modules/` (missing file), so lazy-loaded `POST /api/admin/auth/login` returned **405** after a failed first import.

**Not the cause:** Prisma, PostgreSQL, Redis, MinIO, JWT, Sentry, queues, or startup validation — all initialized; failure occurred in the security middleware stack before route handlers.

---

## 1. Reproduction

```http
GET http://localhost:3000/health
```

**Before fix:**

```json
HTTP/1.1 500
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error"
  }
}
```

**After fix:**

```http
HTTP/1.1 200
```

Body (abbreviated):

```json
{
  "status": "degraded",
  "timestamp": "2026-05-30T06:44:27.473Z",
  "version": "1.0.0",
  "uptime": 15,
  "checks": [
    { "name": "database", "status": "healthy", "latency": 7 },
    { "name": "redis", "status": "degraded", "message": "Redis disabled (REDIS_ENABLED=false)" },
    ...
  ]
}
```

> **Note:** The aggregate `/health` contract returns `status` / `checks`, not `{ "success": true }`. That envelope is used on routes such as `GET /health/dependencies`. Success criterion for this incident is **HTTP 200** with a valid health payload.

---

## 2. Captured exception and stack trace

**Logger (`pranidoctor-api`, development):**

```
ERROR | Unhandled error
path: "/health"
method: "GET"
error: {
  "name": "TypeError",
  "message": "Cannot set property query of #<IncomingMessage> which has only a getter",
  "stack":
      TypeError: Cannot set property query of #<IncomingMessage> which has only a getter
          at <anonymous> (src/shared/security/middleware/sanitize-input.middleware.ts:33:11)
          at Layer.handleRequest (node_modules/router/lib/layer.js:152:17)
          ...
          at secure-headers.middleware.ts:11:5
}
WARN | API server error: GET /health — INTERNAL_ERROR (ALT-ERR-01)
```

Same `TypeError` affected `POST /api/admin/auth/login` at `sanitize-input.middleware.ts:33` before the compat route handler executed.

---

## 3. Request execution trace

| Stage | Component | Outcome (before fix) |
|-------|-----------|----------------------|
| 1 | `server.ts` → `loadEnvironment()` | OK |
| 2 | Bootstrap: Prisma, Redis (disabled), storage/MinIO, validation, modules | OK — server listening |
| 3 | `createApp()` → `applySecurityMiddleware()` | **FAIL** on first request |
| 3a | `helmet` | OK |
| 3b | `secureHeadersMiddleware` | OK |
| 3c | `sanitizeInputMiddleware` | **TypeError** assigning `req.query` |
| 4 | `contextMiddleware`, metrics, logger | Never reached for failing requests |
| 5 | `createHealthRouter` → `getHealthStatus()` | Never reached |
| 6 | `errorHandler` | Returns `INTERNAL_ERROR` 500 |

Health checks (DB, Redis, storage, AI, queues) were never invoked.

---

## 4. Dependency initialization state (verified at runtime after fix)

| Dependency | State (local dev) |
|------------|-------------------|
| Environment loader | Loaded from `.env` |
| Prisma / PostgreSQL | `database` check **healthy** (~7 ms) |
| Redis | Disabled (`REDIS_ENABLED=false`) → **degraded**, not blocking |
| MinIO / S3 storage | **healthy** (`operational: true`) |
| JWT / admin auth | Login **200** with session payload |
| Sentry | Bootstrapped at startup (no probe failure) |
| Queues | **degraded** — no queues when Redis off |
| AI governance | Hydrated; **degraded** — no LLM keys (expected dev) |

---

## 5. Root cause

1. **Primary:** `sanitizeInputMiddleware()` used `req.query = sanitizeObject(...)` incompatible with **Express 5.1** (`express@^5.1.0` in `package.json`), where `req.query` is read-only.
2. **Secondary (admin login):** `src/legacy/web/lib/panel-legal/panel-legal.service.ts` imported `../../../modules/auth/...` (resolves to `src/legacy/modules/...`) instead of `../../../../modules/auth/...`. Lazy route loader cached the failed import; subsequent requests returned **405** until process restart.

---

## 6. Fixes applied

### 6.1 `sanitize-input.middleware.ts`

- Added `sanitizeInPlace()` to mutate query keys without reassigning `req.query`.
- Left body sanitization as object replacement (still writable under Express 5).

### 6.2 `panel-legal.service.ts`

- Corrected import paths to `../../../../modules/auth/` and `../../../../modules/legal/`.

### 6.3 Tests

- Added `sanitize-input.middleware.test.ts` (Express 5 read-only `query` getter + body sanitization).

---

## 7. Files modified

| File | Change |
|------|--------|
| `src/shared/security/middleware/sanitize-input.middleware.ts` | Express 5–compatible in-place query sanitization |
| `src/shared/security/middleware/sanitize-input.middleware.test.ts` | **New** — regression tests |
| `src/legacy/web/lib/panel-legal/panel-legal.service.ts` | Fix module import paths for admin auth chain |
| `docs/reports/HEALTH_ENDPOINT_ROOT_CAUSE_REPORT.md` | **New** — this report |

---

## 8. Verification results

| Command | HTTP | Result |
|---------|------|--------|
| `GET /health` | **200** | Aggregate `degraded` (Redis/queues/AI optional) |
| `GET /live` | **200** | `{ "alive": true, "service": "api", ... }` |
| `GET /health/db` | **200** | Database healthy |
| `POST /api/admin/auth/login` (valid JSON body) | **200** | `{ "ok": true, "data": { "result": "success", ... } }` |
| `npx vitest run sanitize-input.middleware.test.ts` | — | **2/2 passed** |

**Admin login verification (Node fetch):**

```javascript
fetch('http://localhost:3000/api/admin/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@pranidoctor.com', password: '<seed-password>' }),
});
// → HTTP 200
```

No `INTERNAL_ERROR` on `/health` or admin login after fixes (with valid JSON request body).

---

## 9. Recommendations

1. **Express 5 audit:** Search for other `req.query =` / `req.params =` assignments in middleware.
2. **Lazy route loader:** On import failure, avoid caching `loadError` without rethrowing (prevents silent **405** on later requests).
3. **JSON parse errors:** Consider mapping `body-parser` `SyntaxError` to **400** instead of **500** for clearer client errors.
4. **CI:** Add a smoke test that hits `GET /health` and `POST /api/admin/auth/login` after app bootstrap.

---

## 10. Success criteria

| Criterion | Met |
|-----------|-----|
| `GET /health` = 200 | ✅ |
| Admin login = 200 (valid credentials + JSON) | ✅ |
| No `INTERNAL_ERROR` on health probe | ✅ |

**Report status:** Resolved — 2026-05-30
