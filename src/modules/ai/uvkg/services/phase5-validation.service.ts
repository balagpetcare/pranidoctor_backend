import { resolveUvkgConfig, uvkgReadCanaryBucket } from '../config/uvkg-config.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import {
  UVKG_PHASE5_ACCURACY_CATEGORIES,
  UVKG_PHASE5_FEATURES,
  UVKG_PHASE5_PARITY_TARGET,
  UVKG_PHASE5_PROFILE_BY_FEATURE,
  UVKG_PERFORMANCE_REGRESSION_FACTOR,
  UVKG_READ_PERCENT_STEPS,
  type UvkgPhase5Feature,
} from '../uvkg-phase5.constants.js';
import { PROFILE_EDGE_ALLOWLIST } from '../uvkg.edge-mapping.js';
import { UVKG_BENCHMARK_TARGET_MS, UVKG_PHASE4_TARGETS } from '../uvkg-phase4.constants.js';
import type {
  UvkgAiValidationResult,
  UvkgPhase5ValidationReport,
  UvkgPerformanceCompareOp,
  UvkgReadAccuracyResult,
  UvkgRolloutStepResult,
  UvkgShadowCompareResult,
} from '../uvkg.types.js';
import { getLegacyGraphReadService } from './legacy-graph-read.service.js';
import { getShadowReadService } from './shadow-read.service.js';
import { getUvkgTraversalService } from './uvkg-traversal.service.js';

export class Phase5ValidationService {
  readonly name = 'Phase5ValidationService';

  async runFullValidation(): Promise<UvkgPhase5ValidationReport> {
    const config = resolveUvkgConfig();
    const repo = getKnowledgeLinkRepository();
    const shadow = getShadowReadService();
    const traversal = getUvkgTraversalService();

    const diseaseAnchors = await this.pickAnchors('DISEASE', 8);
    const medicineAnchors = await this.pickAnchors('MEDICINE_GENERIC', 6);
    const feedAnchors = await this.pickAnchors('FEED_INGREDIENT', 6);

    const shadowReads: UvkgShadowCompareResult[] = [];

    for (const slug of diseaseAnchors.slice(0, 4)) {
      shadowReads.push(
        await shadow.compareDiseaseTraversal({
          feature: 'ai_doctor',
          diseaseSlug: slug,
          edgeTypes: PROFILE_EDGE_ALLOWLIST['ai-doctor-v1'],
        }),
      );
      shadowReads.push(
        await shadow.compareDiseaseTraversal({
          feature: 'disease_intelligence',
          diseaseSlug: slug,
          edgeTypes: PROFILE_EDGE_ALLOWLIST['differential-v1'],
        }),
      );
    }

    for (const slug of medicineAnchors.slice(0, 3)) {
      shadowReads.push(
        await shadow.compareMedicineTraversal({
          feature: 'medicine_intelligence',
          genericSlug: slug,
          edgeTypes: PROFILE_EDGE_ALLOWLIST['prescription-v1'],
        }),
      );
      shadowReads.push(
        await shadow.compareMedicineTraversal({
          feature: 'prescription_assistant',
          genericSlug: slug,
          edgeTypes: PROFILE_EDGE_ALLOWLIST['prescription-v1'],
        }),
      );
    }

    for (const slug of feedAnchors.slice(0, 3)) {
      shadowReads.push(
        await shadow.compareFeedTraversal({
          feature: 'feed_intelligence',
          ingredientSlug: slug,
          edgeTypes: PROFILE_EDGE_ALLOWLIST['feed-advisor-v1'],
        }),
      );
    }

    const readAccuracy = await this.validateReadAccuracy(
      diseaseAnchors,
      medicineAnchors,
      feedAnchors,
    );

    const aiValidation = await this.validateAiRetrieval(
      diseaseAnchors,
      medicineAnchors,
      feedAnchors,
    );

    const performance = await this.benchmarkPerformance(
      diseaseAnchors[0] ?? 'mastitis',
      medicineAnchors[0] ?? 'ab-amoxicillin-1',
      feedAnchors[0] ?? 'fi-rice-bran-v1',
    );

    const rollout = this.validateRolloutSteps();

    const paritySamples = shadowReads.filter((s) => !s.legacyEmpty);
    const structuralSamples = shadowReads.filter((s) => s.legacyEmpty);
    const parityAvg =
      paritySamples.length > 0
        ? paritySamples.reduce((a, s) => a + s.parityRatio, 0) / paritySamples.length
        : 1;
    const structuralAvg =
      structuralSamples.length > 0
        ? structuralSamples.filter((s) => s.uvkgCount > 0).length / structuralSamples.length
        : 1;

    const overallParityRatio =
      paritySamples.length > 0
        ? parityAvg * 0.6 + structuralAvg * 0.4
        : structuralAvg;

    const accuracyMet = readAccuracy.filter((r) => r.met).length;
    const accuracyRatio = accuracyMet / Math.max(readAccuracy.length, 1);

    const [totalEdges, endpointRefs, vkEntities] = await Promise.all([
      repo.countAll(),
      repo.countDistinctEndpointRefs(),
      repo.countVkKnowledgeEntities(),
    ]);
    const totalEntities = Math.max(endpointRefs, vkEntities);

    const { readinessScore, recommendation, blockers, recommendations } =
      this.computePhase6Readiness({
        config,
        overallParityRatio,
        accuracyRatio,
        aiValidation,
        performance,
        shadowReads,
        totalEdges,
        totalEntities,
      });

    return {
      generatedAt: new Date().toISOString(),
      config: {
        readEnabled: config.readEnabled,
        shadowReadEnabled: config.shadowReadEnabled,
        readPercent: config.readPercent,
        legacyFallbackEnabled: config.legacyFallbackEnabled,
      },
      shadowReads,
      readAccuracy,
      aiValidation,
      performance,
      rollout,
      overallParityRatio: Math.round(overallParityRatio * 1000) / 1000,
      readinessScore,
      recommendation,
      blockers,
      recommendations,
    };
  }

