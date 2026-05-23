import { configSchema, type AppConfig } from './config.schema.js';
import { formatEnvValidation, validateInfrastructureEnv } from './env.validation.js';
import { applyResolvedEnv } from './env.resolver.js';

function parseEnvArray(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseMbToBytes(value: string | undefined, fallbackMb: number): number {
  const raw = value?.trim();
  const n = raw ? Number.parseFloat(raw) : NaN;
  const mb = Number.isFinite(n) && n > 0 ? n : fallbackMb;
  return Math.round(mb * 1024 * 1024);
}

function parseStorageDriver(
  value: string | undefined
): 's3' | 'minio' | 'local' | 'disabled' {
  const media = process.env['MEDIA_STORAGE']?.trim().toLowerCase();
  const driver = (value ?? media ?? 'disabled').trim().toLowerCase();
  if (driver === 's3' || driver === 'minio' || driver === 'local' || driver === 'disabled') {
    return driver;
  }
  return 'disabled';
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue;
  return value !== 'false' && value !== '0';
}

function loadRawConfig(): Record<string, unknown> {
  const env = process.env;

  return {
    nodeEnv: env['NODE_ENV'],
    port: env['PORT'],
    appName: env['APP_NAME'],
    appVersion: env['APP_VERSION'],
    skipStartupValidation: parseBooleanEnv(env['SKIP_STARTUP_VALIDATION'], false),

    database: {
      url: env['DATABASE_URL'],
      host: env['DB_HOST'],
      port: env['DB_PORT'],
      name: env['DB_NAME'],
      user: env['DB_USER'],
      password: env['DB_PASSWORD'],
      poolMin: env['DB_POOL_MIN'],
      poolMax: env['DB_POOL_MAX'],
    },

    redis: {
      enabled: parseBooleanEnv(env['REDIS_ENABLED'], true),
      url: env['REDIS_URL'],
      host: env['REDIS_HOST'],
      port: env['REDIS_PORT'],
      prefix: env['REDIS_PREFIX'],
    },

    jwt: {
      adminSecret: env['ADMIN_JWT_SECRET'],
      mobileSecret: env['MOBILE_JWT_SECRET'],
      doctorSecret: env['DOCTOR_JWT_SECRET'],
      technicianSecret: env['TECHNICIAN_JWT_SECRET'],
      refreshSecret: env['MOBILE_REFRESH_SECRET'],
    },

    otp: {
      length: env['OTP_LENGTH'],
      expirySeconds: env['OTP_EXPIRY_SECONDS'],
      resendCooldownSeconds: env['OTP_RESEND_COOLDOWN_SECONDS'],
      maxAttempts: env['OTP_MAX_ATTEMPTS'],
      maxSendsPerHour: env['OTP_MAX_SENDS_PER_HOUR'],
    },

    log: {
      level: env['LOG_LEVEL'],
      format: env['LOG_FORMAT'],
    },

    cors: {
      origins: parseEnvArray(env['CORS_ORIGINS']),
    },

    rateLimit: {
      windowMs: env['RATE_LIMIT_WINDOW_MS'],
      maxRequests: env['RATE_LIMIT_MAX_REQUESTS'],
    },

    storage: {
      enabled:
        parseBooleanEnv(env['STORAGE_ENABLED'], true) &&
        parseBooleanEnv(env['MINIO_ENABLED'], true),
      driver: parseStorageDriver(env['STORAGE_DRIVER']),
      endpoint: env['S3_ENDPOINT'],
      region: env['S3_REGION'],
      bucket: env['S3_BUCKET'],
      accessKeyId: env['S3_ACCESS_KEY'] ?? env['S3_ACCESS_KEY_ID'],
      secretAccessKey: env['S3_SECRET_KEY'] ?? env['S3_SECRET_ACCESS_KEY'],
      localPath: env['LOCAL_STORAGE_PATH'],
      forcePathStyle: env['S3_FORCE_PATH_STYLE'],
      signedUrlExpirySeconds: env['S3_SIGNED_URL_EXPIRY_SECONDS'],
      maxImageBytes: parseMbToBytes(env['UPLOAD_MAX_IMAGE_MB'], 5),
      maxDocumentBytes: parseMbToBytes(env['UPLOAD_MAX_DOCUMENT_MB'], 10),
      maxVideoBytes: parseMbToBytes(env['UPLOAD_MAX_VIDEO_MB'], 80),
      allowedImageMimes: parseEnvArray(
        env['UPLOAD_ALLOWED_IMAGE_TYPES'] ??
          'image/jpeg,image/png,image/webp'
      ),
      allowedDocumentMimes: parseEnvArray(
        env['UPLOAD_ALLOWED_DOCUMENT_TYPES'] ??
          'application/pdf,image/jpeg,image/png,image/webp'
      ),
      allowedVideoMimes: parseEnvArray(
        env['UPLOAD_ALLOWED_VIDEO_TYPES'] ?? 'video/mp4,video/webm'
      ),
    },
  };
}

let cachedConfig: AppConfig | null = null;

export function loadConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  applyResolvedEnv();

  const infraValidation = validateInfrastructureEnv();
  if (!infraValidation.ok) {
    console.error(formatEnvValidation(infraValidation));
    throw new Error('Infrastructure environment validation failed');
  }
  for (const warning of infraValidation.warnings) {
    console.warn(`[env] ${warning}`);
  }

  const rawConfig = loadRawConfig();
  const result = configSchema.safeParse(rawConfig);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new Error(`Configuration validation failed:\n${errors}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

export function resetConfigCache(): void {
  cachedConfig = null;
}

export function requireConfig(): AppConfig {
  const config = getConfig();
  if (!config) {
    throw new Error('Configuration not loaded');
  }
  return config;
}

export function isProduction(): boolean {
  return getConfig().nodeEnv === 'production';
}

export function isDevelopment(): boolean {
  return getConfig().nodeEnv === 'development';
}

export function isTest(): boolean {
  return getConfig().nodeEnv === 'test';
}
