import { resolveUvkgConfig } from '../config/uvkg-config.js';
import { UVKG_PHASE4_TARGETS } from '../uvkg-phase4.constants.js';
import type { UvkgPhase4ValidationReport } from '../uvkg.types.js';
import { getGraphCoverageService } from './graph-coverage.service.js';
import { getGraphPopulationService } from './graph-population.service.js';
import { getGraphQualityService } from './graph-quality.service.js';
import { getGovernanceValidationService } from './governance-validation.service.js';
import { getUvkgAnalyticsService } from './uvkg-analytics.service.js';
import { getUvkgBenchmarkService } from './uvkg-benchmark.service.js';
import { getUvkgDriftService } from './uvkg-drift.service.js';

export class Phase4ValidationService {
  readonly name = 'Phase4ValidationService';

  async runFullValidation(options?: { skipPopulation?: boolean }): Promise<UvkgPhase4ValidationReport> {
    const config = resolveUvkgConfig();
    let population: UvkgPhase4ValidationReport['population'];

    if (options?.skipPopulation) {
      const { getKnowledgeLinkRepository } = await import('../repositories/knowledge-link.repository.js');
      const repo = getKnowledgeLinkRepository();
      population = {
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        sources: {},
        derived: {},
        totalLinksAfter: await repo.countAll(),
        totalEntitiesReferenced: Math.max(
          await repo.countDistinctEndpointRefs(),
          await repo.countVkKnowledgeEntities(),
        ),
      };
    } else {
      population = await getGraphPopulationService().runFullPopulation();
    }

    const [coverage, quality, governance, analytics, benchmarks, drift] = await Promise.all([
      getGraphCoverageService().generateReport(),
      getGraphQualityService().generateReport(),
      getGovernanceValidationService().generateReport(),
      getUvkgAnalyticsService().getDashboard(),
      getUvkgBenchmarkService().runBenchmarks(),
      getUvkgDriftService().generateReport(),
    ]);

    await getGovernanceValidationService().validateLifecycleTransitionDryRun();

    const { readinessScore, readinessForPhase5, blockers, recommendations } =
      this.computeReadiness({
        population,
        coverage,
        quality,
        governance,
        benchmarks,
        drift,
        config,
      });

    return {
      generatedAt: new Date().toISOString(),
      population,
      coverage,
      quality,
      governance,
      analytics,
      benchmarks,
      drift,
      readinessScore,
      readinessForPhase5,
      blockers,
      recommendations,
    };
  }

  private computeReadiness(input: {
    population: UvkgPhase4ValidationReport['population'];
    coverage: UvkgPhase4ValidationReport['coverage'];
    quality: UvkgPhase4ValidationReport['quality'];
    governance: UvkgPhase4ValidationReport['governance'];
    benchmarks: UvkgPhase4ValidationReport['benchmarks'];
    drift: UvkgPhase4ValidationReport['drift'];
    config: ReturnType<typeof resolveUvkgConfig>;
  }): Pick<
    UvkgPhase4ValidationReport,
    'readinessScore' | 'readinessForPhase5' | 'blockers' | 'recommendations'
  > {
    const blockers: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    const edgeRatio = Math.min(1, input.coverage.totalEdges / UVKG_PHASE4_TARGETS.minEdges);
    const entityRatio = Math.min(1, input.coverage.totalEntities / UVKG_PHASE4_TARGETS.minEntities);
    score += edgeRatio * 35;
    score += entityRatio * 15;

    const categoriesMet = input.coverage.categories.filter((c) => c.met).length;
    const categoryRatio = categoriesMet / input.coverage.categories.length;
    score += categoryRatio * 25;

    if (input.coverage.totalEdges < UVKG_PHASE4_TARGETS.minEdges) {
      blockers.push(
        `Edge count ${input.coverage.totalEdges} < target ${UVKG_PHASE4_TARGETS.minEdges}`,
      );
      recommendations.push('Run knowledge:wave1 and medicine/feed seeds; re-run ops:uvkg-phase4');
    }
    if (input.coverage.totalEntities < UVKG_PHASE4_TARGETS.minEntities) {
      blockers.push(
        `Entity count ${input.coverage.totalEntities} < target ${UVKG_PHASE4_TARGETS.minEntities}`,
      );
      recommendations.push('Expand VkKnowledgeEntity corpus via knowledge:wave1 deploy');
    }

    const highQuality = input.quality.issues.filter((i) => i.severity === 'HIGH').length;
    const qualityPenalty = Math.min(15, highQuality * 3 + input.quality.issues.length * 0.05);
    score += Math.max(0, 15 - qualityPenalty);
    if (highQuality > 0) {
      blockers.push(`${highQuality} HIGH severity quality issues`);
    }

    if (input.benchmarks.allMet) score += 10;
    else {
      recommendations.push('Optimize indexes on vk_knowledge_links (edgeType, status, ref ids)');
      blockers.push('Benchmark average latency >= 100ms');
    }

    if (input.drift.openConflicts === 0) score += 5;
    else recommendations.push(`Resolve ${input.drift.openConflicts} open sync conflicts`);

    if (input.governance.traversalPublishedOnly) score += 5;
    else blockers.push('Traversal contract may expose non-published edges');

    if (!input.config.readEnabled) score += 5;
    else blockers.push('UVKG_READ_ENABLED must remain false until Phase 5 sign-off');

    if (!input.config.dualWriteEnabled) {
      recommendations.push('Keep UVKG_DUAL_WRITE_ENABLED=true during Phase 4–5 transition');
    }

    const readinessScore = Math.round(Math.min(100, score));
    let readinessForPhase5: UvkgPhase4ValidationReport['readinessForPhase5'] = 'NOT_READY';
    if (readinessScore >= 80 && blockers.length === 0) readinessForPhase5 = 'READY';
    else if (readinessScore >= 65) readinessForPhase5 = 'CONDITIONAL';

    if (readinessForPhase5 !== 'READY') {
      recommendations.push('Do not set UVKG_READ_ENABLED=true until READY');
    }

    return { readinessScore, readinessForPhase5, blockers, recommendations };
  }
}

let phase4: Phase4ValidationService | undefined;

export function getPhase4ValidationService(): Phase4ValidationService {
  phase4 ??= new Phase4ValidationService();
  return phase4;
}

export function resetPhase4ValidationServiceForTests(): void {
  phase4 = undefined;
}
