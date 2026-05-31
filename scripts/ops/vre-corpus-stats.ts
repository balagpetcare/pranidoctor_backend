import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma } from '../../src/shared/database/prisma.js';
import { isPgvectorColumnAvailable } from '../../src/modules/ai/knowledge-retrieval/search/pgvector.util.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

const prisma = getPrisma();
const publishedEntries = await prisma.aiKnowledgeEntry.count({ where: { status: 'PUBLISHED' } });
const publishedChunks = await prisma.aiKnowledgeChunk.count({ where: { stage: 'PUBLISHED' } });
const activeEmbeddings = await prisma.aiKnowledgeEmbeddingChunk.count({ where: { active: true } });
const pendingEmbed = await prisma.aiKnowledgeEntry.count({
  where: { status: 'PUBLISHED', embeddingStatus: 'PENDING' },
});
const failedEmbed = await prisma.aiKnowledgeEntry.count({
  where: { status: 'PUBLISHED', embeddingStatus: 'FAILED' },
});
const symptomLinks = await prisma.aiSymptomDiseaseLink.count();
const symptomNodes = await prisma.aiSymptomNode.count();
const pgvectorColumn = await isPgvectorColumnAvailable();

let pgvectorPopulated = 0;
if (pgvectorColumn) {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "AiKnowledgeEmbeddingChunk"
    WHERE "active" = true AND "embeddingVector" IS NOT NULL
  `;
  pgvectorPopulated = Number(rows[0]?.count ?? 0);
}

console.log(
  JSON.stringify(
    {
      publishedEntries,
      publishedChunks,
      activeEmbeddings,
      embeddingCoverage: publishedChunks > 0 ? activeEmbeddings / publishedChunks : 0,
      pendingEmbed,
      failedEmbed,
      pgvectorColumn,
      pgvectorPopulated,
      pgvectorCoverage: activeEmbeddings > 0 ? pgvectorPopulated / activeEmbeddings : 0,
      symptomNodes,
      symptomLinks,
      chunkFloorMet: publishedChunks >= 520,
    },
    null,
    2,
  ),
);

process.exit(0);
