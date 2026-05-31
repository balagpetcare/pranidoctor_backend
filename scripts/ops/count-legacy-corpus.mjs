import { loadEnvironment } from '../../src/shared/config/load-env.js';
import { loadConfig, resetConfigCache } from '../../src/shared/config/config.loader.js';
import { createLogger } from '../../src/shared/logger/logger.js';
import { createPrismaClient, getPrisma, disconnectPrisma } from '../../src/shared/database/prisma.js';

loadEnvironment();
resetConfigCache();
const config = loadConfig();
createLogger(config);
createPrismaClient({ config });
const p = getPrisma();

const [feed, medicine, disease, speciesMatrix, outbreaks, citations, vkEntities, uvkgLinks] =
  await Promise.all([
    p.vkFeedKnowledgeGraphEdge.count(),
    p.vkMedicineKnowledgeGraphEdge.count(),
    p.diGraphEdge.count(),
    p.diDiseaseSpeciesMatrix.count(),
    p.diOutbreakSignal.count(),
    p.vkKnowledgeCitation.count(),
    p.vkKnowledgeEntity.count(),
    p.vkKnowledgeLink.count(),
  ]);

console.log(
  JSON.stringify(
    { feed, medicine, disease, speciesMatrix, outbreaks, citations, vkEntities, uvkgLinks },
    null,
    2,
  ),
);

await disconnectPrisma();
