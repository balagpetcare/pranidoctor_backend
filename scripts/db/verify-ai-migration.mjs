#!/usr/bin/env node
/**
 * One-off verification for 20260602120000_ai_production_platform migration.
 */
import 'dotenv/config';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';
import { loadConfig } from '../../src/shared/config/config.loader.js';

const config = loadConfig();
createLogger(config);
createPrismaClient({ config });
const prisma = getPrisma();

async function main() {
  const migration = await prisma.$queryRaw`
    SELECT migration_name, finished_at, applied_steps_count
    FROM "_prisma_migrations"
    WHERE migration_name LIKE ${'%ai_production%'}
    ORDER BY finished_at DESC
  `;

  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('AiUsageMonthlyRollup', 'AiProviderHealthSnapshot', 'AiUsageAlert')
    ORDER BY table_name
  `;

  const indexes = await prisma.$queryRaw`
    SELECT indexname, tablename FROM pg_indexes
    WHERE schemaname = 'public'
    AND tablename IN ('AiUsageMonthlyRollup', 'AiProviderHealthSnapshot', 'AiUsageAlert', 'AiUsageRecord')
    ORDER BY tablename, indexname
  `;

  const columns = await prisma.$queryRaw`
    SELECT column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'AiUsageRecord'
    AND column_name IN ('organizationId', 'branchId', 'clinicId', 'doctorId')
    ORDER BY column_name
  `;

  const monthlyIndexes = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'AiUsageMonthlyRollup'
    ORDER BY indexname
  `;

  const expectedIndexes = [
    'AiUsageMonthlyRollup_bucketMonth_dimensionType_dimensionId_provider_model_key',
    'AiUsageMonthlyRollup_bucketMonth_dimensionType_idx',
    'AiUsageMonthlyRollup_dimensionType_dimensionId_bucketMonth_idx',
    'AiProviderHealthSnapshot_provider_probedAt_idx',
    'AiUsageAlert_alertType_createdAt_idx',
    'AiUsageAlert_acknowledged_createdAt_idx',
    'AiUsageRecord_doctorId_createdAt_idx',
    'AiUsageRecord_organizationId_createdAt_idx',
  ];

  const indexNames = indexes.map((i) => i.indexname);
  const monthlyIndexNames = monthlyIndexes.map((i) => i.indexname);
  const uniqueRollupIndex =
    monthlyIndexNames.find((n) => n.includes('bucketMonth') && n.includes('dimensionType')) ??
    null;

  const missingIndexes = expectedIndexes.filter((n) => !indexNames.includes(n));
  // PostgreSQL truncates identifiers to 63 chars — unique index may appear shortened.
  if (uniqueRollupIndex) {
    const truncated = missingIndexes.indexOf(
      'AiUsageMonthlyRollup_bucketMonth_dimensionType_dimensionId_provider_model_key',
    );
    if (truncated >= 0) missingIndexes.splice(truncated, 1);
  } else {
    missingIndexes.push(
      'AiUsageMonthlyRollup unique (bucketMonth+dimensionType+dimensionId+provider+model)',
    );
  }

  let integrityOk = true;
  const integrityErrors = [];

  try {
    const month = new Date(Date.UTC(2026, 5, 1));
    await prisma.aiUsageMonthlyRollup.upsert({
      where: {
        bucketMonth_dimensionType_dimensionId_provider_model: {
          bucketMonth: month,
          dimensionType: 'platform',
          dimensionId: 'global',
          provider: 'openai',
          model: 'gpt-4o-mini',
        },
      },
      create: {
        bucketMonth: month,
        dimensionType: 'platform',
        dimensionId: 'global',
        provider: 'openai',
        model: 'gpt-4o-mini',
        requestCount: 1,
        successCount: 1,
        costUsd: 0.001,
      },
      update: { requestCount: { increment: 1 } },
    });

    await prisma.aiProviderHealthSnapshot.create({
      data: { provider: 'openai', reachable: true, latencyMs: 42 },
    });

    await prisma.aiUsageAlert.create({
      data: {
        alertType: 'usage_spike',
        severity: 'warning',
        message: 'migration audit probe',
        metadataJson: { probe: true },
      },
    });

    await prisma.aiUsageRecord.create({
      data: {
        feature: 'MIGRATION_AUDIT',
        provider: 'rules-based',
        model: 'rules',
        organizationId: 'org-audit',
        doctorId: 'doc-audit',
        success: true,
      },
    });

    const rollup = await prisma.aiUsageMonthlyRollup.findFirst({
      where: { dimensionType: 'platform', dimensionId: 'global', provider: 'openai' },
    });
    if (!rollup || rollup.requestCount < 1) {
      integrityOk = false;
      integrityErrors.push('monthly rollup upsert failed');
    }

    const snapshot = await prisma.aiProviderHealthSnapshot.findFirst({
      where: { provider: 'openai' },
      orderBy: { probedAt: 'desc' },
    });
    if (!snapshot?.reachable) {
      integrityOk = false;
      integrityErrors.push('health snapshot insert failed');
    }

    const alert = await prisma.aiUsageAlert.findFirst({
      where: { message: 'migration audit probe' },
    });
    if (!alert) {
      integrityOk = false;
      integrityErrors.push('alert insert failed');
    }

    await prisma.aiUsageAlert.deleteMany({ where: { message: 'migration audit probe' } });
    await prisma.aiProviderHealthSnapshot.deleteMany({
      where: { provider: 'openai', latencyMs: 42 },
    });
    await prisma.aiUsageMonthlyRollup.deleteMany({
      where: { dimensionType: 'platform', dimensionId: 'global', provider: 'openai' },
    });
    await prisma.aiUsageRecord.deleteMany({ where: { feature: 'MIGRATION_AUDIT' } });
  } catch (err) {
    integrityOk = false;
    integrityErrors.push(err instanceof Error ? err.message : String(err));
  }

  const countsAfter = {
    monthlyRollup: await prisma.aiUsageMonthlyRollup.count(),
    healthSnapshot: await prisma.aiProviderHealthSnapshot.count(),
    alerts: await prisma.aiUsageAlert.count(),
    usageRecords: await prisma.aiUsageRecord.count(),
  };

  console.log(
    JSON.stringify(
      {
        ok:
          missingIndexes.length === 0 &&
          tables.length === 3 &&
          migration.length > 0 &&
          integrityOk,
        integrityOk,
        integrityErrors,
        migration,
        tables,
        missingIndexes,
        monthlyIndexNames,
        uniqueRollupIndex,
        indexCount: indexes.length,
        columns,
        counts: countsAfter,
      },
      null,
      2,
    ),
  );

  if (missingIndexes.length > 0 || !integrityOk) process.exit(1);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
