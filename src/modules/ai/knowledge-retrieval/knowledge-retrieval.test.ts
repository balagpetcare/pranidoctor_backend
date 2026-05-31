import { describe, expect, it } from 'vitest';

import { cosineSimilarity, normalizeScore } from './embedding/vector-math.util.js';
import { buildCitationBlock, buildGroundingInstruction } from './packs/citation-builder.js';
import { buildEvidenceBlock, buildEvidenceSummary } from './packs/evidence-builder.js';
import { buildConfidenceBlock } from './packs/confidence-builder.js';
import { detectMedicalIntent } from './grounding/medical-safety.service.js';
import { rerankCandidates } from './ranking/reranker.service.js';
import { fuseHybridCandidates } from './search/hybrid-fusion.service.js';
import { decideConfidenceRouting, buildKnowledgeContextPack } from './routing/confidence-router.service.js';
import { RETRIEVAL_PROFILES } from './profiles/retrieval-profile.registry.js';
import type { RetrievedChunk } from './knowledge-retrieval.types.js';

describe('vector-math', () => {
  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it('normalizes scores', () => {
    expect(normalizeScore(5, 0, 10)).toBe(0.5);
  });
});

describe('hybrid-fusion', () => {
  it('merges lexical and semantic hits', () => {
    const fused = fuseHybridCandidates({
      lexical: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          lexicalScore: 0.9,
        },
      ],
      semantic: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          semanticScore: 0.8,
        },
        {
          knowledgeEntryId: 'e2',
          chunkIndex: 0,
          entryVersion: 1,
          semanticScore: 0.7,
        },
      ],
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      contentTypeByEntry: new Map([
        ['e1', 'DISEASE'],
        ['e2', 'FARM_MGMT'],
      ]),
    });

    expect(fused.length).toBe(2);
    expect(fused[0]?.knowledgeEntryId).toBe('e1');
    expect(fused[0]?.semanticScore).toBeGreaterThan(0);
    expect(fused[0]?.lexicalScore).toBeGreaterThan(0);
  });
});

