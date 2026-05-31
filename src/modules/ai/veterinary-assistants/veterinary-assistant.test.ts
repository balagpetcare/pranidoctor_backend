import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getVeterinaryAssistantConfig,
  listVeterinaryAssistants,
  VETERINARY_ASSISTANTS,
} from './assistant-registry.js';
import { VETERINARY_ASSISTANT_IDS } from './veterinary-assistant.types.js';
import {
  getVeterinaryAssistantService,
  resetVeterinaryAssistantServiceForTests,
} from './veterinary-assistant.service.js';
import { resolveTaskTypeForFeature } from '../foundation/feature-task-map.js';
import { RETRIEVAL_PROFILES, resolveRetrievalProfile } from '../knowledge-retrieval/profiles/retrieval-profile.registry.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';

const retrieveMock = vi.fn();
const executePromptTaskMock = vi.fn();
const auditWriteMock = vi.fn();
const resolveCustomerIdMock = vi.fn();
const createSessionMock = vi.fn();
const addMessageMock = vi.fn();
const findSessionMock = vi.fn();

vi.mock('../knowledge-retrieval/knowledge-retrieval.service.js', () => ({
  getKnowledgeRetrievalService: () => ({
    retrieve: retrieveMock,
  }),
}));

vi.mock('../foundation/ai-foundation.service.js', () => ({
  getAiFoundationService: () => ({
    executePromptTask: executePromptTaskMock,
  }),
}));

vi.mock('../audit/ai-audit.service.js', () => ({
  getAiAuditService: () => ({
    write: auditWriteMock,
  }),
}));

vi.mock('../ai.repository.js', () => ({
  getAiRepository: () => ({
    resolveCustomerId: resolveCustomerIdMock,
    assertCustomerOwnedLivestock: vi.fn(),
  }),
}));

vi.mock('../../ai-veterinary-core/repository/ai-veterinary.repository.js', () => ({
  getAiVeterinaryRepository: () => ({
    findSessionForUser: findSessionMock,
    createSession: createSessionMock,
    addMessage: addMessageMock,
  }),
}));

vi.mock('../disclaimer/ai-disclaimer.resolver.js', () => ({
  resolveAiResponseDisclaimer: vi.fn(async () => 'Test disclaimer'),
}));

function basePack(overrides: Partial<KnowledgeContextPack> = {}): KnowledgeContextPack {
  return {
    packId: 'pack-test',
    taskType: 'DISEASE_ANALYSIS',
    locale: 'bn',
    query: 'test query',
    normalizedQuery: 'test query',
    retrievedAt: new Date().toISOString(),
    retrievalProfileId: 'ai-doctor-v1',
    retrievalMode: 'hybrid',
    chunks: [
      {
        knowledgeEntryId: 'e1',
        chunkIndex: 0,
        entryVersion: 1,
        contentType: 'DISEASE',
        slug: 'mastitis',
        title: 'Mastitis',
        excerpt: 'symptoms',
        evidenceLevel: 'L2',
        confidenceScore: 0.8,
        clinicalRiskTier: 'MEDIUM',
        rank: 1,
        fusedScore: 0.9,
        inlineCitation: '[dls]',
        sources: [],
      },
    ],
    entities: [],
    structuredFacts: [],
    citationBlock: 'Sources:\n[1] DLS',
    evidenceBlock: 'Evidence levels:\n• [1] L2',
    confidenceBlock: 'Confidence scores:\n• [1] 0.80',
    groundingInstruction: 'CRITICAL GROUNDING RULES\nReference: Sources',
    graphHints: [],
    filtersApplied: {
      domainPriority: ['DISEASE'],
      minConfidence: 0.55,
      minEvidenceLevel: 'L2',
      regionScope: 'BD',
      status: 'PUBLISHED',
    },
    confidenceSummary: { min: 0.8, max: 0.8, avg: 0.8 },
    evidenceSummary: { min: 'L2', max: 'L2', dominant: 'L2' },
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
    ...overrides,
  };
}

describe('veterinary assistant registry', () => {
  it('registers all six assistants with RAG required', () => {
    expect(VETERINARY_ASSISTANT_IDS).toHaveLength(6);
    for (const id of VETERINARY_ASSISTANT_IDS) {
      const config = getVeterinaryAssistantConfig(id);
      expect(config.requiresRag).toBe(true);
      expect(config.retrievalProfileId).toBeTruthy();
      expect(config.promptKey).toBeTruthy();
    }
  });

  it('lists assistants for API discovery', () => {
    expect(listVeterinaryAssistants()).toHaveLength(6);
    expect(VETERINARY_ASSISTANTS['ai-doctor'].featureKey).toBe('ai_doctor');
  });

  it('maps feature keys to task types', () => {
    expect(resolveTaskTypeForFeature('ai_doctor')).toBe('DISEASE_ANALYSIS');
    expect(resolveTaskTypeForFeature('prescription_assistant')).toBe('PRESCRIPTION_ANALYSIS');
    expect(resolveTaskTypeForFeature('feed_advisor')).toBe('FEED_FORMULATION');
    expect(resolveTaskTypeForFeature('emergency_assistant')).toBe('EMERGENCY_CONSULTATION');
  });

  it('resolves Phase 6D retrieval profiles', () => {
    for (const profileId of [
      'ai-doctor-v1',
      'vaccine-advisor-v1',
      'feed-advisor-v1',
      'breeding-advisor-v1',
    ]) {
      expect(RETRIEVAL_PROFILES[profileId]).toBeDefined();
      expect(resolveRetrievalProfile({ taskType: 'GENERAL_CHAT', profileId }).profileId).toBe(
        profileId,
      );
    }
  });
});

