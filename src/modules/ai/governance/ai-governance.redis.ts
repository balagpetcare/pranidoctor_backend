import { Redis } from 'ioredis';

import type { AppConfig } from '../../../shared/config/config.schema.js';
import { getRedis, isRedisInitialized } from '../../../infra/redis/redis.client.js';

import { parseScopeSnapshot, type AiGovernanceScopeSnapshot } from './ai-governance.scopes.js';
import type { AiGovernancePubSubMessage } from './ai-governance.types.js';

export const AI_GOVERNANCE_REDIS_KEYS = {
  llmDisabled: 'ai:governance:llm_disabled',
  version: 'ai:governance:version',
  scopes: 'ai:governance:scopes',
  channel: 'ai:governance:events',
} as const;

export function governanceRedisKey(config: AppConfig, suffix: string): string {
  return `${config.redis.prefix}${suffix}`;
}

export async function writeGovernanceRedisCache(
  config: AppConfig,
  params: {
    llmDisabled: boolean;
    version: number;
    scopes?: AiGovernanceScopeSnapshot;
  },
): Promise<void> {
  if (!isRedisInitialized()) return;

  const redis = getRedis();
  const disabledKey = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.llmDisabled);
  const versionKey = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.version);
  const scopesKey = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.scopes);

  const multi = redis.multi().set(disabledKey, params.llmDisabled ? '1' : '0').set(versionKey, String(params.version));

  if (params.scopes) {
    multi.set(scopesKey, JSON.stringify(params.scopes));
  }

  await multi.exec();
}

export async function readGovernanceRedisCache(
  config: AppConfig,
): Promise<{
  llmDisabled: boolean;
  version: number;
  scopes: AiGovernanceScopeSnapshot | null;
} | null> {
  if (!isRedisInitialized()) return null;

  const redis = getRedis();
  const [disabledRaw, versionRaw, scopesRaw] = await redis.mget(
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.llmDisabled),
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.version),
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.scopes),
  );

  if (disabledRaw === null || versionRaw === null) return null;

  const version = Number(versionRaw);
  if (!Number.isFinite(version)) return null;

  return {
    llmDisabled: disabledRaw === '1',
    version,
    scopes: scopesRaw ? parseScopeSnapshot(JSON.parse(scopesRaw)) : null,
  };
}

export async function invalidateGovernanceRedisCache(config: AppConfig): Promise<void> {
  if (!isRedisInitialized()) return;

  const redis = getRedis();
  await redis.del(
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.llmDisabled),
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.version),
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.scopes),
  );
}

export async function publishGovernanceChange(
  config: AppConfig,
  message: AiGovernancePubSubMessage,
): Promise<void> {
  if (!isRedisInitialized()) return;

  const redis = getRedis();
  await redis.publish(
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.channel),
    JSON.stringify(message),
  );
}

export function createGovernanceSubscriber(config: AppConfig): Redis {
  const primary = getRedis();
  return primary.duplicate();
}

export function parseGovernancePubSubMessage(raw: string): AiGovernancePubSubMessage | null {
  try {
    const parsed = JSON.parse(raw) as AiGovernancePubSubMessage;
    if (typeof parsed.version !== 'number' || typeof parsed.llmDisabled !== 'boolean') {
      return null;
    }
    if (parsed.scopes) {
      const scopes = parseScopeSnapshot(parsed.scopes);
      if (!scopes) return null;
      parsed.scopes = scopes;
    }
    return parsed;
  } catch {
    return null;
  }
}
