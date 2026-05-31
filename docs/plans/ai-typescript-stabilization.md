# AI Module — TypeScript Stabilization Plan

**Project:** Prani Doctor  
**Role:** Principal TypeScript Architecture Auditor  
**Date:** 2026-05-31  
**Status:** TS-0 through TS-4 **implemented** — 2026-05-31 (TS-5 guardrails pending)  
**Version:** 1.1.0  
**Scope:** `src/modules/ai/**` (+ one legacy AI-adjacent import in `src/legacy/web/lib/admin-legal/`)  
**Compiler baseline:** `tsconfig.json` — `strict: true`, `exactOptionalPropertyTypes: true`, `noUnusedLocals: true`, `noUnusedParameters: true`

**Depends on:**

- `docs/plans/ai-core-platform-phase-1-foundation.md`
- `docs/plans/ai-phase-3-model-registry.md`
- `docs/plans/ai-phase-4-router-engine.md`
- `docs/reports/ai-router-verification.md`
- `docs/reports/ai-typescript-stability-report.md`

---

## Executive summary

A full-project `tsc --noEmit` surfaces **30 TypeScript errors** attributable to the AI platform (29 under `src/modules/ai/`, 1 legacy compliance import). **196 Vitest tests pass** in `src/modules/ai` despite compile failures — tests are excluded from `tsc` (`**/*.test.ts`), masking type drift from CI.

Errors cluster into three root causes:

1. **`exactOptionalPropertyTypes` semantics** — optional props assigned `undefined` instead of omitted (~45% of errors)
2. **Legacy / drift** — `AiService` + `AiRepository` no longer share a contract; placeholder chat code uses `omitUndefined` with `any`-typed IDs (~10%)
3. **Hygiene & copy-paste defects** — duplicate imports, unused symbols, wrong repository lookup (fixed for cost rates; remaining items below)

**Router-related errors:** 4 of 30 (13%) — all low severity except `ai-scope.util.ts`, which is on the hot path for every routed completion.

**Recommended stabilization score target:** 0 AI-module `tsc` errors before Phase 4.6 legacy path removal — **achieved 2026-05-31**.

---

## Implementation progress

| Phase | Scope | Status | Date | Notes |
|-------|-------|--------|------|-------|
| **TS-0** | Unblock compile (P0) | **Done** | 2026-05-31 | Duplicate import removed; compliance import path fixed; `toggleModel` actor uses `role: 'admin'` |
| **TS-1** | Router hot path | **Done** | 2026-05-31 | `ai-scope.util`, `ai-failover.service`, router unused symbols |
| **TS-2** | Audit & admin optional props | **Done** | 2026-05-31 | Audit events, model registry, settings `toInputJson` + `omitUndefined` |
| **TS-3** | Legacy AI service | **Partial** | 2026-05-31 | `AiRepositoryInterface` exported; `ChatResponse` explicit builder; conversation CRUD not re-implemented on `AiRepository` (interface-only; no runtime wiring found) |
| **TS-4** | Hygiene sweep | **Done** | 2026-05-31 | All P3 unused imports/parameters cleared |
| **TS-5** | CI guardrails | **Partial** | 2026-05-31 | `npm run typecheck:ai` script added; CI job + AGENTS.md pending |

### Verification (post-implementation)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` AI filter (`modules/ai` + `admin-ai-compliance`) | **0 errors** |
| `npx vitest run src/modules/ai` | **196 passed**, 0 failed |

### Changes by file

| File | Fix applied |
|------|-------------|
| `admin/ai-settings-admin.service.ts` | Removed duplicate `createAuditLog` import |
| `admin/ai-registry-admin.service.ts` | `omitUndefined` for `listModels`; actor `{ id, role: 'admin' }` for toggle |
| `legacy/.../admin-ai-compliance-service.ts` | Import path `../../../../modules/ai/compliance/...` |
| `foundation/ai-scope.util.ts` | Conditional spread for optional scope fields |
| `failover/ai-failover.service.ts` | Conditional spread for primary/secondary/tertiary hops |
| `audit/ai-platform-audit.service.ts` | `omitUndefined` + conditional `actorUserId` |
| `models/ai-model-registry.service.ts` | `omitUndefined` for audit + rate updates |
| `settings/ai-settings.service.ts` | `toInputJson` + `omitUndefined` on upsert |
| `ai.repository.ts` | Exported `AiRepositoryInterface` (type contract) |
| `ai.service.ts` | Explicit `ChatResponse`; removed unused `omitUndefined` |
| `router/ai-router-engine.service.ts` | Removed unused import; `_request` param |
| `providers/*`, `analytics`, `budget`, `compliance`, `governance`, `marketplace`, `platform`, `symptom-checker`, `repositories` | Unused import/parameter cleanup |