describe('confidence routing', () => {
  const medicalChunk = (confidence: number): RetrievedChunk => ({
    knowledgeEntryId: 'm1',
    chunkIndex: 0,
    entryVersion: 1,
    contentType: 'MEDICINE',
    slug: 'drug-a',
    title: 'Drug A',
    excerpt: 'dose info',
    evidenceLevel: 'L2',
    confidenceScore: confidence,
    clinicalRiskTier: 'HIGH',
    rank: 1,
    fusedScore: 0.9,
    inlineCitation: '[drug-ref]',
    sources: [],
  });

  it('blocks low-confidence medical advice', () => {
    const decision = decideConfidenceRouting({
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      query: 'antibiotic dose for cow',
      chunks: [medicalChunk(0.4)],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('BLOCK');
  });

  it('allows sufficient medical confidence', () => {
    const decision = decideConfidenceRouting({
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      query: 'general farm tips',
      chunks: [medicalChunk(0.7)],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('PROCEED');
  });

  it('fail-closes prescription without structured facts', () => {
    const decision = decideConfidenceRouting({
      profile: RETRIEVAL_PROFILES['prescription-v1']!,
      query: 'enrofloxacin dose',
      chunks: [medicalChunk(0.9)],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('BLOCK');
  });

  it('blocks medical query with no grounded chunks', () => {
    const decision = decideConfidenceRouting({
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      query: 'what antibiotic dose for mastitis',
      chunks: [],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('BLOCK');
  });
});

describe('citation builder', () => {
  it('builds BN citation block', () => {
    const block = buildCitationBlock(
      [
        {
          knowledgeEntryId: '1',
          chunkIndex: 0,
          entryVersion: 1,
          contentType: 'DISEASE',
          slug: 'mastitis',
          title: 'Mastitis',
          excerpt: 'লক্ষণ',
          evidenceLevel: 'L2',
          confidenceScore: 0.8,
          clinicalRiskTier: 'MEDIUM',
          rank: 1,
          fusedScore: 0.9,
          inlineCitation: '[dls-manual]',
          sources: [{ sourceId: 's1', title: 'DLS', citation: '[dls-manual] DLS' }],
        },
      ],
      'bn',
    );
    expect(block).toContain('তথ্যসূত্র');
    expect(block).toContain('[dls-manual]');
  });

  it('builds grounding instruction', () => {
    const instruction = buildGroundingInstruction('en', 'Sources:\n[1] test');
    expect(instruction).toContain('GUIDANCE');
    expect(instruction).toContain('Reference:');
  });
});

describe('KnowledgeContextPack', () => {
  it('assembles pack metadata', () => {
    const pack = buildKnowledgeContextPack({
      packId: 'pack-1',
      taskType: 'GENERAL_CHAT',
      locale: 'bn',
      query: 'test',
      normalizedQuery: 'test',
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      retrievalMode: 'lexical',
      chunks: [],
      structuredFacts: [],
      excludedCount: 0,
      embeddingCoverage: 1,
      routingDecision: {
        action: 'PROCEED_DEGRADED',
        reason: 'empty',
        failClosed: false,
        disclaimerLevel: 'elevated',
        medicalRiskTier: 'NONE',
      },
      scores: {
        lexicalMs: 1,
        semanticMs: 2,
        fusionMs: 0,
        rerankMs: 0,
        rankMs: 3,
        packBuildMs: 1,
        totalMs: 6,
      },
    });
    expect(pack.packId).toBe('pack-1');
    expect(pack.retrievalProfileId).toBe('farmer-chat-v1');
    expect(pack.evidenceBlock).toBeDefined();
    expect(pack.confidenceBlock).toBeDefined();
  });
});

describe('evidence and confidence builders', () => {
  const sampleChunk = (): RetrievedChunk => ({
    knowledgeEntryId: '1',
    chunkIndex: 0,
    entryVersion: 1,
    contentType: 'MEDICINE',
    slug: 'drug-a',
    title: 'Drug A',
    excerpt: 'dose',
    evidenceLevel: 'L2',
    confidenceScore: 0.82,
    clinicalRiskTier: 'HIGH',
    rank: 1,
    fusedScore: 0.9,
    inlineCitation: '[drug-ref]',
    sources: [],
  });

  it('builds evidence and confidence blocks', () => {
    const chunk = sampleChunk();
    expect(buildEvidenceBlock([chunk], 'en')).toContain('L2');
    expect(buildConfidenceBlock([chunk], 'en')).toContain('0.82');
    expect(buildEvidenceSummary([chunk])?.dominant).toBe('L2');
  });
});

describe('medical intent detection', () => {
  it('detects dosage queries', () => {
    expect(detectMedicalIntent('antibiotic dose for cow')).toBe(true);
    expect(detectMedicalIntent('weather today')).toBe(false);
  });
});

describe('reranker', () => {
  it('orders by final rank score', () => {
    const ranked = rerankCandidates({
      fused: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          lexicalScore: 0.5,
          semanticScore: 0.5,
          fusedScore: 0.5,
          domainBoost: 0.8,
        },
        {
          knowledgeEntryId: 'e2',
          chunkIndex: 0,
          entryVersion: 1,
          lexicalScore: 0.9,
          semanticScore: 0.9,
          fusedScore: 0.9,
          domainBoost: 0.8,
        },
      ],
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      confidenceByEntry: new Map([
        ['e1', 0.5],
        ['e2', 0.9],
      ]),
      contentTypeByEntry: new Map([
        ['e1', 'FARM_MGMT'],
        ['e2', 'DISEASE'],
      ]),
      chunkTextByKey: new Map(),
    });
    expect(ranked[0]?.knowledgeEntryId).toBe('e2');
  });
});