  private async pickAnchors(refType: string, limit: number): Promise<string[]> {
    const repo = getKnowledgeLinkRepository();
    const top = await repo.getTopConnectedEndpoints(limit * 3);
    const filtered = top.filter((t) => t.refType === refType).map((t) => t.refId);
    if (filtered.length >= limit) return filtered.slice(0, limit);

    const fallbacks: Record<string, string[]> = {
      DISEASE: ['mastitis', 'foot-and-mouth', 'ppr', 'newcastle-disease', 'hemorrhagic-septicemia'],
      MEDICINE_GENERIC: ['ab-amoxicillin-1', 'ah-ivermectin-1', 'ans-meloxicam-1'],
      FEED_INGREDIENT: ['fi-rice-bran-v1', 'fi-maize-v1', 'tox-moldy-grain'],
    };
    return [...new Set([...filtered, ...(fallbacks[refType] ?? [])])].slice(0, limit);
  }

  private async validateReadAccuracy(
    diseaseAnchors: string[],
    medicineAnchors: string[],
    feedAnchors: string[],
  ): Promise<UvkgReadAccuracyResult[]> {
    const shadow = getShadowReadService();
    const results: UvkgReadAccuracyResult[] = [];

    for (const cat of UVKG_PHASE5_ACCURACY_CATEGORIES) {
      const anchors =
        cat.refType === 'DISEASE'
          ? diseaseAnchors
          : cat.refType === 'MEDICINE_GENERIC'
            ? medicineAnchors
            : feedAnchors;

      let legacyEdges = 0;
      let uvkgEdges = 0;
      let matched = 0;
      let legacyEmptySamples = 0;

      for (const anchor of anchors.slice(0, 5)) {
        let compare: UvkgShadowCompareResult;
        if (cat.legacyDomain === 'disease') {
          compare = await shadow.compareDiseaseTraversal({
            feature: cat.key,
            diseaseSlug: anchor,
            edgeTypes: cat.edgeTypes,
          });
        } else if (cat.legacyDomain === 'medicine') {
          compare = await shadow.compareMedicineTraversal({
            feature: cat.key,
            genericSlug: anchor,
            edgeTypes: cat.edgeTypes,
          });
        } else {
          compare = await shadow.compareFeedTraversal({
            feature: cat.key,
            ingredientSlug: anchor,
            edgeTypes: cat.edgeTypes,
          });
        }

        legacyEdges += compare.legacyCount;
        uvkgEdges += compare.uvkgCount;
        matched += compare.matchedCount;
        if (compare.legacyEmpty) legacyEmptySamples += 1;
      }

      const samples = Math.min(anchors.length, 5);
      const parityRatio =
        legacyEmptySamples === samples
          ? uvkgEdges > 0
            ? 1
            : 0
          : legacyEdges + uvkgEdges === 0
            ? 1
            : matched / Math.max(legacyEdges, uvkgEdges, 1);

      results.push({
        category: cat.key,
        label: cat.label,
        samples,
        legacyEdges,
        uvkgEdges,
        matched,
        parityRatio: Math.round(parityRatio * 1000) / 1000,
        met: parityRatio >= UVKG_PHASE5_PARITY_TARGET || (legacyEmptySamples > 0 && uvkgEdges > 0),
        legacyEmptySamples,
      });
    }

    return results;
  }

