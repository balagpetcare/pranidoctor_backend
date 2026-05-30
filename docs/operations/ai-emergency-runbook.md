# AI Emergency Runbook

Use when external LLM providers fail, costs spike, safety incidents occur, or AI behavior must stop immediately.

## 1. Emergency disable (preferred order)

### A. Admin panel (persists to PostgreSQL)

1. Open **Admin → AI Ops → Governance**.
2. Set **Disable LLM (global)** with reason (min 10 characters in production).
3. Optionally disable individual **features** or **providers**.
4. Confirm `/health/ai` shows `llmDisabled: true` and expected `scopes`.

### B. Internal API (break-glass)

```http
POST /api/admin/ai-ops/kill-switch
x-internal-admin-token: <INTERNAL_ADMIN_AI_OPS_TOKEN>
Content-Type: application/json

{ "disable": true }
```

Persists like admin governance. Can re-enable in production without `SUPER_ADMIN` when using `internal_api` source (rotate token; restrict network).

### C. Deployment env override (does not persist)

```bash
kubectl set env deployment/pranidoctor-api AI_LLM_DISABLED=true
```

Forces rules-only on **next process start**. When admin UI is available, also toggle in governance so PostgreSQL reflects incident state.

## 2. What stays online

| Still works | Stopped |
|-------------|---------|
| Rules-based chat / voice replies | OpenAI / Anthropic API calls |
| Symptom check (deterministic) | LLM farm briefing/query text |
| Knowledge search, recommendations | Disabled providers in chain |
| Core app, auth, bookings | — |

Users should see educational/rules-based responses, not 5xx errors.

## 3. Recovery (re-enable)

1. Confirm provider incident resolved and keys valid.
2. **`SUPER_ADMIN`** enables global LLM in admin UI (with documented reason).
3. Re-enable any per-feature/per-provider scopes that were toggled.
4. Smoke test: one `CHAT` and one `FARM_BRIEFING` in staging/canary.
5. Watch `ai_requests_total`, token usage, error rate for 30 minutes.

## 4. Troubleshooting

| Symptom | Check | Action |
|---------|-------|--------|
| Admin shows off, LLM still called on one pod | Replica lag | Wait ≤45s poll; verify Redis pub/sub; rolling restart pod |
| All pods LLM on after disable | Migration missing | Apply migrations; check bootstrap logs |
| Toggle returns 503 | PostgreSQL down | Fix DB; use `AI_LLM_DISABLED` env until DB back |
| Toggle works, Redis warning in logs | Redis publish failed | PG state correct; fix Redis; peers sync on poll |
| `governanceHydrated: false` in `/health/ai` | Bootstrap failed | Fail-closed active; fix Prisma/Redis; restart API |
| Prometheus `ai_llm_disabled` mismatch across pods | Per-pod gauge | Alert on max; compare to PG `AiGovernanceState` |

## 5. Rollback (application)

1. Set `AI_KILL_SWITCH_PERSISTENCE_ENABLED=false` only if directed (legacy in-memory).
2. Keep `AI_LLM_DISABLED=true` during bad deploy window.
3. **Do not drop** `AiGovernanceState` / `AiGovernanceScope` / history tables.

## 6. Audit

All successful toggles → `AiGovernanceStateHistory` + `SYSTEM_CONFIG_CHANGE` foundation audit.

Failed admin attempts → `changeKind: failed_attempt` history rows.

Query recent changes:

```sql
SELECT "changeKind", "scopeType", "scopeId", "llmDisabled", "disabled",
       "actorRole", "reason", "source", "createdAt"
FROM "AiGovernanceStateHistory"
ORDER BY "createdAt" DESC
LIMIT 20;
```

## 7. Contacts

- On-call SRE: follow standard Prani Doctor escalation.
- Document incident ID in governance **reason** field.

See also: [ai-kill-switch.md](./ai-kill-switch.md)
