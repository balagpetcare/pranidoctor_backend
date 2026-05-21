import { nanoid } from 'nanoid';

import { omitUndefined } from '../../types/object.utils.js';
import { getConfig } from '../../config/index.js';
import { getRequestContext } from '../../context/request-context.js';
import { logInfo, logWarn, logError } from '../../logger/logger.js';
import { getRedis } from '../../../infra/redis/redis.client.js';
import { addJob, QueueNames } from '../../../infra/queue/index.js';

import type {
  AuditLogEntry,
  AuditAction,
  AuditSeverity,
  AuditOutcome,
} from './audit.types.js';

const AUDIT_LOG_PREFIX = 'audit:log:';
const AUDIT_INDEX_PREFIX = 'audit:idx:';
const AUDIT_LOG_TTL = 90 * 24 * 60 * 60;

export interface CreateAuditLogOptions {
  action: AuditAction;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  actorId?: string;
  actorType?: AuditLogEntry['actorType'];
  actorRole?: string;
  targetType?: string;
  targetId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  changes?: AuditLogEntry['changes'];
  errorCode?: string;
  errorMessage?: string;
}

function getSeverityForAction(action: AuditAction): AuditSeverity {
  const criticalActions: AuditAction[] = [
    'USER_DELETE',
    'DOCTOR_SUSPEND',
    'AUTH_SESSION_REVOKE',
    'DATA_DELETE',
    'PERMISSION_REVOKE',
    'SYSTEM_CONFIG_CHANGE',
    'AI_EMERGENCY_ESCALATE',
  ];

  const warningActions: AuditAction[] = [
    'USER_ROLE_CHANGE',
    'DOCTOR_VERIFY',
    'PERMISSION_GRANT',
    'DATA_EXPORT',
    'SETTINGS_UPDATE',
  ];

  if (criticalActions.includes(action)) return 'CRITICAL';
  if (warningActions.includes(action)) return 'WARNING';
  return 'INFO';
}

export async function createAuditLog(options: CreateAuditLogOptions): Promise<AuditLogEntry> {
  const ctx = getRequestContext();
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const entry: AuditLogEntry = {
    id: nanoid(21),
    timestamp: new Date(),
    action: options.action,
    severity: options.severity ?? getSeverityForAction(options.action),
    outcome: options.outcome ?? 'SUCCESS',
    actorType: options.actorType ?? (ctx?.userId ? 'user' : 'system'),
    ...omitUndefined({
      actorId: options.actorId ?? ctx?.userId,
      actorRole: options.actorRole,
      actorIp: ctx?.ip,
      actorUserAgent: ctx?.userAgent,
      targetType: options.targetType,
      targetId: options.targetId,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      details: options.details,
      changes: options.changes,
      requestId: ctx?.requestId,
      traceId: ctx?.traceId,
      tenantId: ctx?.tenantId,
      errorCode: options.errorCode,
      errorMessage: options.errorMessage,
    }),
  };

  try {
    const pipeline = redis.pipeline();

    pipeline.setex(
      `${prefix}${AUDIT_LOG_PREFIX}${entry.id}`,
      AUDIT_LOG_TTL,
      JSON.stringify(entry)
    );

    const dateKey = entry.timestamp.toISOString().split('T')[0];
    pipeline.lpush(`${prefix}${AUDIT_INDEX_PREFIX}date:${dateKey}`, entry.id);
    pipeline.expire(`${prefix}${AUDIT_INDEX_PREFIX}date:${dateKey}`, AUDIT_LOG_TTL);

    if (entry.actorId) {
      pipeline.lpush(`${prefix}${AUDIT_INDEX_PREFIX}actor:${entry.actorId}`, entry.id);
      pipeline.ltrim(`${prefix}${AUDIT_INDEX_PREFIX}actor:${entry.actorId}`, 0, 999);
      pipeline.expire(`${prefix}${AUDIT_INDEX_PREFIX}actor:${entry.actorId}`, AUDIT_LOG_TTL);
    }

    pipeline.lpush(`${prefix}${AUDIT_INDEX_PREFIX}action:${entry.action}`, entry.id);
    pipeline.ltrim(`${prefix}${AUDIT_INDEX_PREFIX}action:${entry.action}`, 0, 9999);
    pipeline.expire(`${prefix}${AUDIT_INDEX_PREFIX}action:${entry.action}`, AUDIT_LOG_TTL);

    await pipeline.exec();

    if (entry.severity === 'CRITICAL') {
      logWarn('Critical audit event', {
        auditId: entry.id,
        action: entry.action,
        actorId: entry.actorId,
        outcome: entry.outcome,
      });
    } else {
      logInfo('Audit log created', {
        auditId: entry.id,
        action: entry.action,
      });
    }

    return entry;
  } catch (error) {
    logError('Failed to create audit log', error, { action: options.action });
    throw error;
  }
}

