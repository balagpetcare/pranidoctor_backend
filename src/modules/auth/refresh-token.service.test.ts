import { createHash, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  refreshToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('./session.service.js', () => ({
  getSessionService: () => ({
    assertActive: vi.fn().mockResolvedValue({ id: 'sess-1', userId: 'user-1', channel: 'MOBILE' }),
    touch: vi.fn(),
    revoke: vi.fn(),
  }),
}));

vi.mock('./tokens/mobile-jwt.js', () => ({
  MOBILE_SESSION_MAX_AGE: 3600,
  signMobileCustomerToken: vi.fn().mockResolvedValue('access-jwt'),
}));

vi.mock('./auth-audit.service.js', () => ({
  recordAuthAuditFireAndForget: vi.fn(),
}));

process.env.MOBILE_REFRESH_SECRET = 'test_refresh_secret_32_chars_minimum_ok';
process.env.AUTH_REFRESH_ENABLED = 'true';

function hashForTest(raw: string): string {
  const pepper = process.env.MOBILE_REFRESH_SECRET!;
  return createHash('sha256').update(`${pepper}:${raw}`).digest('hex');
}

describe('RefreshTokenService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a refresh token when enabled', async () => {
    const { RefreshTokenService } = await import('./refresh-token.service.js');
    const svc = new RefreshTokenService();

    mockPrisma.refreshToken.create.mockResolvedValue({
      id: 'rt-1',
      userId: 'user-1',
      sessionId: 'sess-1',
      tokenHash: 'hash',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await svc.issue({
      userId: 'user-1',
      sessionId: 'sess-1',
    });

    expect(result).not.toBeNull();
    expect(result?.rawToken).toMatch(/^pd_rt_/);
    expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
  });

  it('returns null for invalid refresh on rotate', async () => {
    const { RefreshTokenService } = await import('./refresh-token.service.js');
    const svc = new RefreshTokenService();

    mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

    const result = await svc.rotate('pd_rt_invalid');
    expect(result).toBeNull();
  });

  it('rotates a valid refresh token', async () => {
    const { RefreshTokenService } = await import('./refresh-token.service.js');
    const svc = new RefreshTokenService();

    const raw = `pd_rt_${randomBytes(16).toString('base64url')}`;
    const hash = hashForTest(raw);

    mockPrisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-old',
      userId: 'user-1',
      sessionId: 'sess-1',
      tokenHash: hash,
      channel: 'MOBILE',
      deviceId: null,
      expiresAt: new Date(Date.now() + 86400000),
      revoked: false,
      session: { id: 'sess-1', status: 'ACTIVE' },
    });

    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
      const tx = {
        refreshToken: {
          create: vi.fn().mockResolvedValue({ id: 'rt-new' }),
          update: vi.fn(),
        },
      };
      return fn(tx as unknown as typeof mockPrisma);
    });

    const result = await svc.rotate(raw);
    expect(result).not.toBeNull();
    expect(result?.accessToken).toBe('access-jwt');
    expect(result?.refreshToken).toMatch(/^pd_rt_/);
  });
});
