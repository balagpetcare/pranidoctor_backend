import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { resetAiPlatformConfigCache } from '../../config/ai.config.js';
import { parseAnalyticsDateRange } from '../usage/ai-usage-analytics.util.js';
import { getAiUsageScopeGuard, resetAiUsageScopeGuardForTests } from './ai-usage-scope.guard.js';

const findManyMock = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('../../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    adminAnalyticsScope: {
      findMany: findManyMock,
    },
  }),
}));

vi.mock('../../../../shared/security/audit/index.js', () => ({
  createAuditLogAsync: vi.fn().mockResolvedValue(undefined),
}));

const ROUTES = [
  'summary',
  'cost-summary',
  'provider-summary',
  'model-summary',
  'performance-summary',
  'dashboard',
  'daily-cost',
  'monthly-cost',
  'providers',
  'features',
  'trends',
  'report',
] as const;

const ACTORS: Array<{ label: string; actor: AiAdminActor; foreignOrg: boolean }> = [
  { label: 'platform-admin', actor: { id: 'a1', role: 'ADMIN' }, foreignOrg: true },
  { label: 'super-admin', actor: { id: 's1', role: 'SUPER_ADMIN' }, foreignOrg: false },
];

describe('AI analytics IDOR matrix (scope guard)', () => {
  beforeEach(() => {
    resetAiUsageScopeGuardForTests();
    resetAiPlatformConfigCache();
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
    process.env.ORGANIZATION_ID = 'org-platform';
    resetAiPlatformConfigCache();
  });

  for (const route of ROUTES) {
    for (const { label, actor, foreignOrg } of ACTORS) {
      it(`${route} × ${label} → ${foreignOrg ? '403' : 'allow'}`, async () => {
        const { from, to } = parseAnalyticsDateRange({ sinceDays: 7 });
        const result = await getAiUsageScopeGuard().enforce(
          actor,
          {
            from,
            to,
            organizationId: foreignOrg ? 'foreign-org' : 'org-platform',
          },
          { route: `/api/admin/ai-ops/analytics/usage/${route}` },
        );

        if (foreignOrg && actor.role !== 'SUPER_ADMIN') {
          expect(result.ok).toBe(false);
        } else {
          expect(result.ok).toBe(true);
        }
      });
    }
  }
});