---

## Audit methodology

| Step | Action |
|------|--------|
| 1 | `npx tsc --noEmit -p tsconfig.json` — full compile |
| 2 | Filter errors matching `src/modules/ai/` and AI-adjacent legacy imports |
| 3 | Classify by TS code, severity, router vs non-router |
| 4 | Trace root cause per cluster (types, repositories, DTOs, audit, legacy) |
| 5 | Cross-check against `omitUndefined` / `toInputJson` utilities and Phase 3–4 patterns |
| 6 | Produce phased remediation roadmap (this document) |

**Command:** `npx tsc --noEmit -p tsconfig.json 2>&1 | Select-String "modules/ai"`

---

## Error inventory

### Summary by TypeScript code

| Code | Meaning | Count | Severity |
|------|---------|------:|----------|
| TS2379 | `exactOptionalPropertyTypes` — `T \| undefined` not assignable to optional `T?` | 7 | High |
| TS2375 | Same family — object literal optional mismatch | 2 | High |
| TS6133 | Unused import / local | 9 | Low |
| TS6196 | Unused type import | 4 | Low |
| TS2300 | Duplicate identifier | 2 | **Critical** |
| TS2305 | Missing export | 1 | **Critical** |
| TS2307 | Module not found | 1 | **Critical** |
| TS2322 | Type mismatch (non-optional) | 2 | High |
| TS2741 | Required property missing after transform | 1 | High |

**Total:** 29 errors in `src/modules/ai/` + 1 legacy = **30**

### Summary by severity

| Severity | Count | Description |
|----------|------:|-------------|
| **P0 — Critical** | 4 | Duplicate imports, missing exports, broken module resolution |
| **P1 — High** | 12 | `exactOptionalPropertyTypes`, Prisma JSON, required DTO fields |
| **P2 — Medium** | 3 | Legacy `AiService` contract drift, admin actor typing |
| **P3 — Low** | 11 | Unused imports/parameters (blocked by `noUnusedLocals`) |

### Router-related vs non-router-related

| Category | Count | Files |
|----------|------:|-------|
| **Router hot path** | 2 | `foundation/ai-scope.util.ts`, `failover/ai-failover.service.ts` |
| **Router adjacent** | 2 | `router/ai-router-engine.service.ts` (unused import/param only) |
| **Platform / admin / legacy** | 26 | Admin, audit, model registry, settings, legacy chat, providers, etc. |

### Recently resolved (post router verification — not in current error set)

| File | Issue | Resolution |
|------|-------|------------|
| `usage/ai-cost-rate.service.ts` | Wrong repo: `getAiModelRepository().findById(providerId)` → no `providerKey` on `AiModel` | Switched to `getAiProviderRepository().findById()` |
| `orchestrator/ai-orchestrator.service.ts` | `attachTrace()` assigned `usage: undefined` | Conditional assignment only when `costUsd != null` |

---

## Detailed error register

### P0 — Critical

| File | Line | Code | Issue | Root cause |
|------|-----:|------|-------|------------|
| `admin/ai-settings-admin.service.ts` | 2–3 | TS2300 | Duplicate `createAuditLog` import | Copy-paste duplicate line |
| `ai.service.ts` | 7 | TS2305 | `AiRepositoryInterface` not exported from `ai.repository.ts` | Repository refactored to customer/livestock guard only; interface removed |
| `legacy/.../admin-ai-compliance-service.ts` | 5 | TS2307 | Cannot find `ai-compliance.types.js` | Import path depth wrong (`../../../modules` → resolves under `legacy/`, not `src/modules`) |

### P1 — High (`exactOptionalPropertyTypes` & type mismatches)

