# P0 BLOCKER-3 — Redis Production Readiness Report

**Date:** 2026-05-30  
**Objective:** Production-grade Redis readiness  
**Status:** **RESOLVED**

---

## Executive summary

Redis is **required in production and staging**. Startup now fails fast when `REDIS_ENABLED=false` in those environments, when Redis is enabled but the client failed to initialize, or when the PING/write probe fails in strict mode. The `/health/redis` endpoint exposes a full feature backend map for operators. Graceful degradation behavior is documented for development and partial-outage scenarios.

---

## 1. Redis usage audit

### Core infrastructure

| Component | File | Redis role |
|-----------|------|------------|
| Client | `src/infra/redis/redis.client.ts` | ioredis lifecycle, PING, reconnect on `ECONNRESET`/`ECONNREFUSED`/`READONLY` |
| Health probe | `src/infra/redis/redis.health.ts` | PING + write/read probe, feature map |
| Cache layer | `src/infra/cache/cache.service.ts` | JSON cache (`{prefix}cache:*`) |
| Queues | `src/infra/queue/queue.service.ts` | BullMQ (`{prefix}queue:*`) |

### Security & auth

| Component | File | Redis role |
|-----------|------|------------|
| Rate limits | `src/shared/security/rate-limit/rate-limit.service.ts` | Sorted-set sliding windows (`{prefix}rl:*`) |
| Safe middleware | `src/shared/security/rate-limit/safe-rate-limit.ts` | Fail-closed 503 in prod/staging when unavailable |
| Sessions | `src/shared/security/session/session.storage.ts` | Session + refresh token keys |
| Audit | `src/shared/security/audit/audit.service.ts` | Audit log storage |
| OTP (prepared) | `src/modules/auth/otp/redis-otp.store.ts` | Not wired — live OTP uses PostgreSQL |

### AI platform

| Component | File | Redis role | Notes |
|-----------|------|------------|-------|
| AI rate limiting | `rate-limit.service.ts` + AI routes | Redis | HTTP: fail-closed prod; orchestrator: fail-open |
| Governance sync | `src/modules/ai/governance/ai-governance.redis.ts` | Cache + pub/sub | PG is source of truth |
| Usage counters | `src/modules/ai/usage/ai-usage.service.ts` | **PostgreSQL** | Not Redis-backed |
| Budget tracking | `src/modules/ai/budget/ai-budget.service.ts` | **PostgreSQL** | Not Redis-backed |
| Health monitoring | `src/api/health/health.service.ts` | Probe target | Prometheus `pranidoctor_redis_up` |

### Other consumers

| Component | Redis role | Degrades? |
|-----------|------------|-----------|
| Area cache | Geographic hierarchy cache | Yes → DB fallback |
| Worker (`src/worker.ts`) | BullMQ + governance | Requires Redis (now gated) |

---

## 2. Feature verification

### AI rate limiting

- **HTTP routes** (`ai.routes.ts`, `voice-assistant.routes.ts`): `whenRateLimitAvailable` → **503** in production/staging when Redis down.
- **Orchestrator** (`checkRateLimit`): fail-open when Redis unavailable (allows request; separate from HTTP middleware policy).
- **Health signal:** `details.rateLimitBackend` = `available` | `unavailable`.

### Governance sync

- **With Redis:** PostgreSQL persist → Redis cache → pub/sub fan-out (`ai:governance:events`).
- **Without Redis:** PostgreSQL poll every `AI_GOVERNANCE_POLL_INTERVAL_MS` (default 45s).
- **Health signal:** `details.governanceSync` = `pubsub` | `poll-only` | `unavailable`.

### Usage counters & budget tracking

- **Confirmed PostgreSQL-only** — no Redis dependency.
- Health probe reports `features.usageCounters: postgres` and `features.budgetTracking: postgres` regardless of Redis state.

### Health monitoring

- `GET /health/redis` — enhanced with probe details (see §4).
- `GET /ready` — Redis must be `healthy` when enabled.
- Prometheus: `pranidoctor_redis_up`, `pranidoctor_redis_probe_latency_ms`.

---

## 3. Startup validation (production gate)

### Layers (defense in depth)

| Layer | When | Behavior |
|-------|------|----------|
| `env.validation.ts` | `loadConfig()` | **Fail** if `REDIS_ENABLED=false` in production **or staging** |
| `config.schema.ts` | Zod refine | **Fail** if `redis.enabled=false` in production |
| `startup-validation.ts` | Post-init boot | **Fail** if production + disabled; **Fail** if enabled but not initialized; **PING + write probe** when initialized |
| `server.ts` | `createRedisClient` | **Fatal exit** on init failure in production |

