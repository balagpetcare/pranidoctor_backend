import { describe, expect, it, beforeEach } from 'vitest';

import {
  resolveUvkgConfig,
  setUvkgConfigForTests,
  shouldRouteToUvkgRead,
  uvkgReadCanaryBucket,
} from './config/uvkg-config.js';
import { UVKG_READ_PERCENT_STEPS } from './uvkg-phase5.constants.js';
import { getUvkgReadRouterService, resetUvkgReadRouterServiceForTests } from './services/uvkg-read-router.service.js';
import {
  mapDiseaseEdgeType,
  mapFeedEdgeType,
  mapMedicineEdgeType,
  PROFILE_EDGE_ALLOWLIST,
} from './uvkg.edge-mapping.js';
import { buildSourceLinkKey, buildUvkgLinkKey, normalizeSourceEdgeId } from './uvkg.util.js';
import { getUvkgDualWriteService, resetUvkgDualWriteServiceForTests } from './services/uvkg-dual-write.service.js';
import { getUvkgTraversalService, resetUvkgTraversalServiceForTests } from './services/uvkg-traversal.service.js';
import { UVKG_COVERAGE_MINIMUMS, UVKG_PHASE4_TARGETS } from './uvkg-phase4.constants.js';
import { formatPhase4ValidationMarkdown } from './uvkg-report.formatter.js';
import type { UvkgPhase4ValidationReport } from './uvkg.types.js';

describe('uvkg.edge-mapping', () => {
  it('maps feed TOXICITY_OF to UVKG TOXIC_TO', () => {
    expect(mapFeedEdgeType('TOXICITY_OF')).toEqual({
      uvkgEdgeType: 'TOXIC_TO',
      edgeClass: 'CLINICAL',
    });
  });

  it('maps medicine CONTRAINDICATED_WITH to CONTRAINDICATES', () => {
    expect(mapMedicineEdgeType('CONTRAINDICATED_WITH')).toEqual({
      uvkgEdgeType: 'CONTRAINDICATES',
      edgeClass: 'CLINICAL',
    });
  });

  it('maps disease CONTRAINDICATES_MEDICINE to CONTRAINDICATES', () => {
    expect(mapDiseaseEdgeType('CONTRAINDICATES_MEDICINE')).toEqual({
      uvkgEdgeType: 'CONTRAINDICATES',
      edgeClass: 'CLINICAL',
    });
  });

  it('isolates commercial SPONSORED_BY edge class', () => {
    expect(mapMedicineEdgeType('SPONSORED_BY').edgeClass).toBe('COMMERCIAL');
  });

  it('defines retrieval profile allowlists', () => {
    expect(PROFILE_EDGE_ALLOWLIST['prescription-v1']).toContain('INTERACTS_WITH');
    expect(PROFILE_EDGE_ALLOWLIST['feed-advisor-v1']).toContain('TOXIC_TO');
  });
});

