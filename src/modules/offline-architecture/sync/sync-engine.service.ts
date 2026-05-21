import { OfflineSyncItemStatus } from '../../../generated/prisma/index.js';

import { resolveConflict } from '../conflict/conflict-resolver.js';
import type { OfflineLeadPayload, SyncItemInput, SyncItemResult } from '../offline-architecture.types.js';
import { getOfflineRepository } from '../repository/offline.repository.js';
import { computeNextRetryAt, shouldMoveToDeadQueue } from '../retry/retry-engine.js';

export class SyncEngineService {
  readonly name = 'SyncEngineService';

  async processItem(
    userId: string,
    itemId: string,
    input: SyncItemInput,
  ): Promise<SyncItemResult> {
    const repo = getOfflineRepository();
    const existing = await repo.findItemByKey(userId, input.idempotencyKey);

    if (existing && existing.status === OfflineSyncItemStatus.SYNCED) {
      return {
        idempotencyKey: input.idempotencyKey,
        status: OfflineSyncItemStatus.SYNCED,
        serverEntityId: existing.serverEntityId,
        conflict: false,
        resolution: null,
        error: null,
      };
    }

    const item = existing ?? (await repo.findItemByKey(userId, input.idempotencyKey));
    if (!item) {
      return {
        idempotencyKey: input.idempotencyKey,
        status: OfflineSyncItemStatus.FAILED,
        serverEntityId: null,
        conflict: false,
        resolution: null,
        error: 'SYNC_ITEM_NOT_FOUND',
      };
    }

    await repo.updateItem(item.id, {
      status: OfflineSyncItemStatus.SYNCING,
      lastAttemptAt: new Date(),
    });

    try {
      const serverVersion =
        input.entityType === 'PROFILE'
          ? (await repo.getCustomerProfileUpdatedAt(userId)) ?? undefined
          : input.serverVersion;

      const conflict = resolveConflict({
        entityType: input.entityType,
        ...(input.clientVersion !== undefined ? { clientVersion: input.clientVersion } : {}),
        ...(serverVersion !== undefined ? { serverVersion } : {}),
      });

      if (conflict.conflict && conflict.resolution === 'SERVER_WINS') {
        await repo.createConflictRecord({
          userId,
          syncItemId: item.id,
          entityType: input.entityType,
          resolution: 'SERVER_WINS',
          ...(serverVersion !== undefined ? { serverVersion } : {}),
          ...(input.clientVersion !== undefined ? { clientVersion: input.clientVersion } : {}),
        });
        await repo.updateItem(item.id, {
          status: OfflineSyncItemStatus.CONFLICT,
          attemptCount: item.attemptCount + 1,
          lastError: 'SERVER_WINS_CONFLICT',
          nextRetryAt: null,
        });
        return {
          idempotencyKey: input.idempotencyKey,
          status: OfflineSyncItemStatus.CONFLICT,
          serverEntityId: null,
          conflict: true,
          resolution: 'SERVER_WINS',
          error: 'SERVER_WINS_CONFLICT',
        };
      }

      if (conflict.requiresMerge) {
        await repo.createConflictRecord({
          userId,
          syncItemId: item.id,
          entityType: input.entityType,
          resolution: 'MERGE_REQUIRED',
          ...(serverVersion !== undefined ? { serverVersion } : {}),
          ...(input.clientVersion !== undefined ? { clientVersion: input.clientVersion } : {}),
        });
        await repo.updateItem(item.id, {
          status: OfflineSyncItemStatus.CONFLICT,
          attemptCount: item.attemptCount + 1,
          lastError: 'MERGE_REQUIRED',
          nextRetryAt: null,
        });
        return {
          idempotencyKey: input.idempotencyKey,
          status: OfflineSyncItemStatus.CONFLICT,
          serverEntityId: null,
          conflict: true,
          resolution: 'MERGE_REQUIRED',
          error: 'MERGE_REQUIRED',
        };
      }

      let serverEntityId: string | null = null;

      if (input.entityType === 'OFFLINE_LEAD') {
        const payload = input.payload as unknown as OfflineLeadPayload;
        if (!payload.phone || !payload.clientLeadId) {
          throw new Error('INVALID_OFFLINE_LEAD_PAYLOAD');
        }
        const draft = await repo.createOfflineLeadDraft({
          userId,
          syncItemId: item.id,
          payload,
        });
        const synced = await repo.syncOfflineLead({
          userId,
          syncItemId: item.id,
          payload,
        });
        serverEntityId = synced.leadId;
        await repo.updateItem(item.id, { serverEntityId });
        void draft;
      }

      await repo.updateItem(item.id, {
        status: OfflineSyncItemStatus.SYNCED,
        serverEntityId,
        lastError: null,
        nextRetryAt: null,
      });

      return {
        idempotencyKey: input.idempotencyKey,
        status: OfflineSyncItemStatus.SYNCED,
        serverEntityId,
        conflict: false,
        resolution: conflict.resolution,
        error: null,
      };
    } catch (error) {
      const attemptCount = item.attemptCount + 1;
      const message = error instanceof Error ? error.message : 'SYNC_FAILED';
      const dead = shouldMoveToDeadQueue(attemptCount, item.maxAttempts);

      await repo.updateItem(item.id, {
        status: dead ? OfflineSyncItemStatus.DEAD : OfflineSyncItemStatus.FAILED,
        attemptCount,
        lastError: message,
        nextRetryAt: dead ? null : computeNextRetryAt(attemptCount),
      });

      return {
        idempotencyKey: input.idempotencyKey,
        status: dead ? OfflineSyncItemStatus.DEAD : OfflineSyncItemStatus.FAILED,
        serverEntityId: null,
        conflict: false,
        resolution: null,
        error: message,
      };
    }
  }
}

let service: SyncEngineService | null = null;

export function getSyncEngineService(): SyncEngineService {
  if (!service) service = new SyncEngineService();
  return service;
}
