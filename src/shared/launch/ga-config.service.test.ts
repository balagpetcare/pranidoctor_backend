import { describe, expect, it, vi, beforeEach } from 'vitest';

import { DEFAULT_GA_LAUNCH_CONFIG } from './ga-launch.types.js';
import {
  deriveGoNoGoVerdict,
  parseGaLaunchConfig,
  summarizeChecklist,
} from './ga-config.service.js';

vi.mock('../database/prisma.js', () => ({
  getPrisma: vi.fn(),
}));

describe('parseGaLaunchConfig', () => {
  beforeEach(() => {
    delete process.env.GA_LAUNCH_ENABLED;
    delete process.env.GA_LAUNCH_PHASE;
  });

  it('returns safe defaults for invalid input', () => {
    const config = parseGaLaunchConfig(null);
    expect(config.enabled).toBe(false);
    expect(config.phase).toBe('PRE_GA');
    expect(config.goNoGoVerdict).toBe('NO_GO');
    expect(config.gateChecklist.length).toBeGreaterThan(10);
  });

  it('merges partial config', () => {
    const config = parseGaLaunchConfig({
      phase: 'SOFT_LAUNCH',
      playRolloutPct: 10,
      minDoctorsForPhase: 20,
    });
    expect(config.phase).toBe('SOFT_LAUNCH');
    expect(config.playRolloutPct).toBe(10);
    expect(config.minDoctorsForPhase).toBe(20);
  });

  it('applies env overrides', () => {
    process.env.GA_LAUNCH_ENABLED = 'true';
    process.env.GA_LAUNCH_PHASE = 'GRADUAL_ROLLOUT';
    const config = parseGaLaunchConfig({ enabled: false, phase: 'PRE_GA' });
    expect(config.enabled).toBe(true);
    expect(config.phase).toBe('GRADUAL_ROLLOUT');
  });
});

describe('deriveGoNoGoVerdict', () => {
  it('returns NO_GO when P0 items open', () => {
    const config = parseGaLaunchConfig(null);
    expect(deriveGoNoGoVerdict(config)).toBe('NO_GO');
  });

  it('returns GO when all P0 pass', () => {
    const config = parseGaLaunchConfig(null);
    const allPass = config.gateChecklist.map((item) => ({
      ...item,
      status: 'pass' as const,
    }));
    const verdict = deriveGoNoGoVerdict({ ...config, gateChecklist: allPass });
    expect(verdict).toBe('GO');
  });
});

describe('DEFAULT_GA_LAUNCH_CONFIG', () => {
  it('is disabled by default', () => {
    expect(DEFAULT_GA_LAUNCH_CONFIG.enabled).toBe(false);
    expect(DEFAULT_GA_LAUNCH_CONFIG.weeklyRegistrationCap).toBe(500);
  });
});

describe('summarizeChecklist', () => {
  it('counts open P0 items', () => {
    const config = parseGaLaunchConfig(null);
    const summary = summarizeChecklist(config);
    expect(summary.p0Open).toBeGreaterThan(0);
    expect(summary.total).toBe(config.gateChecklist.length);
  });
});
