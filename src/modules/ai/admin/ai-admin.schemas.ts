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
  modelType: z.enum(['chat', 'embedding', 'vision', 'audio']).optional(),
  contextWindow: z.number().int().positive().optional(),
  maxOutputTokens: z.number().int().positive().optional(),
  inputCostPerToken: z.number().min(0).optional(),
  outputCostPerToken: z.number().min(0).optional(),
  enabled: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  capabilitiesJson: z.array(z.string()).optional(),
  metadataJson: z.record(z.unknown()).optional(),
});

export const updateModelSchema = createModelSchema.omit({ providerId: true, modelKey: true }).partial();

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
