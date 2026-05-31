import { jsonError } from '../../../../legacy/web/lib/api-response.js';
import { createAuditLogAsync } from '../../../../shared/security/audit/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import { getAiPlatformConfig } from '../../config/ai.config.js';
import type { UsageAnalyticsFilters } from '../usage/ai-usage-analytics.types.js';
import { resolveAnalyticsScope } from './ai-usage-scope.resolver.js';
import type {
  ResolvedAnalyticsScope,
  ScopeGuardContext,
  ScopeGuardFailure,
  ScopeGuardResult,
} from './ai-usage-scope.types.js';

export class AiUsageScopeGuard {
  readonly name = 'AiUsageScopeGuard';

  async enforce(
    actor: AiAdminActor,
    rawFilters: UsageAnalyticsFilters,
    context?: ScopeGuardContext,
  ): Promise<ScopeGuardResult> {
    if (actor.role === 'SUPER_ADMIN') {
      return {
        ok: true,
        filters: rawFilters,
        scope: { level: 'platform' },
      };
    }

    const scope = await resolveAnalyticsScope(actor);

    switch (scope.level) {
      case 'branch':
        return this.enforceBranchScope(actor, rawFilters, scope, context);
      case 'organization':
        return this.enforceOrganizationScope(actor, rawFilters, scope, context);
      default:
        return this.enforcePlatformScope(actor, rawFilters, scope, context);
    }
  }

  private deny(
    actor: AiAdminActor,
    reason: string,
    rawFilters: UsageAnalyticsFilters,
    context?: ScopeGuardContext,
  ): ScopeGuardFailure {
    void this.auditScopeDenial(actor, reason, rawFilters, context);
    return {
      ok: false,
      code: 'SCOPE_FORBIDDEN',
      message: 'Analytics scope access denied',
      reason,
    };
  }

  private async auditScopeDenial(
    actor: AiAdminActor,
    reason: string,
    rawFilters: UsageAnalyticsFilters,
    context?: ScopeGuardContext,
  ): Promise<void> {
    getLogger().warn(
      {
        actorId: actor.id,
        actorRole: actor.role,
        reason,
        route: context?.route,
        requestedOrganizationId: rawFilters.organizationId,
        requestedBranchId: rawFilters.branchId,
        requestedUserId: rawFilters.userId,
      },
      'AI analytics scope denied',
    );

    void createAuditLogAsync({
      action: 'AI_ANALYTICS_SCOPE_DENIED',
      severity: 'WARNING',
      outcome: 'FAILURE',
      actorId: actor.id,
      actorRole: actor.role,
      resourceType: 'ai_analytics',
      details: omitUndefined({
        reason,
        route: context?.route,
        organizationId: rawFilters.organizationId,
        branchId: rawFilters.branchId,
        userId: rawFilters.userId,
      }),
    });
  }

  private enforcePlatformScope(
    actor: AiAdminActor,
    rawFilters: UsageAnalyticsFilters,
    scope: ResolvedAnalyticsScope,
    context?: ScopeGuardContext,
  ): ScopeGuardResult {
    const platformConfig = getAiPlatformConfig();

    if (rawFilters.userId) {
      return this.deny(actor, 'userId filter requires SUPER_ADMIN', rawFilters, context);
    }

    const platformOrg = platformConfig.organizationId;
    const platformBranch = platformConfig.branchId;

    if (rawFilters.organizationId) {
      if (platformOrg && rawFilters.organizationId !== platformOrg) {
        return this.deny(actor, 'foreign organizationId', rawFilters, context);
      }
      if (!platformOrg) {
        getLogger().warn(
          { actorId: actor.id, organizationId: rawFilters.organizationId },
          'Stripping organizationId filter — platform org env unset',
        );
      }
    }

    if (rawFilters.branchId) {
      if (platformBranch && rawFilters.branchId !== platformBranch) {
        return this.deny(actor, 'foreign branchId', rawFilters, context);
      }
      if (!platformBranch) {
        getLogger().warn(
          { actorId: actor.id, branchId: rawFilters.branchId },
          'Stripping branchId filter — platform branch env unset',
        );
      }
    }

    const filters = omitUndefined({
      ...rawFilters,
      organizationId: platformOrg ? rawFilters.organizationId : undefined,
      branchId: platformBranch ? rawFilters.branchId : undefined,
      userId: undefined,
    }) as UsageAnalyticsFilters;

    return { ok: true, filters, scope };
  }

  private enforceOrganizationScope(
    actor: AiAdminActor,
    rawFilters: UsageAnalyticsFilters,
    scope: ResolvedAnalyticsScope,
    context?: ScopeGuardContext,
  ): ScopeGuardResult {
    const forcedOrg = scope.organizationId!;

    if (rawFilters.userId) {
      return this.deny(actor, 'userId filter not permitted for organization scope', rawFilters, context);
    }

    if (rawFilters.organizationId && rawFilters.organizationId !== forcedOrg) {
      return this.deny(actor, 'foreign organizationId', rawFilters, context);
    }

    const filters = omitUndefined({
      ...rawFilters,
      organizationId: forcedOrg,
      userId: undefined,
    }) as UsageAnalyticsFilters;

    return { ok: true, filters, scope: { level: 'organization', organizationId: forcedOrg } };
  }

  private enforceBranchScope(
    actor: AiAdminActor,
    rawFilters: UsageAnalyticsFilters,
    scope: ResolvedAnalyticsScope,
    context?: ScopeGuardContext,
  ): ScopeGuardResult {
    const forcedOrg = scope.organizationId!;
    const forcedBranch = scope.branchId!;

    if (rawFilters.userId) {
      return this.deny(actor, 'userId filter not permitted for branch scope', rawFilters, context);
    }

    if (rawFilters.organizationId && rawFilters.organizationId !== forcedOrg) {
      return this.deny(actor, 'foreign organizationId', rawFilters, context);
    }

    if (rawFilters.branchId && rawFilters.branchId !== forcedBranch) {
      return this.deny(actor, 'foreign branchId', rawFilters, context);
    }

    const filters = omitUndefined({
      ...rawFilters,
      organizationId: forcedOrg,
      branchId: forcedBranch,
      userId: undefined,
    }) as UsageAnalyticsFilters;

    return {
      ok: true,
      filters,
      scope: { level: 'branch', organizationId: forcedOrg, branchId: forcedBranch },
    };
  }
}

let guard: AiUsageScopeGuard | null = null;

export function getAiUsageScopeGuard(): AiUsageScopeGuard {
  if (!guard) guard = new AiUsageScopeGuard();
  return guard;
}

export function resetAiUsageScopeGuardForTests(): void {
  guard = null;
}

export function scopeGuardFailureToResponse(failure: ScopeGuardFailure): Response {
  return jsonError(failure.code, failure.message, 403);
}
