import { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';

export type MedicineGraphEdgeType =
  | 'BRAND_OF_GENERIC'
  | 'MANUFACTURED_BY'
  | 'SPONSORED_BY'
  | 'SUBSTITUTES_FOR'
  | 'CONTRAINDICATED_WITH'
  | 'INTERACTS_WITH'
  | 'SAME_THERAPEUTIC_CLASS'
  | 'SAME_DRUG_CLASS';

export type MedicineKnowledgeGraphEdgeInput = {
  edgeType: MedicineGraphEdgeType;
  fromEntitySlug: string;
  toEntitySlug: string;
  weight?: number;
  labelBn?: string;
  labelEn?: string;
  metadata?: Record<string, unknown>;
};

export type MedicineKnowledgeGraphEdge = {
  id: string;
  edgeType: string;
  fromEntitySlug: string;
  toEntitySlug: string;
  weight: number;
  labelBn: string | null;
  labelEn: string | null;
  metadataJson: unknown;
  createdAt: Date;
};

export class MedicineKnowledgeRepository {
  private prisma = getPrisma();

  async createGraphEdge(input: MedicineKnowledgeGraphEdgeInput): Promise<string> {
    const edge = await this.prisma.vkMedicineKnowledgeGraphEdge.upsert({
      where: {
        edgeType_fromEntitySlug_toEntitySlug: {
          edgeType: input.edgeType,
          fromEntitySlug: input.fromEntitySlug,
          toEntitySlug: input.toEntitySlug,
        },
      },
      create: {
        edgeType: input.edgeType,
        fromEntitySlug: input.fromEntitySlug,
        toEntitySlug: input.toEntitySlug,
        weight: input.weight ?? 1.0,
        labelBn: input.labelBn ?? null,
        labelEn: input.labelEn ?? null,
        metadataJson: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : Prisma.JsonNull,
      },
      update: {
        weight: input.weight ?? 1.0,
        labelBn: input.labelBn ?? null,
        labelEn: input.labelEn ?? null,
        metadataJson: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : Prisma.JsonNull,
      },
    });

    const { getUvkgDualWriteService } = await import('../../uvkg/services/uvkg-dual-write.service.js');
    void getUvkgDualWriteService()
      .afterMedicineGraphEdge({
        legacyEdgeId: edge.id,
        edgeType: input.edgeType,
        fromEntitySlug: input.fromEntitySlug,
        toEntitySlug: input.toEntitySlug,
        weight: input.weight,
        labelBn: input.labelBn,
        labelEn: input.labelEn,
        metadata: input.metadata,
      })
      .catch(() => undefined);

    return edge.id;
  }

  async deleteGraphEdge(
    edgeType: MedicineGraphEdgeType,
    fromEntitySlug: string,
    toEntitySlug: string,
  ): Promise<boolean> {
    try {
      await this.prisma.vkMedicineKnowledgeGraphEdge.delete({
        where: {
          edgeType_fromEntitySlug_toEntitySlug: {
            edgeType,
            fromEntitySlug,
            toEntitySlug,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async getGraphEdges(params: {
    edgeType?: MedicineGraphEdgeType;
    fromEntitySlug?: string;
    toEntitySlug?: string;
    limit?: number;
  }): Promise<MedicineKnowledgeGraphEdge[]> {
    const where: Prisma.VkMedicineKnowledgeGraphEdgeWhereInput = {};
    if (params.edgeType) where.edgeType = params.edgeType;
    if (params.fromEntitySlug) where.fromEntitySlug = params.fromEntitySlug;
    if (params.toEntitySlug) where.toEntitySlug = params.toEntitySlug;

    return this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where,
      take: params.limit ?? 100,
      orderBy: { weight: 'desc' },
    });
  }

  async getBrandsForGenericBySlug(genericSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'BRAND_OF_GENERIC',
        toEntitySlug: genericSlug,
      },
      select: { fromEntitySlug: true },
    });
    return edges.map((e) => e.fromEntitySlug);
  }

  async getGenericsForBrandBySlug(brandSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'BRAND_OF_GENERIC',
        fromEntitySlug: brandSlug,
      },
      select: { toEntitySlug: true },
    });
    return edges.map((e) => e.toEntitySlug);
  }

  async getSubstitutes(genericSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'SUBSTITUTES_FOR',
        OR: [{ fromEntitySlug: genericSlug }, { toEntitySlug: genericSlug }],
      },
    });
    const slugs = new Set<string>();
    for (const e of edges) {
      if (e.fromEntitySlug !== genericSlug) slugs.add(e.fromEntitySlug);
      if (e.toEntitySlug !== genericSlug) slugs.add(e.toEntitySlug);
    }
    return Array.from(slugs);
  }

  async getContraindications(genericSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'CONTRAINDICATED_WITH',
        OR: [{ fromEntitySlug: genericSlug }, { toEntitySlug: genericSlug }],
      },
    });
    const slugs = new Set<string>();
    for (const e of edges) {
      if (e.fromEntitySlug !== genericSlug) slugs.add(e.fromEntitySlug);
      if (e.toEntitySlug !== genericSlug) slugs.add(e.toEntitySlug);
    }
    return Array.from(slugs);
  }

  async getInteractions(genericSlug: string): Promise<Array<{
    targetSlug: string;
    weight: number;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'INTERACTS_WITH',
        OR: [{ fromEntitySlug: genericSlug }, { toEntitySlug: genericSlug }],
      },
    });

    return edges.map((e) => ({
      targetSlug: e.fromEntitySlug === genericSlug ? e.toEntitySlug : e.fromEntitySlug,
      weight: e.weight,
      labelBn: e.labelBn,
      labelEn: e.labelEn,
    }));
  }

  async getSameTherapeuticClass(genericSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'SAME_THERAPEUTIC_CLASS',
        OR: [{ fromEntitySlug: genericSlug }, { toEntitySlug: genericSlug }],
      },
      take: 20,
      orderBy: { weight: 'desc' },
    });
    const slugs = new Set<string>();
    for (const e of edges) {
      if (e.fromEntitySlug !== genericSlug) slugs.add(e.fromEntitySlug);
      if (e.toEntitySlug !== genericSlug) slugs.add(e.toEntitySlug);
    }
    return Array.from(slugs);
  }

  async getSameDrugClass(genericSlug: string): Promise<string[]> {
    const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
      where: {
        edgeType: 'SAME_DRUG_CLASS',
        OR: [{ fromEntitySlug: genericSlug }, { toEntitySlug: genericSlug }],
      },
      take: 20,
      orderBy: { weight: 'desc' },
    });
    const slugs = new Set<string>();
    for (const e of edges) {
      if (e.fromEntitySlug !== genericSlug) slugs.add(e.fromEntitySlug);
      if (e.toEntitySlug !== genericSlug) slugs.add(e.toEntitySlug);
    }
    return Array.from(slugs);
  }

  async expandGraphFromEntity(
    entitySlug: string,
    edgeTypes: MedicineGraphEdgeType[],
    maxHops: number = 1,
  ): Promise<Array<{
    edgeType: string;
    fromSlug: string;
    toSlug: string;
    weight: number;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    const visited = new Set<string>([entitySlug]);
    const results: Array<{
      edgeType: string;
      fromSlug: string;
      toSlug: string;
      weight: number;
      labelBn: string | null;
      labelEn: string | null;
    }> = [];

    let frontier = [entitySlug];

    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const edges = await this.prisma.vkMedicineKnowledgeGraphEdge.findMany({
        where: {
          edgeType: { in: edgeTypes },
          OR: [
            { fromEntitySlug: { in: frontier } },
            { toEntitySlug: { in: frontier } },
          ],
        },
        orderBy: { weight: 'desc' },
        take: 50,
      });

      const nextFrontier: string[] = [];

      for (const edge of edges) {
        results.push({
          edgeType: edge.edgeType,
          fromSlug: edge.fromEntitySlug,
          toSlug: edge.toEntitySlug,
          weight: edge.weight,
          labelBn: edge.labelBn,
          labelEn: edge.labelEn,
        });

        if (!visited.has(edge.fromEntitySlug)) {
          visited.add(edge.fromEntitySlug);
          nextFrontier.push(edge.fromEntitySlug);
        }
        if (!visited.has(edge.toEntitySlug)) {
          visited.add(edge.toEntitySlug);
          nextFrontier.push(edge.toEntitySlug);
        }
      }

      frontier = nextFrontier;
    }

    return results;
  }

  async linkBrandToGeneric(
    brandCode: string,
    genericCode: string,
    companyCode?: string,
  ): Promise<void> {
    await this.createGraphEdge({
      edgeType: 'BRAND_OF_GENERIC',
      fromEntitySlug: `brand:${brandCode}`,
      toEntitySlug: `generic:${genericCode}`,
      weight: 1.0,
      labelEn: `${brandCode} is a brand of ${genericCode}`,
    });

    if (companyCode) {
      await this.createGraphEdge({
        edgeType: 'MANUFACTURED_BY',
        fromEntitySlug: `brand:${brandCode}`,
        toEntitySlug: `company:${companyCode}`,
        weight: 1.0,
        labelEn: `${brandCode} is manufactured by ${companyCode}`,
      });
    }
  }

  async linkCompanyAsSponsor(
    companyCode: string,
    brandCode: string,
    contractCode?: string,
  ): Promise<void> {
    await this.createGraphEdge({
      edgeType: 'SPONSORED_BY',
      fromEntitySlug: `brand:${brandCode}`,
      toEntitySlug: `company:${companyCode}`,
      weight: 1.0,
      labelEn: `${brandCode} is sponsored by ${companyCode}`,
      metadata: contractCode ? { contractCode } : undefined,
    });
  }

  async linkSubstitutes(genericCode1: string, genericCode2: string): Promise<void> {
    await this.createGraphEdge({
      edgeType: 'SUBSTITUTES_FOR',
      fromEntitySlug: `generic:${genericCode1}`,
      toEntitySlug: `generic:${genericCode2}`,
      weight: 1.0,
      labelEn: `${genericCode1} can substitute for ${genericCode2}`,
    });
  }

  async linkSameTherapeuticClass(
    genericCode1: string,
    genericCode2: string,
    therapeuticClass: string,
  ): Promise<void> {
    await this.createGraphEdge({
      edgeType: 'SAME_THERAPEUTIC_CLASS',
      fromEntitySlug: `generic:${genericCode1}`,
      toEntitySlug: `generic:${genericCode2}`,
      weight: 0.8,
      labelEn: `${genericCode1} and ${genericCode2} are in ${therapeuticClass}`,
      metadata: { therapeuticClass },
    });
  }

  async linkSameDrugClass(
    genericCode1: string,
    genericCode2: string,
    drugClass: string,
  ): Promise<void> {
    await this.createGraphEdge({
      edgeType: 'SAME_DRUG_CLASS',
      fromEntitySlug: `generic:${genericCode1}`,
      toEntitySlug: `generic:${genericCode2}`,
      weight: 0.9,
      labelEn: `${genericCode1} and ${genericCode2} are in ${drugClass}`,
      metadata: { drugClass },
    });
  }

  async getEdgeStats(): Promise<Record<string, number>> {
    const results = await this.prisma.vkMedicineKnowledgeGraphEdge.groupBy({
      by: ['edgeType'],
      _count: { id: true },
    });

    const stats: Record<string, number> = {};
    for (const r of results) {
      stats[r.edgeType] = r._count.id;
    }
    return stats;
  }
}

let repository: MedicineKnowledgeRepository | undefined;

export function getMedicineKnowledgeRepository(): MedicineKnowledgeRepository {
  if (!repository) {
    repository = new MedicineKnowledgeRepository();
  }
  return repository;
}

export function resetMedicineKnowledgeRepositoryForTests(): void {
  repository = undefined;
}
