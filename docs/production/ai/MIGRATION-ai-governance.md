# Migration: AI Governance Kill Switch

**Migration ID:** `20260530160000_ai_governance_kill_switch`

## Apply

```bash
cd pranidoctor-backend
pnpm prisma migrate deploy
```

## Rollback (schema only — preserves data)

If you must roll back the application without removing tables:

1. Deploy previous app build with `AI_KILL_SWITCH_PERSISTENCE_ENABLED=false`.
2. Tables `AiGovernanceState` / `AiGovernanceStateHistory` may remain — they are inert.

Dropping tables in production is **not recommended** during incident response; use the admin kill switch instead.

## Verify

```sql
SELECT "llmDisabled", "version", "updatedAt", "source" FROM "AiGovernanceState" WHERE id = 'global';
```

Expected seed: `llmDisabled = false`, `version >= 1`.
