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
  expiresAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
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

export type RotateAiApiKeyResult = {
  previousKeyId: string;
  newKeyId: string;
  providerKey: string;
};
