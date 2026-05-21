import { randomUUID } from 'node:crypto';

import { OfflineSyncItemStatus } from '../../generated/prisma/index.js';

import { getLocalCacheService } from './cache/local-cache.service.js';
import type {
  OfflineQueueDto,
  OfflineQueueItemDto,
  SyncRequest,
  SyncResponse,
  SyncRetryRequest,
  SyncRetryResponse,
  SyncStatusDto,
} from './offline-architecture.types.js';
import {
  OFFLINE_BATCH_MAX_ITEMS,
  OFFLINE_CACHE_TTL_MS,
} from './offline-architecture.types.js';
import { getOfflineRepository } from './repository/offline.repository.js';
import { computeNextRetryAt, isEligibleForRetry } from './retry/retry-engine.js';
import { getSyncEngineService } from './sync/sync-engine.service.js';

export class OfflineArchitectureService {
  readonly name = 'OfflineArchitectureService';

  async getStatus(userId: string, deviceId?: string): Promise<SyncStatusDto> {
    const repo = getOfflineRepository();
    const session = await repo.upsertSession({ userId, ...(deviceId ? { deviceId } : {}) });
    const conflictCount = await repo.countConflicts(userId);

    return {
      sessionId: session.id,
      connectivityMode: session.connectivityMode,
      manualOverride: session.manualOverride,
      pendingCount: session.pendingCount,
      deadCount: session.deadCount,
      conflictCount,
      lastSyncAt: session.lastSyncAt?.toISOString() ?? null,
      lastClientSnapshotAt: session.lastClientSnapshotAt?.toISOString() ?? null,
      cacheTtlMs: OFFLINE_CACHE_TTL_MS,
    };
  }

  async sync(userId: string, input: SyncRequest): Promise<SyncResponse> {
    const repo = getOfflineRepository();
    const mode = input.mode ?? 'foreground';
    const batchId = randomUUID();

    const session = await repo.upsertSession({
      userId,
      ...(input.deviceId !== undefined ? { deviceId: input.deviceId } : {}),
      ...(input.connectivityMode !== undefined ? { connectivityMode: input.connectivityMode } : {}),
      ...(input.manualOverride !== undefined ? { manualOverride: input.manualOverride } : {}),
      lastClientSnapshotAt: new Date(),
    });

    const since = input.since ? new Date(input.since) : undefined;
    const limit = mode === 'batch' ? OFFLINE_BATCH_MAX_ITEMS : OFFLINE_BATCH_MAX_ITEMS;

    if (input.items?.length) {
      for (const item of input.items.slice(0, limit)) {
        const existing = await repo.findItemByKey(userId, item.idempotencyKey);
        if (!existing) {
          await repo.enqueueItem({
            userId,
            sessionId: session.id,
            input: item,
            batchId,
          });
        }
      }
    }

    const pending = await repo.listPendingItems(userId, {
      ...(since ? { since } : {}),
      limit,
    });

    const syncEngine = getSyncEngineService();
    const results = [];

    for (const row of pending) {
      const result = await syncEngine.processItem(userId, row.id, {
        idempotencyKey: row.idempotencyKey,
        entityType: row.entityType,
        operation: row.operation,
        payload: row.payloadJson as Record<string, unknown>,
        clientSequence: row.clientSequence,
      });
      results.push(result);
    }

    await repo.refreshSessionCounts(session.id);

    return {
      sessionId: session.id,
      mode,
      processed: results.length,
      synced: results.filter((r) => r.status === OfflineSyncItemStatus.SYNCED).length,
      failed: results.filter(
        (r) => r.status === OfflineSyncItemStatus.FAILED || r.status === OfflineSyncItemStatus.DEAD,
      ).length,
      conflicts: results.filter((r) => r.status === OfflineSyncItemStatus.CONFLICT).length,
      results,
    };
  }

  async retry(userId: string, input: SyncRetryRequest): Promise<SyncRetryResponse> {
    const repo = getOfflineRepository();

    if (input.pause) {
      await repo.upsertSession({ userId, manualOverride: true });
      return { retried: 0, paused: true, items: [] };
    }

    if (input.resume) {
      await repo.upsertSession({ userId, manualOverride: false });
    }

    const all = await repo.listQueueItems(userId);
    const targets = all.filter((row: (typeof all)[number]) => {
      if (input.idempotencyKeys?.length) {
        return input.idempotencyKeys.includes(row.idempotencyKey);
      }
      if (row.status === OfflineSyncItemStatus.DEAD) {
        return input.includeDead === true;
      }
      return isEligibleForRetry(row.status, row.nextRetryAt);
    });

    const items = [];
    for (const row of targets) {
      const nextRetryAt = computeNextRetryAt(row.attemptCount);
      const updated = await repo.updateItem(row.id, {
        status: OfflineSyncItemStatus.PENDING,
        nextRetryAt,
        lastError: null,
      });
      items.push({
        idempotencyKey: updated.idempotencyKey,
        status: updated.status,
        attemptCount: updated.attemptCount,
        nextRetryAt: updated.nextRetryAt?.toISOString() ?? null,
      });
    }

    return { retried: items.length, paused: false, items };
  }

  async getQueue(userId: string): Promise<OfflineQueueDto> {
    const rows = await getOfflineRepository().listQueueItems(userId);
    const mapRow = (row: (typeof rows)[number]): OfflineQueueItemDto => ({
      id: row.id,
      idempotencyKey: row.idempotencyKey,
      entityType: row.entityType,
      status: row.status,
      attemptCount: row.attemptCount,
      lastError: row.lastError,
      nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
      clientSequence: row.clientSequence,
      serverEntityId: row.serverEntityId,
      createdAt: row.createdAt.toISOString(),
      ...(row.leadDraft
        ? {
            leadDraft: {
              clientLeadId: row.leadDraft.clientLeadId,
              phone: row.leadDraft.phone,
              name: row.leadDraft.name,
              status: row.leadDraft.status,
              serverLeadId: row.leadDraft.serverLeadId,
            },
          }
        : {}),
    });

    const queued = rows.filter((r: (typeof rows)[number]) => r.status === OfflineSyncItemStatus.PENDING).map(mapRow);
    const syncing = rows.filter((r: (typeof rows)[number]) => r.status === OfflineSyncItemStatus.SYNCING).map(mapRow);
    const failed = rows
      .filter(
        (r: (typeof rows)[number]) =>
          r.status === OfflineSyncItemStatus.FAILED ||
          r.status === OfflineSyncItemStatus.DEAD ||
          r.status === OfflineSyncItemStatus.CONFLICT,
      )
      .map(mapRow);
    const resolved = rows.filter((r: (typeof rows)[number]) => r.status === OfflineSyncItemStatus.SYNCED).map(mapRow);

    void getLocalCacheService();

    return {
      queued,
      syncing,
      failed,
      resolved,
      total: rows.length,
    };
  }
}

let service: OfflineArchitectureService | null = null;

export function getOfflineArchitectureService(): OfflineArchitectureService {
  if (!service) service = new OfflineArchitectureService();
  return service;
}
