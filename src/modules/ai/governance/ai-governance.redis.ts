import { Redis } from 'ioredis';

import type { AppConfig } from '../../../shared/config/config.schema.js';
import { getRedis, isRedisInitialized } from '../../../infra/redis/redis.client.js';

import type { AiGovernancePubSubMessage } from './ai-governance.types.js';

export const AI_GOVERNANCE_REDIS_KEYS = {
  llmDisabled: 'ai:governance:llm_disabled',
  version: 'ai:governance:version',
  channel: 'ai:governance:events',
} as const;

export function governanceRedisKey(config: AppConfig, suffix: string): string {
  return `${config.redis.prefix}${suffix}`;
}

export async function writeGovernanceRedisCache(
  config: AppConfig,
  params: { llmDisabled: boolean; version: number },
): Promise<void> {
  if (!isRedisInitialized()) return;

  const redis = getRedis();
  const disabledKey = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.llmDisabled);
  const versionKey = governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.version);

  await redis
    .multi()
    .set(disabledKey, params.llmDisabled ? '1' : '0')
    .set(versionKey, String(params.version))
    .exec();
}

export async function readGovernanceRedisCache(
  config: AppConfig,
): Promise<{ llmDisabled: boolean; version: number } | null> {
  if (!isRedisInitialized()) return null;

  const redis = getRedis();
  const [disabledRaw, versionRaw] = await redis.mget(
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.llmDisabled),
    governanceRedisKey(config, AI_GOVERNANCE_REDIS_KEYS.version),
  );

  if (disabledRaw === null || versionRaw === null) return null;

  const version = Number(versionRaw);
  if (!Number.isFinite(version)) return null;

  return {
    llmDisabled: disabledRaw === '1',
    version,
  };
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
    return parsed;
  } catch {
    return null;
  }
}
