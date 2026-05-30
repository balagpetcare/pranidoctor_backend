# Prisma migrations — canonical (backend)

**Authority:** `pranidoctor-backend/prisma/migrations/`  
**Schema owner:** `prisma/SCHEMA_OWNER.md`

## Commands

```bash
npm run db:generate
npm run db:migrate          # development only — disposable DB
npm run db:migrate:deploy   # staging / production (with guard)
npm run db:audit            # migration inventory + safety scan (no DB)
npm run db:preflight        # pre-deploy checks (requires DATABASE_URL)
npx prisma migrate status
```

## Production

```bash
# After backup:
ALLOW_PRODUCTION_MIGRATE=true npm run db:migrate:deploy
```

## Web repo

`pranidoctor-web` syncs schema for client generation only — **do not** apply migrations from web.

See `pranidoctor-web/docs/PRISMA_CANONICAL_PLAN.md`.

## Archives

`prisma/_archived_out_of_chain/` — not applied by Prisma CLI.
