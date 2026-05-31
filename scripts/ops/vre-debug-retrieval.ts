import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient } from '../../src/shared/database/prisma.js';
import { getKnowledgeRetrievalService } from '../../src/modules/ai/knowledge-retrieval/knowledge-retrieval.service.js';
import {
  AI_DOCTOR_FEATURE,
  AI_DOCTOR_RETRIEVAL_PROFILE,
  AI_DOCTOR_TASK_TYPE,
} from '../../src/modules/ai/ai-doctor/ai-doctor.constants.js';
import type { LivestockSpecies } from '../../src/generated/prisma/index.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });

async function main(): Promise<void> {
  const queries: Array<{ id: string; q: string; species: LivestockSpecies }> = [
    { id: 'ad-g1-003', q: 'গরু জ্বর করছে', species: 'COW' },
    { id: 'ad-g1-007', q: 'মুরগির Newcastle disease লক্ষণ', species: 'CHICKEN' },
    { id: 'ad-g1-008', q: 'গরু হঠাৎ ফুলে গেল', species: 'COW' },
    { id: 'bn-g1-003', q: 'গরু জ্বর করছে', species: 'COW' },
    { id: 'bn-g1-007', q: 'গরুর টিকা কখন দিব', species: 'COW' },
    { id: 'bn-g1-013', q: 'গরু ঝরা হয়েছে', species: 'COW' },
    { id: 'bn-g1-019', q: 'গরু মরে যাচ্ছে জরুরি', species: 'COW' },
  ];

  for (const { id, q, species } of queries) {
    const pack = await getKnowledgeRetrievalService().retrieve({
      query: q,
      locale: 'bn',
      taskType: AI_DOCTOR_TASK_TYPE,
      feature: AI_DOCTOR_FEATURE,
      profileId: id.startsWith('bn') ? 'farmer-chat-v1' : AI_DOCTOR_RETRIEVAL_PROFILE,
      species,
    });
    console.log(
      JSON.stringify({
        id,
        top4: pack.chunks.slice(0, 4).map((c) => c.slug),
        top10: pack.chunks.slice(0, 10).map((c) => c.slug),
        graphHints: pack.graphHints?.slice(0, 6),
        chunkCount: pack.chunks.length,
      }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