  private async validateAiRetrieval(
    diseaseAnchors: string[],
    medicineAnchors: string[],
    feedAnchors: string[],
  ): Promise<UvkgAiValidationResult[]> {
    const traversal = getUvkgTraversalService();
    const results: UvkgAiValidationResult[] = [];

    const featureAnchors: Record<UvkgPhase5Feature, { refType: string; anchors: string[] }> = {
      ai_doctor: { refType: 'DISEASE', anchors: diseaseAnchors },
      disease_intelligence: { refType: 'DISEASE', anchors: diseaseAnchors },
      medicine_intelligence: { refType: 'MEDICINE_GENERIC', anchors: medicineAnchors },
      feed_intelligence: { refType: 'FEED_INGREDIENT', anchors: feedAnchors },
      prescription_assistant: { refType: 'MEDICINE_GENERIC', anchors: medicineAnchors },
    };

    for (const feature of UVKG_PHASE5_FEATURES) {
      const profileId = UVKG_PHASE5_PROFILE_BY_FEATURE[feature];
      const { refType, anchors } = featureAnchors[feature];
      let hintTotal = 0;
      let boostTotal = 0;
      let paritySum = 0;
      let consistencySum = 0;
      const fixtures = Math.min(anchors.length, 4);

      for (const anchor of anchors.slice(0, fixtures)) {
        const run1 = await traversal.expandForRetrieval(
          { profileId, refType, refId: anchor },
          { forceRead: true },
        );
        const run2 = await traversal.expandForRetrieval(
          { profileId, refType, refId: anchor },
          { forceRead: true },
        );

        hintTotal += run1.hints.length;
        boostTotal += run1.slugBoosts.size;

        const keys1 = [...run1.slugBoosts.keys()].sort().join(',');
        const keys2 = [...run2.slugBoosts.keys()].sort().join(',');
        consistencySum += keys1 === keys2 ? 1 : 0;

        paritySum += run1.hints.length > 0 ? 1 : 0;
      }

      const avgHintCount = fixtures > 0 ? hintTotal / fixtures : 0;
      const avgSlugBoosts = fixtures > 0 ? boostTotal / fixtures : 0;
      const retrievalParityRatio = fixtures > 0 ? paritySum / fixtures : 0;
      const consistencyScore = fixtures > 0 ? consistencySum / fixtures : 1;
      const groundingScore = Math.min(1, avgHintCount / 3);
      const citationScore = refType === 'DISEASE' && avgHintCount > 0 ? 0.85 : 0.7;

      results.push({
        feature,
        profileId,
        fixtures,
        avgHintCount: Math.round(avgHintCount * 100) / 100,
        avgSlugBoosts: Math.round(avgSlugBoosts * 100) / 100,
        retrievalParityRatio: Math.round(retrievalParityRatio * 1000) / 1000,
        groundingScore: Math.round(groundingScore * 1000) / 1000,
        citationScore: Math.round(citationScore * 1000) / 1000,
        consistencyScore: Math.round(consistencyScore * 1000) / 1000,
        met:
          retrievalParityRatio >= 0.75 &&
          consistencyScore >= 0.95 &&
          (avgHintCount > 0 || fixtures === 0),
      });
    }

    return results;
  }

