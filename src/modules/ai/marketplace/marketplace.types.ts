import { z } from 'zod';

/** Supported adapter types for marketplace plugins. */
export const AI_ADAPTER_TYPES = {
  OPENAI_NATIVE: 'openai_native',
  OPENAI_COMPATIBLE: 'openai_compatible',
  OPENROUTER_GATEWAY: 'openrouter_gateway',
  ANTHROPIC_NATIVE: 'anthropic_native',
  GEMINI_NATIVE: 'gemini_native',
  SELF_HOSTED_OPENAI: 'self_hosted_openai',
  VETERINARY_CUSTOM: 'veterinary_custom',
  INTERNAL_RULES: 'internal_rules',
} as const;

export type AiAdapterType = (typeof AI_ADAPTER_TYPES)[keyof typeof AI_ADAPTER_TYPES];

/** Veterinary model categories for custom fine-tuned models. */
export const VETERINARY_MODEL_CATEGORIES = [
  'general_chat',
  'veterinary_diagnosis',
  'symptom_analysis',
  'disease_classification',
  'treatment_recommendation',
  'emergency_triage',
  'herd_health',
  'breeding_advisory',
  'image_pathology',
  'lab_interpretation',
] as const;

export type VeterinaryModelCategory = (typeof VETERINARY_MODEL_CATEGORIES)[number];

export type AiModelSourceType = 'BUILTIN' | 'MARKETPLACE' | 'EXTERNAL' | 'VETERINARY' | 'SELF_HOSTED';

export interface ExtensionManifestModel {
  modelKey: string;
  displayName: string;
  externalModelId?: string;
  modelCategory?: VeterinaryModelCategory | string;
  source?: AiModelSourceType;
  modelType?: string;
  contextWindow?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExtensionManifest {
  extensionKey: string;
  name: string;
  version: string;
  publisher?: string;
  description?: string;
  adapterType: AiAdapterType | string;
  providerKey?: string;
  capabilities?: Array<'chat' | 'vision' | 'embeddings'>;
  config?: {
    baseUrl?: string;
    chatModel?: string;
    visionModel?: string;
    embeddingModel?: string;
    authHeader?: 'bearer' | 'x-api-key' | 'google-api-key';
    extraHeaders?: Record<string, string>;
    secretProviderKey?: string;
  };
  models?: ExtensionManifestModel[];
}

export interface ExtensionRegistrationContext {
  scopeKey?: string;
  tenantId?: string | null;
  branchId?: string | null;
  actorUserId?: string;
}

export interface RegisteredExtensionView {
  id: string;
  extensionKey: string;
  name: string;
  version: string;
  publisher: string | null;
  adapterType: string;
  providerKey: string | null;
  status: string;
  enabled: boolean;
  modelCount: number;
  installedAt: string | null;
}

export interface ExternalModelRegistrationInput {
  providerId: string;
  modelKey: string;
  displayName: string;
  externalModelId: string;
  source?: AiModelSourceType;
  modelCategory?: string;
  modelType?: string;
  contextWindow?: number;
  inputCostPerToken?: number;
  outputCostPerToken?: number;
  extensionId?: string;
  capabilitiesJson?: string[];
  metadataJson?: Record<string, unknown>;
}

export interface OpenRouterModelCatalogEntry {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export const extensionManifestSchema = z.object({
  extensionKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(128),
  version: z.string().min(1).max(32),
  publisher: z.string().max(128).optional(),
  description: z.string().max(2000).optional(),
  adapterType: z.string().min(1).max(32),
  providerKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/)
    .optional(),
  capabilities: z.array(z.enum(['chat', 'vision', 'embeddings'])).optional(),
  config: z
    .object({
      baseUrl: z.string().max(512).optional(),
      chatModel: z.string().max(128).optional(),
      visionModel: z.string().max(128).optional(),
      embeddingModel: z.string().max(128).optional(),
      authHeader: z.enum(['bearer', 'x-api-key', 'google-api-key']).optional(),
      extraHeaders: z.record(z.string()).optional(),
      secretProviderKey: z.string().max(64).optional(),
    })
    .optional(),
  models: z
    .array(
      z.object({
        modelKey: z.string().min(1).max(128),
        displayName: z.string().min(1).max(128),
        externalModelId: z.string().max(256).optional(),
        modelCategory: z.string().max(64).optional(),
        source: z.enum(['BUILTIN', 'MARKETPLACE', 'EXTERNAL', 'VETERINARY', 'SELF_HOSTED']).optional(),
        modelType: z.string().max(32).optional(),
        contextWindow: z.number().int().positive().optional(),
        inputCostPerToken: z.number().min(0).optional(),
        outputCostPerToken: z.number().min(0).optional(),
        capabilities: z.array(z.string()).optional(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .optional(),
});

export const registerExternalModelSchema = z.object({
  providerId: z.string().min(1),
  modelKey: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128),
  externalModelId: z.string().min(1).max(256),
  source: z.enum(['BUILTIN', 'MARKETPLACE', 'EXTERNAL', 'VETERINARY', 'SELF_HOSTED']).optional(),
  modelCategory: z.string().max(64).optional(),
  modelType: z.string().max(32).optional(),
  contextWindow: z.number().int().positive().optional(),
  inputCostPerToken: z.number().min(0).optional(),
  outputCostPerToken: z.number().min(0).optional(),
});
