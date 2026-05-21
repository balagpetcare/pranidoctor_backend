export {
  loadConfig,
  getConfig,
  resetConfigCache,
  requireConfig,
  isProduction,
  isDevelopment,
  isTest,
} from './config.loader.js';

export {
  applyResolvedEnv,
  resolveDatabaseUrl,
  resolveRedisUrl,
  resolveMinioUrl,
  resolveEnvUrls,
  type ResolvedEnvUrls,
} from './env.resolver.js';

export { loadEnvironment } from './load-env.js';

export { configSchema, type AppConfig, type NodeEnv } from './config.schema.js';

export {
  validateInfrastructureEnv,
  formatEnvValidation,
  type EnvValidationResult,
} from './env.validation.js';

export {
  isRedisEnabled,
  isRedisRequired,
  isStorageRequired,
  isStrictStartupMode,
  shouldSkipStartupValidation,
} from './infra.flags.js';

export {
  validateStartup,
  formatStartupValidation,
  type StartupValidationResult,
  type ServiceCheckResult,
} from './startup-validation.js';
