import type { AiModel, AiProvider } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import type { ModuleService } from '../../../shared/module/module.types.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

export interface AiProviderRepositoryInterface extends ModuleService {
  findById(id: string): Promise<AiProvider | null>;
  findByKey(scopeKey: string, providerKey: string): Promise<AiProvider | null>;
  listEnabled(scopeKey: string): Promise<AiProvider[]>;
  countActive(scopeKey?: string): Promise<number>;
}

export class AiProviderRepository implements AiProviderRepositoryInterface {
  readonly name = 'AiProviderRepository';

  async findById(id: string): Promise<AiProvider | null> {
    return getPrisma().aiProvider.findFirst({ where: { id, deletedAt: null } });
  }

  async findByKey(scopeKey: string, providerKey: string): Promise<AiProvider | null> {
    return getPrisma().aiProvider.findFirst({
      where: { scopeKey, providerKey, deletedAt: null },
    });
  }

  async listEnabled(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<AiProvider[]> {
    return getPrisma().aiProvider.findMany({
      where: { scopeKey, enabled: true, deletedAt: null },
      orderBy: [{ priority: 'asc' }, { providerKey: 'asc' }],
    });
  }

  async countActive(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<number> {
    return getPrisma().aiProvider.count({ where: { scopeKey, deletedAt: null } });
  }
}

let repository: AiProviderRepository | null = null;

export function getAiProviderRepository(): AiProviderRepository {
  if (!repository) repository = new AiProviderRepository();
  return repository;
}

export function resetAiProviderRepositoryForTests(): void {
  repository = null;
}

export type AiModelRateRow = Pick<
  AiModel,
  'id' | 'providerId' | 'modelKey' | 'inputCostPerToken' | 'outputCostPerToken' | 'scopeKey'
>;

export interface AiModelRepositoryInterface extends ModuleService {
  findById(id: string): Promise<AiModel | null>;
  findRate(scopeKey: string, providerKey: string, modelKey: string): Promise<AiModelRateRow | null>;
  listRatesForScope(scopeKey: string): Promise<AiModelRateRow[]>;
}

export class AiModelRepository implements AiModelRepositoryInterface {
  readonly name = 'AiModelRepository';

  async findById(id: string): Promise<AiModel | null> {
    return getPrisma().aiModel.findFirst({ where: { id, deletedAt: null } });
  }

  async findRate(
    scopeKey: string,
    providerKey: string,
    modelKey: string,
  ): Promise<AiModelRateRow | null> {
    const provider = await getPrisma().aiProvider.findFirst({
      where: { scopeKey, providerKey, deletedAt: null },
      select: { id: true },
    });
    if (!provider) return null;

    return getPrisma().aiModel.findFirst({
      where: {
        scopeKey,
        providerId: provider.id,
        modelKey,
        enabled: true,
        deletedAt: null,
      },
      select: {
        id: true,
        providerId: true,
        modelKey: true,
        inputCostPerToken: true,
        outputCostPerToken: true,
        scopeKey: true,
      },
    });
  }

  async listRatesForScope(scopeKey: string): Promise<AiModelRateRow[]> {
    return getPrisma().aiModel.findMany({
      where: { scopeKey, enabled: true, deletedAt: null },
      select: {
        id: true,
        providerId: true,
        modelKey: true,
        inputCostPerToken: true,
        outputCostPerToken: true,
        scopeKey: true,
      },
    });
  }
}

let modelRepository: AiModelRepository | null = null;

export function getAiModelRepository(): AiModelRepository {
  if (!modelRepository) modelRepository = new AiModelRepository();
  return modelRepository;
}

export function resetAiModelRepositoryForTests(): void {
  modelRepository = null;
}

export interface AiRouteCountResult {
  routeCount: number;
}

export async function countActiveRoutes(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<number> {
  return getPrisma().aiRoute.count({ where: { scopeKey, deletedAt: null } });
}