export async function createAuditLogAsync(options: CreateAuditLogOptions): Promise<void> {
  try {
    await addJob(QueueNames.SCHEDULED, 'audit-log', options);
  } catch {
    await createAuditLog(options);
  }
}

export async function getAuditLog(id: string): Promise<AuditLogEntry | null> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const data = await redis.get(`${prefix}${AUDIT_LOG_PREFIX}${id}`);
  if (!data) return null;

  const entry = JSON.parse(data) as AuditLogEntry;
  entry.timestamp = new Date(entry.timestamp);
  return entry;
}

export async function getAuditLogsByActor(
  actorId: string,
  limit = 100
): Promise<AuditLogEntry[]> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const ids = await redis.lrange(
    `${prefix}${AUDIT_INDEX_PREFIX}actor:${actorId}`,
    0,
    limit - 1
  );

  const entries: AuditLogEntry[] = [];
  for (const id of ids) {
    const entry = await getAuditLog(id);
    if (entry) entries.push(entry);
  }

  return entries;
}

export async function getAuditLogsByAction(
  action: AuditAction,
  limit = 100
): Promise<AuditLogEntry[]> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const ids = await redis.lrange(
    `${prefix}${AUDIT_INDEX_PREFIX}action:${action}`,
    0,
    limit - 1
  );

  const entries: AuditLogEntry[] = [];
  for (const id of ids) {
    const entry = await getAuditLog(id);
    if (entry) entries.push(entry);
  }

  return entries;
}

export async function getAuditLogsByDate(
  date: Date,
  limit = 1000
): Promise<AuditLogEntry[]> {
  const config = getConfig();
  const redis = getRedis();
  const prefix = config.redis.prefix;

  const dateKey = date.toISOString().split('T')[0];
  const ids = await redis.lrange(
    `${prefix}${AUDIT_INDEX_PREFIX}date:${dateKey}`,
    0,
    limit - 1
  );

  const entries: AuditLogEntry[] = [];
  for (const id of ids) {
    const entry = await getAuditLog(id);
    if (entry) entries.push(entry);
  }

  return entries;
}

export function auditAuth(
  action: Extract<AuditAction, `AUTH_${string}`>,
  options: Partial<CreateAuditLogOptions> = {}
): Promise<AuditLogEntry> {
  return createAuditLog({ action, ...options });
}

export function auditUser(
  action: Extract<AuditAction, `USER_${string}`>,
  userId: string,
  options: Partial<CreateAuditLogOptions> = {}
): Promise<AuditLogEntry> {
  return createAuditLog({
    action,
    targetType: 'user',
    targetId: userId,
    ...options,
  });
}

export function auditDoctor(
  action: Extract<AuditAction, `DOCTOR_${string}`>,
  doctorId: string,
  options: Partial<CreateAuditLogOptions> = {}
): Promise<AuditLogEntry> {
  return createAuditLog({
    action,
    targetType: 'doctor',
    targetId: doctorId,
    ...options,
  });
}

export function auditDataAccess(
  resourceType: string,
  resourceId: string,
  action: 'DATA_EXPORT' | 'DATA_DELETE',
  options: Partial<CreateAuditLogOptions> = {}
): Promise<AuditLogEntry> {
  return createAuditLog({
    action,
    resourceType,
    resourceId,
    severity: 'WARNING',
    ...options,
  });
}
