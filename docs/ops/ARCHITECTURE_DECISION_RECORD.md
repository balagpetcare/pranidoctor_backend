# Architecture Decision Record — Phase 6

**Date:** 2026-05-29  
**Status:** Accepted (Hybrid Option C)

## Decision

1. **Prisma owner:** `pranidoctor-backend` runs `prisma migrate deploy` in all environments.
2. **API edge (90-day):** Mobile and admin traffic may hit **Next.js BFF** (`pranidoctor-web`) which proxies to Express; direct Express exposure allowed for staging tests.
3. **Legacy routes:** Production Docker image includes `src/legacy` and runs via `tsx` until legacy compile pipeline ships.

## Consequences

- Web repo must not run migrations against production DB.
- `mobile/livestock/*` routes in web are proxy-only.
- Rate limiting and auth remain authoritative on Express backend.
