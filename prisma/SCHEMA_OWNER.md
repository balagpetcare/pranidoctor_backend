# Prisma schema owner (canonical)

**Owner:** `pranidoctor-backend`  
**Path:** `D:\PraniDoctor\pranidoctor-backend`

**Canonical files:**

- `prisma/schema.prisma`
- `prisma/migrations/` (58 active migrations — run `npm run db:audit` for current count)
- `prisma/seed.ts` and seed variants
- `prisma.config.ts`

## Commands (authoritative)

```bash
npm run db:generate
npm run db:migrate          # development
npm run db:migrate:deploy   # staging / production
npm run db:seed
```

## Archives

Out-of-chain SQL: `prisma/_archived_out_of_chain/` (not applied by Prisma).

## Web mirror

`pranidoctor-web` syncs schema + lock for client generation only.  
See `../pranidoctor-web/docs/PRISMA_CANONICAL_PLAN.md`.