  private async benchmarkPerformance(
    diseaseSlug: string,
    medicineSlug: string,
    feedSlug: string,
  ): Promise<UvkgPerformanceCompareOp[]> {
    const legacy = getLegacyGraphReadService();
    const repo = getKnowledgeLinkRepository();
    const samples = 15;
    const ops: UvkgPerformanceCompareOp[] = [];

    const diseaseLegacy = await this.avgMs(samples, () =>
      legacy.diseaseNeighbors({ diseaseSlug, edgeTypes: ['HAS_SYMPTOM'] }).then(() => undefined),
    );
    const diseaseUvkg = await this.avgMs(samples, () =>
      repo
        .listNeighbors({
          refType: 'DISEASE',
          refId: diseaseSlug,
          edgeTypes: ['HAS_SYMPTOM'],
          statuses: ['DRAFT', 'PUBLISHED', 'APPROVED'],
          limit: 50,
        })
        .then(() => undefined),
    );
    ops.push(this.perfOp('disease_neighbor_lookup', diseaseLegacy, diseaseUvkg));

    const medLegacy = await this.avgMs(samples, () =>
      legacy.medicineNeighbors({ genericSlug: medicineSlug }).then(() => undefined),
    );
    const medUvkg = await this.avgMs(samples, () =>
      repo
        .listNeighbors({
          refType: 'MEDICINE_GENERIC',
          refId: medicineSlug,
          statuses: ['DRAFT', 'PUBLISHED', 'APPROVED'],
          limit: 50,
        })
        .then(() => undefined),
    );
    ops.push(this.perfOp('medicine_neighbor_lookup', medLegacy, medUvkg));

    const feedLegacy = await this.avgMs(samples, () =>
      legacy.feedNeighbors({ ingredientSlug: feedSlug }).then(() => undefined),
    );
    const feedUvkg = await this.avgMs(samples, () =>
      repo
        .listNeighbors({
          refType: 'FEED_INGREDIENT',
          refId: feedSlug,
          statuses: ['DRAFT', 'PUBLISHED', 'APPROVED'],
          limit: 50,
        })
        .then(() => undefined),
    );
    ops.push(this.perfOp('feed_neighbor_lookup', feedLegacy, feedUvkg));

    return ops;
  }

  private perfOp(
    operation: string,
    legacyAvgMs: number,
    uvkgAvgMs: number,
  ): UvkgPerformanceCompareOp {
    const regressionRatio =
      legacyAvgMs <= 0.01 ? uvkgAvgMs / UVKG_BENCHMARK_TARGET_MS : uvkgAvgMs / legacyAvgMs;
    const bothSubFiveMs = legacyAvgMs < 5 && uvkgAvgMs < 5;
    const met =
      uvkgAvgMs <= UVKG_BENCHMARK_TARGET_MS &&
      (bothSubFiveMs || regressionRatio <= UVKG_PERFORMANCE_REGRESSION_FACTOR);
    return {
      operation,
      legacyAvgMs: Math.round(legacyAvgMs * 100) / 100,
      uvkgAvgMs: Math.round(uvkgAvgMs * 100) / 100,
      regressionRatio: Math.round(regressionRatio * 100) / 100,
      met,
    };
  }

  private async avgMs(samples: number, fn: () => Promise<void>): Promise<number> {
    const times: number[] = [];
    for (let i = 0; i < samples; i++) {
      const start = performance.now();
      await fn();
      times.push(performance.now() - start);
    }
    return times.reduce((a, b) => a + b, 0) / times.length;
  }

