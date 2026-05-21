import type {
  OfflineConflictStrategy,
  OfflineConnectivityMode,
  OfflineLeadQueueStatus,
  OfflineSyncEntityType,
  OfflineSyncItemStatus,
  OfflineSyncOperation,
} from '../../generated/prisma/index.js';

export type {
  OfflineConflictStrategy,
  OfflineConnectivityMode,
  OfflineLeadQueueStatus,
  OfflineSyncEntityType,
  OfflineSyncItemStatus,
  OfflineSyncOperation,
};

export const OFFLINE_MAX_RETRY_ATTEMPTS = 5;
export const OFFLINE_RETRY_BASE_MS = 30_000;
export const OFFLINE_RETRY_MAX_MS = 3_600_000;
export const OFFLINE_BATCH_MAX_ITEMS = 25;

export const OFFLINE_CACHE_TTL_MS: Record<string, number> = {
  AUTH_SNAPSHOT: 24 * 60 * 60 * 1000,
  AREA_DATA: 7 * 24 * 60 * 60 * 1000,
  CASE_DRAFT: 30 * 24 * 60 * 60 * 1000,
  VOICE_DRAFT: 7 * 24 * 60 * 60 * 1000,
  PROFILE: 24 * 60 * 60 * 1000,
  OFFLINE_LEAD: 30 * 24 * 60 * 60 * 1000,
};

export type SyncMode = 'foreground' | 'background' | 'delta' | 'batch';

export type SyncItemInput = {
  idempotencyKey: string;
  entityType: OfflineSyncEntityType;
  operation?: OfflineSyncOperation;
  payload: Record<string, unknown>;
  clientSequence: number;
  clientVersion?: string;
  serverVersion?: string;
};

export type SyncStatusDto = {
  sessionId: string;
  connectivityMode: OfflineConnectivityMode;
  manualOverride: boolean;
  pendingCount: number;
  deadCount: number;
  conflictCount: number;
  lastSyncAt: string | null;
  lastClientSnapshotAt: string | null;
  cacheTtlMs: Record<string, number>;
};

export type SyncRequest = {
  deviceId?: string;
  connectivityMode?: OfflineConnectivityMode;
  manualOverride?: boolean;
  mode?: SyncMode;
  since?: string;
  items?: SyncItemInput[];
};

export type SyncItemResult = {
  idempotencyKey: string;
  status: OfflineSyncItemStatus;
  serverEntityId: string | null;
  conflict: boolean;
  resolution: OfflineConflictStrategy | null;
  error: string | null;
};

export type SyncResponse = {
  sessionId: string;
  mode: SyncMode;
  processed: number;
  synced: number;
  failed: number;
  conflicts: number;
  results: SyncItemResult[];
};

export type SyncRetryRequest = {
  idempotencyKeys?: string[];
  includeDead?: boolean;
  pause?: boolean;
  resume?: boolean;
};

export type SyncRetryResponse = {
  retried: number;
  paused: boolean;
  items: Array<{
    idempotencyKey: string;
    status: OfflineSyncItemStatus;
    attemptCount: number;
    nextRetryAt: string | null;
  }>;
};

export type OfflineQueueItemDto = {
  id: string;
  idempotencyKey: string;
  entityType: OfflineSyncEntityType;
  status: OfflineSyncItemStatus;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: string | null;
  clientSequence: number;
  serverEntityId: string | null;
  createdAt: string;
  leadDraft?: {
    clientLeadId: string;
    phone: string;
    name: string | null;
    status: OfflineLeadQueueStatus;
    serverLeadId: string | null;
  };
};

export type OfflineQueueDto = {
  queued: OfflineQueueItemDto[];
  syncing: OfflineQueueItemDto[];
  failed: OfflineQueueItemDto[];
  resolved: OfflineQueueItemDto[];
  total: number;
};

export type OfflineLeadPayload = {
  clientLeadId: string;
  phone: string;
  name?: string;
  concern?: string;
  animalType?: string;
  villageId?: string;
  media?: Array<{
    localId: string;
    mime: string;
    sizeBytes: number;
    checksum?: string;
  }>;
};
