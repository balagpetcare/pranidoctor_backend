import type { Prisma } from '../../../../generated/prisma/index.js';
import type { DiDiseaseCategory, DiNotifiableClass, LivestockSpecies } from '../../../../generated/prisma/index.js';
import { NotFoundError, ValidationError } from '../../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import type { DiseaseRegistryView } from '../disease-intelligence.types.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';

function toView(
  row: Awaited<ReturnType<ReturnType<typeof getDiseaseIntelligenceRepository>['getRegistryByCode']>>,
): DiseaseRegistryView {
  if (!row) throw new NotFoundError('DISEASE_NOT_FOUND', 'Disease not found');
  return {
    id: row.id,
    code: row.code,
    slug: row.slug,
    labelBn: row.labelBn,
    labelEn: row.labelEn,
    category: row.category,
    notifiableClass: row.notifiableClass,
    zoonoticRisk: row.zoonoticRisk,
    status: row.status,
    vkEntityId: row.vkEntityId,
    species: row.speciesMatrix.map((s) => s.species),
  };
}

export class DiseaseRegistryService {
  readonly name = 'DiseaseRegistryService';

  async search(params: {
    q?: string;
    species?: LivestockSpecies;
    take?: number;
    skip?: number;
  }): Promise<DiseaseRegistryView[]> {
    const rows = await getDiseaseIntelligenceRepository().searchRegistry({
      ...params,
      status: 'ACTIVE',
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      slug: r.slug,
      labelBn: r.labelBn,
      labelEn: r.labelEn,
      category: r.category,
      notifiableClass: r.notifiableClass,
      zoonoticRisk: r.zoonoticRisk,
      status: r.status,
      vkEntityId: r.vkEntityId,
      species: r.speciesMatrix.map((s) => s.species),
    }));
  }

  async getByCode(code: string): Promise<DiseaseRegistryView> {
    const row = await getDiseaseIntelligenceRepository().getRegistryByCode(code);
    if (!row || row.status !== 'ACTIVE') {
      throw new NotFoundError('DISEASE_NOT_FOUND', 'Disease not found');
    }
    void getDiseaseAnalyticsService().track('REGISTRY_VIEW', { registryId: row.id });
    return toView(row);
  }

  async createDraft(input: {
    code: string;
    slug: string;
    labelBn: string;
    labelEn: string;
    category: DiDiseaseCategory;
    notifiableClass?: DiNotifiableClass;
    zoonoticRisk?: boolean;
    species?: LivestockSpecies[];
    vkEntityId?: string;
  }) {
    const repo = getDiseaseIntelligenceRepository();
    const existing = await repo.getRegistryBySlug(input.slug);
    if (existing) {
      throw new ValidationError('DISEASE_SLUG_EXISTS', 'Disease slug already exists');
    }
    return repo.createRegistry(
      omitUndefined({
        code: input.code,
        slug: input.slug,
        labelBn: input.labelBn,
        labelEn: input.labelEn,
        category: input.category,
        notifiableClass: input.notifiableClass ?? 'NONE',
        zoonoticRisk: input.zoonoticRisk ?? false,
        status: 'DRAFT' as const,
        ...(input.vkEntityId ? { vkEntityId: input.vkEntityId } : {}),
        ...(input.species?.length
          ? { speciesMatrix: { create: input.species.map((species) => ({ species })) } }
          : {}),
      }) as Prisma.DiDiseaseRegistryCreateInput,
    );
  }

  async activate(id: string) {
    const repo = getDiseaseIntelligenceRepository();
    const row = await repo.updateRegistry(id, { status: 'ACTIVE' });
    if (!row.vkEntityId) {
      throw new ValidationError('VKL_BINDING_REQUIRED', 'ACTIVE disease requires VKL entity binding');
    }
    return row;
  }
}

let service: DiseaseRegistryService | undefined;

export function getDiseaseRegistryService(): DiseaseRegistryService {
  service ??= new DiseaseRegistryService();
  return service;
}
