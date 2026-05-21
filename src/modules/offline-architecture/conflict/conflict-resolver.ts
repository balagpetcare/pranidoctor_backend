import type { OfflineConflictStrategy, OfflineSyncEntityType } from '../../../generated/prisma/index.js';

const ENTITY_STRATEGY: Record<OfflineSyncEntityType, OfflineConflictStrategy> = {
  AUTH_SNAPSHOT: 'SERVER_WINS',
  AREA_DATA: 'SERVER_WINS',
  PROFILE: 'MERGE_REQUIRED',
  CASE_DRAFT: 'LOCAL_WINS',
  VOICE_DRAFT: 'LOCAL_WINS',
  OFFLINE_LEAD: 'LOCAL_WINS',
};

export function defaultConflictStrategy(
  entityType: OfflineSyncEntityType,
): OfflineConflictStrategy {
  return ENTITY_STRATEGY[entityType];
}

export type ConflictInput = {
  entityType: OfflineSyncEntityType;
  clientVersion?: string;
  serverVersion?: string;
};

export type ConflictOutcome = {
  conflict: boolean;
  resolution: OfflineConflictStrategy;
  requiresMerge: boolean;
};

export function resolveConflict(input: ConflictInput): ConflictOutcome {
  const strategy = defaultConflictStrategy(input.entityType);
  const clientVersion = input.clientVersion?.trim();
  const serverVersion = input.serverVersion?.trim();

  if (!clientVersion || !serverVersion || clientVersion === serverVersion) {
    return { conflict: false, resolution: strategy, requiresMerge: false };
  }

  if (strategy === 'SERVER_WINS') {
    return { conflict: true, resolution: 'SERVER_WINS', requiresMerge: false };
  }

  if (strategy === 'LOCAL_WINS') {
    return { conflict: false, resolution: 'LOCAL_WINS', requiresMerge: false };
  }

  return { conflict: true, resolution: 'MERGE_REQUIRED', requiresMerge: true };
}
