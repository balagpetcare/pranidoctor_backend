import { describe, expect, it } from 'vitest';

import { buildKnowledgeContextPack } from '../routing/confidence-router.service.js';
import { RETRIEVAL_PROFILES } from '../profiles/retrieval-profile.registry.js';
import type { RetrievedChunk } from '../knowledge-retrieval.types.js';
import {
  compositeScoresFromSummary,
  evaluateGseRecord,
  summarizeGseEval,
} from './gse-evaluator.service.js';
import type { GoldenEvalRecord } from './golden-set.types.js';
import { scoreCitation } from './scorers/citation.scorer.js';
import { scoreConfidence } from './scorers/confidence.scorer.js';
import { scoreGrounding } from './scorers/grounding.scorer.js';
import { scoreRetrieval } from './scorers/retrieval.scorer.js';
import { scoreSafety } from './scorers/safety.scorer.js';
import { scoreVeterinary } from './scorers/veterinary.scorer.js';

function mockChunk(slug: string, citation: string): RetrievedChunk {
  return {
    knowledgeEntryId: `e-${slug}`,
    chunkIndex: 0,
    entryVersion: 1,
    contentType: 'DISEASE',
    slug,
    title: slug,
    excerpt: `${slug} excerpt`,
    evidenceLevel: 'L2',
    confidenceScore: 0.82,
    clinicalRiskTier: 'MEDIUM',
    rank: 1,
    fusedScore: 0.85,
    inlineCitation: citation,
    sources: [{ sourceId: 's1', sourceKey: 'dls-veterinary', title: 'DLS', citation: '[DLS]' }],
  };
}

function mockPack(chunks: RetrievedChunk[], routing: 'PROCEED' | 'BLOCK' = 'PROCEED') {
  return buildKnowledgeContextPack({
    packId: 'test-pack',
    taskType: 'DISEASE_ANALYSIS',
    locale: 'bn',
    query: 'test',
    normalizedQuery: 'test',
    profile: RETRIEVAL_PROFILES['ai-doctor-v1']!,
    retrievalMode: 'hybrid',
    chunks,
    structuredFacts: [],
    excludedCount: 0,
    embeddingCoverage: 1,
    routingDecision: {
      action: routing,
      reason: 'test',
      failClosed: routing === 'BLOCK',
      disclaimerLevel: routing === 'BLOCK' ? 'blocking' : 'standard',
      medicalRiskTier: 'NONE',
    },
    scores: {
      lexicalMs: 1,
      semanticMs: 1,
      fusionMs: 0,
      rerankMs: 0,
      rankMs: 0,
      packBuildMs: 0,
      totalMs: 5,
    },
  });
}

const baseQuery: GoldenEvalRecord = {
  id: 'test-001',
  tier: 'G1',
  bank: 'SY',
  locale: 'bn',
  query: 'গরুর mastitis',
  profileId: 'ai-doctor-v1',
  taskType: 'DISEASE_ANALYSIS',
  intent: 'medical',
  colloquial: true,
  expectedRouting: 'PROCEED',
  relevantSlugs: ['mastitis'],
  mustNotRetrieve: ['weather'],
  expectedCitations: {
    minCount: 1,
    inlineCitationInPack: true,
    entities: [{ slug: 'mastitis', minGrade: 2 }],
  },
  expectedConfidence: {
    pack: { min: 0.55, max: 0.95 },
    chunksTop4: { min: 0.55, max: 1.0 },
  },
};

describe('GSE — retrieval scorer', () => {
  it('passes when routing and slugs match', () => {
    const result = scoreRetrieval({
      query: baseQuery,
      retrievedSlugs: ['mastitis-guide', 'mastitis-treatment', 'mastitis-signs', 'other'],
      actualRouting: 'PROCEED',
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(70);
  });

  it('flags mustNotRetrieve violations', () => {
    const result = scoreRetrieval({
      query: baseQuery,
      retrievedSlugs: ['weather-alert', 'mastitis', 'x', 'y'],
      actualRouting: 'PROCEED',
    });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('mustNotRetrieve'))).toBe(true);
  });
});

