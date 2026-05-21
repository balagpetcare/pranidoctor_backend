import { describe, expect, it } from 'vitest';

import {
  resolveDatabaseUrl,
  resolveRedisUrl,
  resolveMinioUrl,
} from './env.resolver.js';

describe('env.resolver', () => {
  it('uses explicit DATABASE_URL when set', () => {
    const url = resolveDatabaseUrl({
      DATABASE_URL: 'postgresql://u:p@db.example:5432/app',
    });
    expect(url).toBe('postgresql://u:p@db.example:5432/app');
  });

  it('builds DATABASE_URL from DB_* components', () => {
    const url = resolveDatabaseUrl({
      DB_HOST: 'postgres',
      DB_PORT: '5432',
      DB_NAME: 'pranidoctor',
      DB_USER: 'admin',
      DB_PASSWORD: 'secret@word',
    });
    expect(url).toBe('postgresql://admin:secret%40word@postgres:5432/pranidoctor');
  });

  it('uses explicit REDIS_URL when set', () => {
    const url = resolveRedisUrl({ REDIS_URL: 'redis://cache:6379/0' });
    expect(url).toBe('redis://cache:6379/0');
  });

  it('builds REDIS_URL from REDIS_HOST and REDIS_PORT', () => {
    const url = resolveRedisUrl({ REDIS_HOST: 'redis', REDIS_PORT: '6380' });
    expect(url).toBe('redis://redis:6380');
  });

  it('builds REDIS_URL with password', () => {
    const url = resolveRedisUrl({
      REDIS_HOST: 'redis',
      REDIS_PORT: '6379',
      REDIS_PASSWORD: 's3cret',
    });
    expect(url).toBe('redis://:s3cret@redis:6379');
  });

  it('resolves MinIO URL from S3_ENDPOINT', () => {
    const url = resolveMinioUrl({ S3_ENDPOINT: 'http://minio:9000/' });
    expect(url).toBe('http://minio:9000');
  });

  it('builds MinIO URL from MINIO_HOST and MINIO_PORT', () => {
    const url = resolveMinioUrl({ MINIO_HOST: '127.0.0.1', MINIO_PORT: '9000' });
    expect(url).toBe('http://127.0.0.1:9000');
  });
});
