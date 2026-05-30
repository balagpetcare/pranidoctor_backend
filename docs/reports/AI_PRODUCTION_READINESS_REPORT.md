# AI Production Readiness Report

**Project:** Prani Doctor — LLM AI Platform  
**Role:** Principal QA + DevOps Auditor  
**Date:** 2026-05-30  
**Commit audited:** `3353ff8` (feat(ai): production platform)  
**Verdict:** **NOT PRODUCTION-READY — STOP**

---

## Executive summary

The AI platform **codebase is substantially implemented** and **394/394 automated tests pass**, including dedicated provider validation, failover chain, budget, usage, and governance suites. However, **four production blockers** prevent a production-ready declaration:

1. **`npm run build` fails** (TypeScript errors in legacy admin-auth / Next compat shim).
2. **No LLM API keys configured** in the active environment — live OpenAI and Anthropic connectivity **not verified**.
3. **Redis disabled** (`REDIS_ENABLED=false`) — rate limits and governance hot-path sync are degraded; production requires Redis.
4. **Production migration deploy not evidenced** on target environments (local DB was pending at audit start; applied during this audit only).

Until all blockers are resolved and live provider smoke tests pass, **do not mark production-ready or launch LLM features to farmers at scale**.

---

## Readiness score

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Provider connectivity (live) | 15% | **0 / 15** | No keys; no live probe |
| Failover & orchestration | 15% | **14 / 15** | Unit-tested; fixed chain |
| Cost & token accounting | 10% | **9 / 10** | Unit + verify tests |
| Budget & alerts | 10% | **8 / 10** | Logic tested; DB tables need prod deploy |
| Usage tracking & rollups | 10% | **9 / 10** | Daily OK; monthly needs migration everywhere |
| Governance & kill switch | 10% | **9 / 10** | 23 governance/token tests pass |
| Health checks | 5% | **4 / 5** | `/health/ai` code OK; live not exercised |
| Monitoring | 5% | **4 / 5** | Prometheus wired; verify script stale |
| Logging & security | 5% | **4 / 5** | Structured logs; consent/guardrails exist |
| Build / deploy / docs | 15% | **6 / 15** | Build fails; docs partial |
| **Total** | **100%** | **67 / 100** | **Below GA threshold (≥ 85)** |

**Launch gate:** Requires **≥ 85** and **zero P0 blockers**. Current state: **FAIL**.

---

## Validation matrix

| Check | Result | Evidence |
|-------|--------|----------|
| ✓ OpenAI connectivity | **FAIL (live)** | No `OPENAI_API_KEY` in `.env`; validation logic passes in unit tests only |
| ✓ Anthropic connectivity | **FAIL (live)** | No `ANTHROPIC_API_KEY` in `.env`; validation logic passes in unit tests only |
| ✓ Failover logic | **PASS (simulated)** | `ai-platform.production.test.ts`, `ai-usage-monitoring.verify.test.ts` |
| ✓ Cost calculation | **PASS** | `ai-usage.unit.test.ts`, `estimateAiCostUsd` |
| ✓ Token calculation | **PASS** | `ai-token-tracking.verify.test.ts`, `ai-usage.tokens.unit.test.ts` |
| ✓ Budget limits | **PASS (simulated)** | Budget block → rules fallback in `ai-platform.production.test.ts` |
| ✓ Usage tracking | **PASS** | `ai-usage-monitoring.verify.test.ts` (12 tests) |
| ✓ Governance rules | **PASS** | `ai-governance.service.test.ts` |
| ✓ Kill switch | **PASS (unit)** | Governance service tests; persisted kill switch schema present |
| ✓ Health checks | **PASS (unit)** | `ai-health.service.test.ts` (4 tests) |
| ✓ Monitoring | **PASS (wiring)** | `renderAllPrometheusLines()` → `ai_requests_total`, `ai_provider_up` |
| ✓ Logging | **PASS** | `logAiExecution`, `logAiPlatformEvent` |
| ✓ Security | **PARTIAL** | Consent middleware, guardrails, fail-closed governance; no live pen test |
| ✓ Documentation | **PARTIAL** | Plan + implementation report + OpenAPI; admin UI docs missing |