describe('uvkg.util', () => {
  it('builds stable link keys', () => {
    const a = buildSourceLinkKey('FEED_GRAPH', 'edge-1');
    const b = buildSourceLinkKey('FEED_GRAPH', 'edge-1');
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it('builds semantic keys from endpoints', () => {
    const key = buildUvkgLinkKey(['HAS_SYMPTOM', 'DISEASE', 'mastitis', 'SYMPTOM', 'fever']);
    expect(key).toHaveLength(32);
  });

  it('normalizes long source edge ids', () => {
    const long = 'x'.repeat(200);
    expect(normalizeSourceEdgeId(long)).toHaveLength(32);
  });
});

describe('uvkg.config', () => {
  beforeEach(() => {
    setUvkgConfigForTests(null);
  });

  it('defaults read to disabled for backward compatibility', () => {
    const config = resolveUvkgConfig();
    expect(config.readEnabled).toBe(false);
    expect(config.legacyFallbackEnabled).toBe(true);
  });

  it('allows test overrides', () => {
    setUvkgConfigForTests({ readEnabled: true, dualWriteEnabled: false });
    expect(resolveUvkgConfig().readEnabled).toBe(true);
    expect(resolveUvkgConfig().dualWriteEnabled).toBe(false);
  });

  it('parses read percent and shadow flags', () => {
    setUvkgConfigForTests({
      readPercent: 25,
      shadowReadEnabled: true,
      shadowIncludeDraft: true,
    });
    const c = resolveUvkgConfig();
    expect(c.readPercent).toBe(25);
    expect(c.shadowReadEnabled).toBe(true);
  });
});

describe('uvkg canary rollout', () => {
  beforeEach(() => {
    setUvkgConfigForTests(null);
    resetUvkgReadRouterServiceForTests();
  });

  it('routes 0% traffic to legacy', () => {
    setUvkgConfigForTests({ readEnabled: true, readPercent: 0 });
    expect(shouldRouteToUvkgRead('any-key', resolveUvkgConfig())).toBe(false);
  });

  it('routes 100% traffic to uvkg when read enabled', () => {
    setUvkgConfigForTests({ readEnabled: true, readPercent: 100 });
    expect(shouldRouteToUvkgRead('any-key', resolveUvkgConfig())).toBe(true);
  });

  it('uses stable buckets 0-99', () => {
    expect(uvkgReadCanaryBucket('a')).toBe(uvkgReadCanaryBucket('a'));
    expect(uvkgReadCanaryBucket('a')).toBeGreaterThanOrEqual(0);
    expect(uvkgReadCanaryBucket('a')).toBeLessThan(100);
  });

  it('defines rollout steps', () => {
    expect(UVKG_READ_PERCENT_STEPS).toEqual([0, 10, 25, 50, 100]);
  });

  it('resolves legacy when read disabled', () => {
    setUvkgConfigForTests({ readEnabled: false, readPercent: 100 });
    expect(getUvkgReadRouterService().resolveSource('k')).toBe('legacy');
  });
});

describe('UvkgTraversalService', () => {
  beforeEach(() => {
    resetUvkgTraversalServiceForTests();
    setUvkgConfigForTests({ readEnabled: false });
  });

  it('returns disabled when UVKG_READ_ENABLED is off', async () => {
    const result = await getUvkgTraversalService().neighbors({
      refType: 'DISEASE',
      refId: 'mastitis',
    });
    expect(result.source).toBe('disabled');
    expect(result.neighbors).toHaveLength(0);
  });
});

describe('UvkgDualWriteService', () => {
  beforeEach(() => {
    resetUvkgDualWriteServiceForTests();
    setUvkgConfigForTests({ dualWriteEnabled: false });
  });

  it('skips dual-write when disabled', async () => {
    const result = await getUvkgDualWriteService().afterFeedGraphEdge({
      legacyEdgeId: 'e1',
      edgeType: 'CONTAINS',
      fromEntitySlug: 'rice-bran',
      toEntitySlug: 'ration-dairy-lactating',
    });
    expect(result).toBeNull();
  });
});

describe('uvkg phase4 constants', () => {
  it('defines volume targets', () => {
    expect(UVKG_PHASE4_TARGETS.minEdges).toBe(10_000);
    expect(UVKG_COVERAGE_MINIMUMS.disease_symptom.edgeTypes).toContain('HAS_SYMPTOM');
  });
});

describe('formatPhase4ValidationMarkdown', () => {
  it('renders readiness section', () => {
    const stub: UvkgPhase4ValidationReport = {
      generatedAt: new Date().toISOString(),
      population: {
        startedAt: '',
        completedAt: '',
        sources: {},
        derived: {},
        totalLinksAfter: 100,
        totalEntitiesReferenced: 50,
      },
      coverage: {
        generatedAt: '',
        totalEdges: 100,
        totalEntities: 50,
        byEdgeType: {},
        byStatus: { DRAFT: 100 },
        bySource: {},
        categories: [],
        targetsMet: false,
      },
      quality: { generatedAt: '', issues: [], issueCounts: {} },
      governance: {
        generatedAt: '',
        statusCounts: { DRAFT: 100 },
        unpublishedInTraversalSample: 0,
        traversalPublishedOnly: true,
        lifecycleTransitionsValidated: true,
        notes: ['UVKG_READ_ENABLED=false'],
      },
      analytics: {
        generatedAt: '',
        entityCount: 50,
        edgeCount: 100,
        edgeCountByType: {},
        edgeCountByStatus: {},
        crossDomainCoverage: [],
        topConnectedEntities: [],
        orphanNodes: [],
        drift: {
          generatedAt: '',
          feedLegacyCount: 0,
          medicineLegacyCount: 0,
          diseaseLegacyCount: 0,
          uvkgCount: 100,
          uvkgBySource: {},
          openConflicts: 0,
          missingInUvkg: 0,
        },
      },
      benchmarks: {
        generatedAt: '',
        operations: [],
        allMet: true,
      },
      drift: {
        generatedAt: '',
        feedLegacyCount: 0,
        medicineLegacyCount: 0,
        diseaseLegacyCount: 0,
        uvkgCount: 100,
        uvkgBySource: {},
        openConflicts: 0,
        missingInUvkg: 0,
      },
      readinessScore: 42,
      readinessForPhase5: 'NOT_READY',
      blockers: ['Edge count below target'],
      recommendations: ['Run knowledge:wave1'],
    };
    const md = formatPhase4ValidationMarkdown(stub);
    expect(md).toContain('Phase 5 readiness');
    expect(md).toContain('NOT_READY');
  });
});
