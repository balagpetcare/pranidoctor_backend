# Docker Foundation — Prani Doctor Backend

**Status:** Infrastructure services ready · Production API image has known legacy gap (R-001)

---

## Quick start (local infra only)

```bash
# Start PostgreSQL, Redis, MinIO
npm run docker:up

# Validate environment variables (no server boot)
npm run env:validate

# Run API on host (recommended for development — loads legacy .ts routes via tsx)
npm run dev
```

---

## Compose profiles

| Profile | Services | Use case |
|---------|----------|----------|
| **default** | `postgres`, `redis`, `minio`, `minio-init` | Local development |
| **production** | Above + `api` container | Staging/prod smoke test |

```bash
# Infra only (default)
docker compose up -d postgres redis minio

# Full stack including API image
docker compose --profile production up -d
```

---

## Health endpoints (API container or host)

| Path | Purpose |
|------|---------|
| `GET /health` | Aggregate dependency status |
| `GET /ready` | Readiness (DB required; Redis required only when `REDIS_ENABLED=true`) |
| `GET /live` | Liveness |
| `GET /health/db` | PostgreSQL probe |
| `GET /health/redis` | Redis probe (degraded when disabled) |

Docker `HEALTHCHECK` and compose service health use `GET /health`.

---

## Known production gap (R-001) — **BLOCKED under PROJECT_FREEZE**

The production Docker image runs compiled JavaScript from `dist/`:

1. `tsconfig.build.json` **excludes** `src/legacy/**`.
2. Legacy compat routes load `.ts` files dynamically from `src/legacy/web/routes/` at runtime.
3. The production `Dockerfile` copies only `dist/` — not `src/legacy/`.

**Result:** The `api` service can boot and pass `/health`, but **179 legacy `/api/*` routes will not load** in the production container until Phase 4 ships a legacy compile pipeline or bundled artifact.

**Safe workaround (development):**

```bash
npm run docker:up
npm run dev   # tsx loads legacy TypeScript routes on host
```

**Future resolution (Phase 4 — requires explicit unfreeze for build pipeline):**

- Compile legacy routes into `dist/legacy/` **or**
- Bundle compat handlers at build time **without** changing response contracts

---

## Environment variables (Docker network)

When using compose `api` profile, these are injected automatically:

| Variable | Compose value |
|----------|---------------|
| `DB_HOST` | `postgres` |
| `REDIS_HOST` | `redis` |
| `MINIO_HOST` | `minio` |
| `S3_ENDPOINT` | `http://minio:9000` |

Host development should use `.env` with `localhost` endpoints — see `.env.example`.

---

## Worker container

BullMQ worker (`npm run worker`) is **not** included in compose at freeze time (R-020). Run separately when job processors are registered in a future phase.

---

## Related docs

- [PHASE1_PLAN.md](../../pranidoctor-web/docs/PHASE1_PLAN.md) — Backend foundation plan
- [PROJECT_FREEZE.md](../../pranidoctor-web/docs/PROJECT_FREEZE.md) — R-001 debt register