---

## End-to-end failover simulation

Simulations executed via **Vitest** (mocked providers — no billable live API calls). Results:

### Scenario 1: OpenAI success

```
OpenAI (ok) → response from openai
```

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Chain tries OpenAI first | `openai` | `openai` | **PASS** |
| Usage recorded once | 1 attempt | 1 attempt | **PASS** |

**Test:** `ai-usage-monitoring.verify.test.ts` → *records a successful provider attempt with feature and model labels*

---

### Scenario 2: OpenAI failure → Anthropic success

```
OpenAI (fail) → Anthropic (ok) → response from anthropic
```

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| OpenAI fails | failure recorded | failure recorded | **PASS** |
| Anthropic succeeds | `anthropic` | `anthropic` | **PASS** |

**Test:** `ai-platform.production.test.ts` → *uses Anthropic when OpenAI fails*

---

### Scenario 3: OpenAI failure + Anthropic failure → Rules Engine success

```
OpenAI (fail) → Anthropic (fail) → Rules Engine (ok)
```

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Two LLM failures | ≥ 2 failure records | ≥ 2 | **PASS** |
| Rules fallback | `rules-based` | `rules-based` | **PASS** |
| `isFallback: true` on success | yes | yes | **PASS** |

**Tests:** `ai-platform.production.test.ts` → *falls back OpenAI → Anthropic → rules*; `ai-usage-monitoring.verify.test.ts` → *records failed LLM attempt before fallback success*

---

### Scenario 4: Budget exceeded → Rules Engine (bonus)

| Step | Expected | Actual | Status |
|------|----------|--------|--------|
| Budget blocked | skip LLM chain | `rules-based` | **PASS** |

**Test:** `ai-platform.production.test.ts` → *blocks LLM when budget exceeded*

---

## Automated verification runs

| Command | Result | Detail |
|---------|--------|--------|
| `npm test` | **PASS** | 394/394 tests |
| `npm test -- src/modules/ai src/api/health/ai-health.service.test.ts` | **PASS** | 73/73 AI tests |
| `npm run ai:usage-verify` | **FAIL** | 17/18 — false negative on metrics path (see unresolved) |
| `npm run typecheck` | **FAIL** | 2 errors in legacy `admin-auth` (Next compat) |
| `npm run build` | **FAIL** | Blocked by typecheck |
| `npx prisma migrate status` (after local deploy) | **PASS** | All 59 migrations applied locally |

---

## Environment audit (local `.env`)

| Variable | Present | Production impact |
|----------|---------|-------------------|
| `OPENAI_API_KEY` | **No** | No live OpenAI |
| `ANTHROPIC_API_KEY` | **No** | No live Anthropic |
| `AI_LLM_REQUIRED` | **No** | Startup won't enforce keys in dev |
| `DAILY_AI_BUDGET_USD` | **No** | Budget cap disabled |
| `MONTHLY_AI_BUDGET_USD` | **No** | Budget cap disabled |
| `AI_HEALTH_PROBE_ENABLED` | **No** | Probes off in dev |
| `REDIS_ENABLED` | **`false`** | Rate limits / governance Redis degraded |
| `AI_KILL_SWITCH_PERSISTENCE_ENABLED` | **Not set** | Defaults to enabled in code |

---

## API surface verified (static)

| Endpoint | In OpenAPI | Legacy route file |
|----------|------------|-------------------|
| `GET /api/admin/ai/usage` | Yes | `src/legacy/web/routes/admin/ai/usage/route.ts` |
| `GET /api/admin/ai/costs` | Yes | `.../costs/route.ts` |
| `GET /api/admin/ai/providers` | Yes | `.../providers/route.ts` |
| `GET /api/admin/ai/health` | Yes | `.../health/route.ts` |
| `GET /health/ai` | Yes | `src/api/health/ai-health.service.ts` |

