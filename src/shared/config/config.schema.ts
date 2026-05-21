import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

const jwtSecretSchema = z
  .string()
  .min(32, 'JWT secret must be at least 32 characters')
  .refine((val) => !val.includes('CHANGE_ME'), {
    message: 'JWT secret must be changed from default value',
  });

const storageDriverSchema = z.enum(['s3', 'minio', 'local', 'disabled']);

export const configSchema = z
  .object({
    nodeEnv: nodeEnvSchema.default('development'),
    port: z.coerce.number().int().min(1).max(65535).default(3000),
    appName: z.string().min(1).default('pranidoctor-api'),
    appVersion: z.string().default('1.0.0'),
    skipStartupValidation: z.coerce.boolean().default(false),

    database: z.object({
      url: z.string().url('DATABASE_URL must be a valid URL'),
      host: z.string().default('localhost'),
      port: z.coerce.number().int().default(5432),
      name: z.string().default('pranidoctor'),
      user: z.string().default('pranidoctor'),
      password: z.string(),
      poolMin: z.coerce.number().int().min(1).default(2),
      poolMax: z.coerce.number().int().min(1).default(10),
    }),

    redis: z.object({
      enabled: z.coerce.boolean().default(true),
      url: z.string().default('redis://localhost:6379'),
      host: z.string().default('localhost'),
      port: z.coerce.number().int().default(6379),
      prefix: z.string().default('pd:'),
    }),

    jwt: z.object({
      adminSecret: jwtSecretSchema,
      mobileSecret: jwtSecretSchema,
      doctorSecret: jwtSecretSchema,
      technicianSecret: jwtSecretSchema,
      refreshSecret: jwtSecretSchema,
    }),

    otp: z.object({
      length: z.coerce.number().int().min(4).max(8).default(6),
      expirySeconds: z.coerce.number().int().min(60).max(600).default(300),
      resendCooldownSeconds: z.coerce.number().int().min(30).max(300).default(60),
      maxAttempts: z.coerce.number().int().min(3).max(10).default(5),
      maxSendsPerHour: z.coerce.number().int().min(3).max(20).default(5),
    }),

    log: z.object({
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
      format: z.enum(['json', 'pretty']).default('json'),
    }),

    cors: z.object({
      origins: z.array(z.string()).default(['http://localhost:3000']),
    }),

    rateLimit: z.object({
      windowMs: z.coerce.number().int().min(1000).default(60000),
      maxRequests: z.coerce.number().int().min(1).default(100),
    }),

    storage: z.object({
      driver: storageDriverSchema.default('disabled'),
      endpoint: z.string().optional(),
      region: z.string().default('us-east-1'),
      bucket: z.string().default('pranidoctor-dev'),
      accessKeyId: z.string().default(''),
      secretAccessKey: z.string().default(''),
      localPath: z.string().default('./.local-storage'),
      forcePathStyle: z.coerce.boolean().default(true),
      signedUrlExpirySeconds: z.coerce.number().int().min(60).max(86400).default(300),
      maxImageBytes: z.coerce.number().int().min(1).default(5 * 1024 * 1024),
      maxDocumentBytes: z.coerce.number().int().min(1).default(10 * 1024 * 1024),
      maxVideoBytes: z.coerce.number().int().min(1).default(80 * 1024 * 1024),
      allowedImageMimes: z.array(z.string()).default([
        'image/jpeg',
        'image/png',
        'image/webp',
      ]),
      allowedDocumentMimes: z.array(z.string()).default([
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ]),
      allowedVideoMimes: z.array(z.string()).default(['video/mp4', 'video/webm']),
    }),
  })
  .refine(
    (data) => {
      if (data.nodeEnv === 'production') {
        const secrets = [
          data.jwt.adminSecret,
          data.jwt.mobileSecret,
          data.jwt.doctorSecret,
          data.jwt.technicianSecret,
          data.jwt.refreshSecret,
        ];
        return secrets.every((s) => !s.includes('CHANGE_ME'));
      }
      return true;
    },
    {
      message: 'All JWT secrets must be changed from defaults in production',
      path: ['jwt'],
    }
  );

export type AppConfig = z.infer<typeof configSchema>;
export type NodeEnv = z.infer<typeof nodeEnvSchema>;
