import { describe, expect, it, vi, beforeEach } from 'vitest';

import type { AppConfig } from '../../../shared/config/config.schema.js';

vi.mock('../../../infra/redis/redis.client.js', () => ({
  getRedis: vi.fn(),
  isRedisInitialized: vi.fn(),
}));

import { getRedis, isRedisInitialized } from '../../../infra/redis/redis.client.js';
import {
  AI_GOVERNANCE_REDIS_KEYS,
  governanceRedisKey,
  publishGovernanceChange,
  writeGovernanceRedisCache,
} from './ai-governance.redis.js';

function baseConfig(): AppConfig {
  return {
    redis: { enabled: true, url: 'redis://localhost:6379', prefix: 'pd:' },
  } as AppConfig;
}

describe('ai-governance.redis multi-instance sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no-ops cache writes when Redis is unavailable', async () => {
    vi.mocked(isRedisInitialized).mockReturnValue(false);

    await expect(
      writeGovernanceRedisCache(baseConfig(), { llmDisabled: false, version: 1 }),
    ).resolves.toBeUndefined();

    expect(getRedis).not.toHaveBeenCalled();
  });

  it('writes cache and publishes governance events for cross-instance sync', async () => {
    const multiExec = vi.fn().mockResolvedValue([]);
    const publish = vi.fn().mockResolvedValue(1);
    const multi = {
      set: vi.fn().mockReturnThis(),
      exec: multiExec,
    };

    vi.mocked(isRedisInitialized).mockReturnValue(true);
    vi.mocked(getRedis).mockReturnValue({
      multi: vi.fn().mockReturnValue(multi),
      publish,
    } as never);

    await writeGovernanceRedisCache(baseConfig(), {
      llmDisabled: true,
      version: 42,
      scopes: { features: { CHAT: true }, providers: { openai: false } },
    });

    expect(multi.set).toHaveBeenCalledWith(
      governanceRedisKey(baseConfig(), AI_GOVERNANCE_REDIS_KEYS.llmDisabled),
      '1',
    );
    expect(multiExec).toHaveBeenCalled();

    await publishGovernanceChange(baseConfig(), {
      version: 42,
      llmDisabled: true,
      at: new Date().toISOString(),
      scopes: { features: { CHAT: true }, providers: { openai: false } },
    });

    expect(publish).toHaveBeenCalledWith(
      governanceRedisKey(baseConfig(), AI_GOVERNANCE_REDIS_KEYS.channel),
      expect.stringContaining('"version":42'),
    );
  });
});
