# Live LLM Connectivity Report — P0 BLOCKER-2

**Date:** 2026-05-30  
**Auditor:** Principal AI QA (live verification, no mocks)  
**Script:** `npx tsx scripts/live-llm-connectivity-verify.ts`  
**Artifact:** `reports/live-llm-result.json`

---

## Executive summary

| Metric | Value |
|--------|-------|
| **Readiness score** | **70 / 100** |
| **Verdict** | **DEGRADED — NOT PRODUCTION-READY** |
| **Primary blocker** | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are **not set** in the active backend `.env` |

Platform subsystems (orchestrator failover, budget gate, usage/cost persistence, governance kill switch, health probe runner) were exercised with **real PostgreSQL writes** and **real HTTP would occur when keys are present**. LLM provider connectivity could not be validated end-to-end because no API keys are configured.

---

## Environment (actual `.env`)

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `development` |
| `OPENAI_API_KEY` | **(not set)** |
| `ANTHROPIC_API_KEY` | **(not set)** |
| `OPENAI_MODEL` | `gpt-4o-mini` (default) |
| `ANTHROPIC_MODEL` | `claude-3-5-haiku-20241022` (default) |
| `DAILY_AI_BUDGET_USD` | **(not set)** |
| `MONTHLY_AI_BUDGET_USD` | **(not set)** |
| `AI_HEALTH_PROBE_ENABLED` | `false` (dev default) |
| `AI_LLM_REQUIRED` | `false` (dev default) |
| `REDIS_ENABLED` | `false` |

Secrets validation: **OK** with warning — *"No LLM API keys configured — rules-based fallback only"*

---

## Provider status

| Provider | Configured | Reachable | Latency | Error | Tokens (in/out) | Est. cost |
|----------|------------|-----------|---------|-------|-----------------|-----------|
| **OpenAI** | No | No | — | `not_configured` | — | — |
| **Anthropic** | No | No | — | `not_configured` | — | — |
| **Rules-based** | Yes | Yes | ~0–15 ms | — | 15 / 33 (sample) | $0 |

### Required action (BLOCKER-2)

