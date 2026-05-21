/**
 * Backend foundation public surface — infrastructure only.
 * Import from here in new foundation modules; do not re-export frozen domain modules.
 */

export {
  loadConfig,
  getConfig,
  resetConfigCache,
  requireConfig,
  isProduction,
  isDevelopment,
  isTest,
  loadEnvironment,
  configSchema,
  type AppConfig,
  type NodeEnv,
  applyResolvedEnv,
  resolveDatabaseUrl,
  resolveRedisUrl,
  resolveMinioUrl,
  resolveEnvUrls,
  type ResolvedEnvUrls,
  validateInfrastructureEnv,
  formatEnvValidation,
  type EnvValidationResult,
  isRedisEnabled,
  isRedisRequired,
  isStorageRequired,
  isStrictStartupMode,
  shouldSkipStartupValidation,
  validateStartup,
  formatStartupValidation,
  type StartupValidationResult,
  type ServiceCheckResult,
} from '../config/index.js';

export {
  createLogger,
  getLogger,
  createChildLogger,
  logInfo,
  logWarn,
  logDebug,
  logError,
  logFatal,
  type LogContext,
} from '../logger/index.js';

export { sanitizeObject, sanitizeValue, sanitizeError } from '../logger/sanitizer.js';

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
} from '../errors/index.js';

export { errorHandler, notFoundHandler } from '../errors/error.handler.js';

export {
  sendSuccess,
  sendCreated,
  sendPaginated,
  sendNoContent,
  sendMessage,
  apiResponse,
  type SuccessResponse,
} from '../utils/response.js';

export {
  bdPhoneSchema,
  otpCodeSchema,
  cuidSchema,
  paginationSchema,
  dateRangeSchema,
  bdtAmountSchema,
  emailSchema,
  validate,
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  type ValidateTarget,
  type ValidationOptions,
} from '../validation/index.js';

export {
  createRequestContext,
  runWithContext,
  getRequestContext,
  getRequestId,
  getTraceId,
  getUserId,
  getTenantId,
  setUserId,
  setTenantId,
  getElapsedTime,
  type RequestContextData,
} from '../context/index.js';

export {
  contextMiddleware,
  requestIdMiddleware,
  createLoggerMiddleware,
  asyncHandler,
} from '../middleware/index.js';

export { createPrismaClient, getPrisma, disconnectPrisma } from '../database/index.js';

export {
  createAuditLog,
  createAuditLogAsync,
  getAuditLog,
  auditAuth,
  auditUser,
  auditDoctor,
  auditDataAccess,
  type CreateAuditLogOptions,
} from '../security/audit/index.js';

export {
  createRedisClient,
  getRedis,
  disconnectRedis,
  checkRedisConnection,
  isRedisInitialized,
  prefixKey,
} from '../../infra/redis/redis.client.js';

export {
  initializeQueueConnection,
  createQueue,
  createWorker,
  addJob,
  closeAllQueues,
  getQueue,
  QueueNames,
} from '../../infra/queue/index.js';

export {
  getHealthStatus,
  getReadinessStatus,
  getLivenessStatus,
  getDependencyStatus,
  checkDatabaseHealth,
  checkRedisHealth,
  checkStorageHealth,
  getModulesHealth,
  getSystemInfo,
} from '../../api/health/health.service.js';
