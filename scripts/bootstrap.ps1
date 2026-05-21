# Bootstrap local development (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot\..

Write-Host "==> Prani Doctor Backend — bootstrap"

if (-not (Test-Path .env)) {
    Write-Host "==> Creating .env from .env.example"
    Copy-Item .env.example .env
}

Write-Host "==> Resolving environment URLs"
node scripts/resolve-env.mjs | Out-Null

Write-Host "==> Starting Docker services (postgres, redis, minio)"
docker compose up -d postgres redis minio

Write-Host "==> Waiting for services"
npx tsx scripts/wait-for-services.ts

Write-Host "==> MinIO bucket init"
docker compose up minio-init

Write-Host "==> Applying migrations"
npx prisma migrate deploy

Write-Host "==> Seeding database"
npm run db:seed

Write-Host ""
Write-Host "Bootstrap complete. Run: npm run dev"
