import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  userSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('./auth-audit.service.js', () => ({
  recordAuthAuditFireAndForget: vi.fn(),
}));

describe('SessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an active session', async () => {
    const { SessionService } = await import('./session.service.js');
    const svc = new SessionService();

    mockPrisma.userSession.create.mockResolvedValue({
      id: 'sess-1',
      expiresAt: new Date(Date.now() + 86400000),
    });

    const result = await svc.create({
      userId: 'user-1',
      channel: 'mobile',
    });

    expect(result.id).toBe('sess-1');
    expect(mockPrisma.userSession.create).toHaveBeenCalled();
  });

  it('revokes all sessions for user', async () => {
    const { SessionService } = await import('./session.service.js');
    const svc = new SessionService();

    mockPrisma.userSession.updateMany.mockResolvedValue({ count: 2 });

    const count = await svc.revokeAllForUser('user-1', { reason: 'logout_all' });
    expect(count).toBe(2);
  });
});