### Fixed gap (BLOCKER-3)

**Before:** When `REDIS_ENABLED=true` but client init failed, startup validation reported `healthy: true` with message "Redis disabled".

**After:** Distinct branches:

1. Production + `REDIS_ENABLED=false` → `redis-config` check **FAIL**
2. Enabled + not initialized → **FAIL** (required in prod/staging)
3. Enabled + initialized → `probeRedisHealth()` PING + SET/GET probe

---

## 4. Redis health endpoint

**Route:** `GET /health/redis` (alias: `GET /health/cache`)

### Response shape (enhanced)

```json
{
  "check": {
    "name": "redis",
    "status": "healthy",
    "latency": 2,
    "details": {
      "enabled": true,
      "initialized": true,
      "prefix": "pd:",
      "connected": true,
      "pingLatencyMs": 2,
      "probeWriteOk": true,
      "rateLimitBackend": "available",
      "governanceSync": "pubsub",
      "reconnectSupported": true,
      "features": {
        "aiRateLimit": "redis",
        "governanceSync": "redis",
        "usageCounters": "postgres",
        "budgetTracking": "postgres",
        "sessions": "redis",
        "queues": "redis",
        "areaCache": "redis"
      }
    }
  },
  "timestamp": "2026-05-30T..."
}
```

**Status codes:** 503 when `unhealthy`; 200 when `healthy` or `degraded` (disabled in dev).

---

## 5. Graceful degradation documentation

Operational guide: [`docs/production/redis/graceful-degradation.md`](../production/redis/graceful-degradation.md)

### Quick reference

| Scenario | Server boot | Rate limits | Governance | Sessions | `/ready` |
|----------|-------------|-------------|------------|----------|----------|
| Dev, Redis off | Warn, continue | Skipped | PG poll | Broken | Pass |
| Prod, Redis off | **Fail** | N/A | N/A | N/A | N/A |
| Prod, Redis down at boot | **Fail** | N/A | N/A | N/A | N/A |
| Prod, Redis down at runtime | Running | **503** | PG poll | Errors | **503** |
| Prod, Redis reconnecting | Running | Restored when up | Pub/sub resumes | Restored | Pass when healthy |

---

## 6. Validation results

| Scenario | Test file | Result |
|----------|-----------|--------|
| Redis disabled probe | `redis.health.test.ts` | **PASS** |
| Redis connected (PING + write) | `redis.health.test.ts` | **PASS** |
| Redis unavailable (PING fail) | `redis.health.test.ts` | **PASS** |
| Reconnect policy | `redis.client.test.ts` | **PASS** |
| Production startup gate | `startup-validation.redis.test.ts` | **PASS** |
| Multi-instance governance pub/sub | `ai-governance.redis.test.ts` | **PASS** |
| Full suite | `npm test` | **407/407 PASS** |
| Production build | `npm run build` | **PASS** |

---

## 7. Files changed

| File | Change |
|------|--------|
| `src/infra/redis/redis.health.ts` | New — probe + feature map |
| `src/infra/redis/redis.health.test.ts` | New — connect/unavailable tests |
| `src/infra/redis/redis.client.test.ts` | Reconnect policy test |
| `src/infra/redis/index.ts` | Export health probe |
| `src/shared/config/startup-validation.ts` | Fixed Redis validation branches |
| `src/shared/config/startup-validation.redis.test.ts` | New — startup gate tests |
| `src/shared/config/env.validation.ts` | Staging Redis requirement |
| `src/api/health/health.service.ts` | Enhanced `/health/redis` details |
| `src/worker.ts` | Gate on `isRedisEnabled` |
| `src/modules/ai/governance/ai-governance.redis.test.ts` | Multi-instance sync test |
| `docs/production/redis/graceful-degradation.md` | New — operator guide |

---

## 8. Production checklist

- [ ] Set `REDIS_ENABLED=true` in production `.env`
- [ ] Set `REDIS_URL` to managed Redis (TLS if required)
- [ ] Use consistent `REDIS_PREFIX=pd:` across API + worker replicas
- [ ] Point readiness probe at `GET /ready`
- [ ] Monitor `pranidoctor_redis_up` and alert on sustained `0`
- [ ] Verify startup log shows `[OK] redis` with probe latency

---

## 9. Conclusion

P0 BLOCKER-3 is resolved. Production and staging cannot start with Redis disabled. Redis health is observable via `/health/redis` with per-feature backend visibility. Usage counters and budget tracking correctly remain on PostgreSQL — Redis is required for sessions, rate limits, queues, and real-time governance sync.