| File | Line | Code | Issue | Offending property | Router? |
|------|-----:|------|-------|-------------------|---------|
| `foundation/ai-scope.util.ts` | 24 | TS2375 | Early return assigns `tenantId`/`branchId` as `undefined` | `tenantId`, `branchId` | **Yes** |
| `failover/ai-failover.service.ts` | 29 | TS2375 | `route.hops[n]` is `RouteHop \| undefined` assigned to `primary?` | `primary`, `secondary`, `tertiary` | **Yes** |
| `audit/ai-platform-audit.service.ts` | 45, 63, 75 | TS2379 | `actorUserId: row.actorUserId ?? undefined` | `actorUserId` | No |
| `admin/ai-registry-admin.service.ts` | 153 | TS2379 | Passes `{ scopeKey, providerId }` with explicit `undefined` | `scopeKey`, `providerId` | No |
| `models/ai-model-registry.service.ts` | 113 | TS2379 | `logModelAudit` passes `actorRole: actor.role` when `role?` | `actorRole` | No |
| `models/ai-model-registry.service.ts` | 375 | TS2379 | Zod-inferred rates spread into `UpdateModelRatesInput` with `undefined` optional keys | `cachedInputCostPerToken`, etc. | No |
| `settings/ai-settings.service.ts` | 174 | TS2322 | `Record<string, unknown>` → Prisma `InputJsonValue` | `settingsJson` | No |
| `ai.service.ts` | 79 | TS2741 | `omitUndefined` return missing `messageId` | `messageId` | No |

### P2 — Medium (legacy & admin contracts)

| File | Line | Code | Issue | Root cause |
|------|-----:|------|-------|------------|
| `admin/ai-registry-admin.service.ts` | 173 | TS2322 | `role: undefined` passed to `toggleModel` actor | Explicit undefined vs optional |
| `ai.service.ts` | 7, 79 | — | Entire legacy chat stack | `AiRepository` lacks conversation CRUD; `addMessage` return typed as `any` → `StripUndefined` drops `messageId` |

### P3 — Low (unused symbols — `noUnusedLocals` / `noUnusedParameters`)

| File | Symbol |
|------|--------|
| `analytics/ai-analytics.service.ts` | `getAiAuditService` |
| `budget/ai-budget.service.ts` | `logAiExecution` |
| `compliance/ai-compliance.service.ts` | `AiComplianceRulesConfig` |
| `governance/ai-governance.redis.ts` | `config` param |
| `marketplace/external-model.service.ts` | `scopeKey` param |
| `platform/ai-platform-admin.service.ts` | `decimalToNumber` |
| `providers/core/ai-provider.interface.ts` | `AiProviderKey` type |
| `providers/implementations/anthropic.provider.ts` | `AiProviderNotConfiguredError` |
| `providers/provider-factory.ts` | `AiProviderKey` |
| `providers/provider-registry.ts` | `AiProviderKey` |
| `repositories/ai-platform.repository.ts` | `Prisma` type |
| `router/ai-router-engine.service.ts` | `AiCompletionInput` import; `request` param in `tryRulesFallback` |
| `symptom-checker/symptom-checker.service.ts` | `getAiOrchestratorService` |

---

## Root cause analysis

### 1. `exactOptionalPropertyTypes` violations (dominant — 9 errors)

**Mechanism:** With `exactOptionalPropertyTypes: true`, a property declared as `foo?: string` accepts **omission** or **`string`**, but **not** `undefined` as a value.

**Anti-patterns observed:**

```typescript
// BAD — assigns undefined to optional keys
return { scopeKey, tenantId: input.tenantId, branchId: input.branchId };

// BAD — nullish coalesce to undefined
actorUserId: row.actorUserId ?? undefined

// GOOD — omit or conditional spread (already used elsewhere)
return { scopeKey, ...(input.tenantId ? { tenantId: input.tenantId } : {}) };
```

**Affected surfaces:** foundation scope (router), failover tier map (router), audit event assembly, model registry audit, admin list filters, Zod → service DTO handoff.

**Architectural fix:** Standardize on existing shared helpers:

- `omitUndefined()` / `omitUndefinedDeep()` — `src/shared/types/object.utils.ts`
- `setIfDefined()` — conditional assignment
- **`pickDefined()`** (new, recommended) — typed builder for optional DTO fields used in audit/scope/admin

Do **not** widen optional types to `string | undefined` globally — that erases the safety `exactOptionalPropertyTypes` provides.

### 2. Duplicate imports

**File:** `admin/ai-settings-admin.service.ts` — identical `createAuditLog` import on lines 2–3.

**Root cause:** Merge artifact. Blocks compilation entirely (TS2300).

### 3. Unused imports & parameters

**Mechanism:** `noUnusedLocals` and `noUnusedParameters` are enabled project-wide.

