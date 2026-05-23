# Local Development Setup — Prani Doctor Backend

This guide covers running the API on your host machine with optional Docker infrastructure.

## Quick start (minimal — PostgreSQL only)

Works when you already have PostgreSQL and do not need Redis or file uploads.

```bash
cp .env.example .env
# Edit DATABASE_URL and JWT secrets

npm install
npm run db:migrate   # or: npx prisma migrate deploy
npm run dev
```

Expected startup:

- PostgreSQL: **required** — startup fails if unreachable
- Redis: **optional** when `REDIS_ENABLED=false`
- Storage: **optional** in development — unreachable MinIO/S3 degrades gracefully; uploads return `503 STORAGE_DISABLED`

Verify:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/storage
```

---

## Infrastructure matrix

| Service    | Default in dev | Env toggle              | Startup if unavailable (dev) | Uploads / features        |
|-----------|----------------|-------------------------|------------------------------|---------------------------|
| PostgreSQL | Required       | `DATABASE_URL`          | **Fail**                     | All API features          |
| Redis      | Optional       | `REDIS_ENABLED=false`   | **Continue** (degraded)      | OTP, cache, queues off    |
| MinIO/S3   | Optional       | `STORAGE_ENABLED=false` | **Continue** (degraded)      | Upload routes return 503  |
| Local disk | Alternative    | `STORAGE_DRIVER=local`  | **Continue**                 | Files under `.local-storage` |

---

## Docker Compose services

From the backend repo root:

```bash
# PostgreSQL only (default wait target)
npm run docker:up -- postgres

# PostgreSQL + Redis + MinIO (full local infra)
docker compose up -d postgres redis minio
# minio-init runs once and creates the S3 bucket
```

### Port map

| Service    | Host port | Container |
|-----------|-----------|-----------|
| PostgreSQL | 5432      | postgres  |
| Redis      | 6379      | redis     |
| MinIO API  | 9000      | minio     |
| MinIO UI   | 9001      | minio     |

### MinIO / S3 alignment

These values must match between `.env`, `docker-compose.yml`, and `minio-init`:

| Variable        | Host dev value              | Docker `api` profile value   |
|----------------|-----------------------------|------------------------------|
| `S3_ENDPOINT`  | `http://127.0.0.1:9000`     | `http://minio:9000`          |
| `S3_BUCKET`    | `pranidoctor-dev`           | `pranidoctor-dev`            |
| `S3_ACCESS_KEY`| `minioadmin` (or `S3_ACCESS_KEY_ID`) | same                |
| `S3_SECRET_KEY`| `minioadmin` (or `S3_SECRET_ACCESS_KEY`) | same            |

Recommended driver for local MinIO:

```env
STORAGE_ENABLED=true
STORAGE_DRIVER=minio
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=pranidoctor-dev
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_FORCE_PATH_STYLE=true
```

`STORAGE_DRIVER=s3` also works with the same endpoint and credentials.

---

## Storage options (pick one)

### 1. No uploads (fastest)

```env
STORAGE_ENABLED=false
```

Or:

```env
STORAGE_DRIVER=disabled
```

### 2. Local filesystem (no Docker)

```env
STORAGE_ENABLED=true
STORAGE_DRIVER=local
LOCAL_STORAGE_PATH=./.local-storage
```

### 3. MinIO via Docker

```bash
docker compose up -d minio
# wait for healthy, then:
npm run dev
```

```env
STORAGE_ENABLED=true
STORAGE_DRIVER=minio
S3_ENDPOINT=http://127.0.0.1:9000
S3_BUCKET=pranidoctor-dev
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

### 4. Configured but MinIO not running (auto-degrade)

If `STORAGE_DRIVER` is `s3`/`minio` with credentials but nothing listens on port 9000:

- The API **still starts**
- Startup logs show `[WARN] s3 … connect ECONNREFUSED`
- Runtime switches to disabled storage — uploads fail with `503 STORAGE_DISABLED`
- `/health` overall status: `degraded` (not `unhealthy`)
- `/health/storage` shows `degraded` with endpoint/bucket details

To restore uploads: start MinIO and restart the API.

---

## Redis options

### Without Redis

```env
REDIS_ENABLED=false
```

OTP, session cache, and BullMQ queues are unavailable. Health reports Redis as `degraded`.

### With Redis

```bash
docker compose up -d redis
```

```env
REDIS_ENABLED=true
REDIS_URL=redis://localhost:6379
```

---

## Startup validation

`npm run dev` runs `scripts/wait-for-services.ts` first.

| Env              | Default   | Purpose                          |
|------------------|-----------|----------------------------------|
| `WAIT_FOR`       | `postgres`| Comma list: `postgres,redis,minio` |
| `WAIT_MAX_ATTEMPTS` | `30`   | Retries per service              |
| `WAIT_DELAY_MS`  | `2000`    | Delay between retries            |

Example — wait for all infra before boot:

```env
WAIT_FOR=postgres,redis,minio
```

Skip live probes (not recommended unless you know services are up):

```env
SKIP_STARTUP_VALIDATION=true
```

---

## Health endpoints

| Path                   | Description                                      |
|------------------------|--------------------------------------------------|
| `GET /health`          | Aggregate status (`healthy` / `degraded` / `unhealthy`) |
| `GET /health/db`       | PostgreSQL                                       |
| `GET /health/redis`    | Redis (`degraded` when disabled)                 |
| `GET /health/storage`  | Object storage with driver, bucket, endpoint     |
| `GET /health/dependencies` | Dependency list including storage            |
| `GET /ready`           | Readiness (DB required; Redis if enabled)        |
| `GET /live`            | Liveness                                         |

Storage check example (MinIO down, dev):

```json
{
  "status": "degraded",
  "checks": [
    {
      "name": "storage",
      "status": "degraded",
      "message": "connect ECONNREFUSED 127.0.0.1:9000",
      "details": {
        "driver": "s3",
        "bucket": "pranidoctor-dev",
        "endpoint": "http://127.0.0.1:9000",
        "enabled": true,
        "operational": false
      }
    }
  ]
}
```

After runtime degrade, `/health/storage` reports the degrade reason and `operational: false`.

---

## Common commands

```bash
npm run docker:up          # postgres + redis + minio
npm run env:validate       # validate .env without booting
npm run dev                # wait for postgres → start API with tsx watch
npm run db:seed            # seed data (after migrate)
npm run foundation:verify  # static + unit gates
```

---

## Troubleshooting

### `connect ECONNREFUSED 127.0.0.1:9000`

MinIO is not running. Fix one of:

1. `docker compose up -d minio` and ensure bucket exists (`minio-init` service)
2. Switch to `STORAGE_DRIVER=local`
3. Set `STORAGE_ENABLED=false`
4. Leave as-is — API runs degraded; uploads disabled until MinIO is up

### Startup validation fails on PostgreSQL

Set a valid `DATABASE_URL` in `.env`. Component vars `DB_*` are resolved when `DATABASE_URL` is unset.

### Upload returns 503 `STORAGE_DISABLED`

Storage is disabled, runtime-degraded, or MinIO was unreachable at startup. Check `/health/storage` and startup logs.

### Bucket not found (404 on health)

`minio-init` creates `S3_BUCKET` (default `pranidoctor-dev`). Ensure `S3_BUCKET` in `.env` matches compose:

```bash
docker compose run --rm minio-init
```

---

## Related docs

- [docker/README.md](./docker/README.md) — Compose profiles and production API gap (R-001)
- [.env.example](./.env.example) — All environment variables
