import { describe, expect, it } from 'vitest';

import { expandColloquialTerms } from './query/colloquial-map.js';
import { normalizeQueryForRetrieval } from './query/query-normalizer.service.js';
import { applyMedicalConfidenceCalibration, MEDICAL_CONFIDENCE_CALIBRATION } from './calibration/medical-confidence.calibration.js';
import { scoreCrossEncoderPair, applyCrossEncoderRerank } from './ranking/cross-encoder-reranker.service.js';
import { buildRetrievalMetadataJson, hashRetrievalQuery } from './telemetry/retrieval-metadata.builder.js';
import { validateLlmOutput } from './validation/post-llm-validator.service.js';
import { evaluateGoldenQuery, computePrecisionAt4, summarizeGoldenEval } from './eval/golden-set.eval.js';
import { computeRecallAt10, isMedicalFailClosedEmptyPack } from './eval/golden-set-live.eval.js';
import { formatPgvectorLiteral } from './search/pgvector.util.js';
import { setVreConfigForTests } from './config/vre-config.js';
import { RETRIEVAL_PROFILES } from './profiles/retrieval-profile.registry.js';
import { buildKnowledgeContextPack } from './routing/confidence-router.service.js';
import type { RetrievedChunk } from './knowledge-retrieval.types.js';

describe('Phase 6C.13 — colloquial expansion', () => {
  it('expands BN colloquial terms', () => {
    const result = expandColloquialTerms('গরুর দুধ কমে গেছে');
    expect(result.matched).toBe(true);
    expect(result.expandedTerms).toContain('mastitis');
  });

  it('normalizes query with expansion enabled', () => {
    setVreConfigForTests({ colloquialExpansionEnabled: true });
    const normalized = normalizeQueryForRetrieval({ query: 'গরু জ্বর', locale: 'bn' });
    expect(normalized.colloquialExpanded).toBe(true);
    expect(normalized.text).toContain('fever');
    setVreConfigForTests(null);
  });
});

describe('Phase 6C.13 — medical confidence calibration', () => {
  it('applies calibrated thresholds to farmer-chat profile', () => {
    const calibrated = applyMedicalConfidenceCalibration(RETRIEVAL_PROFILES['farmer-chat-v1']!);
    expect(calibrated.medicalMinConfidence).toBe(
      MEDICAL_CONFIDENCE_CALIBRATION['farmer-chat-v1']!.medicalMinConfidence,
    );
    expect(calibrated.semanticWeight).toBeGreaterThan(calibrated.lexicalWeight * 0.9);
  });
});

describe('Phase 6C.13 — cross-encoder reranker', () => {
  it('scores query-passage overlap', () => {
    const score = scoreCrossEncoderPair({
      query: 'mastitis cow symptoms',
      passage: 'mastitis udder infection in dairy cow',
      domain: 'DISEASE',
      fusedScore: 0.7,
    });
    expect(score).toBeGreaterThan(0.5);
  });

  it('reranks candidates when enabled', async () => {
    setVreConfigForTests({ crossEncoderRerankEnabled: true });
    const result = await applyCrossEncoderRerank({
      query: 'mastitis',
      candidates: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          lexicalScore: 0.3,
          semanticScore: 0.3,
          fusedScore: 0.3,
          domainBoost: 0.5,
          finalRankScore: 0.3,
          confidenceBoost: 1,
          localeBoost: 1,
        },
        {
          knowledgeEntryId: 'e2',
          chunkIndex: 0,
          entryVersion: 1,
          lexicalScore: 0.8,
          semanticScore: 0.8,
          fusedScore: 0.8,
          domainBoost: 0.8,
          finalRankScore: 0.8,
          confidenceBoost: 1,
          localeBoost: 1,
        },
      ],
      profile: { ...RETRIEVAL_PROFILES['prescription-v1']!, rerankerEnabled: true },
      contentTypeByEntry: new Map([
        ['e1', 'FARM_MGMT'],
        ['e2', 'DISEASE'],
      ]),
      chunkTextByKey: new Map([
        ['e1:0', { contentBn: 'weather', contentEn: 'weather' }],
        ['e2:0', { contentBn: 'mastitis udder', contentEn: 'mastitis udder' }],
      ]),
      locale: 'en',
    });
    expect(result.crossEncoderApplied).toBe(true);
    setVreConfigForTests(null);
  });
});

describe('Phase 6C.13 — retrieval metadata', () => {
  it('builds metadata json with query hash', () => {
    const pack = buildKnowledgeContextPack({
      packId: 'p1',
      taskType: 'GENERAL_CHAT',
      locale: 'bn',
      query: 'test query',
      normalizedQuery: 'test query',
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      retrievalMode: 'hybrid',
      chunks: [],
      structuredFacts: [],
      excludedCount: 0,
      embeddingCoverage: 1,
      routingDecision: {
        action: 'PROCEED',
        reason: 'ok',
        failClosed: false,
        disclaimerLevel: 'standard',
        medicalRiskTier: 'NONE',
      },
      scores: {
        lexicalMs: 1,
        semanticMs: 2,
        fusionMs: 0,
        rerankMs: 1,
        rankMs: 1,
        packBuildMs: 1,
        totalMs: 5,
      },
    });

    const meta = buildRetrievalMetadataJson({
      pack,
      normalized: normalizeQueryForRetrieval({ query: 'test query', locale: 'bn' }),
      profileLexicalWeight: 0.38,
      profileSemanticWeight: 0.47,
      crossEncoderApplied: false,
      searchBackend: 'full_scan',
    });

    expect(meta.schemaVersion).toBe('1.0');
    expect(meta.queryHash).toBe(hashRetrievalQuery('test query'));
    expect(meta.pgvectorAnn).toBe(false);
  });
});

