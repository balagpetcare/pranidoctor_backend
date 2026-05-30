import { AiApiKeyAuditAction, AiApiKeyStatus } from '../../../generated/prisma/index.js';
import { NotFoundError } from '../../../shared/errors/http.errors.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import type { AiSecretActor, RotateAiApiKeyResult } from './ai-secret.types.js';
import { getAiSecretService } from './ai-secret.service.js';
import { getEncryptionService } from './encryption.service.js';

export class KeyRotationService {
  readonly name = 'KeyRotationService';

  async rotateKey(
    apiKeyId: string,
    newPlaintextSecret: string,
    actor?: AiSecretActor,
    reason?: string,
  ): Promise<RotateAiApiKeyResult> {
    const secrets = getAiSecretService();
    const encryption = getEncryptionService();
    const prisma = getPrisma();

    const existing = await prisma.aiApiKey.findFirst({
      where: { id: apiKeyId, deletedAt: null },
      include: { provider: { select: { providerKey: true } } },
    });
    if (!existing) throw new NotFoundError('AI_API_KEY_NOT_FOUND', 'API key not found');

    secrets.validatePlaintextSecret(newPlaintextSecret, existing.provider.providerKey);

    const enc = encryption.encrypt(newPlaintextSecret);
    const now = new Date();

    const [previous, created] = await prisma.$transaction([
      prisma.aiApiKey.update({
        where: { id: existing.id },
        data: {
          status: AiApiKeyStatus.ROTATED,
          rotatedAt: now,
          updatedByUserId: actor?.userId,
          version: { increment: 1 },
        },
      }),
      prisma.aiApiKey.create({
        data: {
          scopeKey: existing.scopeKey,
          tenantId: existing.tenantId,
          branchId: existing.branchId,
          providerId: existing.providerId,
          name: existing.name,
          status: AiApiKeyStatus.ACTIVE,
          encryptedSecret: enc.ciphertext,
          encryptionKeyId: enc.encryptionKeyId,
          encryptionAlgorithm: enc.encryptionAlgorithm,
          secretHint: encryption.buildSecretHint(newPlaintextSecret),
          expiresAt: existing.expiresAt,
          version: existing.version + 1,
          createdByUserId: actor?.userId,
          updatedByUserId: actor?.userId,
          metadataJson: { rotatedFromId: existing.id },
        },
      }),
    ]);

    await secrets.appendAudit({
      apiKeyId: previous.id,
      providerKey: existing.provider.providerKey,
      action: AiApiKeyAuditAction.ROTATED,
      actor,
      reason,
      metadataJson: { successorId: created.id },
    });

    await secrets.appendAudit({
      apiKeyId: created.id,
      providerKey: existing.provider.providerKey,
      action: AiApiKeyAuditAction.CREATED,
      actor,
      reason: reason ?? 'Key rotation',
      metadataJson: { rotatedFromId: previous.id },
    });

    await secrets.refreshConfigurationCache({ scopeKey: existing.scopeKey });

    return {
      previousKeyId: previous.id,
      newKeyId: created.id,
      providerKey: existing.provider.providerKey,
    };
  }
}

let keyRotationService: KeyRotationService | null = null;

export function getKeyRotationService(): KeyRotationService {
  if (!keyRotationService) keyRotationService = new KeyRotationService();
  return keyRotationService;
}

export function resetKeyRotationServiceForTests(): void {
  keyRotationService = null;
}
