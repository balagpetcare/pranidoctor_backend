import { request as httpRequest } from 'node:http';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import { SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { loadConfig } from '../../shared/config/config.loader.js';
import { loadEnvironment } from '../../shared/config/load-env.js';
import { createLogger } from '../../shared/logger/logger.js';
import { createCompatWebRouter } from '../compat-web/compat-web.routes.js';
import { GET as getMobileMe } from '../../legacy/web/routes/mobile/me/route.js';
import { GET as getMobileSettings } from '../../legacy/web/routes/mobile/settings/route.js';
import { MOBILE_AUDIENCE, MOBILE_ISSUER, getMobileJwtSecret } from '../auth/tokens/mobile-jwt.js';

async function signTestToken(expiresInSec: number): Promise<string> {
  const secret = getMobileJwtSecret();
  if (!secret) {
    throw new Error('MOBILE_JWT_SECRET or AUTH_SECRET required for contract tests');
  }
  return new SignJWT({ role: 'CUSTOMER', type: 'access', ctx: 'mobile' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('contract-test-user')
    .setIssuer(MOBILE_ISSUER)
    .setAudience(MOBILE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${expiresInSec}s`)
    .sign(new TextEncoder().encode(secret));
}

async function httpFetch(
  baseUrl: string,
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ status: number; body: string }> {
  const url = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      url,
      { method: init?.method ?? 'GET', headers: init?.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8') });
        });
      },
    );
    req.on('error', reject);
    if (init?.body) req.write(init.body);
    req.end();
  });
}

beforeAll(() => {
  loadEnvironment();
});

describe('mobile profile contract (route handlers)', () => {
  it('GET /api/mobile/me returns 401 without Bearer token', async () => {
    const res = await getMobileMe(new Request('http://localhost/api/mobile/me'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { ok?: boolean; error?: { code?: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('GET /api/mobile/settings returns 401 without Bearer token', async () => {
    const res = await getMobileSettings(new Request('http://localhost/api/mobile/settings'));
    expect(res.status).toBe(401);
  });
});

describe('mobile profile contract (compat express)', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    createLogger(loadConfig());
    const app = express();
    app.use(express.json());
    app.use('/api', await createCompatWebRouter());
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('POST /api/mobile/me returns 405', async () => {
    const res = await httpFetch(baseUrl, '/api/mobile/me', { method: 'POST', body: '{}' });
    expect(res.status).toBe(405);
  });

  it('GET /api/mobile/me returns 401 without token', async () => {
    const res = await httpFetch(baseUrl, '/api/mobile/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/mobile/me returns 401 for expired token', async () => {
    const expired = await signTestToken(-60);
    const res = await httpFetch(baseUrl, '/api/mobile/me', {
      headers: { Authorization: `Bearer ${expired}` },
    });
    expect(res.status).toBe(401);
  });
});
