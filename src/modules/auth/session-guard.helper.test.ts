import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAssertActive = vi.fn();
const mockTouch = vi.fn();

vi.mock('./session.service.js', () => ({
  getSessionService: () => ({
    assertActive: mockAssertActive,
    touch: mockTouch,
  }),
}));

vi.mock('./session-guard.config.js', () => ({
  isPanelSessionGuardEnabled: vi.fn(() => true),
  isMobileSessionGuardEnabled: vi.fn(() => true),
}));

describe('session-guard.helper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns legacy when sid absent', async () => {
    const { assertJwtSessionActive } = await import('./session-guard.helper.js');
    const result = await assertJwtSessionActive({ sub: 'u1' }, 'doctor_panel', { panel: true });
    expect(result).toBe('legacy');
    expect(mockAssertActive).not.toHaveBeenCalled();
  });

  it('returns revoked when session inactive', async () => {
    mockAssertActive.mockResolvedValue(null);
    const { assertJwtSessionActive } = await import('./session-guard.helper.js');
    const result = await assertJwtSessionActive(
      { sub: 'u1', sid: 's1' },
      'doctor_panel',
      { panel: true },
    );
    expect(result).toBe('revoked');
  });

  it('returns ok when session active and user matches', async () => {
    mockAssertActive.mockResolvedValue({ id: 's1', userId: 'u1', channel: 'DOCTOR_PANEL' });
    const { assertJwtSessionActive } = await import('./session-guard.helper.js');
    const result = await assertJwtSessionActive(
      { sub: 'u1', sid: 's1' },
      'doctor_panel',
      { panel: true },
    );
    expect(result).toBe('ok');
  });

  it('returns revoked when userId mismatch', async () => {
    mockAssertActive.mockResolvedValue({ id: 's1', userId: 'other', channel: 'MOBILE' });
    const { assertJwtSessionActive } = await import('./session-guard.helper.js');
    const result = await assertJwtSessionActive(
      { sub: 'u1', sid: 's1' },
      'mobile',
    );
    expect(result).toBe('revoked');
  });
});
