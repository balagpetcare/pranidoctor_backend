import { Redis } from 'ioredis';

import type { AppConfig } from '../../../shared/config/config.schema.js';
import { getConfig } from '../../../shared/config/index.js';
import { getRequestContext } from '../../../shared/context/request-context.js';
import {
  BadRequestError,
  ForbiddenError,
  ServiceUnavailableError,
} from '../../../shared/errors/http.errors.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { isRedisInitialized } from '../../../infra/redis/redis.client.js';
import { createAuditLogAsync } from '../../../shared/security/audit/index.js';
import { logInfo, logWarn } from '../../../shared/logger/logger.js';
import { setAiLlmDisabledMetric } from '../usage/ai-usage.service.js';

import {
  AI_GOVERNANCE_REDIS_KEYS,
  createGovernanceSubscriber,
  governanceRedisKey,
  parseGovernancePubSubMessage,
  publishGovernanceChange,
  readGovernanceRedisCache,
  writeGovernanceRedisCache,
} from './ai-governance.redis.js';
import {
  AI_GOVERNANCE_SCOPE_ID,
  type AiGovernanceHistoryDto,
  type AiGovernancePanelDto,
  type AiGovernanceSource,
  type AiGovernanceStateDto,
  type SetAiGovernanceParams,
} from './ai-governance.types.js';

const DEFAULT_POLL_MS = 45_000;
const TOGGLE_RATE_LIMIT_TTL_SEC = 3600;
const MAX_TOGGLES_PER_HOUR = 10;

interface LocalMirror {
  llmDisabled: boolean;
  version: number;
}

