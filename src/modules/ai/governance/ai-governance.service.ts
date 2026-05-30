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
import type { AuditAction } from '../../../shared/security/audit/audit.types.js';
import { logInfo, logWarn } from '../../../shared/logger/logger.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
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
  AI_GOVERNANCE_FEATURES,
  AI_GOVERNANCE_PROVIDERS,
  AI_GOVERNANCE_SCOPE_TYPES,
  emptyScopeSnapshot,
  isKnownFeature,
  isKnownProvider,
  normalizeFeatureKey,
  normalizeProviderKey,
  type AiGovernanceScopeSnapshot,
  type AiGovernanceScopeType,
} from './ai-governance.scopes.js';
import {
  AI_GOVERNANCE_SCOPE_ID,
  type AiGovernanceChangeKind,
  type AiGovernanceHistoryDto,
  type AiGovernancePanelDto,
  type AiGovernanceScopeUpdateInput,
  type AiGovernanceSource,
  type AiGovernanceStateDto,
  type SetAiGovernanceParams,
  type SetAiGovernanceScopeParams,
} from './ai-governance.types.js';

const DEFAULT_POLL_MS = 45_000;
const TOGGLE_RATE_LIMIT_TTL_SEC = 3600;
const MAX_TOGGLES_PER_HOUR = 10;

interface LocalMirror {
  llmDisabled: boolean;
  version: number;
  scopes: AiGovernanceScopeSnapshot;
  hydrated: boolean;
}

