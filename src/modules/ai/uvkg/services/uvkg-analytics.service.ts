import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import type { UvkgAnalyticsDashboard } from '../uvkg.types.js';
import { getGraphCoverageService } from './graph-coverage.service.js';
import { getUvkgDriftService } from './uvkg-drift.service.js';

export class UvkgAnalyticsService {
  readonly name = 'UvkgAnalyticsService';

  async getDashboard(): Promise<UvkgAnalyticsDashboard> {
    const repo = getKnowledgeLinkRepository();
    const [entityCount, edgeCount, edgeCountByType, edgeCountByStatus, topConnectedEntities, drift] =
      await Promise.all([
        repo.countVkKnowledgeEntities(),
        repo.countAll(),
        repo.countByEdgeType(),
        repo.countByStatus(),
        repo.getTopConnectedEndpoints(25),
        getUvkgDriftService().generateReport(),
      ]);

    const coverage = await getGraphCoverageService().generateReport();
    const orphanNodes = await this.findOrphanNodes(topConnectedEntities);

    return {
      generatedAt: new Date().toISOString(),
      entityCount,
      edgeCount,
      edgeCountByType,
      edgeCountByStatus,
      crossDomainCoverage: coverage.categories,
      topConnectedEntities,
      orphanNodes,
      drift,
    };
  }

  private async findOrphanNodes(
    topConnected: Array<{ refType: string; refId: string; degree: number }>,
  ): Promise<Array<{ refType: string; refId: string }>> {
    const connected = new Set(topConnected.map((t) => `${t.refType}:${t.refId}`));
    const repo = getKnowledgeLinkRepository();
    const allEndpoints = await repo.getTopConnectedEndpoints(500);
    return allEndpoints
      .filter((e) => e.degree <= 1 && !connected.has(`${e.refType}:${e.refId}`))
      .slice(0, 50)
      .map((e) => ({ refType: e.refType, refId: e.refId }));
  }
}

let analytics: UvkgAnalyticsService | undefined;

export function getUvkgAnalyticsService(): UvkgAnalyticsService {
  analytics ??= new UvkgAnalyticsService();
  return analytics;
}

export function resetUvkgAnalyticsServiceForTests(): void {
  analytics = undefined;
}