**Admin web UI:** No `pranidoctor-web` pages for `/admin/ai/*` (only existing `/admin/ai-ops/*`). APIs are callable via BFF/curl only.

---

## Monitoring audit

| Signal | Implemented | Exported on `/metrics` |
|--------|-------------|------------------------|
| `ai_requests_total` | Yes | Yes (via `renderAllPrometheusLines`) |
| `ai_tokens_total` | Yes | Yes |
| `ai_cost_usd_total` | Yes | Yes |
| `ai_fallbacks_total` | Yes | Yes |
| `ai_request_duration_seconds` | Yes | Yes |
| `ai_llm_disabled` | Yes | Yes |
| `ai_provider_up` | Yes | Yes |
| `ai_provider_health_probes_total` | Yes | Yes |
| Grafana dashboard | Yes | `docs/monitoring/dashboards/ai-ops.json` |

**Note:** `npm run ai:usage-verify` checks for `renderAiUsagePrometheusLines` in `metrics.routes.ts` directly; wiring is via `renderAllPrometheusLines()` — **script is outdated**, not the runtime.

---

## Security audit (static)

| Control | Status |
|---------|--------|
| Mobile AI consent middleware | Implemented on `/api/ai/*` |
| Input refusal (diagnosis/prescription) | `shouldRefuseUserInput()` |
| Output guardrails | `sanitizeAssistantOutput()` |
| Fail-closed governance (unhydrated → no LLM) | Implemented |
| Kill switch persistence (PG + Redis) | Implemented |
| SUPER_ADMIN for prod LLM re-enable | Implemented |
| Rate limiting (AI_CHAT, AI_CHAT_DAILY) | Implemented — **requires Redis in prod** |
| API keys in logs | Redacted via `sanitizer.ts` |
| Prompt injection layer | **Not implemented** (planned Phase 2+) |

---

## Documentation audit

| Document | Status |
|----------|--------|
| `docs/plans/AI_PRODUCTION_COMPLETION_PLAN.md` | Present |
| `docs/reports/AI_PRODUCTION_IMPLEMENTATION_REPORT.md` | Present |
| `.env.example` / `.env.production.example` | Updated with AI vars |
| `openapi.json` | Admin AI routes documented |
| Kill switch runbook | `docs/operations/ai-kill-switch.md` |
| Admin UI guide for new dashboards | **Missing** |

---

# ⛔ STOP — Production blockers

Do **not** declare production-ready until each item below is **resolved and re-verified**.

## P0 blockers (must fix before launch)

### BLOCKER-1: Production build fails

**Symptom:** `npm run build` exits code 2.

```
src/legacy/web/lib/admin-auth/api-guard.ts(2,10): error TS2305: 
  Module '"next/headers"' has no exported member 'getExpressRequest'.
src/legacy/web/lib/admin-auth/session.ts(1,19): same
```

**Impact:** Cannot ship compiled production artifact; CI/CD gate fails.

**Resolution:** Fix Next compat shim exports or admin-auth imports; re-run `npm run build`.

---

### BLOCKER-2: No live LLM provider connectivity

