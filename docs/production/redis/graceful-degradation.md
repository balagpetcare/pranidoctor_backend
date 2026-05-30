# Redis Graceful Degradation

Operational guide for Prani Doctor backend when Redis is disabled, unavailable, or recovering.

## Production requirement

**`REDIS_ENABLED=true` is mandatory** when `NODE_ENV=production` or `NODE_ENV=staging`.

Startup fails at config load (`loadConfig`) and again at `validateStartup` if Redis is disabled in production.

## Feature matrix

| Feature | Backend | Redis required? | When Redis is down |
|---------|---------|-----------------|-------------------|
| AI rate limiting (HTTP) | Redis sorted sets | Yes (prod/staging) | **503** `RATE_LIMIT_UNAVAILABLE` |
| AI rate limiting (orchestrator) | Redis sorted sets | Soft | Fail-open (allows requests) |
| AI governance sync | PG + Redis pub/sub | PG required; Redis optional | Poll-only sync (~45s); toggle rate limit skipped |
| AI usage counters | PostgreSQL | No | Unaffected |
| AI budget tracking | PostgreSQL | No | Unaffected |
| Sessions / refresh tokens | Redis | Yes (prod) | Auth failures |
| BullMQ jobs | Redis | Yes (worker) | Queues not processed |
| Area search cache | Redis → PG fallback | No | DB fallback |
| Audit logs (sync) | Redis | Yes | Write errors |
| OTP (live path) | PostgreSQL | No | Unaffected today |

## Environment behavior

### Development (`REDIS_ENABLED=false`)

- Server starts with warnings.
- Rate limits skipped on HTTP routes.
- Sessions, queues, and cache unavailable.
- `/ready` excludes Redis from required checks.

### Production (`REDIS_ENABLED=true`, Redis unreachable)

- `createRedisClient` failure → **fatal exit**.
- Startup validation PING + write probe failure → **fatal exit**.
- Runtime disconnect → ioredis reconnects on `ECONNRESET`, `ECONNREFUSED`, `READONLY`.
- `/health/redis` → **503 unhealthy** with feature breakdown.
- `/ready` → **503** until Redis is healthy.

## Health probes

| Endpoint | Use |
|----------|-----|
| `GET /health/redis` | PING + write/read probe; feature backend map |
| `GET /health/cache` | Alias of Redis check |
| `GET /ready` | Redis required when enabled |
| `GET /health/dependencies` | Redis row with `required: true` when enabled |

## Multi-instance governance sync

When Redis is healthy, governance changes are:

1. Persisted to PostgreSQL (source of truth).
2. Cached in Redis keys under `{REDIS_PREFIX}ai:governance:*`.
3. Published on `{REDIS_PREFIX}ai:governance:events` for cross-instance fan-out.

Without Redis, instances rely on PostgreSQL polling (`AI_GOVERNANCE_POLL_INTERVAL_MS`, default 45s).

## Operator checklist

- [ ] `REDIS_ENABLED=true` in production/staging `.env`
- [ ] `REDIS_URL` points to managed Redis (not localhost)
- [ ] `REDIS_PREFIX=pd:` set consistently across all API/worker instances
- [ ] K8s/Docker readiness probe uses `/ready` (not `/health`)
- [ ] Alert on `pranidoctor_redis_up == 0` in production
