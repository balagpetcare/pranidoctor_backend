import { getPrisma } from '../../../../shared/database/prisma.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import type { UvkgDriftReport } from '../uvkg.types.js';
import { buildSourceLinkKey } from '../uvkg.util.js';

export class UvkgDriftService {
  readonly name = 'UvkgDriftService';

  async generateReport(): Promise<UvkgDriftReport> {
    const prisma = getPrisma();
    const [feedLegacyCount, medicineLegacyCount, diseaseLegacyCount, uvkgCount, openConflicts] =
      await Promise.all([
        prisma.vkFeedKnowledgeGraphEdge.count(),
        prisma.vkMedicineKnowledgeGraphEdge.count(),
        prisma.diGraphEdge.count(),
        getKnowledgeLinkRepository().countAll(),
        prisma.uvkgSyncConflict.count({ where: { status: 'OPEN' } }),
      ]);

    const uvkgBySource = await getKnowledgeLinkRepository().countBySource();

    let missingInUvkg = 0;
    const feedEdges = await prisma.vkFeedKnowledgeGraphEdge.findMany({
      select: { id: true },
      take: 500,
    });
    for (const edge of feedEdges) {
      const key = buildSourceLinkKey('FEED_GRAPH', edge.id);
      const link = await getKnowledgeLinkRepository().findByLinkKey(key);
      if (!link) missingInUvkg += 1;
    }

    return {
      generatedAt: new Date().toISOString(),
      feedLegacyCount,
      medicineLegacyCount,
      diseaseLegacyCount,
      uvkgCount,
      uvkgBySource,
      openConflicts,
      missingInUvkg,
    };
  }
}

let drift: UvkgDriftService | undefined;

export function getUvkgDriftService(): UvkgDriftService {
  drift ??= new UvkgDriftService();
  return drift;
}

export function resetUvkgDriftServiceForTests(): void {
  drift = undefined;
}
