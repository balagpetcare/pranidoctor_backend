import { z } from 'zod';

import {
  AiFailoverActionType,
  AiFailoverTriggerType,
} from '../../../generated/prisma/index.js';

const scopeFields = {
  scopeKey: z.string().max(128).optional(),
  tenantId: z.string().max(64).optional(),
  branchId: z.string().max(64).optional(),
};

export const createProviderSchema = z.object({
  ...scopeFields,
  providerKey: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/),
  displayName: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  adapterType: z.string().max(32).optional(),
  baseUrl: z.string().max(512).nullable().optional(),
  costTier: z.enum(['economy', 'standard', 'premium']).optional(),
  capabilitiesJson: z.array(z.string()).optional(),
  configJson: z.record(z.unknown()).optional(),
});

export const updateProviderSchema = createProviderSchema
  .omit({ providerKey: true })
  .partial();

export const createModelSchema = z.object({
  ...scopeFields,
  providerId: z.string().min(1),
  modelKey: z.string().min(1).max(128),
  displayName: z.string().min(1).max(128),
  modelFamily: z.enum(['gpt', 'gemini', 'claude', 'deepseek', 'qwen', 'llama', 'grok']).optional(),
  modelType: z.enum(['chat', 'embedding', 'vision', 'audio', 'multimodal']).optional(),
  modelCategory: z
    .enum(['general_chat', 'reasoning', 'code', 'vision', 'embedding', 'veterinary'])
    .optional(),
  contextWindow: z.number().int().positive().optional(),
  maxInputTokens: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  contextWindowSource: z.enum(['ADVERTISED', 'MEASURED', 'ADMIN_OVERRIDE']).optional(),
  externalModelId: z.string().max(256).nullable().optional(),
  inputCostPerToken: z.number().min(0).optional(),
  outputCostPerToken: z.number().min(0).optional(),
  cachedInputCostPerToken: z.number().min(0).nullable().optional(),
  currency: z.string().max(8).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  capabilities: z
    .array(
      z.enum([
        'chat',
        'vision',
        'embeddings',
        'function_calling',
        'json_mode',
        'streaming',
        'reasoning',
        'audio_input',
        'audio_output',
        'document_pdf',
        'code_optimized',
      ]),
    )
    .optional(),
  capabilitiesJson: z.union([z.array(z.string()), z.record(z.unknown())]).optional(),
  metadataJson: z.record(z.unknown()).optional(),
  deprecatedAt: z.string().datetime().nullable().optional(),
});

export const updateModelSchema = createModelSchema
  .omit({ providerId: true, modelKey: true })
  .partial();

export const updateModelRatesSchema = z.object({
  inputCostPerToken: z.number().min(0),
  outputCostPerToken: z.number().min(0),
  cachedInputCostPerToken: z.number().min(0).nullable().optional(),
  batchInputCostPerToken: z.number().min(0).nullable().optional(),
  batchOutputCostPerToken: z.number().min(0).nullable().optional(),
  currency: z.string().max(8).optional(),
  changeReason: z.string().max(500).optional(),
});

export const modelFamilyParamSchema = z.enum([
  'gpt',
  'gemini',
  'claude',
  'deepseek',
  'qwen',
  'llama',
  'grok',
]);

export const createRouteSchema = z.object({
  ...scopeFields,
  routeKey: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9_-]+$/),
  name: z.string().min(1).max(128),
  taskType: z.string().min(1).max(64),
  description: z.string().max(500).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  primaryProviderId: z.string().nullable().optional(),
  primaryModelId: z.string().nullable().optional(),
  providerChainJson: z.array(z.record(z.unknown())).optional(),
  maxRetries: z.number().int().min(0).max(10).optional(),
  timeoutMs: z.number().int().min(1000).max(300_000).optional(),
  asyncRequired: z.boolean().optional(),
  maxCostUsd: z.number().min(0).nullable().optional(),
  fallbackToRules: z.boolean().optional(),
  conditionsJson: z.record(z.unknown()).optional(),
});

export const updateRouteSchema = createRouteSchema.omit({ routeKey: true }).partial();

const failoverTrigger = z.nativeEnum(AiFailoverTriggerType);
const failoverAction = z.nativeEnum(AiFailoverActionType);

export const createFailoverRuleSchema = z.object({
  ...scopeFields,
  routeId: z.string().nullable().optional(),
  name: z.string().min(1).max(128),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  triggerType: failoverTrigger,
  triggerConfigJson: z.record(z.unknown()).optional(),
  fromProviderId: z.string().nullable().optional(),
  toProviderId: z.string().nullable().optional(),
  fromModelId: z.string().nullable().optional(),
  toModelId: z.string().nullable().optional(),
  action: failoverAction,
  actionConfigJson: z.record(z.unknown()).optional(),
});

export const updateFailoverRuleSchema = createFailoverRuleSchema.partial();

export const toggleEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const createSecretSchema = z.object({
  providerKey: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
  secret: z.string().min(20),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
});

export const updateSecretSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  secret: z.string().min(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  reason: z.string().max(500).optional(),
});

export const batchProviderPrioritySchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        priority: z.number().int().min(0).max(10_000),
      }),
    )
    .min(1)
    .max(100),
});

export const rotateSecretSchema = z.object({
  secret: z.string().min(20),
  reason: z.string().max(500).optional(),
});

export const upsertSettingsSchema = z.object({
  scopeKey: z.string().max(128).optional(),
  settingsJson: z.record(z.unknown()),
});

export const settingsScopeQuerySchema = z.object({
  scopeKey: z.string().max(128).optional(),
});

const routingSettingsJsonSchema = z.object({
  preferredProvider: z.string().max(32).optional(),
  honorDbRoutes: z.boolean().optional(),
  fallbackToRules: z.boolean().optional(),
});

const budgetSettingsJsonSchema = z.object({
  dailyBudgetUsd: z.number().min(0).nullable().optional(),
  monthlyBudgetUsd: z.number().min(0).nullable().optional(),
  emergencyBypassBudget: z.boolean().optional(),
});

const governanceSettingsJsonSchema = z.object({
  llmEnabled: z.boolean().optional(),
  requireAiConsent: z.boolean().optional(),
});

const encryptionSettingsJsonSchema = z.object({
  apiKeyStorage: z.string().max(64).optional(),
  defaultEncryptionKeyId: z.string().max(64).optional(),
  algorithm: z.string().max(32).optional(),
});

const KNOWN_SETTINGS_SCHEMAS: Record<string, z.ZodType<Record<string, unknown>>> = {
  'routing.default': routingSettingsJsonSchema,
  'budget.global': budgetSettingsJsonSchema,
  'governance.features': governanceSettingsJsonSchema,
  'security.encryption': encryptionSettingsJsonSchema,
};

export function validateSettingsPayload(
  settingsKey: string,
  settingsJson: Record<string, unknown>,
): Record<string, unknown> {
  const schema = KNOWN_SETTINGS_SCHEMAS[settingsKey];
  if (!schema) {
    throw new Error(`Unknown settings key: ${settingsKey}`);
  }
  return schema.parse(settingsJson) as Record<string, unknown>;
}

export function isKnownSettingsKey(settingsKey: string): boolean {
  return settingsKey in KNOWN_SETTINGS_SCHEMAS;
}
