import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockPrisma = {
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  userSession: {
    findFirst: vi.fn(),
  },
};

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('./auth-audit.service.js', () => ({
  authRequestContext: vi.fn(() => ({})),
  recordAuthAuditFireAndForget: vi.fn(),
}));

vi.mock('./tokens/panel-doctor-token.js', () => ({
  getDoctorJwtSecret: vi.fn(() => 'test-doctor-secret-32-chars-minimum-ok'),
  signDoctorToken: vi.fn().mockResolvedValue('doctor-jwt'),
}));

vi.mock('./session-guard.config.js', () => ({
  isPanelJwtSidEnabled: vi.fn(() => true),
}));

vi.mock('./mobile-auth-credentials.service.js', () => ({
  recordPanelSession: vi.fn().mockResolvedValue('session-1'),
}));

vi.mock('./panel-session.helper.js', () => ({
  revokePanelSession: vi.fn().mockResolvedValue(true),
  revokeLatestPanelSession: vi.fn().mockResolvedValue(true),
  isPanelLogoutSessionRevokeEnabled: vi.fn(() => true),
}));

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

describe('PanelDoctorAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveActor returns profile with providerStatus', async () => {
    const { PanelDoctorAuthService } = await import('./services/panel-doctor-auth.service.js');
    const svc = new PanelDoctorAuthService();

    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'doc@test.com',
      role: 'DOCTOR',
      status: 'ACTIVE',
      doctorProfile: {
        id: 'prof-1',
        displayName: 'Doc',
        providerStatus: 'ACTIVE',
      },
    });

    const actor = await svc.resolveActor({ sub: 'user-1', email: 'doc@test.com', role: 'DOCTOR' });
    expect(actor).not.toBeNull();
    expect(actor?.userId).toBe('user-1');
    expect(actor?.providerStatus).toBe('ACTIVE');
  });

  it('logout revokes panel session by sid when provided', async () => {
    const { PanelDoctorAuthService } = await import('./services/panel-doctor-auth.service.js');
    const { revokePanelSession } = await import('./panel-session.helper.js');
    const svc = new PanelDoctorAuthService();

    await svc.logout(undefined, 'user-1', 'session-abc');
    expect(revokePanelSession).toHaveBeenCalledWith(
      'user-1',
      'session-abc',
      'doctor_panel',
      'logout',
    );
  });

  it('logout falls back when sid missing', async () => {
    const { PanelDoctorAuthService } = await import('./services/panel-doctor-auth.service.js');
    const { revokePanelSession } = await import('./panel-session.helper.js');
    const svc = new PanelDoctorAuthService();

    await svc.logout(undefined, 'user-1');
    expect(revokePanelSession).toHaveBeenCalledWith('user-1', undefined, 'doctor_panel', 'logout');
  });
});
