import { describe, expect, it } from 'vitest';

import { buildEmbeddingText } from './embedding/embedding-text.util.js';
import { fuseHybridCandidates } from './search/hybrid-fusion.service.js';
import { scoreLexicalMatch, resolveStructuredRecord } from './search/lexical-scoring.util.js';
import { buildSourceCitations } from './packs/citation-builder.js';
import { buildEvidenceBlock, buildEvidenceSummary } from './packs/evidence-builder.js';
import { buildConfidenceBlock } from './packs/confidence-builder.js';
import { filterGroundableChunks, buildKnowledgeContextPack } from './packs/context-pack-builder.js';
import { buildEnrichedPromptContext } from './grounding/grounding-engine.js';
import {
  detectMedicalIntent,
  detectEmergencyIntent,
  evaluateMedicalSafety,
} from './grounding/medical-safety.service.js';
import { applyLowConfidencePolicy } from './grounding/low-confidence.handler.js';
import { decideConfidenceRouting, extractStructuredFacts } from './routing/confidence-router.service.js';
import { rerankCandidates } from './ranking/reranker.service.js';
import { RETRIEVAL_PROFILES } from './profiles/retrieval-profile.registry.js';
import type { RetrievedChunk } from './knowledge-retrieval.types.js';

function sampleChunk(overrides: Partial<RetrievedChunk> = {}): RetrievedChunk {
  return {
    knowledgeEntryId: 'e1',
    chunkIndex: 0,
    entryVersion: 1,
    contentType: 'MEDICINE',
    slug: 'drug-a',
    title: 'Drug A',
    excerpt: 'dose info',
    evidenceLevel: 'L2',
    confidenceScore: 0.82,
    clinicalRiskTier: 'HIGH',
    rank: 1,
    fusedScore: 0.9,
    inlineCitation: '[drug-ref|p.12]',
    sources: [{ sourceId: 's1', title: 'Ref', citation: '[drug-ref|p.12] Ref' }],
    ...overrides,
  };
}

describe('lexical-scoring locale boost', () => {
  it('boosts BN content when locale is bn', () => {
    const bnFavored = scoreLexicalMatch({
      query: 'mastitis',
      contentBn: 'mastitis লক্ষণ',
      contentEn: 'other topic',
      titleBn: 'Mastitis',
      titleEn: 'Other',
      locale: 'bn',
    });
    const neutral = scoreLexicalMatch({
      query: 'mastitis',
      contentBn: 'mastitis লক্ষণ',
      contentEn: 'other topic',
      titleBn: 'Mastitis',
      titleEn: 'Other',
      locale: 'en',
    });
    expect(bnFavored).toBeGreaterThanOrEqual(neutral);
  });
});

describe('embedding text template', () => {
  it('includes evidence, confidence, and cite tags per VRE contract', () => {
    const text = buildEmbeddingText({
      contentType: 'MEDICINE',
      species: ['COW'],
      clinicalRiskTier: 'HIGH',
      contentBn: 'bn body',
      contentEn: 'en body',
      evidenceLevel: 'L2',
      confidenceScore: 0.85,
      inlineCitation: '[drug-ref|p.12]',
    });
    expect(text).toContain('[evidence=L2]');
    expect(text).toContain('[confidence=0.85]');
    expect(text).toContain('[cite=[drug-ref|p.12]]');
  });
});

describe('structured fact extraction', () => {
  it('reads structuredJson from metadata envelope', () => {
    const facts = extractStructuredFacts({
      knowledgeEntryId: 'e1',
      contentType: 'MEDICINE',
      metadataJson: { structuredJson: { doseMgKg: 10, withdrawalDays: 7 } },
      evidenceLevel: 'L2',
      confidenceScore: 0.8,
      inlineCitation: '[drug-ref]',
    });
    expect(facts).toHaveLength(2);
    expect(facts[0]?.factType).toBe('DOSE_MG_KG');
  });

  it('returns null record when metadata missing', () => {
    expect(resolveStructuredRecord(null)).toBeNull();
  });
});

