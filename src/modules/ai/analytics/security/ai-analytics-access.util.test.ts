import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { parseAnalyticsDateRange } from '../usage/ai-usage-analytics.util.js';

const checkRateLimit = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ allowed: true, remaining: 59, resetAt: new Date() }),
);
const createAuditLogAsync = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../../../shared/security/rate-limit/rate-limit.service.js', () => ({
  checkRateLimit,
}));

vi.mock('../../../../shared/security/audit/index.js', () => ({
  createAuditLogAsync,
}));

const findManyMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    adminAnalyticsScope: { findMany: findManyMock },
  }),
}));

const actor: AiAdminActor = { id: 'admin-1', role: 'ADMIN' };

function requestWithParams(params: Record<string, string>): Request {
  const url = new URL('http://localhost/api/admin/ai-ops/analytics/usage/summary');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new Request(url);
}

describe('AI analytics access controls', () => {
  beforeEach(() => {
    checkRateLimit.mockReset();
    checkRateLimit.mockResolvedValue({ allowed: true, remaining: 59, resetAt: new Date() });
    createAuditLogAsync.mockClear();
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
    delete process.env.ORGANIZATION_ID;
  });

  it('returns 429 when rate limit exceeded', async () => {
    checkRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, resetAt: new Date(), retryAfter: 60 });
    const { enforceAiAnalyticsRateLimit } = await import('./ai-analytics-access.util.js');
    const response = await enforceAiAnalyticsRateLimit(actor);
    expect(response?.status).toBe(429);
  });

  it('uses per-admin rate limit key', async () => {
    const { enforceAiAnalyticsRateLimit } = await import('./ai-analytics-access.util.js');
    await enforceAiAnalyticsRateLimit(actor);
    expect(checkRateLimit).toHaveBeenCalledWith('admin:admin-1', expect.objectContaining({ points: 60 }));
  });

  it('auditAnalyticsExport writes AI_ANALYTICS_EXPORT audit entry', async () => {
    const { auditAnalyticsExport } = await import('./ai-analytics-access.util.js');
    const { from, to } = parseAnalyticsDateRange({ sinceDays: 7 });
    await auditAnalyticsExport(actor, { from, to, organizationId: 'org-a' }, 'csv', 42);
    expect(createAuditLogAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_ANALYTICS_EXPORT',
        actorId: 'admin-1',
        details: expect.objectContaining({ format: 'csv', rowCount: 42, organizationId: 'org-a' }),
      }),
    );
  });

  it('requireScopedAnalyticsAccess enforces scope before returning filters', async () => {
    process.env.ORGANIZATION_ID = 'org-platform';
    const { resetAiPlatformConfigCache } = await import('../../config/ai.config.js');
    resetAiPlatformConfigCache();

    const { requireScopedAnalyticsAccess } = await import('./ai-analytics-access.util.js');
    const response = await requireScopedAnalyticsAccess(
      requestWithParams({ organizationId: 'foreign-org', sinceDays: '7' }),
      actor,
    );
    expect(response).toBeInstanceOf(Response);
    if (response instanceof Response) expect(response.status).toBe(403);
  });
});