describe('GSE — grounding scorer', () => {
  it('requires full citation coverage for medical chunks', () => {
    const pack = {
      ...mockPack([mockChunk('mastitis', '[mastitis]')]),
      chunks: [
        mockChunk('mastitis', '[mastitis]'),
        { ...mockChunk('other', ''), inlineCitation: '', rank: 2 },
      ],
    };
    const result = scoreGrounding({ query: baseQuery, pack });
    expect(result.passed).toBe(false);
    expect(result.violations.some((v) => v.includes('citation coverage'))).toBe(true);
  });
});

describe('GSE — citation scorer', () => {
  it('validates entity slug in top-4', () => {
    const pack = mockPack([mockChunk('mastitis', '[mastitis]')]);
    const result = scoreCitation({ query: baseQuery, pack });
    expect(result.passed).toBe(true);
  });
});

describe('GSE — safety scorer', () => {
  it('requires BLOCK for prescription fail-closed', () => {
    const pack = mockPack([], 'PROCEED');
    const blockQuery: GoldenEvalRecord = {
      ...baseQuery,
      intent: 'prescription',
      expectedRouting: 'BLOCK',
      expectedEscalation: { routing: 'BLOCK', emptyPackMustBlock: true },
    };
    const result = scoreSafety({
      query: blockQuery,
      pack,
      retrievedSlugs: [],
    });
    expect(result.passed).toBe(false);
  });
});

describe('GSE — confidence scorer', () => {
  it('checks pack confidence band', () => {
    const pack = mockPack([mockChunk('mastitis', '[mastitis]')]);
    const result = scoreConfidence({ query: baseQuery, pack });
    expect(result.metrics.packConfidenceAvg).toBeGreaterThan(0);
  });
});

describe('GSE — veterinary scorer', () => {
  it('scores differential slug alignment', () => {
    const pack = mockPack([mockChunk('mastitis', '[mastitis]')]);
    const result = scoreVeterinary({
      query: baseQuery,
      pack,
      differentials: [
        {
          slug: 'mastitis',
          titleBn: 'Mastitis',
          titleEn: 'Mastitis',
          rank: 1,
          confidenceScore: 0.8,
          evidenceLevel: 'L2',
          supportingSymptoms: [],
          citations: ['[mastitis]'],
          source: 'rag',
        },
      ],
    });
    expect(result.passed).toBe(true);
  });
});

describe('GSE — evaluator orchestrator', () => {
  it('composes all dimensions', () => {
    const pack = mockPack([
      mockChunk('mastitis', '[mastitis]'),
      mockChunk('mastitis-care', '[mastitis-care]'),
    ]);
    pack.citationBlock = '[mastitis]';
    const result = evaluateGseRecord({ query: baseQuery, pack });
    expect(result.dimensions).toHaveLength(6);
    expect(result.compositeScore).toBeGreaterThan(0);
    expect(result.violations.some((v) => v.includes('mustNotRetrieve'))).toBe(false);
  });

  it('summarizes batch results', () => {
    const passPack = mockPack([
      mockChunk('mastitis', '[mastitis]'),
      mockChunk('mastitis-care', '[mastitis-care]'),
    ]);
    passPack.citationBlock = '[mastitis]';
    const results = [
      evaluateGseRecord({ query: baseQuery, pack: passPack }),
      evaluateGseRecord({
        query: { ...baseQuery, id: 'fail', expectedRouting: 'BLOCK' },
        pack: mockPack([], 'PROCEED'),
      }),
    ];
    const summary = summarizeGseEval(results);
    const scores = compositeScoresFromSummary(summary);
    expect(summary.total).toBe(2);
    expect(summary.passed).toBeGreaterThanOrEqual(0);
    expect(scores.productionReadinessScore).toBeGreaterThan(0);
    expect(summary.dimensionAverages.retrieval).toBeGreaterThan(0);
  });
});
