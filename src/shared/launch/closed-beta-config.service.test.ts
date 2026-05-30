import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  DEFAULT_CLOSED_BETA_CONFIG,
  type ClosedBetaConfig,
} from './closed-beta.types.js';
import { parseClosedBetaConfig } from './closed-beta-config.service.js';

vi.mock('../database/prisma.js', () => ({
  getPrisma: vi.fn(),
}));

vi.mock('../config/index.js', () => ({
  isProduction: () => false,
}));

describe('parseClosedBetaConfig', () => {
  beforeEach(() => {
    delete process.env.CLOSED_BETA_ENABLED;
    delete process.env.CLOSED_BETA_ENFORCE_INVITE;
  });

  it('returns defaults for invalid input', () => {
    const config = parseClosedBetaConfig(null);
    expect(config.enabled).toBe(false);
    expect(config.maxUsers).toBe(80);
    expect(config.feedbackEnabled).toBe(true);
  });

  it('merges partial config', () => {
    const config = parseClosedBetaConfig({
      enabled: true,
      activeCohort: 'C1',
      invitedPhones: ['+8801712345678'],
    });
    expect(config.enabled).toBe(true);
    expect(config.activeCohort).toBe('C1');
    expect(config.invitedPhones).toEqual(['+8801712345678']);
  });

  it('applies env overrides', () => {
    process.env.CLOSED_BETA_ENABLED = 'true';
    process.env.CLOSED_BETA_ENFORCE_INVITE = 'true';
    const config = parseClosedBetaConfig({ enabled: false });
    expect(config.enabled).toBe(true);
    expect(config.enforceInviteList).toBe(true);
  });
});

describe('DEFAULT_CLOSED_BETA_CONFIG', () => {
  it('has safe production defaults', () => {
    const config: ClosedBetaConfig = DEFAULT_CLOSED_BETA_CONFIG;
    expect(config.enabled).toBe(false);
    expect(config.enforceInviteList).toBe(false);
    expect(config.maxUsers).toBeGreaterThan(0);
  });
});
