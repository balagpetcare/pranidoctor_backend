# AI Router Engine — Verification Report

**Project:** Prani Doctor  
**Role:** Principal Reliability Engineer  
**Date:** 2026-05-31  
**Scope:** Phase 4 Router Engine (`docs/plans/ai-phase-4-router-engine.md`) — sub-phases 4.0–4.1 + reliability hardening  
**Repositories:** `pranidoctor-backend` (primary), `pranidoctor-web` (admin BFF — routing UI partial)

---

## Executive summary

Phase 4 delivers a **registry-first, modular router** (`AiRouterEngine`) that resolves DB-backed routes, executes provider/model hops with health gating, retries, timeouts, failover rules, and rules-based fallback. The orchestrator and legacy `AIFailoverService` both delegate to this engine.

**Production readiness score: 87 / 100** (staging-ready; production after migration deploy + Phase 4.2–4.6 backlog).

| Dimension | Score | Status |
|-----------|------:|--------|
| Routing | 88 | Pass |
| Failover | 90 | Pass |
| Retry | 84 | Pass (fixes applied) |
| Timeout | 86 | Pass |
| Health monitoring | 89 | Pass |
| Cost optimization | 78 | Partial (pre-hop gate added) |

---

## Verification methodology

1. Static review of `src/modules/ai/router/`, `AIRouterService`, `AIFailoverService`, orchestrator integration, migration `20260608120000_ai_phase4_router_engine`
2. Cross-check vs Phase 4 plan acceptance criteria (4.0–4.1 scope + reliability dimensions)
3. Trace execution path: `AiOrchestratorService.completeViaRouter()` → `AiRouterEngine.executeCompletion()` → engines
4. Automated test execution: `npx vitest run src/modules/ai`
5. Safe remediations applied during audit (see **Fixes applied**)

**Test results (post-fix):** 29 test files, **196 tests passed**, 0 failed.

---

## Dimension results

### 1. Routing — 88 / 100 — Pass

| Check | Result |
|-------|--------|
| `AIRouterService.resolve()` loads route from DB with tenant/branch scope | Pass |
| Provider chain parsed from `providerChainJson`; model selected via `ModelSelector` | Pass |
| Resolved hops include `providerKey`, `modelKey`, enable flags, adapter type | Pass |
| Platform seed route: OpenAI → Gemini → OpenRouter (`GENERAL_CHAT`) | Pass |
| `ModelInvocationAdapter` passes `resolvedModelKey` to provider bridge | Pass |
| Orchestrator primary path: `completeViaRouter()` before legacy adapter chain | Pass |
| Structured logging: `ai_route_resolved`, `ai_router_success` | Pass |
| Capability-based hop filtering at router level | **Not implemented** (Phase 4.2) |
| Legacy `completeViaAdapterChain()` still fallback when router returns null | Partial (Phase 4.6) |

**Evidence:** `ai-router-engine.test.ts` — primary 503 → secondary hop; model key forwarded to adapter.

---

### 2. Failover — 90 / 100 — Pass

| Check | Result |
|-------|--------|
| `FallbackEngine` + `FailoverRuleResolver` map triggers to actions | Pass |
| DB rules: HTTP_429 → NEXT_PROVIDER, HTTP_5XX → RETRY_SAME, TIMEOUT → NEXT_PROVIDER (seed) | Pass |
| Hop advancement on non-retriable / exhausted retries | Pass |
| `RULES_ONLY` action jumps to rules-based provider | Pass |
| `ABORT` action throws `AiFailoverAbortedError` | Pass |
| `fallbackToRules` injects rules hop when not in chain | Pass |
| `AIFailoverService` delegates to `AiRouterEngine` (backward compatible) | Pass |
| Cross-route provider demotion / dynamic chain rewrite | **Not implemented** (Phase 4.4) |

**Evidence:** `ai-failover.test.ts` — primary→secondary→tertiary chain, rules-only on budget, abort on 5xx rule.

---

### 3. Retry — 84 / 100 — Pass

| Check | Result |
|-------|--------|
| Route-level `maxRetries` honored per hop | Pass |
| Exponential backoff via `RetryEngine.delayMs()` | Pass |
| Retriable codes: `provider_5xx`, `rate_limit`, `provider_error` | Pass |
| **Same-hop retry blocked for `timeout`** (Phase 4 policy) | Pass (fix applied) |
| Retry-After from error object / message parsed on retry wait | Pass (fix applied) |
| Retry-After from HTTP response headers on 429 | **Partial** — `parseRetryAfterHeader()` exists; not wired from provider adapters |
| Global 429 coordinator across tenants | **Not implemented** (Phase 4.3) |

**Fix applied:** `RetryEngine.canRetrySameHop()` returns `false` when `errorCode === 'timeout'`. Router calls `extractRetryAfterMs(err)` before `retry.wait()`.

**Evidence:** `ai-router-engine.test.ts` — ETIMEDOUT on primary: 1 attempt then failover; `ai-failover.test.ts` updated to match.

---

### 4. Timeout — 86 / 100 — Pass