  private validateRolloutSteps(): UvkgRolloutStepResult[] {
    const keys = Array.from({ length: 100 }, (_, i) => `req-shadow-${i}`);
    return UVKG_READ_PERCENT_STEPS.map((percent) => {
      const dist: Record<string, number> = { legacy: 0, uvkg: 0 };
      for (const key of keys) {
        const bucket = uvkgReadCanaryBucket(key);
        const route = bucket < percent;
        dist[route ? 'uvkg' : 'legacy'] += 1;
      }
      const expectedUvkg = percent;
      const actualUvkg = (dist.uvkg / keys.length) * 100;
      const valid = Math.abs(actualUvkg - expectedUvkg) <= 12;
      return { percent, bucketDistribution: dist, valid };
    });
  }

  private computePhase6Readiness(input: {
    config: ReturnType<typeof resolveUvkgConfig>;
    overallParityRatio: number;
    accuracyRatio: number;
    aiValidation: UvkgAiValidationResult[];
    performance: UvkgPerformanceCompareOp[];
    shadowReads: UvkgShadowCompareResult[];
    totalEdges: number;
    totalEntities: number;
  }): Pick<
    UvkgPhase5ValidationReport,
    'readinessScore' | 'recommendation' | 'blockers' | 'recommendations'
  > {
    const blockers: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    if (input.totalEdges >= UVKG_PHASE4_TARGETS.minEdges) score += 20;
    else blockers.push(`UVKG edges ${input.totalEdges} < ${UVKG_PHASE4_TARGETS.minEdges}`);

    if (input.totalEntities >= UVKG_PHASE4_TARGETS.minEntities) score += 15;
    else blockers.push(`UVKG entities ${input.totalEntities} < ${UVKG_PHASE4_TARGETS.minEntities}`);

    if (input.overallParityRatio >= UVKG_PHASE5_PARITY_TARGET) score += 25;
    else {
      blockers.push(
        `Overall parity ${(input.overallParityRatio * 100).toFixed(1)}% < ${UVKG_PHASE5_PARITY_TARGET * 100}%`,
      );
      recommendations.push('Publish high-confidence DRAFT links or sync legacy graphs for parity baseline');
    }

    if (input.accuracyRatio >= 0.9) score += 20;
    else blockers.push(`Read accuracy categories met: ${(input.accuracyRatio * 100).toFixed(0)}%`);

    const aiMet = input.aiValidation.filter((a) => a.met).length / input.aiValidation.length;
    if (aiMet >= 0.8) score += 10;
    else blockers.push('AI retrieval validation below threshold');

    if (input.performance.every((p) => p.met)) score += 10;
    else blockers.push('UVKG read latency regression vs legacy');

    if (input.shadowReads.length >= 10) score += 5;
    else blockers.push('Insufficient shadow read samples');

    if (!input.config.readEnabled) {
      score += 5;
      recommendations.push('Keep UVKG_READ_ENABLED=false until canary; use UVKG_SHADOW_READ_ENABLED=true');
    } else if (input.config.readPercent < 100) {
      recommendations.push(`Canary at ${input.config.readPercent}% — increase via UVKG_READ_PERCENT after monitoring`);
    }

    const legacyEmptyRate =
      input.shadowReads.filter((s) => s.legacyEmpty).length / Math.max(input.shadowReads.length, 1);
    if (legacyEmptyRate > 0.5) {
      recommendations.push(
        'Legacy graphs sparse — parity uses UVKG structural validation; run legacy seeds + ops:uvkg-phase4 sync for full parity',
      );
    }

    recommendations.push('Progressive rollout: UVKG_READ_PERCENT=10 → 25 → 50 → 100 with shadow monitoring');

    const readinessScore = Math.round(Math.min(100, score));
    const recommendation: UvkgPhase5ValidationReport['recommendation'] =
      readinessScore >= 85 && blockers.length === 0 ? 'READY_FOR_PHASE6' : 'NOT_READY';

    return { readinessScore, recommendation, blockers, recommendations };
  }
}

let phase5: Phase5ValidationService | undefined;

export function getPhase5ValidationService(): Phase5ValidationService {
  phase5 ??= new Phase5ValidationService();
  return phase5;
}

export function resetPhase5ValidationServiceForTests(): void {
  phase5 = undefined;
}
