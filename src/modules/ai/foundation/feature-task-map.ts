import type { AiDbTaskType } from '../routing/ai-task.types.js';
import { normalizeAiTaskType } from '../routing/ai-task.types.js';

/** Product feature keys → canonical DB task types for route resolution. */
const FEATURE_TO_TASK_TYPE: Record<string, AiDbTaskType> = {
  CHAT: 'GENERAL_CHAT',
  farmer_chat: 'GENERAL_CHAT',
  FARM_BRIEFING: 'GENERAL_CHAT',
  FARM_QUERY: 'GENERAL_CHAT',
  farm_assistant: 'GENERAL_CHAT',
  symptom_checker: 'DISEASE_ANALYSIS',
  SYMPTOM_CHECK: 'DISEASE_ANALYSIS',
  emergency_triage: 'EMERGENCY_CONSULTATION',
  EMERGENCY_TRIAGE: 'EMERGENCY_CONSULTATION',
  voice_assistant: 'GENERAL_CHAT',
  VOICE_CHAT: 'GENERAL_CHAT',
  IMAGE_ANALYSIS: 'IMAGE_ANALYSIS',
  feed_formulation: 'FEED_FORMULATION',
  ai_doctor: 'DISEASE_ANALYSIS',
  prescription_assistant: 'PRESCRIPTION_ANALYSIS',
  vaccine_assistant: 'DISEASE_ANALYSIS',
  feed_advisor: 'FEED_FORMULATION',
  breeding_advisor: 'GENERAL_CHAT',
  emergency_assistant: 'EMERGENCY_CONSULTATION',
  livestock_weight_estimate: 'IMAGE_ANALYSIS',
  LIVESTOCK_WEIGHT_ESTIMATE: 'IMAGE_ANALYSIS',
};

export function resolveTaskTypeForFeature(feature: string, explicitTaskType?: string): AiDbTaskType {
  if (explicitTaskType?.trim()) {
    return normalizeAiTaskType(explicitTaskType);
  }

  const direct = FEATURE_TO_TASK_TYPE[feature.trim()];
  if (direct) return direct;

  const upper = feature.trim().toUpperCase();
  const upperMatch = FEATURE_TO_TASK_TYPE[upper];
  if (upperMatch) return upperMatch;

  if (upper.includes('EMERGENCY')) return 'EMERGENCY_CONSULTATION';
  if (upper.includes('SYMPTOM') || upper.includes('DISEASE')) return 'DISEASE_ANALYSIS';
  if (upper.includes('IMAGE') || upper.includes('VISION')) return 'IMAGE_ANALYSIS';
  if (upper.includes('FEED')) return 'FEED_FORMULATION';

  return 'GENERAL_CHAT';
}

export function listFeatureTaskMappings(): Array<{ feature: string; taskType: AiDbTaskType }> {
  return Object.entries(FEATURE_TO_TASK_TYPE).map(([feature, taskType]) => ({ feature, taskType }));
}
