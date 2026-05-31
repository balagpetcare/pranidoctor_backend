import { getAiSecretService } from '../vault/ai-secret.service.js';
import { getKeyRotationService } from '../vault/key-rotation.service.js';
import { createAuditLog } from '../../../shared/security/audit/audit.service.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import type { AiAdminActor } from './ai-admin.guard.js';
import { actorContext } from './ai-admin.guard.js';

export class AiVaultAdminService {
  readonly name = 'AiVaultAdminService';

  async getKey(id: string) {
    return getAiSecretService().getKeyById(id);
  }

  async listKeys() {
    return getAiSecretService().listKeys();
  }

  async addKey(
    request: Request,
    actor: AiAdminActor,
    body: {
      providerKey: string;
      name: string;
      secret: string;
      expiresAt?: Date;
      reason?: string;
    },
  ) {
    return getAiSecretService().addKey(
      omitUndefined({
        providerKey: body.providerKey,
        name: body.name,
        secret: body.secret,
        expiresAt: body.expiresAt,
        reason: body.reason,
        actor: actorContext(request, actor),
      }),
    ).then((key) => {
      void createAuditLog({
        action: 'AI_REGISTRY_CHANGE',
        actorId: actor.id,
        actorRole: actor.role,
        targetType: 'ai_api_key',
        targetId: key.id,
        resourceType: 'ai_api_key',
        resourceId: key.id,
        details: {
          operation: 'vault.add_key',
          providerKey: key.providerKey,
          status: key.status,
        },
      });
      return key;
    });
  }

  async updateKey(
    request: Request,
    actor: AiAdminActor,
    id: string,
    body: {
      name?: string;
      secret?: string;
      expiresAt?: Date | null;
      reason?: string;
    },
  ) {
    return getAiSecretService().updateKey(
      id,
      omitUndefined({
        name: body.name,
        secret: body.secret,
        expiresAt: body.expiresAt,
        reason: body.reason,
        actor: actorContext(request, actor),
      }),
    );
  }

  async disableKey(request: Request, actor: AiAdminActor, id: string, reason?: string) {
    return getAiSecretService().disableKey(id, actorContext(request, actor), reason);
  }

  async testKey(request: Request, actor: AiAdminActor, id: string) {
    return getAiSecretService().testKey(id, actorContext(request, actor));
  }

  async rotateKey(
    request: Request,
    actor: AiAdminActor,
    id: string,
    secret: string,
    reason?: string,
  ) {
    const result = await getKeyRotationService().rotateKey(id, secret, actorContext(request, actor), reason);
    void createAuditLog({
      action: 'AI_SECRET_ROTATE',
      actorId: actor.id,
      actorRole: actor.role,
      targetType: 'ai_api_key',
      targetId: result.previousKeyId,
      resourceType: 'ai_api_key',
      resourceId: result.newKeyId,
      details: { providerKey: result.providerKey, previousKeyId: result.previousKeyId, newKeyId: result.newKeyId },
    });
    return getAiSecretService().getKeyById(result.newKeyId);
  }

  async setPrimaryKey(request: Request, actor: AiAdminActor, id: string, reason?: string) {
    return getAiSecretService().setPrimaryKey(id, actorContext(request, actor), reason);
  }

  async listAudit(id: string) {
    return getAiSecretService().listAuditLog(id);
  }
}

let service: AiVaultAdminService | null = null;

export function getAiVaultAdminService(): AiVaultAdminService {
  if (!service) service = new AiVaultAdminService();
  return service;
}

export function resetAiVaultAdminServiceForTests(): void {
  service = null;
}
