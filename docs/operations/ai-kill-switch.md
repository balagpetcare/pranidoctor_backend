# AI Kill Switch — Operations Guide

**Status:** Production  
**Backend module:** `src/modules/ai/governance/`  
**Admin UI:** Admin → AI Ops → Governance

## Architecture

| Layer | Role |
|-------|------|
| PostgreSQL `AiGovernanceState` | Global LLM on/off (singleton `id = global`) |
| PostgreSQL `AiGovernanceScope` | Per-feature and per-provider disable flags |
| PostgreSQL `AiGovernanceStateHistory` | Append-only audit (global, scope, failed attempts) |
| Redis `{prefix}ai:governance:*` | Cache + pub/sub fan-out across API replicas |
| In-process mirror | Hot-path reads in `AiOrchestratorService` |

### Scopes

| Type | Keys | Effect when disabled |
|------|------|----------------------|
| **Global** | `llmDisabled` | All LLM calls use rules-based provider only |
| **feature** | `CHAT`, `FARM_BRIEFING`, `FARM_QUERY` | That feature uses rules-only |
| **provider** | `openai`, `anthropic` | Provider skipped in fallback chain |

Rules-based assistance is **never** kill-switched (graceful degradation).

### Fail-safe

When persistence is enabled and governance is **not hydrated**:

- Global LLM treated as **disabled**
- Per-provider treated as **blocked** (except rules-based)

Production bootstrap failure also fail-closes to LLM disabled.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_KILL_SWITCH_PERSISTENCE_ENABLED` | `true` | `false` = in-memory only (dev) |
| `AI_LLM_DISABLED` | unset | Emergency rules-only on startup |
| `AI_GOVERNANCE_POLL_INTERVAL_MS` | `45000` | PG/Redis reconciliation |

## Admin API

| Method | Path | Body (additive) |
|--------|------|-----------------|
| GET | `/api/admin/ai-ops/governance` | Returns `{ escalations, governance, history }` |
| POST | `/api/admin/ai-ops/governance` | `{ disable?, reason?, expectedVersion?, scopeUpdates?: [{ scopeType, scopeId, disabled }] }` |

Production: disabling requires reason ≥ 10 chars; enabling global or scope requires `SUPER_ADMIN` (admin UI).

## Migrations

1. `20260530160000_ai_governance_kill_switch`
2. `20260601120000_ai_governance_scopes`

```bash
cd pranidoctor-backend
pnpm prisma migrate deploy
```

## Verification

```bash
pnpm exec vitest run src/modules/ai/governance src/api/health/ai-health.service.test.ts
```

- `/health/ai` → `details.llmDisabled`, `governanceHydrated`, `scopes`, `environment`
- Prometheus: `ai_llm_disabled`

## Caching

- Redis keys have **no TTL** (repopulated from PostgreSQL on poll/bootstrap).
- Toggle: PG commit → Redis SET → PUBLISH → local mirror.
- Missed pub/sub healed within poll interval (default 45s).

## Related

- [ai-emergency-runbook.md](./ai-emergency-runbook.md)
- `docs/production/ai/ai-kill-switch-operations.md`
- `pranidoctor-web/docs/launch/ai-kill-switch-plan.md`