function isPersistenceEnabled(): boolean {
  const raw = process.env.AI_KILL_SWITCH_PERSISTENCE_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

function envForceLlmDisabled(): boolean {
  return process.env.AI_LLM_DISABLED?.trim().toLowerCase() === 'true';
}

function mapStateRow(row: {
  llmDisabled: boolean;
  version: bigint;
  updatedAt: Date;
  updatedByUserId: string | null;
  updatedByRole: string | null;
  reason: string | null;
  source: string;
}): AiGovernanceStateDto {
  return {
    llmDisabled: row.llmDisabled,
    version: Number(row.version),
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
    updatedByRole: row.updatedByRole,
    reason: row.reason,
    source: row.source,
  };
}

function mapHistoryRow(row: {
  id: string;
  llmDisabled: boolean;
  previousLlmDisabled: boolean;
  version: bigint;
  actorId: string | null;
  actorRole: string | null;
  reason: string | null;
  source: string;
  requestId: string | null;
  correlationId: string | null;
  rollbackOfId: string | null;
  createdAt: Date;
}): AiGovernanceHistoryDto {
  return {
    id: row.id,
    llmDisabled: row.llmDisabled,
    previousLlmDisabled: row.previousLlmDisabled,
    version: Number(row.version),
    actorId: row.actorId,
    actorRole: row.actorRole,
    reason: row.reason,
    source: row.source,
    requestId: row.requestId,
    correlationId: row.correlationId,
    rollbackOfId: row.rollbackOfId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class AiGovernanceService {
  readonly name = 'AiGovernanceService';

  private config: AppConfig | null = null;
  private mirror: LocalMirror = { llmDisabled: false, version: 0 };
  private subscriber: Redis | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Hot path — read in-process mirror (no I/O). */
  isLlmDisabled(): boolean {
    return this.mirror.llmDisabled;
  }

  getLocalVersion(): number {
    return this.mirror.version;
  }

  /**
   * Apply state locally + metrics (tests, pub/sub, startup).
   * Does not persist.
   */
  applyLocalState(llmDisabled: boolean, version?: number): void {
    this.mirror.llmDisabled = llmDisabled;
    if (version !== undefined) {
      this.mirror.version = version;
    }
    setAiLlmDisabledMetric(llmDisabled);
  }

  private applyRemoteIfNewer(version: number, llmDisabled: boolean): void {
    if (version <= this.mirror.version) return;
    this.applyLocalState(llmDisabled, version);
  }

  async bootstrap(config: AppConfig): Promise<void> {
    this.config = config;

    if (!isPersistenceEnabled()) {
      const forced = envForceLlmDisabled();
      this.applyLocalState(forced, 0);
      logWarn('AI kill switch persistence disabled — in-memory only', {
        llmDisabled: forced,
      });
      return;
    }

    try {
      const state = await this.ensureStateRow();
      let llmDisabled = state.llmDisabled;
      let version = Number(state.version);

      if (envForceLlmDisabled() && !llmDisabled) {
        llmDisabled = true;
        logWarn('AI_LLM_DISABLED env override — forcing rules-only until persisted toggle');
      }

      this.applyLocalState(llmDisabled, version);
      await writeGovernanceRedisCache(config, { llmDisabled, version });

      if (isRedisInitialized()) {
        this.subscriber = createGovernanceSubscriber(config);
        const channel = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.channel);
        await this.subscriber.subscribe(channel);
        this.subscriber.on('message', (ch, message) => {
          if (ch !== channel) return;
          const payload = parseGovernancePubSubMessage(message);
          if (!payload) return;
          this.applyRemoteIfNewer(payload.version, payload.llmDisabled);
        });
      }

      const pollMs = Number(process.env.AI_GOVERNANCE_POLL_INTERVAL_MS ?? DEFAULT_POLL_MS);
      if (Number.isFinite(pollMs) && pollMs > 0) {
        this.pollTimer = setInterval(() => {
          void this.pollRefresh().catch((err) => {
            logWarn('AI governance poll refresh failed', {
              error: err instanceof Error ? err.message : String(err),
            });
          });
        }, pollMs);
        this.pollTimer.unref?.();
      }

      logInfo('AI governance hydrated', { llmDisabled, version });
    } catch (error) {
      let llmDisabled = envForceLlmDisabled();
      let version = 0;

      if (isRedisInitialized()) {
        try {
          const cached = await readGovernanceRedisCache(config);
          if (cached) {
            llmDisabled = llmDisabled || cached.llmDisabled;
            version = cached.version;
          }
        } catch {
          // Redis read failed — continue with env / fail-closed below
        }
      }

      if (
        !llmDisabled &&
        config.nodeEnv === 'production' &&
        isPersistenceEnabled()
      ) {
        llmDisabled = true;
        logWarn(
          'AI governance bootstrap failed — fail-closed to LLM disabled in production',
        );
      }

      this.applyLocalState(llmDisabled, version);
      logWarn('AI governance bootstrap failed — using recovery defaults', {
        error: error instanceof Error ? error.message : String(error),
        llmDisabled,
        version,
      });
    }
  }

  async shutdown(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.subscriber) {
      try {
        await this.subscriber.quit();
      } catch {
        this.subscriber.disconnect();
      }
      this.subscriber = null;
    }
  }

  async pollRefresh(): Promise<void> {
    if (!isPersistenceEnabled() || !this.config) return;

    const pgState = await this.loadStateFromDb();
    if (pgState) {
      this.applyRemoteIfNewer(pgState.version, pgState.llmDisabled);
      await writeGovernanceRedisCache(this.config, {
        llmDisabled: pgState.llmDisabled,
        version: pgState.version,
      });
      return;
    }

    const cached = await readGovernanceRedisCache(this.config);
    if (cached) {
      this.applyRemoteIfNewer(cached.version, cached.llmDisabled);
    }
  }

  async getStateFromDb(): Promise<AiGovernanceStateDto | null> {
    const row = await getPrisma().aiGovernanceState.findUnique({
      where: { id: AI_GOVERNANCE_SCOPE_ID },
    });
    return row ? mapStateRow(row) : null;
  }

  async getRecentHistory(limit = 50): Promise<AiGovernanceHistoryDto[]> {
    const rows = await getPrisma().aiGovernanceStateHistory.findMany({
      where: { stateId: AI_GOVERNANCE_SCOPE_ID },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapHistoryRow);
  }

  async buildGovernancePanel(escalations: unknown[]): Promise<AiGovernancePanelDto> {
    const governance = (await this.getStateFromDb()) ?? {
      llmDisabled: this.mirror.llmDisabled,
      version: this.mirror.version,
      updatedAt: new Date().toISOString(),
      updatedByUserId: null,
      updatedByRole: null,
      reason: null,
      source: 'local_mirror',
    };
    const history = await this.getRecentHistory(50);
    return { escalations, governance, history };
  }

  async setLlmDisabled(params: SetAiGovernanceParams): Promise<AiGovernanceStateDto> {
    const config = this.config ?? getConfig();

    if (!isPersistenceEnabled()) {
      this.applyLocalState(params.llmDisabled);
      return {
        llmDisabled: params.llmDisabled,
        version: this.mirror.version,
        updatedAt: new Date().toISOString(),
        updatedByUserId: params.actorId ?? null,
        updatedByRole: params.actorRole ?? null,
        reason: params.reason ?? null,
        source: params.source,
      };
    }

    this.assertTogglePolicy(params);

    const ctx = getRequestContext();
    const requestId = params.requestId ?? ctx?.requestId;
    const correlationId = params.correlationId ?? ctx?.traceId;

    await this.assertToggleRateLimit(params.actorId);

    const previous = await this.ensureStateRow();
    const previousDisabled = previous.llmDisabled;
    const previousVersion = Number(previous.version);

    if (params.expectedVersion !== undefined && params.expectedVersion !== previousVersion) {
      throw new BadRequestError(
        'AI_GOVERNANCE_VERSION_CONFLICT',
        'Governance state changed by another operator. Refresh and retry.',
        { expectedVersion: params.expectedVersion, currentVersion: previousVersion },
      );
    }

    if (previousDisabled === params.llmDisabled) {
      return mapStateRow(previous);
    }

    const nextVersion = previousVersion + 1;

    let updated;
    try {
      updated = await getPrisma().$transaction(async (tx) => {
        const state = await tx.aiGovernanceState.update({
          where: { id: AI_GOVERNANCE_SCOPE_ID },
          data: {
            llmDisabled: params.llmDisabled,
            version: BigInt(nextVersion),
            updatedByUserId: params.actorId ?? null,
            updatedByRole: params.actorRole ?? null,
            reason: params.reason ?? null,
            source: params.source,
          },
        });

        await tx.aiGovernanceStateHistory.create({
          data: {
            stateId: AI_GOVERNANCE_SCOPE_ID,
            llmDisabled: params.llmDisabled,
            previousLlmDisabled: previousDisabled,
            version: BigInt(nextVersion),
            actorId: params.actorId ?? null,
            actorRole: params.actorRole ?? null,
            reason: params.reason ?? null,
            source: params.source,
            requestId: requestId ?? null,
            correlationId: correlationId ?? null,
            rollbackOfId: params.rollbackOfId ?? null,
          },
        });

        return state;
      });
    } catch (error) {
      logWarn('AI governance persist failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'AI_GOVERNANCE_STORE_UNAVAILABLE',
        'Could not persist AI governance state. Try again when the database is available.',
      );
    }

    const dto = mapStateRow(updated);
    this.applyLocalState(dto.llmDisabled, dto.version);

    try {
      await writeGovernanceRedisCache(config, {
        llmDisabled: dto.llmDisabled,
        version: dto.version,
      });
      await publishGovernanceChange(config, {
        version: dto.version,
        llmDisabled: dto.llmDisabled,
        at: dto.updatedAt,
      });
    } catch (error) {
      logWarn('AI governance Redis sync failed after persist', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    void createAuditLogAsync({
      action: 'SYSTEM_CONFIG_CHANGE',
      severity: 'CRITICAL',
      actorId: params.actorId,
      actorRole: params.actorRole,
      actorType: 'user',
      resourceType: 'ai_governance',
      resourceId: AI_GOVERNANCE_SCOPE_ID,
      details: {
        field: 'llmDisabled',
        source: params.source,
        reason: params.reason,
      },
      changes: {
        before: { llmDisabled: previousDisabled, version: previousVersion },
        after: { llmDisabled: dto.llmDisabled, version: dto.version },
      },
    });

    logInfo('AI governance state changed', {
      llmDisabled: dto.llmDisabled,
      version: dto.version,
      source: params.source,
      actorId: params.actorId,
    });

    return dto;
  }

  private assertTogglePolicy(params: SetAiGovernanceParams): void {
    const config = this.config ?? getConfig();
    const isProd = config.nodeEnv === 'production';

    if (
      isProd &&
      !params.llmDisabled &&
      params.source !== 'internal_api' &&
      params.actorRole !== 'SUPER_ADMIN'
    ) {
      throw new ForbiddenError(
        'AI_GOVERNANCE_ENABLE_FORBIDDEN',
        'Enabling LLM in production requires SUPER_ADMIN role.',
      );
    }

    if (isProd && params.llmDisabled) {
      const reason = params.reason?.trim() ?? '';
      if (reason.length < 10) {
        throw new BadRequestError(
          'AI_GOVERNANCE_REASON_REQUIRED',
          'A reason of at least 10 characters is required to disable LLM in production.',
        );
      }
    }
  }

  private async assertToggleRateLimit(actorId?: string): Promise<void> {
    if (!actorId || !isRedisInitialized() || !this.config) return;

    const { getRedis } = await import('../../../infra/redis/redis.client.js');
    const redis = getRedis();
    const key = `${this.config.redis.prefix}ai:governance:toggle:${actorId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, TOGGLE_RATE_LIMIT_TTL_SEC);
    }
    if (count > MAX_TOGGLES_PER_HOUR) {
      throw new BadRequestError(
        'AI_GOVERNANCE_RATE_LIMIT',
        'Too many kill switch changes. Try again later.',
      );
    }
  }

  private async ensureStateRow() {
    const prisma = getPrisma();
    const existing = await prisma.aiGovernanceState.findUnique({
      where: { id: AI_GOVERNANCE_SCOPE_ID },
    });
    if (existing) return existing;

    return prisma.aiGovernanceState.create({
      data: {
        id: AI_GOVERNANCE_SCOPE_ID,
        llmDisabled: false,
        version: BigInt(1),
        source: 'startup_sync',
      },
    });
  }

  private async loadStateFromDb() {
    const row = await getPrisma().aiGovernanceState.findUnique({
      where: { id: AI_GOVERNANCE_SCOPE_ID },
    });
    if (!row) return null;
    return {
      llmDisabled: row.llmDisabled,
      version: Number(row.version),
    };
  }
}

let governanceService: AiGovernanceService | null = null;

export function getAiGovernanceService(): AiGovernanceService {
  if (!governanceService) governanceService = new AiGovernanceService();
  return governanceService;
}

export async function bootstrapAiGovernance(config: AppConfig): Promise<void> {
  await getAiGovernanceService().bootstrap(config);
}

export async function shutdownAiGovernance(): Promise<void> {
  await getAiGovernanceService().shutdown();
}

export type { AiGovernanceSource };
