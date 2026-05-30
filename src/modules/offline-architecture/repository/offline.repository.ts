import { createHash } from 'node:crypto';

import {
  LeadSource,
  LeadStatus,
  OfflineConnectivityMode,
  OfflineLeadQueueStatus,
  OfflineSyncItemStatus,
  Prisma,
  type OfflineSyncItem,
  type OfflineSyncSession,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import { defaultConflictStrategy } from '../conflict/conflict-resolver.js';
import type { OfflineLeadPayload, SyncItemInput } from '../offline-architecture.types.js';

export function hashPayload(payload: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export class OfflineRepository {
  readonly name = 'OfflineRepository';

  async upsertSession(params: {
    userId: string;
    deviceId?: string;
    connectivityMode?: OfflineConnectivityMode;
    manualOverride?: boolean;
    lastClientSnapshotAt?: Date;
  }): Promise<OfflineSyncSession> {
    const deviceId = params.deviceId ?? null;
    const existing = await getPrisma().offlineSyncSession.findFirst({
      where: { userId: params.userId, deviceId },
    });

    if (existing) {
      return getPrisma().offlineSyncSession.update({
        where: { id: existing.id },
        data: {
          ...(params.connectivityMode !== undefined
            ? { connectivityMode: params.connectivityMode }
            : {}),
          ...(params.manualOverride !== undefined
            ? { manualOverride: params.manualOverride }
            : {}),
          ...(params.lastClientSnapshotAt !== undefined
            ? { lastClientSnapshotAt: params.lastClientSnapshotAt }
            : {}),
        },
      });
    }

    return getPrisma().offlineSyncSession.create({
      data: {
        userId: params.userId,
        deviceId,
        connectivityMode: params.connectivityMode ?? OfflineConnectivityMode.ONLINE,
        manualOverride: params.manualOverride ?? false,
        ...(params.lastClientSnapshotAt ? { lastClientSnapshotAt: params.lastClientSnapshotAt } : {}),
      },
    });
  }

  async refreshSessionCounts(sessionId: string): Promise<OfflineSyncSession> {
    const [pendingCount, deadCount] = await Promise.all([
      getPrisma().offlineSyncItem.count({
        where: {
          sessionId,
          status: { in: [OfflineSyncItemStatus.PENDING, OfflineSyncItemStatus.FAILED, OfflineSyncItemStatus.CONFLICT] },
        },
      }),
      getPrisma().offlineSyncItem.count({
        where: { sessionId, status: OfflineSyncItemStatus.DEAD },
      }),
    ]);

    return getPrisma().offlineSyncSession.update({
      where: { id: sessionId },
      data: { pendingCount, deadCount, lastSyncAt: new Date() },
    });
  }

  async findItemByKey(userId: string, idempotencyKey: string): Promise<OfflineSyncItem | null> {
    return getPrisma().offlineSyncItem.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  async enqueueItem(params: {
    userId: string;
    sessionId: string;
    input: SyncItemInput;
    batchId?: string;
  }): Promise<OfflineSyncItem> {
    const payloadHash = hashPayload(params.input.payload);
    const conflictStrategy = defaultConflictStrategy(params.input.entityType);

    return getPrisma().offlineSyncItem.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId,
        idempotencyKey: params.input.idempotencyKey,
        entityType: params.input.entityType,
        operation: params.input.operation ?? 'UPSERT',
        payloadHash,
        payloadJson: params.input.payload as Prisma.InputJsonValue,
        conflictStrategy,
        clientSequence: params.input.clientSequence,
        ...(params.batchId ? { batchId: params.batchId } : {}),
      },
    });
  }

  async listPendingItems(
    userId: string,
    opts: { since?: Date; limit: number },
  ): Promise<OfflineSyncItem[]> {
    return getPrisma().offlineSyncItem.findMany({
      where: {
        userId,
        status: { in: [OfflineSyncItemStatus.PENDING, OfflineSyncItemStatus.FAILED] },
        ...(opts.since ? { updatedAt: { gte: opts.since } } : {}),
      },
      orderBy: { clientSequence: 'asc' },
      take: opts.limit,
      include: { leadDraft: true },
    });
  }

  async listQueueItems(userId: string): Promise<
    Array<
      OfflineSyncItem & {
        leadDraft: {
          clientLeadId: string;
          phone: string;
          name: string | null;
          status: OfflineLeadQueueStatus;
          serverLeadId: string | null;
        } | null;
      }
    >
  > {
    const rows = await getPrisma().offlineSyncItem.findMany({
      where: { userId },
      orderBy: [{ clientSequence: 'asc' }, { createdAt: 'asc' }],
      include: { leadDraft: true },
    });
    return rows.map((row) => ({
      ...row,
      leadDraft: row.leadDraft[0] ?? null,
    }));
  }

  async updateItem(
    id: string,
    data: Partial<{
      status: OfflineSyncItemStatus;
      attemptCount: number;
      lastError: string | null;
      lastAttemptAt: Date;
      nextRetryAt: Date | null;
      serverEntityId: string | null;
    }>,
  ): Promise<OfflineSyncItem> {
    return getPrisma().offlineSyncItem.update({ where: { id }, data });
  }

  async countConflicts(userId: string): Promise<number> {
    return getPrisma().offlineSyncItem.count({
      where: { userId, status: OfflineSyncItemStatus.CONFLICT },
    });
  }

  async createConflictRecord(params: {
    userId: string;
    syncItemId: string;
    entityType: OfflineSyncItem['entityType'];
    entityId?: string;
    resolution: OfflineSyncItem['conflictStrategy'];
    serverVersion?: string;
    clientVersion?: string;
  }) {
    return getPrisma().offlineConflictRecord.create({
      data: {
        userId: params.userId,
        syncItemId: params.syncItemId,
        entityType: params.entityType,
        resolution: params.resolution,
        ...(params.entityId ? { entityId: params.entityId } : {}),
        ...(params.serverVersion ? { serverVersion: params.serverVersion } : {}),
        ...(params.clientVersion ? { clientVersion: params.clientVersion } : {}),
      },
    });
  }

  async createOfflineLeadDraft(params: {
    userId: string;
    syncItemId: string;
    payload: OfflineLeadPayload;
  }) {
    return getPrisma().offlineLeadDraft.create({
      data: {
        userId: params.userId,
        syncItemId: params.syncItemId,
        clientLeadId: params.payload.clientLeadId,
        phone: params.payload.phone,
        name: params.payload.name ?? null,
        concern: params.payload.concern ?? null,
        animalType: params.payload.animalType ?? null,
        villageId: params.payload.villageId ?? null,
        ...(params.payload.media
          ? { mediaMetadataJson: params.payload.media as Prisma.InputJsonValue }
          : {}),
        status: OfflineLeadQueueStatus.QUEUED,
      },
    });
  }

  async syncOfflineLead(params: {
    userId: string;
    syncItemId: string;
    payload: OfflineLeadPayload;
  }): Promise<{ leadId: string }> {
    const prisma = getPrisma();

    const lead = await prisma.lead.create({
      data: {
        phone: params.payload.phone.trim(),
        name: params.payload.name?.trim() ?? null,
        concern: params.payload.concern?.trim() ?? null,
        animalType: params.payload.animalType?.trim() ?? null,
        villageId: params.payload.villageId?.trim() ?? null,
        source: LeadSource.OTHER,
        status: LeadStatus.NEW,
        notes: 'Created via offline sync (P8)',
      },
    });

    await prisma.offlineLeadDraft.updateMany({
      where: { syncItemId: params.syncItemId, userId: params.userId },
      data: {
        status: OfflineLeadQueueStatus.SYNCED,
        serverLeadId: lead.id,
      },
    });

    return { leadId: lead.id };
  }

  async getCustomerProfileUpdatedAt(userId: string): Promise<string | null> {
    const profile = await getPrisma().customerProfile.findFirst({
      where: { userId },
      select: { updatedAt: true },
    });
    return profile?.updatedAt.toISOString() ?? null;
  }
}

let repo: OfflineRepository | null = null;

export function getOfflineRepository(): OfflineRepository {
  if (!repo) repo = new OfflineRepository();
  return repo;
}
