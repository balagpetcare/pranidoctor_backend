#!/usr/bin/env tsx
/** Apply Phase 6C.13 / 6E.2 DB extensions (pgvector + embedding columns) if missing. */
import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const prisma = getPrisma();

console.log('Applying VRE DB extensions (idempotent)...');

let pgvectorExtension = false;
try {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);
  pgvectorExtension = true;
  console.log('  pgvector extension: OK');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`  pgvector extension unavailable — semantic ANN disabled (${message.slice(0, 120)})`);
}

await prisma.$executeRawUnsafe(`
  ALTER TABLE "AiKnowledgeEmbeddingChunk"
    ADD COLUMN IF NOT EXISTS "metadataSidecarJson" JSONB
`);

await prisma.$executeRawUnsafe(`
  ALTER TABLE "ai_usage_logs"
    ADD COLUMN IF NOT EXISTS "retrievalMetadataJson" JSONB
`);

if (pgvectorExtension) {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "AiKnowledgeEmbeddingChunk"
      ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AiKnowledgeEmbeddingChunk_active_model_dims_idx"
      ON "AiKnowledgeEmbeddingChunk" ("active", "modelKey", "dimensions", "embeddedAt" DESC)
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AiKnowledgeEmbeddingChunk_embedding_vector_hnsw_idx"
      ON "AiKnowledgeEmbeddingChunk"
      USING hnsw ("embeddingVector" vector_cosine_ops)
      WHERE "active" = true AND "dimensions" = 1536 AND "embeddingVector" IS NOT NULL
  `);
}

const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_name = 'AiKnowledgeEmbeddingChunk'
    AND column_name IN ('metadataSidecarJson', 'embeddingVector')
`;

console.log(
  JSON.stringify(
    {
      pgvectorExtension,
      columns: columns.map((c) => c.column_name),
    },
    null,
    2,
  ),
);

process.exit(0);