describe('Phase 6C.13 — post-LLM validation', () => {
  const chunk = (): RetrievedChunk => ({
    knowledgeEntryId: 'm1',
    chunkIndex: 0,
    entryVersion: 1,
    contentType: 'MEDICINE',
    slug: 'drug-a',
    title: 'Drug',
    excerpt: 'dose',
    evidenceLevel: 'L2',
    confidenceScore: 0.9,
    clinicalRiskTier: 'HIGH',
    rank: 1,
    fusedScore: 0.9,
    inlineCitation: '[drug]',
    sources: [],
  });

  it('blocks uncited dosage claims', () => {
    setVreConfigForTests({ postLlmValidationEnabled: true });
    const pack = buildKnowledgeContextPack({
      packId: 'p1',
      taskType: 'PRESCRIPTION_ANALYSIS',
      locale: 'en',
      query: 'antibiotic dose',
      normalizedQuery: 'antibiotic dose',
      profile: RETRIEVAL_PROFILES['prescription-v1']!,
      retrievalMode: 'hybrid',
      chunks: [chunk()],
      structuredFacts: [],
      excludedCount: 0,
      embeddingCoverage: 1,
      routingDecision: {
        action: 'PROCEED',
        reason: 'ok',
        failClosed: false,
        disclaimerLevel: 'standard',
        medicalRiskTier: 'HIGH',
      },
      scores: {
        lexicalMs: 1,
        semanticMs: 1,
        fusionMs: 0,
        rerankMs: 0,
        rankMs: 1,
        packBuildMs: 0,
        totalMs: 3,
      },
    });

    const result = validateLlmOutput({
      llmOutput: 'Give 10 mg/kg enrofloxacin daily.',
      pack,
      taskType: 'PRESCRIPTION_ANALYSIS',
    });
    expect(result.action).toBe('BLOCK');
    setVreConfigForTests(null);
  });
});

describe('Phase 6C.13 — golden set live eval', () => {
  it('recognizes medical fail-closed empty pack as routing pass', () => {
    expect(
      isMedicalFailClosedEmptyPack({
        query: {
          id: 't1',
          tier: 'G1',
          locale: 'bn',
          query: 'ছাগলের ডায়রিয়া চিকিৎসা',
          profileId: 'farmer-chat-v1',
          taskType: 'GENERAL_CHAT',
          intent: 'medical',
          colloquial: true,
          expectedRouting: 'PROCEED',
          relevantSlugs: ['diarrhea'],
          mustNotRetrieve: [],
        },
        actualRouting: 'BLOCK',
        retrievedSlugs: [],
      }),
    ).toBe(true);
  });

  it('computes recall@10', () => {
    expect(
      computeRecallAt10({
        retrievedSlugs: ['mastitis-guide', 'other-topic', 'unrelated-1', 'unrelated-2'],
        relevantSlugs: ['mastitis', 'fever'],
      }),
    ).toBe(0.5);
  });
});

describe('Phase 6C.13 — golden set eval', () => {
  it('computes precision@4', () => {
    expect(
      computePrecisionAt4({
        retrievedSlugs: ['mastitis-guide', 'other', 'x', 'y'],
        relevantSlugs: ['mastitis'],
      }),
    ).toBe(0.25);
  });

  it('summarizes eval results', () => {
    const summary = summarizeGoldenEval([
      {
        queryId: 'q1',
        passed: true,
        routingMatch: true,
        actualRouting: 'PROCEED',
        precisionAt4: 1,
        violations: [],
      },
      {
        queryId: 'q2',
        passed: false,
        routingMatch: false,
        actualRouting: 'BLOCK',
        precisionAt4: 0,
        violations: ['routing'],
      },
    ]);
    expect(summary.passRate).toBe(0.5);
  });

  it('evaluates golden query record', () => {
    const result = evaluateGoldenQuery({
      query: {
        id: 't1',
        tier: 'G0',
        locale: 'bn',
        query: 'test',
        profileId: 'farmer-chat-v1',
        taskType: 'GENERAL_CHAT',
        intent: 'general',
        colloquial: false,
        expectedRouting: 'PROCEED',
        relevantSlugs: ['mastitis'],
        mustNotRetrieve: ['wrong-slug'],
      },
      retrievedSlugs: ['mastitis-guide', 'mastitis-treatment', 'x', 'y'],
      actualRouting: 'PROCEED',
    });
    expect(result.passed).toBe(true);
  });
});

describe('Phase 6C.13 — pgvector utils', () => {
  it('formats vector literal', () => {
    expect(formatPgvectorLiteral([1, 2, 3])).toBe('[1,2,3]');
  });
});