**Root cause:** Phase 2–4 rapid iteration left dead imports (provider key types, orchestrator hooks). Low risk individually; collectively prevent clean `tsc`.

**Architectural fix:** Add `npm run typecheck:ai` gate; optional ESLint `@typescript-eslint/no-unused-vars` aligned with compiler.

### 4. Invalid repository usage

| Status | Location | Issue |
|--------|----------|-------|
| **Fixed** | `usage/ai-cost-rate.service.ts` | Model repo used for provider lookup |
| **Latent risk** | Any code calling `getAiModelRepository().findById` expecting `AiProvider` fields | Needs grep audit in remediation |

**Architectural fix:** Split repository interfaces are correct (`AiProviderRepository` vs `AiModelRepository`); add JSDoc on `findById` return types and a thin **`resolveProviderKey(providerId)`** helper to prevent recurrence.

### 5. Type mismatches & DTO inconsistencies

| Area | Issue | Fix direction |
|------|-------|---------------|
| **Settings JSON** | `Record<string, unknown>` not assignable to `InputJsonValue` | Route through `toInputJson()` (`shared/database/prisma-json.ts`) — already used in model registry |
| **Model rates** | Zod `updateModelRatesSchema` infers `prop?: T \| undefined`; service expects `prop?: T` | Map with `omitUndefined(input)` before `updateRates()` |
| **Chat response** | `StripUndefined` removes `messageId` when inferred as `any` | Type `addMessage` return; avoid `any`; or build response without stripping required keys |

### 6. Optional field violations (audit & admin)

**Audit event typing:**

- `AiAuditEvent.actorUserId?: string` — builders use `?? undefined`
- `CreateAuditLogOptions.actorRole?: string` — `logModelAudit` passes `actor.role` from `{ id, role? }`

**Admin settings typing:**

- `toggleModel` actor `{ id, role: undefined }` — violates actor contract

**Architectural fix:** Introduce **`buildAiAuditEvent()`** and **`toAuditActor(actor?: Partial<AiAdminActor>)`** factories that only spread defined fields.

### 7. Legacy AI service compatibility

**Current state:**

| Component | Expected | Actual |
|-----------|----------|--------|
| `ai.service.ts` | Full conversation CRUD via `AiRepositoryInterface` | Interface not exported; methods not on `AiRepository` |
| `ai.repository.ts` | Conversation persistence | Customer/livestock authorization helpers only |
| `ai.service.chat()` | Returns `ChatResponse` with `messageId` | Placeholder AI; repository methods likely runtime failures |

**Assessment:** Legacy module is **orphaned** from Phase 1 foundation work. Not on router path (`AiFoundationService` / orchestrator used instead).

**Architectural options (pick one in Phase TS-3):**

| Option | Effort | Recommendation |
|--------|--------|----------------|
| A. Restore `AiRepositoryInterface` + Prisma conversation repo | High | Only if mobile chat still calls `/api/ai` legacy routes |
| B. Deprecate `AiService`; route to `AiFoundationService` | Medium | **Preferred** if legacy routes unused |
| C. Exclude `ai.service.ts` from compile until deletion | Low | Staging stopgap only |

### 8. Admin AI settings typing

| File | Issue |
|------|-------|
| `ai-settings-admin.service.ts` | Duplicate import (P0) |
| `ai-settings.service.ts` | Prisma JSON typing at upsert boundary |

**Downstream:** Admin BFF proxies settings mutations — type errors don't break runtime today but block production `tsc` CI.

### 9. Compliance module resolution (legacy boundary)

**File:** `src/legacy/web/lib/admin-legal/admin-ai-compliance-service.ts`  
**Wrong path:** `../../../modules/ai/compliance/ai-compliance.types.js`  
**Correct path:** `../../../../modules/ai/compliance/ai-compliance.types.js`

Types file **exists** at `src/modules/ai/compliance/ai-compliance.types.ts`. This is a path bug, not a missing module.

---

## Architectural remediation themes

### Theme A — Optional property builders (platform-wide for AI)

Create `src/modules/ai/shared/optional-props.util.ts` (or extend `shared/types/object.utils.ts`):

| Helper | Purpose |
|--------|---------|
| `pickDefined(obj)` | Strip undefined keys with preserved types |
| `buildScopeResult(input)` | Single canonical scope resolver return type |
| `buildAuditPayload(partial)` | Audit log + `AiAuditEvent` assembly |
| `buildFailoverTiers(hops[])` | Safe primary/secondary/tertiary without undefined values |

