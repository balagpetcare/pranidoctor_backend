import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeCaseConfidence,
  shouldFailClosed,
  tierFromScore,
} from './engines/confidence.engine.js';
import {
  allDifferentialsHaveCitations,
  fuseDifferentials,
  graphRowToDifferential,
} from './engines/differential-diagnosis.engine.js';
import {
  detectLexiconEmergency,
  shouldSkipLlmForEmergency,
} from './engines/emergency-detection.engine.js';
import {
  buildClarificationPlan,
  buildSymptomSnapshot,
  computeSymptomCompleteness,
  meetsLlmCompletenessGate,
} from './engines/symptom-intake.engine.js';
import { resolveEscalationType } from './engines/vet-escalation.engine.js';
import { buildNewCase } from './engines/ai-doctor-session.engine.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';

describe('AI Doctor — symptom intake engine', () => {
  it('computes completeness from structured symptoms', () => {
    const score = computeSymptomCompleteness({
      symptomCodes: ['FEVER'],
      freeTextSymptoms: [],
      durationDays: 2,
      severity: 'MODERATE',
    });
    expect(score.score).toBeGreaterThanOrEqual(0.6);
    expect(score.requiredFieldsMet).toBe(true);
  });

  it('returns clarification when completeness is low', () => {
    const completeness = computeSymptomCompleteness({
      symptomCodes: [],
      freeTextSymptoms: [],
    });
    const questions = buildClarificationPlan(completeness, 'bn');
    expect(questions.length).toBeGreaterThan(0);
    expect(meetsLlmCompletenessGate(completeness)).toBe(false);
  });

  it('normalizes colloquial free text', () => {
    const snapshot = buildSymptomSnapshot({
      symptomCodes: [],
      freeTextSymptoms: ['গরু জ্বর'],
      locale: 'bn',
    });
    expect(snapshot.normalizedTerms?.length).toBeGreaterThan(0);
  });
});

describe('AI Doctor — confidence engine', () => {
  it('fail-closes on insufficient confidence', () => {
    const confidence = computeCaseConfidence({
      differentials: [],
      completeness: computeSymptomCompleteness({ symptomCodes: [], freeTextSymptoms: [] }),
    });
    expect(confidence.tier).toBe('INSUFFICIENT');
    expect(confidence.failClosed).toBe(true);
    expect(
      shouldFailClosed({
        confidence,
        routingAction: 'PROCEED',
        hasGroundedCitations: false,
      }),
    ).toBe(true);
  });

  it('maps tiers from score', () => {
    expect(tierFromScore(0.75)).toBe('STRONG');
    expect(tierFromScore(0.55)).toBe('MODERATE');
    expect(tierFromScore(0.4)).toBe('LIMITED');
    expect(tierFromScore(0.2)).toBe('INSUFFICIENT');
  });
});

describe('AI Doctor — differential engine', () => {
  it('requires citations on all differentials', () => {
    expect(
      allDifferentialsHaveCitations([
        {
          slug: 'mastitis',
          titleBn: 'Mastitis',
          titleEn: 'Mastitis',
          rank: 1,
          confidenceScore: 0.8,
          evidenceLevel: 'L2',
          supportingSymptoms: [],
          citations: ['[mastitis]'],
          source: 'graph',
        },
      ]),
    ).toBe(true);
    expect(
      allDifferentialsHaveCitations([
        {
          slug: 'x',
          titleBn: 'X',
          titleEn: 'X',
          rank: 1,
          confidenceScore: 0.5,
          evidenceLevel: 'L2',
          supportingSymptoms: [],
          citations: [],
          source: 'graph',
        },
      ]),
    ).toBe(false);
  });

  it('fuses graph and rag differentials', () => {
    const pack = {
      chunks: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          contentType: 'DISEASE' as const,
          slug: 'mastitis',
          title: 'Mastitis',
          excerpt: 'udder',
          evidenceLevel: 'L2' as const,
          confidenceScore: 0.85,
          clinicalRiskTier: 'MEDIUM' as const,
          rank: 1,
          fusedScore: 0.9,
          inlineCitation: '[dls-mastitis]',
          sources: [],
        },
      ],
    } as unknown as KnowledgeContextPack;

    const fused = fuseDifferentials({
      graphRows: [
        {
          knowledgeEntryId: 'e1',
          slug: 'mastitis',
          titleBn: 'Mastitis BN',
          titleEn: 'Mastitis',
          weight: 0.7,
          evidenceLevel: 'L2',
          supportingSymptoms: ['FEVER'],
        },
      ],
      pack,
      locale: 'en',
    });

    expect(fused).toHaveLength(1);
    expect(fused[0]!.source).toBe('fused');
    expect(fused[0]!.citations).toContain('[dls-mastitis]');
  });

  it('maps graph row to cited differential', () => {
    const diff = graphRowToDifferential(
      {
        knowledgeEntryId: 'e1',
        slug: 'fever',
        titleBn: 'জ্বর',
        titleEn: 'Fever',
        weight: 0.6,
        evidenceLevel: 'L2',
        supportingSymptoms: ['FEVER'],
      },
      1,
    );
    expect(diff.citations[0]).toBe('[fever]');
  });
});

