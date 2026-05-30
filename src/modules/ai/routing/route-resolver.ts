import type { AiRoute, AiProvider } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { normalizeAiTaskType } from './ai-task.types.js';
import { AiRouteNotFoundError } from './ai-router.errors.js';
import type { AiRouteRequest } from './ai-router.types.js';
import { parseProviderChainJson } from './provider-chain.util.js';
import { scopeKeysForResolution } from './scope.util.js';

export type DbRouteRow = AiRoute & {
  primaryProvider: AiProvider | null;
};

export class RouteResolver {
  readonly name = 'RouteResolver';

  async findRouteRow(request: AiRouteRequest): Promise<{ row: DbRouteRow; scopeKey: string }> {
    const dbTaskType = normalizeAiTaskType(request.taskType);
    const scopeKeys = scopeKeysForResolution(request.tenantId, request.branchId);
    const prisma = getPrisma();

    for (const scopeKey of scopeKeys) {
      const row = await prisma.aiRoute.findFirst({
        where: {
          scopeKey,
          taskType: dbTaskType,
          enabled: true,
          deletedAt: null,
        },
        orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
        include: {
          primaryProvider: true,
        },
      });

      if (row) {
        return { row, scopeKey };
      }
    }

    throw new AiRouteNotFoundError(dbTaskType, scopeKeys);
  }

  parseChain(row: DbRouteRow) {
    return parseProviderChainJson(row.providerChainJson);
  }
}

let routeResolver: RouteResolver | null = null;

export function getRouteResolver(): RouteResolver {
  if (!routeResolver) routeResolver = new RouteResolver();
  return routeResolver;
}

export function resetRouteResolverForTests(): void {
  routeResolver = null;
}