**Adoption order:** scope util → audit → admin → model registry.

### Theme B — Boundary typing discipline

| Boundary | Rule |
|----------|------|
| Zod → Service | Always `omitUndefined(parsed)` at route handler or service entry |
| Service → Prisma | JSON via `toInputJson` / `toNullableInputJson` |
| Service → API DTO | Explicit mapper functions (`toAdminDto` pattern from model registry) |
| DB null → optional field | Map `null` to **omit**, not `undefined` |

### Theme C — Repository contract clarity

- Document `AiProviderRepository.findById` vs `AiModelRepository.findById` in `ai-platform.repository.ts` header
- Add compile-time test or lint rule: never access `.providerKey` on `AiModel` without join
- Consider typed **`AiModelWithProvider`** for rate bootstrap queries (single join query)

### Theme D — Legacy isolation

- Mark `ai.service.ts`, `ai.repository.ts` (conversation stubs) with `@deprecated`
- Verify route registration in `ai.routes.ts` / `ai.controller.ts` — if unused, move to `_archived` exclude pattern (same as auth archived modules)
- Align with Phase 4.6 orchestrator legacy path removal

### Theme E — CI enforcement

```json
// package.json script (proposed)
"typecheck:ai": "tsc --noEmit -p tsconfig.json 2>&1 | rg \"src/modules/ai/|admin-ai-compliance\" && exit 1 || exit 0"
```

Add to PR checks for any PR touching `src/modules/ai/**`.

---

## Remediation roadmap

### Phase TS-0 — Unblock compile (0.5 day)

**Goal:** P0 errors → 0

| Task | File(s) | Action |
|------|---------|--------|
| TS-0.1 | `ai-settings-admin.service.ts` | Remove duplicate `createAuditLog` import |
| TS-0.2 | `admin-ai-compliance-service.ts` | Fix import path depth to `../../../../modules/ai/...` |
| TS-0.3 | `ai-registry-admin.service.ts:173` | Pass `{ id: actorUserId }` only — omit `role` when unknown |

**Exit criteria:** 3 fewer errors; no TS2300/TS2307 in AI scope.

### Phase TS-1 — Router hot path (0.5 day)

**Goal:** Router-related P1 → 0

| Task | File(s) | Action |
|------|---------|--------|
| TS-1.1 | `ai-scope.util.ts:24-28` | Use conditional spread for `tenantId`/`branchId` (match lines 36-40 pattern) |
| TS-1.2 | `ai-failover.service.ts:29-33` | Build tiers with conditional spreads or `pickDefined` |
| TS-1.3 | `ai-router-engine.service.ts` | Remove unused `AiCompletionInput` import; prefix `_request` or omit unused param |

**Exit criteria:** 0 router-path `tsc` errors; router tests still 196+ pass.

### Phase TS-2 — Audit & admin optional props (1 day)

**Goal:** P1 audit/admin cluster → 0

| Task | File(s) | Action |
|------|---------|--------|
| TS-2.1 | `ai-platform-audit.service.ts` | Replace `?? undefined` with conditional spread for optional fields |
| TS-2.2 | `ai-model-registry.service.ts:113` | `logModelAudit` — only include `actorRole` when defined |
| TS-2.3 | `ai-registry-admin.service.ts:153` | `listModels(omitUndefined({ scopeKey, providerId }))` |
| TS-2.4 | `ai-model-registry.service.ts:375` | `omitUndefined(input)` before `updateRates()` |
| TS-2.5 | `ai-settings.service.ts:174` | `settingsJson: toInputJson(params.settingsJson)` |

**Exit criteria:** 0 TS2379/TS2375 in audit, registry, settings.

### Phase TS-3 — Legacy AI service decision (1–2 days)

**Goal:** Resolve P1/P2 `ai.service.ts` cluster

| Task | Action |
|------|--------|
| TS-3.1 | Audit route usage: grep for `AiService`, `getAiService`, legacy chat endpoints |
| TS-3.2a | **If unused:** deprecate + exclude from `tsconfig` or delete |
| TS-3.2b | **If used:** re-export `AiRepositoryInterface`; implement conversation methods on `AiRepository` |
| TS-3.3 | Fix `ChatResponse` builder — explicit typed object, no `StripUndefined` on required keys |

