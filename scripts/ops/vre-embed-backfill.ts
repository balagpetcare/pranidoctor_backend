#!/usr/bin/env tsx
/** Embed backfill + pgvector sync for published knowledge corpus. */
import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';
import {
  runFullCorpusEmbedJob,
  runKnowledgeEmbeddingRefreshJob,
  runPgvectorBackfillJob,
} from '../../src/modules/ai/knowledge-retrieval/embedding/embedding-refresh.job.js';
import { isPgvectorColumnAvailable } from '../../src/modules/ai/knowledge-retrieval/search/pgvector.util.js';

loadEnvironment();
process.env.VRE_DETERMINISTIC_EMBED_FALLBACK = process.env.VRE_DETERMINISTIC_EMBED_FALLBACK ?? 'true';
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const mode = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'full';

const prisma = getPrisma();
const publishedChunks = await prisma.aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });

console.log(`VRE embed backfill — mode=${mode}, publishedChunks=${publishedChunks}\n`);

let result: unknown;

if (mode === 'refresh') {
  result = await runKnowledgeEmbeddingRefreshJob(500);
} else if (mode === 'pgvector') {
  result = await runPgvectorBackfillJob(2000);
} else {
  result = await runFullCorpusEmbedJob();
  const backfill = await runPgvectorBackfillJob(2000);
  result = { embed: result, backfill };
}

const activeEmbeddings = await prisma.aiKnowledgeEmbeddingChunk.count({ where: { active: true } });
const pgvectorAvailable = await isPgvectorColumnAvailable();

const pgvectorPopulated = pgvectorAvailable
  ? await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM "AiKnowledgeEmbeddingChunk"
      WHERE "active" = true AND "embeddingVector" IS NOT NULL
    `
  : [{ count: 0n }];

console.log(
  JSON.stringify(
    {
      result,
      activeEmbeddings,
      pgvectorColumn: pgvectorAvailable,
      pgvectorPopulated: Number(pgvectorPopulated[0]?.count ?? 0),
      coverage: publishedChunks > 0 ? activeEmbeddings / publishedChunks : 0,
    },
    null,
    2,
  ),
);

process.exit(0);
