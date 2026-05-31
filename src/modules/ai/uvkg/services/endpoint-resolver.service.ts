import type { VkKnowledgeNodeRefType } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

export type ResolvedEndpoint = {
  entityId: string | null;
  refType: VkKnowledgeNodeRefType;
  refId: string;
};

export class UvkgEndpointResolverService {
  readonly name = 'UvkgEndpointResolverService';

  async resolveBySlug(slug: string): Promise<string | null> {
    const entity = await getPrisma().vkKnowledgeEntity.findUnique({
      where: { slug },
      select: { id: true },
    });
    return entity?.id ?? null;
  }

  async resolveDisease(slug: string): Promise<ResolvedEndpoint> {
    const registry = await getPrisma().diDiseaseRegistry.findUnique({
      where: { slug },
      select: { slug: true, vkEntityId: true },
    });
    const entityId =
      registry?.vkEntityId ?? (await this.resolveBySlug(slug));
    return {
      entityId,
      refType: 'DISEASE',
      refId: slug,
    };
  }

  async resolveSymptom(code: string): Promise<ResolvedEndpoint> {
    return { entityId: null, refType: 'SYMPTOM', refId: code };
  }

  async resolveFeedSlug(slug: string, entityType?: string): Promise<ResolvedEndpoint> {
    const refType: VkKnowledgeNodeRefType =
      entityType === 'NUTRIENT_REQUIREMENT'
        ? 'NUTRIENT'
        : entityType === 'RATION_TEMPLATE'
          ? 'FEED_FORMULA'
          : 'FEED_INGREDIENT';
    const entityId = await this.resolveBySlug(slug);
    return { entityId, refType, refId: slug };
  }

  async resolveMedicineSlug(slug: string, isBrand = false): Promise<ResolvedEndpoint> {
    if (isBrand) {
      const brand = await getPrisma().medicineBrand.findUnique({
        where: { brandCode: slug },
        select: { brandCode: true },
      });
      return {
        entityId: await this.resolveBySlug(slug),
        refType: 'MEDICINE_BRAND',
        refId: brand?.brandCode ?? slug,
      };
    }

    const generic = await getPrisma().medicineGeneric.findUnique({
      where: { genericCode: slug },
      select: { genericCode: true, version: { select: { entityId: true } } },
    });

    return {
      entityId: generic?.version.entityId ?? (await this.resolveBySlug(slug)),
      refType: 'MEDICINE_GENERIC',
      refId: generic?.genericCode ?? slug,
    };
  }
}

let resolver: UvkgEndpointResolverService | undefined;

export function getUvkgEndpointResolverService(): UvkgEndpointResolverService {
  resolver ??= new UvkgEndpointResolverService();
  return resolver;
}

export function resetUvkgEndpointResolverServiceForTests(): void {
  resolver = undefined;
}