| Check | Result |
|-------|--------|
| Per-hop timeout via `TimeoutEngine.run()` + `withTimeout()` | Pass |
| Route budget: `hopTimeoutMs(routeTimeoutMs, elapsedRouteMs)` with 1s floor | Pass |
| Timeout errors classified as `timeout` (ETIMEDOUT, message match) | Pass |
| Timeout → next provider (no same-hop retry) | Pass |
| Seed failover rule `TIMEOUT` → `NEXT_PROVIDER` | Pass |
| End-to-end route deadline propagation to all hops | Partial — budget shrinks per hop; no global cancel token |

**Evidence:** `TimeoutEngine` unit test; timeout failover integration test.

---

### 5. Health monitoring — 89 / 100 — Pass

| Check | Result |
|-------|--------|
| `RouterHealthMonitor` wraps `AIProviderMonitor` (lazy instance — no stale singleton) | Pass |
| Circuit breaker: consecutive failures → `circuit_open` skip | Pass |
| Success/failure recorded per hop with latency | Pass |
| Open-circuit hops skipped before invocation | Pass |
| `rules-based` provider exempt from circuit | Pass |
| `AIHealthService` probes providers; metrics via `ai-usage.metrics` | Pass |
| Automatic provider demotion in route chain | **Not implemented** (Phase 4.4) |
| Admin health dashboard wired to router snapshots | Partial (ops panel exists; not router-specific) |

**Evidence:** `ai-router-engine.test.ts` — 6 failures on openai → gemini only invoked.

---

### 6. Cost optimization — 78 / 100 — Partial

| Check | Result |
|-------|--------|
| Route `maxCostUsd` stored on `AiRoute` and exposed in `ResolvedRoute` | Pass |
| Post-completion cost via `AiCostRateService.estimateCostUsd()` in `executeCompletion` | Pass |
| **Pre-hop budget gate** skips hops exceeding `maxCostUsd` estimate | Pass (fix applied) |
| Token estimate from prompt text (`CostGateEngine.estimateInputTokensFromText`) | Pass |
| Registry rate versions used for estimates | Pass (via cost rate service) |
| Cost-aware hop **reordering** (cheapest capable model first) | **Not implemented** |
| Capability + cost joint optimization | **Not implemented** (Phase 4.2) |
| Budget exceeded → `RULES_ONLY` failover rule | Pass (existing rule resolver) |

**Fix applied:** New `CostGateEngine` + `evaluateHopSkip()` budget check when `scopeKey`, `estimatedInputTokens`, and `maxCostUsd` are present.

**Evidence:** `ai-router-engine.test.ts` — openai skipped (`budget_exceeded`), gemini succeeds.

---

## Module inventory

```
src/modules/ai/router/
├── ai-router-engine.service.ts      # Orchestrates hop loop + executeCompletion
├── adapters/
│   ├── provider-adapter.factory.ts
│   └── model-invocation.adapter.ts
└── engines/
    ├── timeout.engine.ts
    ├── retry.engine.ts
    ├── fallback.engine.ts
    ├── health-monitor.service.ts
    └── cost-gate.engine.ts          # Added during verification
```

**Integration points**

| Consumer | Path |
|----------|------|
| `AiOrchestratorService` | `completeViaRouter()` → `executeCompletion()` |
| `AIFailoverService` | `execute()` → `AiRouterEngine.execute()` |
| `AIRouterService` | Route resolution (DB chain + model selection) |

---

## Fixes applied (this audit)

| # | Issue | Fix | Risk |
|---|-------|-----|------|
| 1 | `timeout` retried on same hop despite Phase 4 policy | `RetryEngine.canRetrySameHop()` excludes `timeout` | Low |
| 2 | `maxCostUsd` stored but never enforced pre-hop | `CostGateEngine` + skip in `evaluateHopSkip()` | Low |
| 3 | Retry-After not passed to backoff wait | `extractRetryAfterMs()` wired in router retry path | Low |
| 4 | Failover test assumed 3 timeout retries | Updated to expect 1 attempt + failover | Test only |
| 5 | New reliability tests | timeout failover, cost skip, CostGate unit | Test only |

---

## Known gaps (backlog)

| Priority | Gap | Phase |
|----------|-----|-------|
| P1 | Wire HTTP `Retry-After` header from provider responses into retry wait | 4.3 |
| P1 | Capability filter in hop selection | 4.2 |
| P2 | Cost-aware hop reordering (not just skip) | 4.2 |
| P2 | Remove legacy orchestrator adapter chain in production | 4.6 |
| P3 | Admin route preview + routing dashboard | 4.5 |
| P3 | Dynamic provider demotion in route chain | 4.4 |

---

## Operational checklist

- [ ] Deploy migration `20260608120000_ai_phase4_router_engine` (`npx prisma migrate deploy`)
- [ ] Confirm platform `GENERAL_CHAT` route hops match enabled providers in vault
- [ ] Set route `maxCostUsd` where budget enforcement is required
- [ ] Monitor `ai_router_attempt_failed` and circuit metrics after cutover
- [ ] Phase 4.6: disable legacy adapter chain fallback once router SLO met

---

## Sign-off

| Role | Verdict |
|------|---------|
| Principal Reliability Engineer | **Approve for staging** — router core reliable; cost/retry hardening applied |
| Blockers for production | Migration deploy + validate live provider keys on seeded route |

**Overall score: 87 / 100**