describe('VeterinaryAssistantService', () => {
  beforeEach(() => {
    resetVeterinaryAssistantServiceForTests();
    retrieveMock.mockReset();
    executePromptTaskMock.mockReset();
    auditWriteMock.mockReset();
    resolveCustomerIdMock.mockReset();
    createSessionMock.mockReset();
    addMessageMock.mockReset();
    findSessionMock.mockReset();

    resolveCustomerIdMock.mockResolvedValue('cust-1');
    createSessionMock.mockResolvedValue({ id: 'sess-1' });
    findSessionMock.mockResolvedValue(null);
    addMessageMock
      .mockResolvedValueOnce({ id: 'msg-user' })
      .mockResolvedValueOnce({ id: 'msg-asst' });
  });

  it('fail-closes on RAG BLOCK without calling LLM', async () => {
    retrieveMock.mockResolvedValue(
      basePack({
        chunks: [],
        citationBlock: '',
        groundingInstruction: '',
        routingDecision: {
          action: 'BLOCK',
          reason: 'low_confidence',
          failClosed: true,
          disclaimerLevel: 'blocking',
          medicalRiskTier: 'HIGH',
        },
      }),
    );

    const result = await getVeterinaryAssistantService().ask({
      assistantId: 'ai-doctor',
      userId: 'user-1',
      message: 'What drug for fever?',
    });

    expect(result.refused).toBe(true);
    expect(result.humanRedirect).toBe(true);
    expect(executePromptTaskMock).not.toHaveBeenCalled();
    expect(auditWriteMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'RETRIEVAL_FAIL_CLOSED' }),
    );
  });

  it('routes PROCEED through AiFoundationService (AiRouterEngine path)', async () => {
    retrieveMock.mockResolvedValue(basePack());
    executePromptTaskMock.mockResolvedValue({
      content: 'Educational guidance based on references.',
      provider: 'openai',
      model: 'gpt-test',
    });

    const result = await getVeterinaryAssistantService().ask({
      assistantId: 'ai-doctor',
      userId: 'user-1',
      message: 'My cow has mastitis signs',
      locale: 'en',
    });

    expect(result.refused).toBe(false);
    expect(result.content).toContain('Educational guidance');
    expect(executePromptTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        promptKey: 'ai_doctor',
        feature: 'ai_doctor',
        taskType: 'DISEASE_ANALYSIS',
      }),
    );
    expect(retrieveMock.mock.invocationCallOrder[0]).toBeLessThan(
      executePromptTaskMock.mock.invocationCallOrder[0]!,
    );
  });

  it('blocks prescription without structured facts even when chunks exist', async () => {
    retrieveMock.mockResolvedValue(
      basePack({
        retrievalProfileId: 'prescription-v1',
        structuredFacts: [],
        routingDecision: {
          action: 'PROCEED',
          reason: 'chunks_ok',
          failClosed: true,
          disclaimerLevel: 'standard',
          medicalRiskTier: 'HIGH',
        },
      }),
    );

    const result = await getVeterinaryAssistantService().ask({
      assistantId: 'prescription',
      userId: 'user-1',
      message: 'Dose of antibiotic?',
    });

    expect(result.refused).toBe(true);
    expect(executePromptTaskMock).not.toHaveBeenCalled();
  });

  it('blocks emergency when retrieval returns zero chunks', async () => {
    retrieveMock.mockResolvedValue(
      basePack({
        retrievalProfileId: 'emergency-v1',
        chunks: [],
        citationBlock: '',
        groundingInstruction: '',
        routingDecision: {
          action: 'PROCEED_DEGRADED',
          reason: 'empty',
          failClosed: false,
          disclaimerLevel: 'elevated',
          medicalRiskTier: 'CRITICAL',
        },
      }),
    );

    const result = await getVeterinaryAssistantService().ask({
      assistantId: 'emergency',
      userId: 'user-1',
      message: 'Cow cannot stand',
    });

    expect(result.refused).toBe(true);
    expect(executePromptTaskMock).not.toHaveBeenCalled();
  });
});
