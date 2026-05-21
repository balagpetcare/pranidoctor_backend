# Seed System Discovery — Prani Doctor Backend (`backend-api`)

Analysis date: 2026-05-22  
Scope: read-only inspection of `package.json`, `prisma.config.ts`, `prisma/`, `scripts/`, and seed entrypoints. No implementation changes.

---

## Executive summary

The backend has **one primary Prisma seed** (`prisma/seed.ts`), **three auxiliary seed scripts** (admin-only, demo, demo-reset), and a **standalone area seed command** that shares logic with the main seed. Admin login credentials are **environment-driven** (never hardcoded in the admin-only script). Demo credentials mix **env overrides** with **hardcoded dev defaults**. A legacy `prisma/seed-data/users.ts` / `roles.ts` pair exists but is **not wired** into any npm seed command.

---

## 1. Existing seed command

### Primary command

| npm script | Underlying command | Entry file |
|------------|-------------------|------------|
| `npm run db:seed` | `tsx prisma/seed.ts` | `prisma/seed.ts` |

### Prisma CLI equivalent

Configured in `prisma.config.ts`:

```ts
migrations: {
  path: 'prisma/migrations',
  seed: 'tsx prisma/seed.ts',
},
```

So `npx prisma db seed` runs the same entrypoint as `npm run db:seed`.

### Full bootstrap (infra + migrate + seed)

| npm script | Platform | Flow |
|------------|----------|------|
| `npm run bootstrap` | Bash (`scripts/bootstrap.sh`) | `.env` from `.env.example` → resolve env → Docker (postgres, redis, minio) → wait → minio-init → `prisma migrate deploy` → **`npm run db:seed`** |
| (manual) | PowerShell (`scripts/bootstrap.ps1`) | Same steps; no npm alias — run script directly on Windows |

### Related seed commands (not the “main” seed)

| npm script | Entry file | Purpose |
|------------|------------|---------|
| `npm run db:seed:admin` | `prisma/seed-admin.ts` | Admin user only |
| `npm run db:seed:demo` | `prisma/seed-demo.ts` | Rich dev/demo dataset (doctors, AI techs, customer, SRs, billing) |
| `npm run db:seed:reset-demo` | `prisma/seed-demo-reset.ts` | Deletes demo rows created by `seed-demo.ts` |
| `npm run area:seed` | `scripts/area-seed.ts` | Area-engine geography only (also invoked inside main seed) |

### What `prisma/seed.ts` seeds (idempotent upserts)

1. **Panel admin** — optional, from env (see §4)
2. **Knowledge Hub** — `contentCategory` rows
3. **Service categories** — core + legacy slugs
4. **Area tree (`Area` model)** — Dhaka division sample hierarchy + legacy `bangladesh` placeholder
5. **Geo hierarchy (`Division` → `District` → `Upazila` → `Union` → `Village`)** — Dhaka/Gazipur sample + trim-code upserts
6. **Area engine seed** — `applyAreaEngineSeed()` (BD reference data + engine villages)
7. **Semen reference masters** — providers + cattle breeds
8. **Settings** — `app.name`, `PLATFORM_COMMISSION_RATE`
9. **Optional inline demo** — when `PRANI_SEED_DEMO=true` and not production: one doctor, one AI tech, draft content post

Environment loading: `loadEnvironment()` from `src/shared/config/load-env.js` (`.env` + URL resolution).

### Prisma config notes

- `prisma.config.ts` sets `schema`, `migrations.path`, `migrations.seed`, and `datasource.url` from `DATABASE_URL`.
- `package.json` `"prisma"` block only declares `"schema": "prisma/schema.prisma"` — **seed path lives in `prisma.config.ts`**, not `package.json`.

### Dead / unused seed modules

| File | Status |
|------|--------|
| `prisma/seed-data/roles.ts` | Exports `seedRoles()` — **not imported** by any seed entrypoint |
| `prisma/seed-data/users.ts` | Exports `seedDevUsers()` with `SEED_ADMIN_*` + SHA-256 hashing — **not imported**; schema/API mismatch vs current User model |

---

## 2. Admin bootstrap command

### Dedicated admin seed

| npm script | Command | Entry file |
|------------|---------|------------|
| **`npm run db:seed:admin`** | `tsx prisma/seed-admin.ts` | `prisma/seed-admin.ts` |

### Required environment (strict)