**Symptom:** `.env` contains **no** `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

**Impact:** All farmer LLM requests degrade to rules-based fallback in any environment using this config. Live connectivity, latency, and vendor billing **unverified**.

**Resolution:**
1. Configure at least one provider key in production secret store.
2. Set `AI_LLM_REQUIRED=true` in production.
3. Run live smoke test: `GET /health/ai` + one `/api/ai/chat/v2` request.
4. Confirm `AiProviderHealthSnapshot` rows with `reachable=true`.

---

### BLOCKER-3: Redis disabled in target environment

**Symptom:** `REDIS_ENABLED=false` in active `.env`.

**Impact:** In production/staging, AI rate limits **fail-closed** (503 `RATE_LIMIT_UNAVAILABLE`); governance Redis cache/pub-sub unavailable; OTP/sessions also affected.

**Resolution:** Enable Redis (`REDIS_ENABLED=true`, valid `REDIS_URL`); verify startup check `[OK] redis`.

---

### BLOCKER-4: Database migration deploy on all environments

**Symptom:** At audit start, `20260602120000_ai_production_platform` was **not applied** (local DB). Applied during this audit session only.

**Impact:** Without migration: monthly rollups, provider health snapshots, usage alerts, and dimension columns on `AiUsageRecord` **fail at runtime**.

**Resolution:** Run `npm run db:migrate:deploy` on staging and production; verify `_prisma_migrations` includes `20260602120000_ai_production_platform`.

---

## P1 issues (high priority, not launch-blocking alone)

| ID | Issue | Risk |
|----|-------|------|
| P1-1 | No admin web UI for `/api/admin/ai/*` | Ops blind without curl/API client |
| P1-2 | `ai:usage-verify` script false-fails metrics wiring | Misleading CI signal |
| P1-3 | Budget env vars unset | Runaway spend possible |
| P1-4 | No live kill-switch drill recorded in last 90 days | GA checklist K4 |
| P1-5 | Prompt injection defense not implemented | Abuse / jailbreak risk |
| P1-6 | Phase 8 seed import path broken (`generated/prisma` vs `src/generated/prisma`) | Dev/staging seed gaps |

---

## Risk assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Silent rules-only degradation (no API keys) | **High** (current env) | High — poor UX, no LLM value | BLOCKER-2 |
| Deploy blocked by TS errors | **High** | High — no release | BLOCKER-1 |
| Rate limit 503 storm without Redis | **High** in prod config | High — AI unavailable | BLOCKER-3 |
| Monthly cost/alert tables missing | Medium (if migrate skipped) | Medium — ops dashboards 500 | BLOCKER-4 |
| Provider outage without circuit breaker | Medium | Medium — latency cascade | Phase 2 circuit breaker |
| Cost rate drift vs vendor pricing | Medium | Low–Medium — budget inaccuracy | Periodic rate review |

---

## Launch recommendation

### **DO NOT LAUNCH** LLM AI to production users

**Recommended path:**

1. Resolve **BLOCKER-1 through BLOCKER-4** (in order).
2. Configure production secrets and budgets.
3. Re-run this audit checklist:
   - `npm run build` → pass
   - `npm test` → pass
   - `npm run db:migrate:deploy` on staging → pass
   - Live `/health/ai` → `healthy` or documented `degraded`
   - Live provider probe → at least one `reachable: true`
   - Admin `GET /api/admin/ai/usage` → 200 with data
4. Conduct kill-switch drill (document in ops log).
5. Target **readiness score ≥ 85** before GA vote.

**Staging recommendation:** May proceed with **rules-based-only** smoke tests after BLOCKER-1 and BLOCKER-4 are fixed, even without LLM keys — but label environment clearly as *LLM-disabled*.

---

## Re-verification checklist (post-fix)

- [ ] `npm run build` exits 0
- [ ] `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` set in production secrets
- [ ] `REDIS_ENABLED=true` on staging/production
- [ ] Migration `20260602120000_ai_production_platform` applied everywhere
- [ ] Live OpenAI completion smoke test (1 request, tokens > 0)
- [ ] Live Anthropic completion smoke test (or documented primary-only)
- [ ] Failover drill: disable OpenAI key temporarily → Anthropic serves
- [ ] `DAILY_AI_BUDGET_USD` and `MONTHLY_AI_BUDGET_USD` set
- [ ] Grafana `ai-ops` dashboard imported and receiving metrics
- [ ] Kill-switch drill completed &lt; 90 days

---

## Document control

| Version | Date | Author | Verdict |
|---------|------|--------|---------|
| 1.0 | 2026-05-30 | QA + DevOps Audit | **NOT PRODUCTION-READY** |

**Related:** `docs/plans/AI_PRODUCTION_COMPLETION_PLAN.md`, `docs/reports/AI_PRODUCTION_IMPLEMENTATION_REPORT.md`