describe('AI Doctor — emergency detection', () => {
  it('detects emergency lexicon in snapshot', () => {
    expect(
      detectLexiconEmergency(
        { symptomCodes: [], freeTextSymptoms: ['গরু মরে যাচ্ছে জরুরি'], normalizedTerms: [] },
        'bn',
      ),
    ).toBe(true);
  });

  it('skips LLM on critical urgency', () => {
    expect(
      shouldSkipLlmForEmergency({
        urgencyTier: 'CRITICAL',
        triageBucket: 'HIGH',
        urgencyLevel: 10,
        redFlags: [],
        recommendationBn: '',
        recommendationEn: '',
        escalationRequired: true,
        emergency: true,
      }),
    ).toBe(true);
  });
});

describe('AI Doctor — vet escalation engine', () => {
  it('resolves VET_CALL_NOW on emergency', () => {
    expect(
      resolveEscalationType({
        urgencyTier: 'CRITICAL',
        routingAction: 'BLOCK',
        caseConfidence: 0,
        emergency: true,
      }),
    ).toBe('VET_CALL_NOW');
  });
});

describe('AI Doctor — session engine', () => {
  it('builds new case in INTAKE-ready shape', () => {
    const aiCase = buildNewCase({
      userId: 'u1',
      species: 'COW',
    });
    expect(aiCase.state).toBe('CREATED');
    expect(aiCase.symptomSnapshot.symptomCodes).toEqual([]);
  });
});

const retrieveMock = vi.fn();
const executePromptTaskMock = vi.fn();
const upsertMemoryMock = vi.fn();
const listMemoryMock = vi.fn();
const createSessionMock = vi.fn();
const createEscalationMock = vi.fn();
const addMessageMock = vi.fn();

vi.mock('../knowledge-retrieval/knowledge-retrieval.service.js', () => ({
  getKnowledgeRetrievalService: () => ({ retrieve: retrieveMock }),
}));

vi.mock('../foundation/ai-foundation.service.js', () => ({
  getAiFoundationService: () => ({ executePromptTask: executePromptTaskMock }),
}));

vi.mock('../../ai-veterinary-core/repository/ai-veterinary.repository.js', () => ({
  getAiVeterinaryRepository: () => ({
    createSession: createSessionMock,
    upsertMemory: upsertMemoryMock,
    listMemory: listMemoryMock,
    createEscalation: createEscalationMock,
    addMessage: addMessageMock,
    markSessionEscalated: vi.fn(),
  }),
}));

vi.mock('../audit/ai-audit.service.js', () => ({
  getAiAuditService: () => ({ write: vi.fn() }),
}));

vi.mock('../disclaimer/ai-disclaimer.resolver.js', () => ({
  resolveAiResponseDisclaimer: vi.fn(async () => 'Disclaimer'),
}));

vi.mock('./engines/emergency-detection.engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engines/emergency-detection.engine.js')>();
  return {
    ...actual,
    assessCaseRisk: vi.fn(async () => ({
      urgencyTier: 'LOW' as const,
      triageBucket: 'LOW' as const,
      urgencyLevel: 2,
      redFlags: [],
      recommendationBn: 'পর্যবেক্ষণ',
      recommendationEn: 'Monitor',
      escalationRequired: false,
      emergency: false,
    })),
  };
});