| Variable | Required | Notes |
|----------|----------|-------|
| `ADMIN_SEED_EMAIL` | **Yes** | Normalized to lowercase |
| `ADMIN_SEED_PASSWORD` | **Yes** | Bcrypt cost **12** |
| `ADMIN_SEED_NAME` | No | Default: `"Prani Doctor Admin"` |
| `ADMIN_SEED_PHONE` | No | Stored on `User.phone` if set |

Missing `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` → **throws** and exits non-zero.

### Behavior

- Upserts `User` with role `ADMIN` (preserves existing `SUPER_ADMIN` role on update)
- Upserts `AdminProfile.displayName`
- Skips if email exists with a non-admin role
- Uses `dotenv/config` + `src/lib/prisma` (not `loadEnvironment()`)
- References `docs/ADMIN_CREDENTIAL_SETUP.md` in a comment — **that doc file does not exist** in this repo

### Admin via main seed (alternative path)

`prisma/seed.ts` → `seedPanelAdminFromEnv()` accepts a **wider env alias set** and **skips silently** if email/password unset:

| Priority | Email vars | Password vars |
|----------|------------|---------------|
| Primary | `ADMIN_SEED_EMAIL` | `ADMIN_SEED_PASSWORD` |
| Fallback | `DEFAULT_ADMIN_EMAIL` | `DEFAULT_ADMIN_PASSWORD` |
| Legacy | `PRANI_SEED_ADMIN_EMAIL` | `PRANI_SEED_ADMIN_PASSWORD` |

Optional name/phone: `ADMIN_SEED_NAME`, `DEFAULT_ADMIN_NAME`, `PRANI_SEED_ADMIN_DISPLAY_NAME`, `ADMIN_SEED_PHONE`, `PRANI_SEED_ADMIN_PHONE`.

**No hardcoded admin password** in main seed — if env is empty, admin is skipped with a console warning.

### Bootstrap integration

`npm run bootstrap` ends with `npm run db:seed`, **not** `db:seed:admin`. Admin is created during bootstrap **only if** `ADMIN_SEED_*` (or aliases) are present in `.env`.

---

## 3. Area bootstrap

### Standalone command

| npm script | Command | Entry file |
|------------|---------|------------|
| **`npm run area:seed`** | `tsx scripts/area-seed.ts` | `scripts/area-seed.ts` |

### Shared library

| File | Role |
|------|------|
| `scripts/area-seed-lib.ts` | Core logic: `applyAreaEngineSeed()`, `getAreaSeedVersion()`, `AREA_SEED_VERSION` |
| `prisma/seed-data/bd-locations.ts` | BD division/district/upazila/union reference rows |
| `prisma/seed-data/location-trim-upserts.ts` | Trim-code-aware upsert helpers |

### What area seed does

1. Calls `seedBdReferenceLocations(prisma)` — patches BD geo reference data
2. Upserts engine villages from `AREA_ENGINE_VILLAGE_ROWS` (e.g. Kazulia village, Gopalganj)
3. Records version in `Setting` key **`area_engine.seed_version`** (`2026.05.21-area-engine-1`)
4. Invalidates area cache via `getAreaCacheService().invalidateAll()` (best-effort)

### Relationship to main seed

`prisma/seed.ts` calls **`await applyAreaEngineSeed(prisma)`** near the end (after manual Dhaka/Gazipur geo + `Area` tree). Running `npm run db:seed` **already includes** area-engine seeding. `npm run area:seed` is for **re-applying area data** without full seed.

### Verification

| npm script | Purpose |
|------------|---------|
| `npm run area:verify` | Phase 2 area engine structure/tests (`scripts/area-verify.ts`) |

Runtime service mirror: `src/modules/area-engine/seed/area-seed.service.ts` exposes `getAreaSeedVersion()` for reads only.

---

## 4. Login credentials source

### Admin panel login

| Source | Details |
|--------|---------|
| **Primary** | `.env` → `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` |
| **Main seed aliases** | `DEFAULT_ADMIN_*`, `PRANI_SEED_ADMIN_*` (email/password/name/phone) |
| **Hardcoded in seed scripts** | **None** for admin (by design) |
| **`.env.example`** | Does **not** document seed credential vars |
| **Local `.env` (observed)** | `ADMIN_SEED_EMAIL=admin@pranidoctor.com`, `ADMIN_SEED_PASSWORD=12345678`, etc. |
| **Verify scripts fallbacks** | `scripts/p1-12-verify.ts`, `p2-verify.ts`, `p3-verify.ts` default to `admin@pranidoctor.com` / `12345678` if env unset |

