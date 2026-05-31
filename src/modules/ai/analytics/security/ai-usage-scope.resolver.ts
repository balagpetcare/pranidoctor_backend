import { getPrisma } from '../../../../shared/database/prisma.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import type { AnalyticsScopeLevel, ResolvedAnalyticsScope } from './ai-usage-scope.types.js';

const SCOPE_PRIORITY: Record<AnalyticsScopeLevel, number> = {
  branch: 3,
  organization: 2,
  platform: 1,
};

function pickHighestScope(
  rows: Array<{
    scopeLevel: string;
    organizationId: string | null;
    branchId: string | null;
  }>,
): ResolvedAnalyticsScope | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort(
    (a, b) =>
      (SCOPE_PRIORITY[b.scopeLevel as AnalyticsScopeLevel] ?? 0) -
      (SCOPE_PRIORITY[a.scopeLevel as AnalyticsScopeLevel] ?? 0),
  );
  const top = sorted[0]!;
  const level = top.scopeLevel as AnalyticsScopeLevel;

  if (level === 'branch') {
    if (!top.organizationId || !top.branchId) return null;
    return {
      level: 'branch',
      organizationId: top.organizationId,
      branchId: top.branchId,
    };
  }

  if (level === 'organization') {
    if (!top.organizationId) return null;
    return { level: 'organization', organizationId: top.organizationId };
  }

  return { level: 'platform' };
}

/** Resolve effective analytics scope for an admin actor from membership rows or role fallback. */
export async function resolveAnalyticsScope(actor: AiAdminActor): Promise<ResolvedAnalyticsScope> {
  if (actor.role === 'SUPER_ADMIN') {
    return { level: 'platform' };
  }

  const memberships = await getPrisma().adminAnalyticsScope.findMany({
    where: { userId: actor.id, enabled: true },
    select: {
      scopeLevel: true,
      organizationId: true,
      branchId: true,
    },
  });

  const fromMembership = pickHighestScope(memberships);
  if (fromMembership) return fromMembership;

  if (actor.role === 'ADMIN') {
    return { level: 'platform' };
  }

  return { level: 'platform' };
}

export function resetAnalyticsScopeResolverForTests(): void {
  // No module state — hook for test symmetry.
}
