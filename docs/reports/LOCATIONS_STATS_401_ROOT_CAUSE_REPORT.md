# Locations Stats 401 Root Cause Report

**Project:** pranidoctor-backend / pranidoctor-web  
**Date:** 2026-05-30  
**Incident:** `GET /api/admin/locations/stats` returned HTTP 401 while admin login and dashboard APIs succeeded  
**Engineer role:** Principal RBAC and Next.js Authorization Engineer

---

## Executive summary

| Check | Before | After | Status |
|-------|--------|-------|--------|
| `GET /api/admin/locations/stats` (backend direct) | **401** `UNAUTHORIZED` | **200** + stats payload | ✅ |
| `GET /api/admin/locations/stats` (Next proxy `:3001`) | **401** | **200** | ✅ |
| `GET /api/admin/locations/import-report` | **401** | **200** | ✅ |
| `/admin/locations` RSC page | Error digest / route error | Loads stats successfully | ✅ |

**Root cause:** **D — Session not propagated to auth guard** (route guard mismatch with working dashboard pattern).

Location admin routes called `requireAdminPanelApiAccess()` without passing the compat-layer Fetch `Request`. On Express-backed legacy routes, the Express AsyncLocalStorage cookie fallback is unreliable; cookies are present on the Fetch `Request` built by `expressToWebRequest()` but were never read. This produced `401 Not signed in` despite a valid `prani_admin_token` cookie.

**Not the cause:** Missing RBAC permission, wrong role, permission seed, or a separate location auth chain. Location routes use the same `requireAdminPanelApiAccess` gate as dashboard (`admin.panel` — active ADMIN/SUPER_ADMIN with AdminProfile).

---

## 1. Request path traced

```
AdminLocationsPage (RSC, pranidoctor-web)
  └─ getLocationAdminStats()
       └─ serverInternalJson("/api/admin/locations/stats")
            └─ serverInternalFetch → BACKEND_URL:3000 (forwards Cookie header)
                 └─ Express compat router (/api/admin/locations/stats)
                      └─ wrapNextHandler → expressToWebRequest(req)
                      └─ GET handler
                           └─ requireAdminPanelApiAccess()   ← BUG: no Request arg
                                └─ getAdminSession() → null → 401
                           └─ getLocationAdminStats() (never reached before fix)
```

**Working comparison — dashboard:**

```
GET /api/admin/dashboard/page-data
  └─ requireAdminPanelApiAccess(request)   ← passes Fetch Request
       └─ getAdminSession(request) → reads Cookie header → 200
```

**Browser/proxy path (also affected before fix):**

```
Browser → Next /api/admin/locations/stats (proxyRouteToBackend)
  └─ Web BFF requireAdminPanelApiAccess() (Next cookies — passes)
  └─ Proxy to backend with Cookie header
       └─ Backend requireAdminPanelApiAccess() without request → 401
```

---

## 2. Logged-in user verified

From `GET /api/admin/auth/me` (200) during incident window:

| Field | Value |
|-------|-------|
| User ID | `cmpfhf5hu0000egbc3j22o0a0` |
| Email | `admin@pranidoctor.com` |
| Display name | Prani Doctor Admin |
| Role | `ADMIN` |
| Permissions | Panel access via `requireAdminPanelApiAccess` (active ADMIN + AdminProfile). No location-specific capability matrix entry — same gate as dashboard. |

---

## 3. Route requirements

| Route | Auth guard | Permission / role | Extra checks |
|-------|------------|-------------------|--------------|
| `/api/admin/locations/stats` | `requireAdminPanelApiAccess` | Active `ADMIN` or `SUPER_ADMIN` + `AdminProfile` | None |
| `/api/admin/dashboard/page-data` | Same | Same | None |

Documented in `pranidoctor-web/docs/ADMIN_API_MAPPING.md` as permission `admin.panel` for both routes.

---

## 4. Root cause classification

| Option | Verdict | Evidence |
|--------|---------|----------|
| A. Missing permission | ❌ | Would return **403** `FORBIDDEN`, not 401 |
| B. Wrong role requirement | ❌ | User is `ADMIN` with AdminProfile; me/dashboard succeed |
| C. Route guard mismatch | ✅ | Location routes omitted `request` parameter |
| D. Session not propagated | ✅ | Primary failure mode — JWT cookie on wire, guard saw no session |
| E. Different auth chain | ❌ | Same `api-guard` + `panel-access` + `panel-classify` |
| F. Permission seed missing | ❌ | No location-specific seed; generic panel gate only |

Supporting comment in `src/legacy/web/lib/admin-auth/session.ts`:

> Prefer Fetch `Request` cookies on compat routes (Express ALS can miss the header).

Dashboard `page-data` was already updated to pass `request`; location routes were not.

---

## 5. Fix applied

Pass the compat Fetch `Request` into `requireAdminPanelApiAccess(request)` on all admin location routes (same pattern as dashboard and legal routes).

### Files modified

| File | Change |
|------|--------|
| `src/legacy/web/routes/admin/locations/stats/route.ts` | `GET(request)` + pass `request` to guard |
| `src/legacy/web/routes/admin/locations/import-report/route.ts` | Same |
| `src/legacy/web/routes/admin/locations/missing-coords/route.ts` | Pass existing `request` to guard |
| `src/legacy/web/routes/admin/locations/pending-verification/route.ts` | Pass existing `request` to guard |
| `src/legacy/web/routes/admin/locations/duplicates/route.ts` | Pass existing `request` to guard |

**Example (stats route):**

```typescript
export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  // ...
}
```

No frontend changes required. `location-master-admin-client.ts` and `serverInternalJson` already forward cookies correctly.

---

## 6. Verification results

Post-fix (authenticated session via `POST /api/admin/auth/login`):

```http
GET http://localhost:3000/api/admin/locations/stats
→ HTTP 200
→ {"ok":true,"data":{"counts":{"divisions":8,...},...}}

GET http://localhost:3001/api/admin/locations/stats  (Next proxy)
→ HTTP 200

GET http://localhost:3000/api/admin/locations/import-report
→ HTTP 200
→ {"ok":true,"data":{"report":null}}
```

`/admin/locations` no longer throws `Location stats failed (401)` during RSC render.

---

## 7. Follow-up recommendations

1. **Sweep remaining admin routes** — Many legacy handlers still call `requireAdminPanelApiAccess()` without `request` (e.g. `/api/admin/areas` also returned 401 in the same session). Apply the same one-line fix or add a lint/check.
2. **Harden `getAdminSession()`** — Consider defaulting to the handler's Fetch `Request` when invoked from compat routes, reducing repeated guard bugs.
3. **Regression test** — Add compat integration test: signed cookie on Fetch `Request` → location stats returns 200 without relying on Express ALS.

---

## 8. Related artifacts

- `docs/reports/HEALTH_ENDPOINT_ROOT_CAUSE_REPORT.md` — prior backend startup/auth fixes
- `pranidoctor-web/docs/ADMIN_API_MAPPING.md` — location route permission matrix (`admin.panel`)
