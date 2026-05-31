import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { resetAiPlatformConfigCache } from '../../config/ai.config.js';
import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';
import { parseAnalyticsDateRange } from '../usage/ai-usage-analytics.util.js';
import { resetAnalyticsScopeResolverForTests } from './ai-usage-scope.resolver.js';
import {
  getAiUsageScopeGuard,
  resetAiUsageScopeGuardForTests,
} from './ai-usage-scope.guard.js';

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

function baseFilters(overrides: Partial<UsageAnalyticsFilters> = {}): UsageAnalyticsFilters {
  const { from, to } = parseAnalyticsDateRange({ sinceDays: 7 });
  return { from, to, ...overrides };
}

const platformAdmin: AiAdminActor = { id: 'admin-1', role: 'ADMIN' };
const superAdmin: AiAdminActor = { id: 'super-1', role: 'SUPER_ADMIN' };

describe('AiUsageScopeGuard', () => {
  beforeEach(() => {
    resetAiUsageScopeGuardForTests();
    resetAnalyticsScopeResolverForTests();
    resetAiPlatformConfigCache();
    findManyMock.mockReset();
    findManyMock.mockResolvedValue([]);
    delete process.env.ORGANIZATION_ID;
    delete process.env.BRANCH_ID;
    delete process.env.TENANT_ID;
    delete process.env.DEPLOYMENT_BRANCH;
  });

  it('allows SUPER_ADMIN to pass through foreign org/branch filters', async () => {
    process.env.ORGANIZATION_ID = 'org-platform';
    resetAiPlatformConfigCache();

    const result = await getAiUsageScopeGuard().enforce(superAdmin, baseFilters({
      organizationId: 'foreign-org',
      branchId: 'foreign-branch',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.organizationId).toBe('foreign-org');
      expect(result.filters.branchId).toBe('foreign-branch');
    }
  });

  it('rejects platform ADMIN requesting foreign organizationId when env org is set', async () => {
    process.env.ORGANIZATION_ID = 'org-platform';
    resetAiPlatformConfigCache();

    const result = await getAiUsageScopeGuard().enforce(platformAdmin, baseFilters({
      organizationId: 'foreign-org',
    }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('SCOPE_FORBIDDEN');
  });

  it('strips org/branch params for platform ADMIN when env org/branch unset', async () => {
    const result = await getAiUsageScopeGuard().enforce(platformAdmin, baseFilters({
      organizationId: 'any-org',
      branchId: 'any-branch',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.organizationId).toBeUndefined();
      expect(result.filters.branchId).toBeUndefined();
    }
  });

  it('rejects platform ADMIN userId filter', async () => {
    const result = await getAiUsageScopeGuard().enforce(platformAdmin, baseFilters({
      userId: 'user-123',
    }));

    expect(result.ok).toBe(false);
  });

  it('forces branch scope filters for branch membership', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        scopeLevel: 'branch',
        organizationId: 'org-a',
        branchId: 'branch-a',
      },
    ]);

    const branchActor: AiAdminActor = { id: 'branch-admin', role: 'ADMIN' };
    const result = await getAiUsageScopeGuard().enforce(branchActor, baseFilters());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.organizationId).toBe('org-a');
      expect(result.filters.branchId).toBe('branch-a');
    }
  });

  it('rejects branch member querying sibling branchId', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        scopeLevel: 'branch',
        organizationId: 'org-a',
        branchId: 'branch-a',
      },
    ]);

    const branchActor: AiAdminActor = { id: 'branch-admin', role: 'ADMIN' };
    const result = await getAiUsageScopeGuard().enforce(branchActor, baseFilters({
      branchId: 'branch-b',
    }));

    expect(result.ok).toBe(false);
  });

  it('forces organization scope and allows optional branch within org', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        scopeLevel: 'organization',
        organizationId: 'org-a',
        branchId: null,
      },
    ]);

    const orgActor: AiAdminActor = { id: 'org-admin', role: 'ADMIN' };
    const result = await getAiUsageScopeGuard().enforce(orgActor, baseFilters({
      branchId: 'branch-a',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filters.organizationId).toBe('org-a');
      expect(result.filters.branchId).toBe('branch-a');
    }
  });

  it('rejects org member querying foreign organizationId', async () => {
    findManyMock.mockResolvedValueOnce([
      {
        scopeLevel: 'organization',
        organizationId: 'org-a',
        branchId: null,
      },
    ]);

    const orgActor: AiAdminActor = { id: 'org-admin', role: 'ADMIN' };
    const result = await getAiUsageScopeGuard().enforce(orgActor, baseFilters({
      organizationId: 'org-b',
    }));

    expect(result.ok).toBe(false);
  });
});