**Exit criteria:** No TS2305/TS2741 from legacy chat module.

### Phase TS-4 — Hygiene sweep (0.5 day)

**Goal:** P3 → 0

| Task | Action |
|------|--------|
| TS-4.1 | Remove all unused imports/parameters listed in P3 register |
| TS-4.2 | Remove unused `Prisma` type import in `ai-platform.repository.ts` |
| TS-4.3 | Run `tsc --noEmit` — confirm **0 AI-module errors** |

### Phase TS-5 — Guardrails (0.5 day)

**Goal:** Prevent regression

| Task | Action |
|------|--------|
| TS-5.1 | Add `typecheck:ai` npm script + CI job |
| TS-5.2 | Document optional-property pattern in `src/modules/ai/AGENTS.md` (or module README) |
| TS-5.3 | Add `optional-props.util.ts` with `pickDefined` + unit tests |
| TS-5.4 | Update `docs/reports/ai-router-verification.md` § operational checklist with typecheck gate |

**Exit criteria:** CI fails on new AI `tsc` errors; documentation linked from Phase 4 plan.

---

## Effort & sequencing

| Phase | Duration | Errors resolved | Depends on |
|-------|----------|-----------------|------------|
| TS-0 | 0.5 d | ~4 | — |
| TS-1 | 0.5 d | ~4 | TS-0 |
| TS-2 | 1 d | ~8 | TS-0 |
| TS-3 | 1–2 d | ~2 | Product decision |
| TS-4 | 0.5 d | ~11 | TS-1, TS-2 |
| TS-5 | 0.5 d | regression guard | TS-4 |

**Total estimate:** 3.5–4.5 engineering days

**Recommended order:** TS-0 → TS-1 → TS-2 → TS-4 → TS-5 → TS-3 (legacy decision can parallel TS-2 after TS-0)

---

## Acceptance criteria

| Criterion | Target | Status |
|-----------|--------|--------|
| `npx tsc --noEmit` AI filter | **0 errors** | **Pass** (2026-05-31) |
| `npx vitest run src/modules/ai` | **≥196 pass**, 0 fail | **Pass** (196/196) |
| Router hot path | 0 `exactOptionalPropertyTypes` errors in scope/failover/orchestrator | **Pass** |
| No new `any` wideners | Fixes use omit/spread, not type weakening | **Pass** |
| CI | `typecheck:ai` required on AI PRs | **Partial** — script added; CI wiring pending |
| Documentation | This plan marked implemented | **Done** — see `docs/reports/ai-typescript-stability-report.md` |

---

## Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Legacy `AiService` still used in production | TS-3 wrong choice breaks chat | TS-3.1 route audit before delete |
| `omitUndefined` + `any` interaction | Required keys dropped from inferred types | Ban `any` on IDs; explicit return types |
| Prisma JSON too permissive after `toInputJson` | Invalid shapes persisted | Keep Zod validation before upsert |
| Fixing only router path | 26 errors remain; CI still red | Follow full roadmap through TS-4 |

---

## Appendix A — File heat map

| Directory | Error count | Priority |
|-----------|------------:|----------|
| `admin/` | 4 | P0–P1 |
| `audit/` | 3 | P1 |
| `models/` | 2 | P1 |
| `foundation/` | 1 | P1 (router) |
| `failover/` | 1 | P1 (router) |
| `router/` | 2 | P3 |
| `settings/` | 1 | P1 |
| `ai.service.ts` + repo | 2 | P2 |
| `providers/` | 4 | P3 |
| Other (single each) | 6 | P3 |
| Legacy compliance | 1 | P0 |

---

## Appendix B — Relationship to Phase 4 router

| Router concern | TypeScript status |
|----------------|-------------------|
| Route resolution (`AIRouterService`) | **Clean** |
| Engine execution (`AiRouterEngine`) | **Clean** |
| Scope resolution | **Clean** (TS-1) |
| Failover tier helper | **Clean** (TS-1) |
| Cost gate (`CostGateEngine`) | **Clean** |
| Orchestrator trace attachment | **Clean** |

---

## Sign-off

| Role | Verdict |
|------|---------|
| Principal TypeScript Architecture Auditor | **Plan approved** |
| Senior TypeScript Platform Engineer | **TS-0–TS-4 complete** — AI module compile-clean; TS-5 CI guardrails remain |

**Next action:** TS-5 — add `typecheck:ai` npm script + CI job; optional `pickDefined` helper.