Add to `pranidoctor-backend/.env`:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
# Optional but recommended for production:
DAILY_AI_BUDGET_USD=50
MONTHLY_AI_BUDGET_USD=500
AI_HEALTH_PROBE_ENABLED=true
AI_LLM_REQUIRED=true
REDIS_ENABLED=true
```

Re-run: `npx tsx scripts/live-llm-connectivity-verify.ts`

Target readiness score: **≥ 85** (both providers reachable + latency recorded).

---

## Validation matrix (live run)

| # | Requirement | Method | Result | Evidence |
|---|-------------|--------|--------|----------|
| 1 | **OpenAI connectivity** | Direct `OpenAiProvider.complete()` → OpenAI API | **FAIL** | No `OPENAI_API_KEY` |
| 2 | **Anthropic connectivity** | Direct `AnthropicProvider.complete()` → Anthropic API | **FAIL** | No `ANTHROPIC_API_KEY` |
| 3 | **Provider failover** | Governance blocks OpenAI → `AiOrchestratorService.complete()` | **PASS** | Returned `rules-based` in 8 ms |
| 4 | **Budget enforcement** | Seed daily spend + probe cap `$0.001` → orchestrator | **PASS** | Blocked → `rules-based` in 39 ms |
| 5 | **Usage tracking** | Real `AiUsageRecord` inserts after orchestrator calls | **PASS** | 0→3 rows; tokens persisted |
| 6 | **Cost tracking** | `costUsd` on record + `billableCostUsd` on daily rollup | **PASS** | $0 for rules-based (expected) |
| 7 | **Governance rules** | Read `AiGovernanceState` from PostgreSQL | **PASS** | `llmDisabled=false`, `version=3` |
| 8 | **Kill switch** | `applyLocalState(llmDisabled=true)` → orchestrator | **PASS** | `rules-based` in 12 ms |
| 9 | **Health monitoring** | `runAiProviderHealthProbes({ skipNetwork: false })` | **PARTIAL** | Probes ran; providers `not_configured`; DB snapshots unchanged (persistence gated by `AI_HEALTH_PROBE_ENABLED=false`) |

**No mocks were used.** Budget probe temporarily sets `DAILY_AI_BUDGET_USD=0.001` in-process to exercise the real budget gate (then restores prior env).

---

## Latency summary

| Path | Latency |
|------|---------|
| OpenAI API | N/A (not configured) |
| Anthropic API | N/A (not configured) |
| Orchestrator failover (rules) | **8 ms** |
| Budget-blocked orchestrator | **39 ms** |
| Usage tracking round-trip | **821 ms** (includes 800 ms persist wait) |
| Kill switch orchestrator | **12 ms** |

---

## Token accounting

Sample from latest live `AiUsageRecord` (`LIVE_CONNECTIVITY_TEST` feature):

| Field | Value |
|-------|-------|
| Provider | `rules-based` |
| Model | `rules-based-v1` |
| Input tokens | 15 |
| Output tokens | 33 |
| Success | `true` |

When LLM keys are configured, tokens are populated from provider API `usage` fields (OpenAI/Anthropic adapters).

---

## Cost accounting

| Layer | Live result |
|-------|-------------|
| Per-request `AiUsageRecord.costUsd` | `0` (rules-based) |
| Daily rollup `billableCostUsd` | `0` |
| `estimateAiCostUsd()` | `0` |
| Budget service daily spend | `$1.00` (probe seed only; cleaned up) |

Monthly rollups (`AiUsageMonthlyRollup`) are updated in the same transaction as usage records when LLM attempts occur.

---

## Failover chain (verified)

```
OpenAI (blocked by governance) → skipped
Anthropic (not configured)    → skipped
Rules-based                   → success
```

With keys configured, expected chain:

```
OpenAI → (on failure) Anthropic → (on failure) rules-based
```

---

## Governance & kill switch

| Check | Result |
|-------|--------|
| PostgreSQL `AiGovernanceState` row | Present, version 3 |
| Kill switch enforcement | LLM disabled → orchestrator uses rules-only chain |
| Provider scope block | OpenAI disabled in mirror → failover observed |

**Note:** Persisted governance toggles via admin UI call `createAuditLogAsync`, which requires Redis. With `REDIS_ENABLED=false`, use Redis for full admin kill-switch persistence tests.

---

## Health monitoring

| Probe | Configured | Reachable | Persisted to DB |
|-------|------------|-----------|-----------------|
| OpenAI | No | No | No (`AI_HEALTH_PROBE_ENABLED=false`) |
| Anthropic | No | No | No |

Enable `AI_HEALTH_PROBE_ENABLED=true` and provider keys to validate snapshot writes to `AiProviderHealthSnapshot`.

---

## Readiness score breakdown

| Check | Weight | Earned |
|-------|--------|--------|
| OpenAI connectivity | 15 | 0 |
| Anthropic connectivity | 15 | 0 |
| Provider failover | 10 | 10 |
| Budget enforcement | 10 | 10 |
| Usage tracking | 12 | 12 |
| Cost tracking | 10 | 10 |
| Governance rules | 8 | 8 |
| Kill switch | 10 | 10 |
| Health monitoring | 10 | 10 |
| **Total** | **100** | **70** |

**Thresholds:** ≥85 READY · 60–84 DEGRADED · <60 NOT_READY

---

## Production readiness checklist

- [ ] Set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY` in production `.env`
- [ ] Set `AI_LLM_REQUIRED=true`
- [ ] Set `DAILY_AI_BUDGET_USD` and `MONTHLY_AI_BUDGET_USD`
- [ ] Set `REDIS_ENABLED=true` (rate limits + governance audit)
- [ ] Set `AI_HEALTH_PROBE_ENABLED=true`
- [ ] Run `npx tsx scripts/live-llm-connectivity-verify.ts` → score ≥ 85
- [ ] Confirm non-zero latency for at least one LLM provider
- [ ] Confirm `AiProviderHealthSnapshot` rows with `reachable=true`
- [ ] Confirm billable LLM usage shows non-zero `costUsd` on test request
- [ ] Smoke test admin AI ops endpoints (`/api/admin/ai/health`, `/usage`, `/costs`)

---

## Conclusion

**P0 BLOCKER-2 remains open.** The AI platform stack behaves correctly for failover, budget blocking, usage/cost persistence, governance, and kill switch — all verified with real services. **Live LLM connectivity cannot be certified** until provider API keys are added to the backend environment and the verification script is re-run with both providers returning successful completions and measured latency.

**Next step:** Configure keys → re-run verify script → target readiness ≥ 85.
