import { describe, expect, it, beforeEach } from 'vitest';

import type { AppConfig } from '../../../shared/config/config.schema.js';
import { createLogger } from '../../../shared/logger/logger.js';
import {
  degradeStorageRuntime,
  isStorageEnabled,
  isStorageOperational,
  isStorageRuntimeDegraded,
  resetStorage,
} from './storage.factory.js';

function baseConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'development',
    port: 3000,
    appName: 'test',
    appVersion: '1.0.0',
    skipStartupValidation: false,
    cors: { origins: ['http://localhost:3001'] },
    log: { level: 'info', format: 'json' },
    redis: { enabled: true, url: 'redis://localhost:6379', host: 'localhost', port: 6379, prefix: 'pd:' },
    storage: {
      enabled: true,
      driver: 's3',
      endpoint: 'http://127.0.0.1:9000',
      region: 'us-east-1',
      bucket: 'pranidoctor-dev',
      accessKeyId: 'minioadmin',
      secretAccessKey: 'minioadmin',
      localPath: './.local-storage',
      forcePathStyle: true,
      signedUrlExpirySeconds: 300,
      maxImageBytes: 5 * 1024 * 1024,
      maxDocumentBytes: 10 * 1024 * 1024,
      maxVideoBytes: 80 * 1024 * 1024,
      allowedImageMimes: ['image/jpeg'],
      allowedDocumentMimes: ['application/pdf'],
      allowedVideoMimes: ['video/mp4'],
    },
    ...overrides,
  } as AppConfig;
}

describe('storage.factory', () => {
  beforeEach(() => {
    resetStorage();
    createLogger(baseConfig());
  });

  it('respects STORAGE_ENABLED via config.storage.enabled', () => {
    expect(isStorageEnabled(baseConfig())).toBe(true);
    expect(isStorageEnabled(baseConfig({ storage: { ...baseConfig().storage, enabled: false } }))).toBe(
      false
    );
  });

  it('marks storage non-operational after runtime degrade', () => {
    const config = baseConfig();
    expect(isStorageOperational(config)).toBe(true);

    degradeStorageRuntime('connect ECONNREFUSED 127.0.0.1:9000');

    expect(isStorageRuntimeDegraded()).toBe(true);
    expect(isStorageOperational(config)).toBe(false);
    expect(process.env['STORAGE_RUNTIME_DEGRADED']).toBe('true');
  });
});
