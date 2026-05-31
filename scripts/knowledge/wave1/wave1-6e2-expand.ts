#!/usr/bin/env tsx
/**
 * Phase 6E.2 — Vector retrieval expansion orchestrator.
 *
 * Usage:
 *   npx tsx scripts/knowledge/wave1/wave1-6e2-expand.ts
 *   npx tsx scripts/knowledge/wave1/wave1-6e2-expand.ts --skip-deploy
 *   npx tsx scripts/knowledge/wave1/wave1-6e2-expand.ts --skip-embed
 *   npx tsx scripts/knowledge/wave1/wave1-6e2-expand.ts --target-chunks=520
 */
import { join } from 'node:path';
import { execSync } from 'node:child_process';

import { loadEnvironment } from '../../../src/shared/config/load-env.js';
import { bootstrapScriptRuntime, shutdownScriptRuntime } from '../../seed-runtime.js';
import { getRetrievalChunkExpansionService } from '../../../src/modules/ai/knowledge-retrieval/expansion/retrieval-chunk-expansion.service.js';
import { getVkLegacyRagSyncService } from '../../../src/modules/ai/knowledge-foundation/vk-legacy-rag-sync.service.js';
import {
  runFullCorpusEmbedJob,
  runPgvectorBackfillJob,
} from '../../../src/modules/ai/knowledge-retrieval/embedding/embedding-refresh.job.js';
import { getPrisma } from '../../../src/shared/database/prisma.js';
import { seedWave1SymptomsEnriched } from './wave1-symptoms.js';

function parseFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseArg(prefix: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`${prefix}=`));
  return arg?.split('=')[1] ?? fallback;
}

async function main(): Promise<void> {
  const skipDeploy = parseFlag('skip-deploy');
  const skipEmbed = parseFlag('skip-embed');
  const targetChunks = Number(parseArg('--target-chunks', '520'));

  loadEnvironment();
  process.env.VRE_DETERMINISTIC_EMBED_FALLBACK = process.env.VRE_DETERMINISTIC_EMBED_FALLBACK ?? 'true';

  bootstrapScriptRuntime();

  console.log('Phase 6E.2 — Vector Retrieval Expansion\n');

  if (!skipDeploy) {
    console.log('Step 1: Wave 1 MVC deploy (publish + legacy sync)...');
    const deployScript = join(import.meta.dirname, 'wave1-mvc-deploy.ts');
    execSync(`npx tsx "${deployScript}" --publish-only`, { stdio: 'inherit', cwd: join(import.meta.dirname, '../../..') });
  } else {
    console.log('Step 1: Skipped deploy (--skip-deploy)');
    const sync = getVkLegacyRagSyncService();
    const legacySync = await sync.syncAllPublished();
    console.log(`  Legacy RAG sync: ${legacySync.entries} entries, ${legacySync.chunks} chunks`);
  }

  console.log('\nStep 2: G1 priority micro-summary chunks...');
  const expansion = getRetrievalChunkExpansionService();
  const micro = await expansion.expandMicroSummaries();
  console.log(`  Micro summaries: +${micro.chunksAdded} chunks (${micro.entriesProcessed} entries)`);

  const beforeFloor = await getPrisma().aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
  console.log(`\nStep 3: Chunk floor expansion (target ${targetChunks}, current ${beforeFloor})...`);
  const floor = await expansion.expandToChunkFloor(targetChunks);
  console.log(`  Floor expansion: +${floor.chunksAdded} chunks → ${floor.finalCount} total`);

  console.log('\nStep 4: Symptom graph enrichment...');
  const symptoms = await seedWave1SymptomsEnriched();
  console.log(`  Symptom graph: ${symptoms.nodes} nodes, ${symptoms.links} links`);

  if (!skipEmbed) {
    console.log('\nStep 5: Full corpus embedding generation...');
    const embed = await runFullCorpusEmbedJob();
    console.log(`  Embeddings: indexed=${embed.indexed}, failed=${embed.failed}, scanned=${embed.scanned}`);

    console.log('\nStep 6: pgvector backfill...');
    const backfill = await runPgvectorBackfillJob(2000);
    console.log(`  pgvector backfill: ${backfill.backfilled} rows (${backfill.skipped} skipped)`);
  } else {
    console.log('\nStep 5–6: Skipped embed (--skip-embed)');
  }

  const publishedChunks = await getPrisma().aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
  const activeEmbeddings = await getPrisma().aiKnowledgeEmbeddingChunk.count({ where: { active: true } });
  const symptomLinks = await getPrisma().aiSymptomDiseaseLink.count();

  console.log('\n--- Phase 6E.2 Summary ---');
  console.log(JSON.stringify({ publishedChunks, activeEmbeddings, symptomLinks, targetChunks }, null, 2));

  await shutdownScriptRuntime();
  process.exit(publishedChunks >= targetChunks ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await shutdownScriptRuntime();
  process.exit(1);
});
