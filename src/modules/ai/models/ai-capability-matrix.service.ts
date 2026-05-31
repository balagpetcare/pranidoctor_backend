import {
  AI_CAPABILITIES,
  type AiCapability,
  type AiModelMetadata,
} from './ai-model.types.js';

const CAPABILITY_SET = new Set<string>(AI_CAPABILITIES);

export function normalizeCapabilities(raw: unknown): AiCapability[] {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is AiCapability =>
      typeof item === 'string' && CAPABILITY_SET.has(item),
    );
  }
  if (raw && typeof raw === 'object' && 'capabilities' in raw) {
    const nested = (raw as { capabilities?: unknown }).capabilities;
    if (Array.isArray(nested)) {
      return nested.filter((item): item is AiCapability =>
        typeof item === 'string' && CAPABILITY_SET.has(item),
      );
    }
  }
  return [];
}

export function serializeCapabilities(capabilities: AiCapability[]): { capabilities: AiCapability[] } {
  const unique = [...new Set(capabilities.filter((c) => CAPABILITY_SET.has(c)))];
  return { capabilities: unique };
}

export function modelHasCapabilities(modelCaps: AiCapability[], required: AiCapability[]): boolean {
  if (required.length === 0) return true;
  const set = new Set(modelCaps);
  return required.every((cap) => set.has(cap));
}

export function filterByCapabilities<T extends { capabilities: AiCapability[] }>(
  models: T[],
  required: AiCapability[],
): T[] {
  return models.filter((model) => modelHasCapabilities(model.capabilities, required));
}

export function parseModelMetadata(raw: unknown): AiModelMetadata | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as AiModelMetadata;
}

export const TASK_REQUIRED_CAPABILITIES: Record<string, AiCapability[]> = {
  chat: ['chat'],
  vision: ['chat', 'vision'],
  embedding: ['embeddings'],
  farm_briefing: ['chat'],
  triage: ['chat', 'json_mode'],
  tool_agent: ['chat', 'function_calling'],
};

export function requiredCapabilitiesForTask(taskType: string): AiCapability[] {
  return TASK_REQUIRED_CAPABILITIES[taskType] ?? ['chat'];
}

let capabilityService: AiCapabilityMatrixService | null = null;

export class AiCapabilityMatrixService {
  readonly name = 'AiCapabilityMatrixService';

  normalize(raw: unknown): AiCapability[] {
    return normalizeCapabilities(raw);
  }

  serialize(capabilities: AiCapability[]): { capabilities: AiCapability[] } {
    return serializeCapabilities(capabilities);
  }

  hasAll(modelCaps: AiCapability[], required: AiCapability[]): boolean {
    return modelHasCapabilities(modelCaps, required);
  }

  forTask(taskType: string): AiCapability[] {
    return requiredCapabilitiesForTask(taskType);
  }
}

export function getAiCapabilityMatrixService(): AiCapabilityMatrixService {
  if (!capabilityService) capabilityService = new AiCapabilityMatrixService();
  return capabilityService;
}

export function resetAiCapabilityMatrixServiceForTests(): void {
  capabilityService = null;
}
