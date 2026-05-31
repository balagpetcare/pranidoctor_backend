import type { AiDbTaskType } from '../routing/ai-task.types.js';
import type {
  KnowledgeContextPack,
  StructuredFact,
} from '../knowledge-retrieval/knowledge-retrieval.types.js';

export const VETERINARY_ASSISTANT_IDS = [
  'ai-doctor',
  'prescription',
  'vaccine',
  'feed',
  'breeding',
  'emergency',
] as const;

export type VeterinaryAssistantId = (typeof VETERINARY_ASSISTANT_IDS)[number];

export type VeterinaryAssistantConfig = {
  assistantId: VeterinaryAssistantId;
  featureKey: string;
  taskType: AiDbTaskType;
  retrievalProfileId: string;
  promptKey: string;
  riskTier: 'R1' | 'R2' | 'R3' | 'R4';
  requiresRag: true;
};

export type VeterinaryAssistantRequest = {
  assistantId: VeterinaryAssistantId;
  userId: string;
  message: string;
  locale?: 'bn' | 'en';
  sessionId?: string;
  caseId?: string;
  livestockId?: string;
  customerId?: string;
};

export type VeterinaryAssistantResponse = {
  assistantId: VeterinaryAssistantId;
  sessionId: string;
  messageId: string;
  content: string;
  refused: boolean;
  humanRedirect: boolean;
  escalationRecommended: boolean;
  disclaimer: string;
  retrieval: {
    packId: string;
    profileId: string;
    routingDecision: string;
    retrievalMode: string;
    chunkCount: number;
    citationBlock: string;
  };
  structuredFacts: StructuredFact[];
  pack?: KnowledgeContextPack;
};
