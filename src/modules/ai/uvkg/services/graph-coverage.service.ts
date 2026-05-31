import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import {
  UVKG_COVERAGE_MINIMUMS,
  UVKG_PHASE4_TARGETS,
  type UvkgCoverageCategory,
} from '../uvkg-phase4.constants.js';
import type { UvkgCoverageCategoryResult, UvkgCoverageReport } from '../uvkg.types.js';

export class GraphCoverageService {
  readonly name = 'GraphCoverageService';

  async generateReport(): Promise<UvkgCoverageReport> {
    const repo = getKnowledgeLinkRepository();
    const [totalEdges, totalEntities, byEdgeType, byStatus, bySource] = await Promise.all([
      repo.countAll(),
      Math.max(await repo.countDistinctEndpointRefs(), await repo.countVkKnowledgeEntities()),
      repo.countByEdgeType(),
      repo.countByStatus(),
      repo.countBySource(),
    ]);

    const categories: UvkgCoverageCategoryResult[] = [];
    for (const [key, spec] of Object.entries(UVKG_COVERAGE_MINIMUMS) as Array<
      [UvkgCoverageCategory, (typeof UVKG_COVERAGE_MINIMUMS)[UvkgCoverageCategory]]
    >) {
      const count = await repo.countByEdgeTypes(spec.edgeTypes);
      categories.push({
        category: key,
        edgeTypes: spec.edgeTypes,
        count,
        minimum: spec.minimum,
        met: count >= spec.minimum,
      });
    }

    const categoriesMet = categories.every((c) => c.met);
    const volumeMet =
      totalEdges >= UVKG_PHASE4_TARGETS.minEdges &&
      totalEntities >= UVKG_PHASE4_TARGETS.minEntities;

    return {
      generatedAt: new Date().toISOString(),
      totalEdges,
      totalEntities,
      byEdgeType,
      byStatus,
      bySource,
      categories,
      targetsMet: categoriesMet && volumeMet,
    };
  }
}

let coverage: GraphCoverageService | undefined;

export function getGraphCoverageService(): GraphCoverageService {
  coverage ??= new GraphCoverageService();
  return coverage;
}

export function resetGraphCoverageServiceForTests(): void {
  coverage = undefined;
}
