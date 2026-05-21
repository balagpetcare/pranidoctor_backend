# Prisma migrations — mirror only

**Authority:** `pranidoctor-web/prisma/migrations/`  
**This folder:** historical copy for reference; **do not apply** from `pranidoctor-backend`.

## Production commands (web repo)

```bash
cd D:\PraniDoctor\pranidoctor-web
npm run db:migrate
npm run db:deploy:safe
npx prisma migrate status
```

## Staging mirror

```bash
# BLOCKED in this repo:
npm run db:migrate
npm run db:migrate:deploy

# Allowed:
npm run db:generate
```

See `prisma/SCHEMA_OWNER.md` and `ARCHITECTURE.md`.
