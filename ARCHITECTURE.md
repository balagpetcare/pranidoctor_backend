# Architecture — BACKEND-FIRST (Prisma)

**Prisma canonical owner:** this repo (`pranidoctor-backend`).  
**API production (interim):** `pranidoctor-web` until Express parity.

| Role | Repository | Path |
|------|------------|------|
| **Prisma** (schema, migrations, seed) | `pranidoctor-backend` | `D:\PraniDoctor\pranidoctor-backend` |
| **API + UI (legacy)** | `pranidoctor-web` | `D:\PraniDoctor\pranidoctor-web` |

## This repo IS (Prisma)

- **Canonical** `schema.prisma`, `migrations/`, seed suite
- `npm run db:migrate`, `db:migrate:deploy`, `db:seed`
- Archives under `prisma/_archived_out_of_chain/` (not in migration chain)

## This repo IS (API staging)

- Express modular monolith prototype
- Read-only copy of web `src/lib` → `src/legacy/web/lib`
- Read-only copy of web API routes → `src/legacy/web/routes` (171 handlers)

## Prisma sync to web

After schema changes: web runs `scripts/sync-prisma-from-backend.ps1` then `db:generate`.

## API

All traffic remains on **Next.js route handlers** in `pranidoctor-web` until a future cutover phase passes release criteria in `CUTOVER_DEFER_PLAN.md`.
