import { describe, expect, it } from 'vitest';

import {
  compactCheck,
  toLiteDependencyResponse,
  toLiteHealthResponse,
  toLiteReadinessResponse,
  wantsLiteResponse,
} from './health-response.util.js';

describe('health-response.util', () => {
  it('detects lite query variants', () => {
    expect(wantsLiteResponse({ lite: '1' })).toBe(true);
    expect(wantsLiteResponse({ format: 'lite' })).toBe(true);
    expect(wantsLiteResponse({})).toBe(false);
  });

  it('strips verbose health fields in lite mode', () => {
    const lite = toLiteHealthResponse({
      status: 'healthy',
      timestamp: '2026-05-30T00:00:00.000Z',
      version: '1.0.0',
      uptime: 42,
      checks: [],
    });

    expect(lite).toEqual({
      status: 'healthy',
      timestamp: '2026-05-30T00:00:00.000Z',
      version: '1.0.0',
      uptime: 42,
    });
  });

  it('compacts readiness checks', () => {
    const lite = toLiteReadinessResponse({
      ready: true,
      timestamp: '2026-05-30T00:00:00.000Z',
      checks: [
        {
          name: 'database',
          status: 'healthy',
          latency: 3,
          message: 'ignored in lite',
        },
      ],
    });

    expect(lite.checks).toEqual([{ name: 'database', status: 'healthy', latency: 3 }]);
  });

  it('compacts dependency rows', () => {
    const lite = toLiteDependencyResponse([
      {
        name: 'AI Services',
        type: 'ai',
        status: 'degraded',
        latency: 1,
        required: false,
        message: 'kill switch',
      },
    ]);

    expect(lite[0]).toEqual({
      name: 'AI Services',
      type: 'ai',
      status: 'degraded',
      required: false,
    });
  });

  it('compacts granular checks', () => {
    const compact = compactCheck({
      name: 'ai',
      status: 'healthy',
      latency: 0,
      details: { llmDisabled: false },
    });

    expect(compact).toEqual({ name: 'ai', status: 'healthy', latency: 0 });
  });
});
