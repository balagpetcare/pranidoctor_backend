import type { AiApiKeyAuditAction, AiApiKeyStatus } from '../../../generated/prisma/index.js';

export type AiSecretScope = {
  scopeKey?: string;
  tenantId?: string | null;
  branchId?: string | null;
};

export type AiSecretActor = {
  userId?: string;
  role?: string;
  ipAddress?: string;
};

export type AiApiKeyPublic = {
  id: string;
  scopeKey: string;
  tenantId: string | null;
  branchId: string | null;
  providerId: string;
  providerKey: string;
  name: string;
  status: AiApiKeyStatus;
  encryptionKeyId: string;
  encryptionAlgorithm: string;
  secretHint: string | null;
  isPrimary: boolean;
  expiresAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  /** True when `encryptedSecret` is a seed/demo placeholder (not decryptable). */
  isPlaceholder: boolean;
};

export type AddAiApiKeyInput = AiSecretScope & {
  providerKey: string;
  name: string;
  secret: string;
  expiresAt?: Date | null;
  actor?: AiSecretActor;
  reason?: string;
};

export type UpdateAiApiKeyInput = {
  name?: string;
  secret?: string;
  expiresAt?: Date | null;
  actor?: AiSecretActor;
  reason?: string;
};

export type AiApiKeyTestResult = {
  ok: boolean;
  providerKey: string;
  latencyMs: number;
  errorCode?: string;
  message?: string;
};

export type AiApiKeyAuditEntry = {
  id: string;
  apiKeyId: string;
  providerKey: string;
  action: AiApiKeyAuditAction;
  actorUserId: string | null;
  actorRole: string | null;
  reason: string | null;
  metadataJson: unknown;
  ipAddress: string | null;
  createdAt: string;
};

export type AiConnectionTestResult = AiApiKeyTestResult & {
  providerId?: string;
  apiKeyId?: string;
  testedAt: string;
  probeType: 'validate' | 'manual' | 'health';
};

export type AiProviderKeySummary = {
  hasPrimary: boolean;
  primaryKeyId: string | null;
  hint: string | null;
  expiresAt: string | null;
  pendingTestCount: number;
  activeCount: number;
};

export type AiProviderEffectiveStatus =
  | 'ACTIVE'
  | 'DEGRADED'
  | 'DISABLED'
  | 'UNCONFIGURED'
  | 'BLOCKED';

export type AiProviderAdminDto = {
  id: string;
  scopeKey: string;
  providerKey: string;
  displayName: string;
  description: string | null;
  enabled: boolean;
  effectiveStatus: AiProviderEffectiveStatus;
  priority: number;
  adapterType: string;
  baseUrl: string | null;
  costTier: string;
  healthScore: number;
  lastHealthCheckAt: string | null;
  lastConnectionTestAt: string | null;
  lastConnectionTestOk: boolean | null;
  capabilitiesJson: unknown;
  configJson: unknown;
  modelCount: number;
  apiKeyCount: number;
  keySummary: AiProviderKeySummary;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type RotateAiApiKeyResult = {
  previousKeyId: string;
  newKeyId: string;
  providerKey: string;
};
