#!/usr/bin/env tsx
/**
 * Wave 1 MVC corpus deploy — import, editorial/vet governance, publish, legacy RAG sync, embed.
 *
 * Usage:
 *   npx tsx scripts/knowledge/wave1/wave1-mvc-deploy.ts
 *   npx tsx scripts/knowledge/wave1/wave1-mvc-deploy.ts --dry-run
 *   npx tsx scripts/knowledge/wave1/wave1-mvc-deploy.ts --skip-embed
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bootstrapScriptRuntime, shutdownScriptRuntime } from '../../seed-runtime.js';
import { getKnowledgeSeederService } from '../../../src/modules/ai/knowledge-seeder/index.js';
import { getVkLegacyRagSyncService } from '../../../src/modules/ai/knowledge-foundation/vk-legacy-rag-sync.service.js';
import { getPrisma } from '../../../src/shared/database/prisma.js';
import { buildWave1CorpusRows } from './wave1-corpus.builder.js';
import { ensureWave1Sources, sourceIdForDomain } from './wave1-sources.js';
import { fastTrackPublishAll } from './wave1-governance.js';
import { seedWave1Symptoms } from './wave1-symptoms.js';

async function collectPendingVersionIds(slugs: string[]): Promise<string[]> {
  const versions = await getPrisma().vkKnowledgeVersion.findMany({
    where: {
      status: { in: ['DRAFT', 'IN_REVIEW', 'VET_APPROVAL', 'CHANGES_REQUESTED'] },
      entity: { slug: { in: slugs } },
    },
    select: { id: true, versionNumber: true, entity: { select: { slug: true } } },
    orderBy: { versionNumber: 'desc' },
  });

  const latestBySlug = new Map<string, string>();
  for (const version of versions) {
    if (!latestBySlug.has(version.entity.slug)) {
      latestBySlug.set(version.entity.slug, version.id);
    }
  }
  return [...latestBySlug.values()];
}

async function dedupeLatestVersionPerSlug(versionIds: string[]): Promise<string[]> {
  if (versionIds.length === 0) return [];

  const versions = await getPrisma().vkKnowledgeVersion.findMany({
    where: { id: { in: versionIds } },
    select: { id: true, versionNumber: true, entity: { select: { slug: true } } },
  });

  const best = new Map<string, { id: string; versionNumber: number }>();
  for (const version of versions) {
    const slug = version.entity.slug;
    const current = best.get(slug);
    if (!current || version.versionNumber > current.versionNumber) {
      best.set(slug, { id: version.id, versionNumber: version.versionNumber });
    }
  }
  return [...best.values()].map((row) => row.id);
}

const root = join(import.meta.dirname, '../..');
const bundlesDir = join(root, 'bundles', 'wave1');

function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  const dryRun = parseFlag('dry-run');
  const skipEmbed = parseFlag('skip-embed');
  const publishOnly = parseFlag('publish-only');

  bootstrapScriptRuntime();

  console.log('Wave 1 MVC Deploy — starting\n');

  if (publishOnly) {
    const sync = getVkLegacyRagSyncService();
    const legacySync = await sync.syncAllPublished();
    console.log(`Publish-only legacy sync: ${legacySync.entries} entries, ${legacySync.chunks} chunks`);
    const symptomStats = await seedWave1Symptoms();
    console.log(`Symptom graph: ${symptomStats.nodes} nodes, ${symptomStats.links} links`);
    if (!skipEmbed) {
      const embed = await sync.embedAllLegacyEntries();
      console.log(`Embeddings indexed: ${embed.indexed}, failed: ${embed.failed}`);
    }
    await shutdownScriptRuntime();
    process.exit(0);
  }

  const sourceIds = await ensureWave1Sources();
  console.log(`Registered ${Object.keys(sourceIds).length} BD sources\n`);

  const rows = buildWave1CorpusRows();
  mkdirSync(bundlesDir, { recursive: true });

  const byDomain = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byDomain.get(row.domain) ?? [];
    list.push(row);
    byDomain.set(row.domain, list);
  }

  const seeder = getKnowledgeSeederService();
  const allVersionIds: string[] = [];

  for (const [domain, domainRows] of byDomain) {
    const bundlePath = join(bundlesDir, `${domain.toLowerCase()}.json`);
    writeFileSync(bundlePath, JSON.stringify({ rows: domainRows }, null, 2));
    console.log(`Bundle ${domain}: ${domainRows.length} rows → ${bundlePath}`);

    if (dryRun || publishOnly) continue;

    const result = await seeder.importBundle({
      filePath: bundlePath,
      sourceId: sourceIdForDomain(domain, sourceIds),
      domain: domain as never,
      actorId: 'wave1-mvc-deploy',
    });

    allVersionIds.push(...result.versionIds);
    console.log(
      `  Imported importRunId=${result.importRunId} versions=${result.versionIds.length} stats=${JSON.stringify(result.stats)}`,
    );
  }

  const slugList = rows.map((r) => r.slug);
  const pendingIds = await collectPendingVersionIds(slugList);
  const versionIdSet = new Set([...allVersionIds, ...pendingIds]);
  const versionIds = await dedupeLatestVersionPerSlug([...versionIdSet]);

  if (dryRun) {
    console.log(`\nDry run complete — ${rows.length} rows validated in bundles only.`);
    await shutdownScriptRuntime();
    return;
  }

  console.log(`\nFast-tracking governance for ${versionIds.length} versions...`);
  const publishResults = await fastTrackPublishAll(versionIds);
  const published = publishResults.filter((r) => r.published);
  const failed = publishResults.filter((r) => !r.published);

  console.log(`Published: ${published.length} / ${publishResults.length}`);
  if (failed.length > 0) {
    console.log('Failures:');
    for (const f of failed.slice(0, 10)) {
      console.log(`  - ${f.slug}: ${f.error}`);
    }
  }

  const sync = getVkLegacyRagSyncService();
  const legacySync = await sync.syncAllPublished();
  console.log(`\nLegacy RAG sync: ${legacySync.entries} entries, ${legacySync.chunks} chunks`);

  const symptomStats = await seedWave1Symptoms();
  console.log(`Symptom graph: ${symptomStats.nodes} nodes, ${symptomStats.links} links`);

  if (!skipEmbed) {
    console.log('\nGenerating embeddings...');
    const embed = await sync.embedAllLegacyEntries();
    console.log(`Embeddings indexed: ${embed.indexed}, failed: ${embed.failed}`);
  }

  const vkChunks = await getPrisma().vkKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
  const legacyChunks = await getPrisma().aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
  const embeddings = await getPrisma().aiKnowledgeEmbeddingChunk.count({ where: { active: true } });

  console.log('\n--- Wave 1 MVC Summary ---');
  console.log(`Entities imported: ${rows.length}`);
  console.log(`VK published chunks: ${vkChunks}`);
  console.log(`Legacy published chunks: ${legacyChunks}`);
  console.log(`Active embeddings: ${embeddings}`);
  console.log(`Publish success rate: ${published.length}/${publishResults.length}`);

  await seeder.recordRunSummary({
    actorId: 'wave1-mvc-deploy',
    filePath: bundlesDir,
    dryRun: false,
  });

  await shutdownScriptRuntime();
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error);
  await shutdownScriptRuntime();
  process.exit(1);
});
