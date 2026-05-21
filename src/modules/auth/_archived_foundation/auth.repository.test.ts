import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthRepository, hashTokenValue } from './auth.repository.js';

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  role: {
    findFirst: vi.fn(),
  },
  userSession: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  refreshToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
  zadd: vi.fn(),
  zcount: vi.fn(),
  expire: vi.fn(),
  pipeline: vi.fn(),
};

const mockPipeline = {
  setex: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  expire: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('../../infra/redis/redis.client.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('../../shared/config/index.js', () => ({
  getConfig: () => ({
    redis: { prefix: 'pd:' },
    otp: { expirySeconds: 300 },
  }),
}));

describe('AuthRepository', () => {
  const repository = new AuthRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.pipeline.mockReturnValue(mockPipeline);
  });

  describe('findUserByPhone', () => {
    it('returns mapped user when found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        phone: '+8801712345678',
        email: null,
        displayName: 'Test',
        passwordHash: null,
        status: 'ACTIVE',
        tenantId: null,
        lastLoginAt: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        role: { name: 'USER' },
      });

      const user = await repository.findUserByPhone('+8801712345678');

      expect(user).not.toBeNull();
      expect(user?.id).toBe('user-1');
      expect(user?.role).toBe('USER');
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ phone: '+8801712345678' }),
        })
      );
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      const user = await repository.findUserByPhone('+8801999999999');
      expect(user).toBeNull();
    });
  });

  describe('createUser', () => {
    it('creates user with default USER role', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({ id: 'role-1', name: 'USER' });
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-new',
        phone: '+8801712345678',
        email: null,
        displayName: null,
        passwordHash: null,
        status: 'ACTIVE',
        tenantId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        role: { name: 'USER' },
      });

      const user = await repository.createUser({ phone: '+8801712345678' });

      expect(user.id).toBe('user-new');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            phone: '+8801712345678',
            role: { connect: { id: 'role-1' } },
          }),
        })
      );
    });

    it('throws when neither phone nor email provided', async () => {
      await expect(repository.createUser({})).rejects.toThrow(
        'createUser requires phone or email'
      );
    });
  });

  describe('OTP flow', () => {
    it('stores challenge in redis with ttl', async () => {
      const expiresAt = new Date(Date.now() + 300_000);
      const challenge = await repository.createOtpChallenge(
        '+8801712345678',
        'hash-abc',
        expiresAt
      );

      expect(challenge.phone).toBe('+8801712345678');
      expect(challenge.codeHash).toBe('hash-abc');
      expect(mockPipeline.setex).toHaveBeenCalled();
      expect(mockPipeline.zadd).toHaveBeenCalled();
    });

    it('finds challenge from redis', async () => {
      const stored: object = {
        id: 'ch-1',
        phone: '+8801712345678',
        codeHash: 'hash',
        expiresAt: new Date().toISOString(),
        attempts: 0,
        verified: false,
        createdAt: new Date().toISOString(),
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(stored));

      const challenge = await repository.findOtpChallenge('+8801712345678');

      expect(challenge?.id).toBe('ch-1');
    });

    it('counts recent otp sends via sorted set', async () => {
      mockRedis.zcount.mockResolvedValue(3);
      const count = await repository.countRecentOtpRequests(
        '+8801712345678',
        new Date(Date.now() - 3600_000)
      );
      expect(count).toBe(3);
      expect(mockRedis.zcount).toHaveBeenCalled();
    });
  });

  describe('sessions', () => {
    it('creates persisted session row', async () => {
      const expiresAt = new Date(Date.now() + 86_400_000);
      mockPrisma.userSession.create.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        context: 'MOBILE',
        status: 'ACTIVE',
        deviceId: 'dev-1',
        expiresAt,
        lastActiveAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        tenantId: null,
        createdAt: new Date(),
      });

      const session = await repository.createSession({
        id: 'sess-1',
        userId: 'user-1',
        context: 'mobile',
        expiresAt,
        deviceId: 'dev-1',
      });

      expect(session.id).toBe('sess-1');
      expect(session.context).toBe('mobile');
    });

    it('finds session by device', async () => {
      mockPrisma.userSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        userId: 'user-1',
        context: 'MOBILE',
        status: 'ACTIVE',
        deviceId: 'dev-1',
        expiresAt: new Date(Date.now() + 1000),
        lastActiveAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        tenantId: null,
        createdAt: new Date(),
      });

      const session = await repository.findSessionByDevice('user-1', 'dev-1');
      expect(session?.deviceId).toBe('dev-1');
    });
  });

  describe('refreshToken', () => {
    it('stores refresh token hash in database', async () => {
      const expiresAt = new Date(Date.now() + 604_800_000);
      mockPrisma.refreshToken.create.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        sessionId: 'sess-1',
        tokenHash: hashTokenValue('refresh-token'),
        deviceId: null,
        expiresAt,
        revoked: false,
        revokedAt: null,
        rotatedAt: null,
        rotatedToId: null,
      });

      const record = await repository.storeRefreshToken({
        userId: 'user-1',
        sessionId: 'sess-1',
        tokenHash: hashTokenValue('refresh-token'),
        expiresAt,
      });

      expect(record.tokenHash).toBe(hashTokenValue('refresh-token'));
    });
  });

  describe('findUserBySocialIdentity', () => {
    it('returns null until social identity storage exists', async () => {
      const user = await repository.findUserBySocialIdentity({
        provider: 'google',
        subject: 'google-sub-123',
      });
      expect(user).toBeNull();
    });
  });
});
