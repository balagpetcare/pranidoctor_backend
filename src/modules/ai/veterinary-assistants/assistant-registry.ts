import type { VeterinaryAssistantConfig, VeterinaryAssistantId } from './veterinary-assistant.types.js';

export const VETERINARY_ASSISTANTS: Record<VeterinaryAssistantId, VeterinaryAssistantConfig> = {
  'ai-doctor': {
    assistantId: 'ai-doctor',
    featureKey: 'ai_doctor',
    taskType: 'DISEASE_ANALYSIS',
    retrievalProfileId: 'ai-doctor-v1',
    promptKey: 'ai_doctor',
    riskTier: 'R2',
    requiresRag: true,
  },
  prescription: {
    assistantId: 'prescription',
    featureKey: 'prescription_assistant',
    taskType: 'PRESCRIPTION_ANALYSIS',
    retrievalProfileId: 'prescription-v1',
    promptKey: 'prescription_assistant',
    riskTier: 'R3',
    requiresRag: true,
  },
  vaccine: {
    assistantId: 'vaccine',
    featureKey: 'vaccine_assistant',
    taskType: 'DISEASE_ANALYSIS',
    retrievalProfileId: 'vaccine-advisor-v1',
    promptKey: 'vaccine_assistant',
    riskTier: 'R2',
    requiresRag: true,
  },
  feed: {
    assistantId: 'feed',
    featureKey: 'feed_advisor',
    taskType: 'FEED_FORMULATION',
    retrievalProfileId: 'feed-advisor-v1',
    promptKey: 'feed_advisor',
    riskTier: 'R2',
    requiresRag: true,
  },
  breeding: {
    assistantId: 'breeding',
    featureKey: 'breeding_advisor',
    taskType: 'GENERAL_CHAT',
    retrievalProfileId: 'breeding-advisor-v1',
    promptKey: 'breeding_advisor',
    riskTier: 'R2',
    requiresRag: true,
  },
  emergency: {
    assistantId: 'emergency',
    featureKey: 'emergency_assistant',
    taskType: 'EMERGENCY_CONSULTATION',
    retrievalProfileId: 'emergency-v1',
    promptKey: 'emergency_assistant',
    riskTier: 'R4',
    requiresRag: true,
  },
};

export function getVeterinaryAssistantConfig(id: string): VeterinaryAssistantConfig {
  const config = VETERINARY_ASSISTANTS[id as VeterinaryAssistantId];
  if (!config) {
    throw new Error(`Unknown veterinary assistant: ${id}`);
  }
  return config;
}

export function listVeterinaryAssistants(): VeterinaryAssistantConfig[] {
  return Object.values(VETERINARY_ASSISTANTS);
}
