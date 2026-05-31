import { getDiseaseRegistryService } from './registry/disease-registry.service.js';

/**
 * D1 governance bridge — coordinates registry activation with VKL publish state.
 */
export class DiseaseKnowledgeGovernanceService {
  readonly name = 'DiseaseKnowledgeGovernanceService';

  async activateAfterPublish(registryId: string) {
    return getDiseaseRegistryService().activate(registryId);
  }

  async markDeprecated(registryId: string) {
    const prisma = (await import('../../../shared/database/prisma.js')).getPrisma();
    return prisma.diDiseaseRegistry.update({
      where: { id: registryId },
      data: { status: 'DEPRECATED' },
    });
  }
}

let service: DiseaseKnowledgeGovernanceService | undefined;

export function getDiseaseKnowledgeGovernanceService(): DiseaseKnowledgeGovernanceService {
  service ??= new DiseaseKnowledgeGovernanceService();
  return service;
}
