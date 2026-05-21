#!/usr/bin/env bash
# Bootstrap local development: infra + migrations + seed
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Prani Doctor Backend — bootstrap"

if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
fi

echo "==> Resolving environment URLs"
node scripts/resolve-env.mjs > /dev/null

echo "==> Starting Docker services (postgres, redis, minio)"
docker compose up -d postgres redis minio

echo "==> Waiting for services to accept connections"
npx tsx scripts/wait-for-services.ts

echo "==> Waiting for MinIO bucket init"
docker compose up minio-init

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Seeding database"
npm run db:seed

echo ""
echo "✅ Bootstrap complete!"
echo "   Run: npm run dev"
echo "   Health: http://localhost:3000/health"
