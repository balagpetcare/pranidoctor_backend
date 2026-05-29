# AI Kill Switch — Operations & Recovery

**Status:** Implemented  
**Related:** `pranidoctor_user/docs/production/ai/ai-kill-switch-persistence-plan.md`

## Architecture (runtime)

| Layer | Role |
|-------|------|
| PostgreSQL `AiGovernanceState` | Source of truth (singleton `id = global`) |
| PostgreSQL `AiGovernanceStateHistory` | Append-only audit of every change |
| Redis `{prefix}ai:governance:*` | Runtime cache + pub/sub fan-out |
| In-process mirror | Hot path for `AiOrchestratorService` (no Redis per request) |

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AI_KILL_SWITCH_PERSISTENCE_ENABLED` | `true` | Set `false` to legacy in-memory-only (dev emergency) |
| `AI_LLM_DISABLED` | unset | Emergency override: `true` forces rules-only on startup |
| `AI_GOVERNANCE_POLL_INTERVAL_MS` | `45000` | Background PG/Redis reconciliation interval |

## Migration

Apply additive migration:

```bash
cd pranidoctor-backend
pnpm prisma migrate deploy
# or dev: pnpm prisma migrate dev
```

Migration: `prisma/migrations/20260530160000_ai_governance_kill_switch/migration.sql`

## Admin API (unchanged paths)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/admin/ai-ops/governance` | Returns `{ escalations, governance, history }` |
| POST | `/api/admin/ai-ops/governance` | Body: `{ disable, reason?, expectedVersion? }` |
| POST | `/api/admin/ai-ops/kill-switch` | Body: `{ disable }` — internal token; same persistence |

**Production:** Enabling LLM requires `SUPER_ADMIN`. Disabling requires `reason` (min 10 characters).

## Recovery scenarios

### Redis unavailable

- Reads: local mirror + periodic PostgreSQL poll.
- Writes: PostgreSQL commit succeeds; Redis publish skipped — alert ops; replicas converge on poll.
- Toggle still allowed if PostgreSQL is healthy.

### PostgreSQL unavailable

- Reads: Redis cache if present; else `AI_LLM_DISABLED` env; else last local mirror.
- Writes: **rejected** with `503` — do not toggle until DB is back.

### Full cluster restart

- Each API pod hydrates from PostgreSQL on boot and repairs Redis cache.
- No manual re-toggle required.

### PostgreSQL unavailable at startup (production)

- Hydration order: PostgreSQL → (on failure) Redis cache → `AI_LLM_DISABLED` env → **fail-closed (LLM disabled)** when persistence is enabled.
- Ensures new pods do not silently re-enable LLM during a database outage.

### Emergency disable (admin UI down)

```bash
# Per deployment — forces rules-only on next process start
kubectl set env deployment/pranidoctor-api AI_LLM_DISABLED=true
```

Then disable via admin when UI is available to persist in PostgreSQL.

## Rollback (application)

1. Set `AI_KILL_SWITCH_PERSISTENCE_ENABLED=false` and redeploy previous image if needed.
2. State row remains in PostgreSQL — safe.
3. Do **not** drop history table on app rollback.

## Verification

```bash
cd pranidoctor-backend
pnpm test src/modules/ai/governance
```

Check `/health/ai` → `details.llmDisabled` matches admin governance panel.

Prometheus: `ai_llm_disabled` gauge should match persisted state after toggle.