describe('citation slug fallback', () => {
  it('builds slug-based citation without sourceId', () => {
    const cites = buildSourceCitations({
      sourceId: null,
      sourceKey: null,
      slug: 'mastitis-guide',
      titleBn: 'mastitis bn',
      titleEn: 'mastitis en',
      locale: 'bn',
    });
    expect(cites[0]?.citation).toContain('[mastitis-guide]');
  });
});

describe('evidence and confidence injection', () => {
  it('builds evidence and confidence blocks for pack', () => {
    const chunk = sampleChunk();
    expect(buildEvidenceBlock([chunk], 'en')).toContain('L2');
    expect(buildEvidenceSummary([chunk])?.dominant).toBe('L2');
    expect(buildConfidenceBlock([chunk], 'en')).toContain('0.82');
  });
});

describe('groundable chunk filter', () => {
  it('drops chunks without inline citation', () => {
    const filtered = filterGroundableChunks([
      sampleChunk(),
      sampleChunk({ inlineCitation: '   ' }),
    ]);
    expect(filtered).toHaveLength(1);
  });

  it('pack builder excludes uncited chunks from grounding blocks', () => {
    const pack = buildKnowledgeContextPack({
      packId: 'p1',
      taskType: 'GENERAL_CHAT',
      locale: 'en',
      query: 'test',
      normalizedQuery: 'test',
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      retrievalMode: 'hybrid',
      chunks: [sampleChunk(), sampleChunk({ inlineCitation: '' })],
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
        semanticMs: 1,
        fusionMs: 0,
        rerankMs: 0,
        rankMs: 1,
        packBuildMs: 0,
        totalMs: 3,
      },
    });
    expect(pack.chunks).toHaveLength(1);
    expect(pack.evidenceBlock).toContain('L2');
    expect(pack.groundingInstruction).toContain('Reference:');
  });
});

describe('medical safety and fail-closed', () => {
  it('detects medical and emergency intent', () => {
    expect(detectMedicalIntent('antibiotic dose for cow')).toBe(true);
    expect(detectEmergencyIntent('cow is bleeding urgently')).toBe(true);
    expect(detectMedicalIntent('weather today')).toBe(false);
  });

  it('blocks medical query with zero chunks', () => {
    const decision = evaluateMedicalSafety({
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      query: 'antibiotic dose',
      taskType: 'GENERAL_CHAT',
      chunks: [],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('BLOCK');
    expect(decision.failClosed).toBe(true);
  });

  it('blocks prescription without structured facts', () => {
    const decision = decideConfidenceRouting({
      profile: RETRIEVAL_PROFILES['prescription-v1']!,
      query: 'enrofloxacin dose',
      chunks: [sampleChunk({ confidenceScore: 0.9 })],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
    });
    expect(decision.action).toBe('BLOCK');
  });

  it('degrades on low average confidence when failClosed false', () => {
    const decision = applyLowConfidencePolicy({
      profile: RETRIEVAL_PROFILES['farmer-chat-v1']!,
      chunks: [sampleChunk({ confidenceScore: 0.35, contentType: 'FARM_MGMT' })],
      structuredFacts: [],
      embeddingCoverage: 1,
      semanticEnabled: true,
      baseDecision: {
        action: 'PROCEED',
        reason: 'ok',
        failClosed: false,
        disclaimerLevel: 'standard',
        medicalRiskTier: 'NONE',
      },
    });
    expect(decision.action).toBe('PROCEED_DEGRADED');
  });
});

describe('hybrid fusion and reranking', () => {
  it('merges lexical and semantic candidate keys', () => {
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
  });

  it('reranker prefers higher confidence entry', () => {
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

describe('grounding enriched context', () => {
  it('prefixes degraded caution in enriched prompt', () => {
    const prefix = buildEnrichedPromptContext({
      groundingInstruction: 'Reference:\n[1] test',
      routingDecision: { action: 'PROCEED_DEGRADED', disclaimerLevel: 'elevated' },
      locale: 'en',
    });
    expect(prefix).toContain('Caution:');
    expect(prefix).toContain('Reference:');
  });
});
