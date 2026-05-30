import type { AppConfig } from './src/shared/config/config.schema.js';
import { createLogger } from './src/shared/logger/logger.js';

const testConfig = {
  nodeEnv: 'test',
  port: 3000,
  appName: 'pranidoctor-api-test',
  appVersion: '1.0.0',
  skipStartupValidation: true,
  cors: { origins: ['http://localhost:3000'] },
  log: { level: 'silent' as const, format: 'json' as const },
  redis: {
    enabled: false,
    url: 'redis://localhost:6379',
    host: 'localhost',
    port: 6379,
    prefix: 'pd:test:',
  },
} as AppConfig;

createLogger(testConfig);