Password hashing: **bcrypt**, cost **12** — must match admin login (`bcrypt.compare` on `/api/admin/auth/login`).

### Inline dev users (main seed, `PRANI_SEED_DEMO=true`)

| Role | Env override | Hardcoded default |
|------|--------------|-------------------|
| Doctor | `PRANI_SEED_DOCTOR_EMAIL`, `PRANI_SEED_DOCTOR_PASSWORD` | `doctor@pranidoctor.local` / `ChangeMe!Doctor123` |
| AI technician | `PRANI_SEED_AI_TECH_EMAIL`, `PRANI_SEED_AI_TECH_PASSWORD` | `ai-tech@pranidoctor.local` / `ChangeMe!AiTech123` |

Blocked when `NODE_ENV=production`.

### Demo seed (`npm run db:seed:demo`)

| Credential type | Source |
|-----------------|--------|
| Staff (doctors, AI, support) | `DEMO_SEED_STAFF_PASSWORD` env, default **`DemoSeed!ChangeMe123`** |
| Customer password field | `DEMO_SEED_CUSTOMER_PASSWORD` env, default **`DemoCustomer!NotUsedOtp123`** (OTP login primary) |
| Customer phone (OTP) | Hardcoded in `demo-seed-shared.ts`: **`8801701022274`** (UI shows `01701022274`) |
| Customer email | Hardcoded: **`customer@pranidoctor.test`** |
| Staff emails | Hardcoded: `demo-doctor-1@pranidoctor.test` … `demo-doctor-5@…`, `demo-ai-1@…` … `demo-ai-3@…`, `demo-support@pranidoctor.test` |

Production guard: requires `ALLOW_DEMO_SEED_IN_PRODUCTION=true` to run when `NODE_ENV=production`.

### Legacy (unused) credential module

`prisma/seed-data/users.ts`:

- `SEED_ADMIN_EMAIL` (default `admin@pranidoctor.local`)
- `SEED_ADMIN_PASSWORD` (default `ChangeMe!Admin123`)
- Uses SHA-256, not bcrypt — **not connected to current auth**

---

## File map

```
prisma.config.ts          → Prisma seed CLI wiring
package.json              → npm scripts (db:seed*, area:seed, bootstrap)

prisma/
  seed.ts                 → Main seed (Prisma + npm db:seed)
  seed-admin.ts           → Admin-only bootstrap
  seed-demo.ts            → Full demo dataset
  seed-demo-reset.ts      → Demo cleanup
  demo-seed-shared.ts     → Stable demo IDs/emails
  seed-data/
    bd-locations.ts       → BD reference geography
    location-trim-upserts.ts
    roles.ts              → UNUSED legacy
    users.ts              → UNUSED legacy

scripts/
  bootstrap.sh / bootstrap.ps1
  area-seed.ts            → Standalone area bootstrap
  area-seed-lib.ts        → Shared area seed logic
  area-verify.ts
```

---

## Recommended operator flows

| Goal | Command |
|------|---------|
| Fresh local DB | `npm run bootstrap` (ensure `ADMIN_SEED_*` in `.env` for admin) |
| Migrations + reference data only | `npm run db:migrate:deploy && npm run db:seed` |
| Admin only (after env set) | `npm run db:seed:admin` |
| Re-apply area reference data | `npm run area:seed` |
| Mobile/API demo data | `npm run db:seed` first, then `npm run db:seed:demo` |
| Remove demo data | `npm run db:seed:reset-demo` |

---

## Gaps / inconsistencies noted

1. **`docs/ADMIN_CREDENTIAL_SETUP.md`** referenced by `seed-admin.ts` but missing from repo.
2. **`.env.example`** omits all `ADMIN_SEED_*`, `PRANI_SEED_*`, and `DEMO_SEED_*` variables.
3. **`seed.ts` log message** mentions `npm run seed:admin`; actual script is **`npm run db:seed:admin`**.
4. **`prisma/seed-data/users.ts` / `roles.ts`** appear orphaned (old schema assumptions).
5. **Verify scripts** embed fallback credentials (`admin@pranidoctor.com` / `12345678`) independent of seed defaults.

---

*Discovery complete — analysis only, no code changes.*