vi.mock('./engines/differential-diagnosis.engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./engines/differential-diagnosis.engine.js')>();
  return {
    ...actual,
    loadGraphDifferentials: vi.fn(async () => []),
  };
});

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    aiSymptomNode: { findMany: vi.fn(async () => []) },
  }),
}));

describe('AI Doctor — orchestrator', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { resetAiDoctorOrchestratorForTests } = await import('./ai-doctor-orchestrator.service.js');
    resetAiDoctorOrchestratorForTests();

    createSessionMock.mockResolvedValue({ id: 'sess-1' });
    upsertMemoryMock.mockResolvedValue({});
    createEscalationMock.mockResolvedValue({ id: 'esc-1' });

    listMemoryMock.mockImplementation(async (_userId: string, _kind: string, key?: string) => {
      if (!key) return [];
      return [
        {
          key,
          valueJson: {
            id: 'case-1',
            userId: 'u1',
            species: 'COW',
            locale: 'en',
            state: 'INTAKE',
            sessionId: 'sess-1',
            symptomSnapshot: {
              symptomCodes: ['FEVER'],
              freeTextSymptoms: ['cow fever'],
              durationDays: 3,
              severity: 'MODERATE',
            },
            completeness: {
              score: 0.75,
              requiredFieldsMet: true,
              missingFields: [],
              redFlagScreened: true,
            },
            differentials: [],
            escalationIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      ];
    });

    retrieveMock.mockResolvedValue({
      packId: 'pack-1',
      routingDecision: { action: 'PROCEED', reason: 'ok', failClosed: false, disclaimerLevel: 'standard', medicalRiskTier: 'LOW' },
      confidenceSummary: { min: 0.7, max: 0.9, avg: 0.8 },
      citationBlock: 'Sources:\n[1] DLS',
      groundingInstruction: 'Use only cited sources.',
      evidenceBlock: '',
      confidenceBlock: '',
      query: 'cow fever',
      locale: 'en',
      chunks: [
        {
          knowledgeEntryId: 'e1',
          chunkIndex: 0,
          entryVersion: 1,
          contentType: 'DISEASE',
          slug: 'fever-disease',
          title: 'Fever',
          excerpt: 'symptoms',
          evidenceLevel: 'L2',
          confidenceScore: 0.8,
          clinicalRiskTier: 'MEDIUM',
          rank: 1,
          fusedScore: 0.9,
          inlineCitation: '[fever-disease]',
          sources: [],
        },
      ],
      structuredFacts: [],
    });

    executePromptTaskMock.mockResolvedValue({
      content: 'Possible causes include fever-related conditions [fever-disease].',
      provider: 'openai',
      model: 'gpt-4',
    });
  });

  it('fail-closes analyze when routing is BLOCK', async () => {
    retrieveMock.mockResolvedValueOnce({
      packId: 'pack-block',
      routingDecision: { action: 'BLOCK', reason: 'no knowledge', failClosed: true, disclaimerLevel: 'blocking', medicalRiskTier: 'HIGH' },
      confidenceSummary: { min: 0, max: 0, avg: 0 },
      citationBlock: '',
      groundingInstruction: '',
      evidenceBlock: '',
      confidenceBlock: '',
      query: 'cow fever',
      locale: 'en',
      chunks: [],
      structuredFacts: [],
    });

    const { getAiDoctorOrchestratorService } = await import('./ai-doctor-orchestrator.service.js');
    const result = await getAiDoctorOrchestratorService().analyze('case-1', 'u1');

    expect(result.refused).toBe(true);
    expect(result.humanRedirect).toBe(true);
    expect(executePromptTaskMock).not.toHaveBeenCalled();
    expect(createEscalationMock).toHaveBeenCalled();
  });

  it('invokes LLM when grounded pack proceeds', async () => {
    const { getAiDoctorOrchestratorService } = await import('./ai-doctor-orchestrator.service.js');
    const result = await getAiDoctorOrchestratorService().analyze('case-1', 'u1');

    expect(result.refused).toBe(false);
    expect(executePromptTaskMock).toHaveBeenCalled();
    expect(result.content).toContain('[fever-disease]');
  });
});
