# MinIO Bootstrap Fix Report

**Date:** 2026-05-30  
**Scope:** `pranidoctor-backend` — MinIO/S3 startup bootstrap failure  
**Status:** ✅ Resolved — backend starts successfully, MinIO bootstrap passes

---

## Summary

The backend failed at startup with:

```
FATAL | MinIO bootstrap failed — MEDIA_STORAGE=s3 requires storage
```

Root cause was **invalid S3 credentials** in `.env`. The MinIO server at `192.168.10.111:9000` uses the default `minioadmin` / `minioadmin` root user, but `.env` was configured with `admin` / `password123`. After correcting credentials and normalizing `S3_ENDPOINT`, bootstrap succeeds and the API starts on port 3000.

---

## Root Cause

| Issue | Detail |
|-------|--------|
| **Primary** | `S3_ACCESS_KEY` / `S3_SECRET_KEY` set to `admin` / `password123` — MinIO rejected with `InvalidAccessKeyId: The Access Key Id you provided does not exist in our records.` |
| **Secondary** | `S3_ENDPOINT=192.168.10.111` (bare hostname, no `http://` scheme). Runtime resolver (`applyResolvedEnv`) corrects this at boot, but raw `.env` values break tools that skip the resolver. |
| **Not the cause** | Network reachability, bucket existence, or missing env vars — all verified OK after credential fix. |

When `MEDIA_STORAGE=s3`, `isMediaStorageRequired()` forces a fatal exit if bootstrap fails (`src/server.ts`). Wrong credentials therefore blocked all startup.

---

## Configuration Inspection

### Code paths (requested paths map to)

| Requested path | Actual location |
|----------------|-----------------|
| `.env` | `pranidoctor-backend/.env` |
| `src/config` | `src/shared/config/` (`load-env.ts`, `env.resolver.ts`, `config.loader.ts`, `infra.flags.ts`) |
| `src/storage` | `src/legacy/web/lib/storage/` + `src/modules/media/storage/` |
| `src/bootstrap` | `src/server.ts` (MinIO bootstrap at lines 103–124), `src/legacy/web/lib/storage/minio-bootstrap.ts` |

### Required environment variables

| Variable | Purpose | Required when |
|----------|---------|---------------|
| `MEDIA_STORAGE=s3` | Hard-requires storage at boot | Always (triggers fatal on bootstrap failure) |
| `STORAGE_DRIVER` / `STORAGE_ENABLED` / `MINIO_ENABLED` | Enable storage subsystem | `s3` driver active |
| `S3_ENDPOINT` or `MINIO_URL` or `MINIO_HOST`+`MINIO_PORT` | S3 API endpoint | Remote storage |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` (or `_ID` / `_ACCESS_KEY` aliases) | Authentication | Remote storage |
| `S3_BUCKET` or `MINIO_BUCKET` | Target bucket | Remote storage |
| `S3_REGION` | AWS SDK region (default `us-east-1`) | Remote storage |
| `S3_FORCE_PATH_STYLE` | Path-style URLs (required for MinIO) | MinIO |
| `MINIO_PUBLIC_URL` | Signed URL base for mobile clients | Uploads/downloads |

Optional: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` (docker-compose only).

### Variables before fix

| Variable | Value (before) | Status |
|----------|----------------|--------|
| `S3_ENDPOINT` | `192.168.10.111` | ⚠ Invalid format (no scheme; resolver patches at runtime) |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `admin` / `password123` | ❌ Wrong — not registered on MinIO server |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `admin` / `password123` | ❌ Mismatch with actual MinIO instance |
| `MINIO_URL` | `http://192.168.10.111:9000` | ✅ Correct |
| `S3_BUCKET` | `pranidoctor-dev` | ✅ Correct |
| `MEDIA_STORAGE` | `s3` | ✅ Correct (strict boot requirement) |

### Variables after fix

| Variable | Value (after) |
|----------|---------------|
| `S3_ENDPOINT` | `http://192.168.10.111:9000` |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | `minioadmin` / `minioadmin` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | `minioadmin` / `minioadmin` |
| `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` | `minioadmin` / `minioadmin` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | `minioadmin` / `minioadmin` |

---

## MinIO Connectivity Verification

| Check | Result |
|-------|--------|
| TCP `192.168.10.111:9000` | ✅ Reachable |
| HTTP `/minio/health/live` | ✅ `200 OK` |
| Credentials `admin/password123` | ❌ `InvalidAccessKeyId` |
| Credentials `minioadmin/minioadmin` | ✅ Authenticated |
| Bucket `pranidoctor-dev` | ✅ Exists (no creation needed) |
| Bootstrap `HeadBucket` | ✅ Success |

---

## Bucket Status

- **Bucket name:** `pranidoctor-dev`
- **Pre-existing:** Yes — bucket already present on LAN MinIO
- **Created during fix:** No (`bucketCreated: false`)
- **Bootstrap behavior:** `minio-bootstrap.ts` runs `HeadBucketCommand`; creates bucket only if missing via `CreateBucketCommand`

---

## Fixes Applied

1. **Updated `.env` S3 credentials** from `admin`/`password123` to `minioadmin`/`minioadmin` to match the MinIO server root user.
2. **Normalized `S3_ENDPOINT`** to full URL `http://192.168.10.111:9000`.
3. **Added `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`** aliases for consistency with `storage-env.ts` fallback chain.
4. **Aligned `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`** with docker-compose defaults (for future local docker use).

No application code changes were required — configuration-only fix.

---

## Verification Results

### `npm run dev` (2026-05-30)

```
[MINIO_CONNECTED] {"endpoint":"http://192.168.10.111:9000","bucket":"pranidoctor-dev"}
INFO | Storage initialized  driver=s3  bucket=pranidoctor-dev  endpoint=http://192.168.10.111:9000  bucketCreated=false
Startup validation:
  [OK] s3 (9ms) [required]
INFO | Startup validation passed
INFO | Server started  port=3000
```

| Criterion | Result |
|-----------|--------|
| Backend starts successfully | ✅ |
| No MinIO bootstrap failure | ✅ |
| `[MINIO_CONNECTED]` logged | ✅ |
| Startup validation S3 check | ✅ `[OK] s3 (9ms)` |
| Server listening on `:3000` | ✅ |

---

## Recommendations

1. **Keep S3 credentials in sync** with the MinIO server's actual root user. If MinIO is redeployed with custom `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`, update all four S3 key vars in `.env`.
2. **Always use full URLs** for `S3_ENDPOINT` (`http://host:port`) to avoid `Invalid URL` errors in scripts that read `.env` without `applyResolvedEnv()`.
3. **Add MinIO to `WAIT_FOR`** for dev: `WAIT_FOR=postgres,redis,minio` in `.env` so `predev` waits for storage before boot (currently only postgres is checked).
4. **Do not commit `.env`** — credentials are local/LAN-specific.

---

## Related Files

- `src/legacy/web/lib/storage/minio-bootstrap.ts` — bucket ensure logic
- `src/legacy/web/lib/storage/storage-env.ts` — env → `StorageEnv` mapping
- `src/shared/config/env.resolver.ts` — URL resolution (`S3_ENDPOINT`, `MINIO_URL`)
- `src/shared/config/infra.flags.ts` — `isMediaStorageRequired()`
- `src/server.ts` — bootstrap orchestration and fatal exit on failure
- `docker-compose.yml` — MinIO service defaults (`minioadmin`/`minioadmin`, bucket init)
