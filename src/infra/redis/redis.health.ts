import type { AppConfig } from '../../shared/config/config.schema.js';
import { isRedisEnabled } from '../../shared/config/infra.flags.js';
import { isRateLimitingAvailable } from '../../shared/security/rate-limit/safe-rate-limit.js';

import {
  checkRedisConnection,
  getRedis,
  isRedisInitialized,
  prefixKey,
} from './redis.client.js';

const PROBE_KEY = 'health:probe';

export type RedisFeatureBackend = 'redis' | 'postgres' | 'unavailable' | 'in-process';

export interface RedisHealthDetails {
  enabled: boolean;
  initialized: boolean;
  prefix: string;
  connected: boolean;
  pingLatencyMs: number;
  probeWriteOk: boolean;
  rateLimitBackend: 'available' | 'unavailable';
  governanceSync: 'pubsub' | 'poll-only' | 'unavailable';
  reconnectSupported: boolean;
  features: {
    aiRateLimit: RedisFeatureBackend;
    governanceSync: RedisFeatureBackend;
    usageCounters: RedisFeatureBackend;
    budgetTracking: RedisFeatureBackend;
    sessions: RedisFeatureBackend;
    queues: RedisFeatureBackend;
    areaCache: RedisFeatureBackend;
  };
}

export interface RedisHealthProbeResult {
  healthy: boolean;
  latency: number;
  error?: string;
  details: RedisHealthDetails;
}

function buildFeatureMap(config: AppConfig): RedisHealthDetails['features'] {
  const redisUp = isRedisEnabled(config) && isRedisInitialized();

  return {
    aiRateLimit: redisUp ? 'redis' : 'unavailable',
    governanceSync: redisUp ? 'redis' : 'postgres',
    usageCounters: 'postgres',
    budgetTracking: 'postgres',
    sessions: redisUp ? 'redis' : 'unavailable',
    queues: redisUp ? 'redis' : 'unavailable',
    areaCache: redisUp ? 'redis' : 'postgres',
  };
}

function buildDetails(
  config: AppConfig,
  params: {
    connected: boolean;
    pingLatencyMs: number;
    probeWriteOk: boolean;
  },
): RedisHealthDetails {
  const enabled = isRedisEnabled(config);
  const initialized = isRedisInitialized();
  const rateLimitAvailable = isRateLimitingAvailable();

  let governanceSync: RedisHealthDetails['governanceSync'] = 'unavailable';
  if (enabled && initialized && params.connected) {
    governanceSync = 'pubsub';
  } else if (enabled) {
    governanceSync = 'poll-only';
  }

  return {
    enabled,
    initialized,
    prefix: config.redis.prefix,
    connected: params.connected,
    pingLatencyMs: params.pingLatencyMs,
    probeWriteOk: params.probeWriteOk,
    rateLimitBackend: rateLimitAvailable ? 'available' : 'unavailable',
    governanceSync,
    reconnectSupported: true,
    features: buildFeatureMap(config),
  };
}

/** PING + write/read probe for production health checks and startup validation. */
export async function probeRedisHealth(config: AppConfig): Promise<RedisHealthProbeResult> {
  if (!isRedisEnabled(config)) {
    return {
      healthy: false,
      latency: 0,
      error: 'Redis disabled (REDIS_ENABLED=false)',
      details: buildDetails(config, { connected: false, pingLatencyMs: 0, probeWriteOk: false }),
    };
  }

  if (!isRedisInitialized()) {
    return {
      healthy: false,
      latency: 0,
      error: 'Redis enabled but client not initialized',
      details: buildDetails(config, { connected: false, pingLatencyMs: 0, probeWriteOk: false }),
    };
  }

  const ping = await checkRedisConnection();
  if (!ping.healthy) {
    return {
      healthy: false,
      latency: ping.latency,
      ...(ping.error && { error: ping.error }),
      details: buildDetails(config, {
        connected: false,
        pingLatencyMs: ping.latency,
        probeWriteOk: false,
      }),
    };
  }

  const redis = getRedis();
  const probeKey = prefixKey(config, PROBE_KEY);
  let probeWriteOk = false;

  try {
    await redis.set(probeKey, String(Date.now()), 'EX', 30);
    const value = await redis.get(probeKey);
    probeWriteOk = value !== null;
  } catch (error) {
    return {
      healthy: false,
      latency: ping.latency,
      error: error instanceof Error ? error.message : 'Redis probe write failed',
      details: buildDetails(config, {
        connected: false,
        pingLatencyMs: ping.latency,
        probeWriteOk: false,
      }),
    };
  }

  return {
    healthy: probeWriteOk,
    latency: ping.latency,
    ...(probeWriteOk ? {} : { error: 'Redis probe read/write failed' }),
    details: buildDetails(config, {
      connected: true,
      pingLatencyMs: ping.latency,
      probeWriteOk,
    }),
  };
}
