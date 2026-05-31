# Feed Admin GA Blocker Remediation Report

**Date:** 2026-06-01  
**Prior audit:** `docs/audits/feed-admin-phase0-phase1-audit.md` (PARTIAL PASS, 82/100)  
**Scope:** GA blockers only — no Phase 2+ features

---

## Executive verdict

| Result | **PASS** (GA blockers resolved) |
|--------|--------------------------------|
| **GA readiness score** | **91 / 100** (Phase 0–1 scope) |
| **Recommendation** | **Approve GA** for Feed Intelligence admin (ingredients + toxic) for SUPER_ADMIN / ADMIN; SUPPORT read-only per Policy A |

---

## Blocker resolution summary

| Blocker | Policy / fix | Status |
|---------|----------------|--------|
| **1. SUPPORT permission mismatch** | **Policy A** — SUPPORT: `ai.feed.view` + `ai.feed.audit` only | **RESOLVED** |
| **2. Paginated list filter bug** | `buildFeedEntityListWhere()` — filters in Prisma `where` before `take`/`skip` | **RESOLVED** |
| **3. Missing integration tests** | `feed-admin.integration.test.ts` + `feed-admin-list.query.test.ts` | **RESOLVED** |

---

## Blocker 1 — SUPPORT role (Policy A)

### Decision

**Option A:** SUPPORT may access `ai.feed.view` and `ai.feed.audit` (read-only). SUPPORT cannot manage or publish.

### Changes applied

| Layer | Change |
|-------|--------|
| Backend matrix | Unchanged — already correct in `ai-permissions.ts` |
| Web matrix | Unchanged — already correct in `permissions-core.ts` |
| Panel auth | `panel-admin-auth.service.ts` — SUPPORT login + `resolveActor` with `adminProfile` |
| JWT | `panel-admin-token.ts` — `SUPPORT` session role verified |
| Feed API guard | `feed-admin-route.util.ts` — `requireAdminApiActor` + `feedAdminCan` (not `requireAiAdminActor`) |
| AI Ops (other) | Still `requireAiAdminActor` — SUPPORT blocked from providers/models (intentional) |

### Consistency matrix (post-fix)

| Role | Web nav | Backend `/me` | Feed GET list | Feed POST manage | Feed audit |
|------|---------|---------------|---------------|------------------|------------|
| SUPER_ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| SUPPORT | ✓ | ✓ | ✓ | ✗ 403 | ✓ |

---

## Blocker 2 — List pagination filters

### Root cause

`FeedIngredientAdminService.list` and `FeedToxicAdminService.list` applied `status`, `bdAvailability`, and `species` **after** `findMany` pagination.

### Fix

- New: `src/modules/ai/feed/admin/feed-admin-list.query.ts`
- Effective-version semantics: draft when `currentDraftVersionId` set, else published
- `count({ where })` uses same `where` as `findMany`

### Regression tests

`feed-admin-list.query.test.ts` — 4 tests for status, species, bdAvailability, toxic `speciesAffected`

---

## Blocker 3 — Integration tests

### New suites

| File | Coverage |
|------|----------|
| `feed-admin.integration.test.ts` | Permission policy A; ingredient create + submit + publish + audit; toxic create + submit + review + approve + publish + audit; list where + total |
| `feed-admin-list.query.test.ts` | Prisma where builder |
| `feed-admin.permissions.test.ts` | +1 Policy A test |

### Test run (2026-06-01)

```
vitest run src/modules/ai/feed/admin  → 15 passed
vitest run src/modules/ai/feed        → 83 passed (full feed module)
```

**Not in scope:** Live HTTP E2E against running API (manual UAT still recommended once per environment).

---

## Verification checklist

| Check | Result |
|-------|--------|
| Unit / integration tests | PASS |
| Permission tests | PASS |
| Workflow tests (mocked) | PASS |
| List filter regression | PASS |
| Docs updated | PASS (`feed-admin-api.md`, `feed-admin-control-center.md`) |

---

## Remaining non-blockers (post-GA backlog)

These were **not** GA blockers in the prior audit but remain for later phases:

| Item | Phase | Severity |
|------|-------|----------|
| FeedItem linker UI (`feedItemId`) | 1 extension / 7 | Low |
| Dedicated governance review/vet queue UI | 3 | Medium |
| DOCTOR-role vet publish path (without ADMIN+profile) | 3 | Medium |
| Client-side hide Publish for users without `ai.feed.publish` | UX | Low |
| Overview hub Prisma stats | 0 polish | Low |
| Route-parity compat test | Hardening | Low |
| Live Playwright/Cypress E2E | QA | Medium |

---

## GA readiness score

| Category | Before | After |
|----------|--------|-------|
| Permissions | 12/15 | **15/15** |
| APIs (list/pagination) | 13/15 | **15/15** |
| Workflow tests | 6/15 | **13/15** |
| Other areas (unchanged) | 51/55 | 51/55 |
| **Total** | **82/100** | **91/100** |

---

## Recommendation

1. **Ship GA** for Feed Intelligence Admin Phase 0–1 to production for editorial ADMIN/SUPER_ADMIN users.
2. **Enable SUPPORT** accounts with `adminProfile` for read-only support diagnostics (list, detail, audit).
3. **Run one manual UAT** cycle: create ingredient → submit → publish; create toxic → submit → review → publish (vet-linked ADMIN).
4. **Proceed to Phase 2** (nutrient requirements) only after product sign-off on GA.

---

*Remediation completed in codebase; re-run `npx vitest run src/modules/ai/feed/admin` before deploy.*