function isPersistenceEnabled(): boolean {
  const raw = process.env.AI_KILL_SWITCH_PERSISTENCE_ENABLED?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

function envForceLlmDisabled(): boolean {
  return process.env.AI_LLM_DISABLED?.trim().toLowerCase() === 'true';
}

function mapStateRow(
  row: {
    llmDisabled: boolean;
    version: bigint;
    updatedAt: Date;
    updatedByUserId: string | null;
    updatedByRole: string | null;
    reason: string | null;
    source: string;
  },
  scopes: AiGovernanceScopeSnapshot,
  environment: string,
): AiGovernanceStateDto {
  return {
    llmDisabled: row.llmDisabled,
    version: Number(row.version),
    updatedAt: row.updatedAt.toISOString(),
    updatedByUserId: row.updatedByUserId,
    updatedByRole: row.updatedByRole,
    reason: row.reason,
    source: row.source,
    environment,
    scopes,
  };
}

function mapHistoryRow(row: {
  id: string;
  changeKind: string;
  llmDisabled: boolean;
  previousLlmDisabled: boolean;
  scopeType: string | null;
  scopeId: string | null;
  disabled: boolean | null;
  previousDisabled: boolean | null;
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
    changeKind: row.changeKind as AiGovernanceChangeKind,
    llmDisabled: row.llmDisabled,
    previousLlmDisabled: row.previousLlmDisabled,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    disabled: row.disabled,
    previousDisabled: row.previousDisabled,
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
  private mirror: LocalMirror = {
    llmDisabled: false,
    version: 0,
    scopes: emptyScopeSnapshot(),
    hydrated: false,
  };
  private subscriber: Redis | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  isHydrated(): boolean {
    return this.mirror.hydrated;
  }

  private isFailClosed(): boolean {
    return isPersistenceEnabled() && !this.mirror.hydrated;
  }

  /** Hot path — global LLM kill switch (fail-closed if not hydrated). */
  isLlmDisabled(): boolean {
    if (this.isFailClosed()) return true;
    return this.mirror.llmDisabled;
  }

  getLocalVersion(): number {
    return this.mirror.version;
  }

  getScopeSnapshot(): AiGovernanceScopeSnapshot {
    return {
      features: { ...this.mirror.scopes.features },
      providers: { ...this.mirror.scopes.providers },
    };
  }

  shouldUseRulesOnlyForFeature(feature: string): boolean {
    if (this.isFailClosed()) return true;
    if (this.mirror.llmDisabled) return true;
    const key = normalizeFeatureKey(feature);
    return Boolean(this.mirror.scopes.features[key]);
  }

  isProviderDisabled(provider: string): boolean {
    if (this.isFailClosed()) return provider !== 'rules-based';
    const key = normalizeProviderKey(provider);
    if (key === 'rules-based') return false;
    return Boolean(this.mirror.scopes.providers[key]);
  }

  /** No-op guard for observability; orchestrator enforces rules-only. */
  assertLlmExecutionAllowed(feature: string): void {
    if (this.shouldUseRulesOnlyForFeature(feature)) {
      return;
    }
  }

  applyLocalState(
    llmDisabled: boolean,
    version?: number,
    scopes?: AiGovernanceScopeSnapshot,
  ): void {
    this.mirror.llmDisabled = llmDisabled;
    if (version !== undefined) this.mirror.version = version;
    if (scopes) this.mirror.scopes = scopes;
    this.mirror.hydrated = true;
    setAiLlmDisabledMetric(llmDisabled);
  }

  private applyRemoteIfNewer(
    version: number,
    llmDisabled: boolean,
    scopes?: AiGovernanceScopeSnapshot,
  ): void {
    if (version < this.mirror.version) return;
    if (version === this.mirror.version && !scopes) return;
    this.applyLocalState(llmDisabled, version, scopes ?? this.mirror.scopes);
  }

  async bootstrap(config: AppConfig): Promise<void> {
    this.config = config;
    this.mirror.hydrated = false;

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
      const scopes = await this.loadScopesFromDb();
      let llmDisabled = state.llmDisabled;
      let version = Number(state.version);

      if (envForceLlmDisabled() && !llmDisabled) {
        llmDisabled = true;
        logWarn('AI_LLM_DISABLED env override — forcing rules-only until persisted toggle');
      }

      this.applyLocalState(llmDisabled, version, scopes);
      await writeGovernanceRedisCache(config, { llmDisabled, version, scopes });

      if (isRedisInitialized()) {
        this.subscriber = createGovernanceSubscriber(config);
        const channel = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.channel);
        await this.subscriber.subscribe(channel);
        this.subscriber.on('message', (ch, message) => {
          if (ch !== channel) return;
          const payload = parseGovernancePubSubMessage(message);
          if (!payload) return;
          this.applyRemoteIfNewer(payload.version, payload.llmDisabled, payload.scopes);
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

      logInfo('AI governance hydrated', { llmDisabled, version, scopes });
    } catch (error) {
      let llmDisabled = envForceLlmDisabled();
      let version = 0;
      let scopes = emptyScopeSnapshot();

      if (isRedisInitialized()) {
        try {
          const cached = await readGovernanceRedisCache(config);
          if (cached) {
            llmDisabled = llmDisabled || cached.llmDisabled;
            version = cached.version;
            if (cached.scopes) scopes = cached.scopes;
          }
        } catch {
          // continue
        }
      }

      if (!llmDisabled && config.nodeEnv === 'production' && isPersistenceEnabled()) {
        llmDisabled = true;
        logWarn(
          'AI governance bootstrap failed — fail-closed to LLM disabled in production',
        );
      }

      this.applyLocalState(llmDisabled, version, scopes);
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
    const scopes = await this.loadScopesFromDb();
    if (pgState) {
      this.applyRemoteIfNewer(pgState.version, pgState.llmDisabled, scopes);
      await writeGovernanceRedisCache(this.config, {
        llmDisabled: pgState.llmDisabled,
        version: pgState.version,
        scopes,
      });
      return;
    }

    const cached = await readGovernanceRedisCache(this.config);
    if (cached) {
      this.applyRemoteIfNewer(cached.version, cached.llmDisabled, cached.scopes ?? undefined);
    }
  }

  async getStateFromDb(): Promise<AiGovernanceStateDto | null> {
    const row = await getPrisma().aiGovernanceState.findUnique({
      where: { id: AI_GOVERNANCE_SCOPE_ID },
    });
    if (!row) return null;
    const scopes = await this.loadScopesFromDb();
    const config = this.config ?? getConfig();
    return mapStateRow(row, scopes, config.nodeEnv);
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
    const config = this.config ?? getConfig();
    const governance = (await this.getStateFromDb()) ?? {
      llmDisabled: this.mirror.llmDisabled,
      version: this.mirror.version,
      updatedAt: new Date().toISOString(),
      updatedByUserId: null,
      updatedByRole: null,
      reason: null,
      source: 'local_mirror',
      environment: config.nodeEnv,
      scopes: this.getScopeSnapshot(),
    };
    const history = await this.getRecentHistory(50);
    return { escalations, governance, history };
  }

  async setLlmDisabled(params: SetAiGovernanceParams): Promise<AiGovernanceStateDto> {
    const config = this.config ?? getConfig();

    if (!isPersistenceEnabled()) {
      this.applyLocalState(params.llmDisabled, undefined, this.mirror.scopes);
      return mapStateRow(
        {
          llmDisabled: params.llmDisabled,
          version: BigInt(this.mirror.version),
          updatedAt: new Date(),
          updatedByUserId: params.actorId ?? null,
          updatedByRole: params.actorRole ?? null,
          reason: params.reason ?? null,
          source: params.source,
        },
        this.mirror.scopes,
        config.nodeEnv,
      );
    }

    this.assertTogglePolicy(params, 'global');

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
      return mapStateRow(previous, await this.loadScopesFromDb(), config.nodeEnv);
    }

    const nextVersion = previousVersion + 1;
    const scopes = await this.loadScopesFromDb();

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
            changeKind: 'global',
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

    const dto = mapStateRow(updated, scopes, config.nodeEnv);
    this.applyLocalState(dto.llmDisabled, dto.version, scopes);
    await this.syncAfterPersist(dto, scopes, params, previousDisabled, previousVersion);
    return dto;
  }

  async setScopeDisabled(params: SetAiGovernanceScopeParams): Promise<AiGovernanceStateDto> {
    const config = this.config ?? getConfig();
    this.validateScopeParams(params);

    if (!isPersistenceEnabled()) {
      const key =
        params.scopeType === 'feature'
          ? normalizeFeatureKey(params.scopeId)
          : normalizeProviderKey(params.scopeId);
      if (params.scopeType === 'feature') {
        this.mirror.scopes.features[key] = params.disabled;
      } else {
        this.mirror.scopes.providers[key] = params.disabled;
      }
      return mapStateRow(
        {
          llmDisabled: this.mirror.llmDisabled,
          version: BigInt(this.mirror.version),
          updatedAt: new Date(),
          updatedByUserId: params.actorId ?? null,
          updatedByRole: params.actorRole ?? null,
          reason: params.reason ?? null,
          source: params.source,
        },
        this.mirror.scopes,
        config.nodeEnv,
      );
    }

    this.assertTogglePolicy(
      { ...params, llmDisabled: params.disabled, source: params.source },
      params.scopeType,
    );

    const ctx = getRequestContext();
    const requestId = params.requestId ?? ctx?.requestId;
    const correlationId = params.correlationId ?? ctx?.traceId;

    await this.assertToggleRateLimit(params.actorId);

    const globalRow = await this.ensureStateRow();
    const globalVersion = Number(globalRow.version);
    const scopeRow = await this.ensureScopeRow(params.scopeType, params.scopeId);
    const scopeVersion = Number(scopeRow.version);

    if (params.expectedVersion !== undefined && params.expectedVersion !== scopeVersion) {
      throw new BadRequestError(
        'AI_GOVERNANCE_VERSION_CONFLICT',
        'Scope changed by another operator. Refresh and retry.',
        { expectedVersion: params.expectedVersion, currentVersion: scopeVersion },
      );
    }

    if (scopeRow.disabled === params.disabled) {
      const scopes = await this.loadScopesFromDb();
      return mapStateRow(globalRow, scopes, config.nodeEnv);
    }

    const nextGlobalVersion = globalVersion + 1;
    const nextScopeVersion = scopeVersion + 1;
    const changeKind = params.scopeType;

    let updatedGlobal;
    try {
      updatedGlobal = await getPrisma().$transaction(async (tx) => {
        await tx.aiGovernanceScope.update({
          where: {
            scopeType_scopeId: {
              scopeType: params.scopeType,
              scopeId:
                params.scopeType === 'feature'
                  ? normalizeFeatureKey(params.scopeId)
                  : normalizeProviderKey(params.scopeId),
            },
          },
          data: {
            disabled: params.disabled,
            version: BigInt(nextScopeVersion),
            updatedByUserId: params.actorId ?? null,
            updatedByRole: params.actorRole ?? null,
            reason: params.reason ?? null,
            source: params.source,
          },
        });

        const state = await tx.aiGovernanceState.update({
          where: { id: AI_GOVERNANCE_SCOPE_ID },
          data: { version: BigInt(nextGlobalVersion) },
        });

        await tx.aiGovernanceStateHistory.create({
          data: {
            stateId: AI_GOVERNANCE_SCOPE_ID,
            changeKind,
            llmDisabled: state.llmDisabled,
            previousLlmDisabled: state.llmDisabled,
            scopeType: params.scopeType,
            scopeId:
              params.scopeType === 'feature'
                ? normalizeFeatureKey(params.scopeId)
                : normalizeProviderKey(params.scopeId),
            disabled: params.disabled,
            previousDisabled: scopeRow.disabled,
            version: BigInt(nextGlobalVersion),
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
      logWarn('AI governance scope persist failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ServiceUnavailableError(
        'AI_GOVERNANCE_STORE_UNAVAILABLE',
        'Could not persist AI governance scope. Try again when the database is available.',
      );
    }

    const scopes = await this.loadScopesFromDb();
    const dto = mapStateRow(updatedGlobal, scopes, config.nodeEnv);
    this.applyLocalState(dto.llmDisabled, dto.version, scopes);
    await this.syncAfterPersist(
      dto,
      scopes,
      omitUndefined({
        llmDisabled: dto.llmDisabled,
        reason: params.reason,
        actorId: params.actorId,
        actorRole: params.actorRole,
        source: params.source,
      }),
      dto.llmDisabled,
      globalVersion,
      `scope.${params.scopeType}.${params.scopeId}`,
    );
    return dto;
  }

  async applyScopeUpdates(
    updates: AiGovernanceScopeUpdateInput[],
    meta: {
      actorId?: string;
      actorRole?: string;
      reason?: string;
      source: AiGovernanceSource;
      expectedVersion?: number;
    },
  ): Promise<AiGovernanceStateDto> {
    let last: AiGovernanceStateDto | null = null;
    for (const u of updates) {
      last = await this.setScopeDisabled(
        omitUndefined({
          scopeType: u.scopeType,
          scopeId: u.scopeId,
          disabled: u.disabled,
          reason: meta.reason,
          actorId: meta.actorId,
          actorRole: meta.actorRole,
          source: meta.source,
          expectedVersion: meta.expectedVersion,
        }),
      );
      meta.expectedVersion = last.version;
    }
    if (!last) {
      const existing = await this.getStateFromDb();
      if (!existing) {
        throw new ServiceUnavailableError(
          'AI_GOVERNANCE_STORE_UNAVAILABLE',
          'Governance state unavailable',
        );
      }
      return existing;
    }
    return last;
  }

  async logFailedGovernanceAttempt(params: {
    actorId?: string;
    actorRole?: string;
    reason: string;
    source: AiGovernanceSource;
    details?: Record<string, unknown>;
  }): Promise<void> {
    if (!isPersistenceEnabled()) {
      logWarn('AI governance failed attempt', params);
      return;
    }

    const globalRow = await this.ensureStateRow();
    const version = Number(globalRow.version) + 1;
    const ctx = getRequestContext();

    try {
      await getPrisma().$transaction(async (tx) => {
        await tx.aiGovernanceState.update({
          where: { id: AI_GOVERNANCE_SCOPE_ID },
          data: { version: BigInt(version) },
        });
        await tx.aiGovernanceStateHistory.create({
          data: {
            stateId: AI_GOVERNANCE_SCOPE_ID,
            changeKind: 'failed_attempt',
            llmDisabled: globalRow.llmDisabled,
            previousLlmDisabled: globalRow.llmDisabled,
            version: BigInt(version),
            actorId: params.actorId ?? null,
            actorRole: params.actorRole ?? null,
            reason: params.reason,
            source: params.source,
            requestId: ctx?.requestId ?? null,
            correlationId: ctx?.traceId ?? null,
          },
        });
      });
    } catch (error) {
      logWarn('AI governance failed attempt audit write failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private validateScopeParams(params: SetAiGovernanceScopeParams): void {
    if (!AI_GOVERNANCE_SCOPE_TYPES.includes(params.scopeType)) {
      throw new BadRequestError('AI_GOVERNANCE_INVALID_SCOPE', 'Invalid scope type');
    }
    if (params.scopeType === 'feature' && !isKnownFeature(params.scopeId)) {
      throw new BadRequestError(
        'AI_GOVERNANCE_INVALID_SCOPE',
        `Unknown feature. Allowed: ${AI_GOVERNANCE_FEATURES.join(', ')}`,
      );
    }
    if (params.scopeType === 'provider' && !isKnownProvider(params.scopeId)) {
      throw new BadRequestError(
        'AI_GOVERNANCE_INVALID_SCOPE',
        `Unknown provider. Allowed: ${AI_GOVERNANCE_PROVIDERS.join(', ')}`,
      );
    }
  }

  private assertTogglePolicy(
    params: { llmDisabled: boolean; source: AiGovernanceSource; actorRole?: string; reason?: string },
    kind: 'global' | AiGovernanceScopeType,
  ): void {
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
        kind === 'global'
          ? 'Enabling LLM in production requires SUPER_ADMIN role.'
          : 'Enabling this scope in production requires SUPER_ADMIN role.',
      );
    }

    if (isProd && params.llmDisabled) {
      const reason = params.reason?.trim() ?? '';
      if (reason.length < 10) {
        throw new BadRequestError(
          'AI_GOVERNANCE_REASON_REQUIRED',
          'A reason of at least 10 characters is required to disable in production.',
        );
      }
    }
  }

  private async syncAfterPersist(
    dto: AiGovernanceStateDto,
    scopes: AiGovernanceScopeSnapshot,
    params: {
      llmDisabled: boolean;
      reason?: string;
      actorId?: string;
      actorRole?: string;
      source: AiGovernanceSource;
    },
    previousDisabled: boolean,
    previousVersion: number,
    auditField = 'llmDisabled',
  ): Promise<void> {
    const config = this.config ?? getConfig();

    try {
      await writeGovernanceRedisCache(config, {
        llmDisabled: dto.llmDisabled,
        version: dto.version,
        scopes,
      });
      await publishGovernanceChange(config, {
        version: dto.version,
        llmDisabled: dto.llmDisabled,
        at: dto.updatedAt,
        scopes,
      });
    } catch (error) {
      logWarn('AI governance Redis sync failed after persist', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    void createAuditLogAsync({
      action: 'SYSTEM_CONFIG_CHANGE' satisfies AuditAction,
      ...omitUndefined({
        severity: 'CRITICAL' as const,
        actorId: params.actorId,
        actorRole: params.actorRole,
        actorType: 'user' as const,
        resourceType: 'ai_governance',
        resourceId: AI_GOVERNANCE_SCOPE_ID,
        details: {
          field: auditField,
          source: params.source,
          reason: params.reason,
        },
        changes: [
          { field: 'llmDisabled', oldValue: previousDisabled, newValue: dto.llmDisabled },
          { field: 'version', oldValue: previousVersion, newValue: dto.version },
        ],
      }),
    });

    logInfo('AI governance state changed', {
      llmDisabled: dto.llmDisabled,
      version: dto.version,
      source: params.source,
      actorId: params.actorId,
    });
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

  private async ensureScopeRow(scopeType: AiGovernanceScopeType, scopeId: string) {
    const prisma = getPrisma();
    const normalizedId =
      scopeType === 'feature' ? normalizeFeatureKey(scopeId) : normalizeProviderKey(scopeId);
    const existing = await prisma.aiGovernanceScope.findUnique({
      where: { scopeType_scopeId: { scopeType, scopeId: normalizedId } },
    });
    if (existing) return existing;

    return prisma.aiGovernanceScope.create({
      data: {
        scopeType,
        scopeId: normalizedId,
        disabled: false,
        version: BigInt(1),
        source: 'startup_sync',
      },
    });
  }

  private async ensureAllScopeRows(): Promise<void> {
    for (const f of AI_GOVERNANCE_FEATURES) {
      await this.ensureScopeRow('feature', f);
    }
    for (const p of AI_GOVERNANCE_PROVIDERS) {
      await this.ensureScopeRow('provider', p);
    }
  }

  private async loadScopesFromDb(): Promise<AiGovernanceScopeSnapshot> {
    await this.ensureAllScopeRows();
    const rows = await getPrisma().aiGovernanceScope.findMany();
    const snapshot = emptyScopeSnapshot();
    for (const row of rows) {
      if (row.scopeType === 'feature') {
        snapshot.features[normalizeFeatureKey(row.scopeId)] = row.disabled;
      } else if (row.scopeType === 'provider') {
        snapshot.providers[normalizeProviderKey(row.scopeId)] = row.disabled;
      }
    }
    return snapshot;
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
