import { Prisma } from '../../../generated/prisma/index.js';
import type {
  BdFeedAvailability,
  BreedCategory,
  LivestockSpecies,
  ProductionStage,
  VkVersionStatus,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import type {
  AntinutrientInfo,
  FeedGraphEdgeType,
  FeedIngredientComposition,
  FeedIngredientView,
  FeedKnowledgeGraphEdgeInput,
  IngredientMaxInclusion,
  NutrientRequirementView,
  SeasonalAvailability,
  ToxicFeedAlertView,
} from './feed-knowledge.types.js';

type PrismaClient = ReturnType<typeof getPrisma>;

function buildFeedIngredientView(
  row: Prisma.VkFeedIngredientGetPayload<{
    include: { version: { select: { status: true } } };
  }>,
): FeedIngredientView {
  const composition: FeedIngredientComposition = {
    dmPercent: Number(row.dmPercent),
    cpPercent: row.cpPercent ? Number(row.cpPercent) : undefined,
    tdnPercent: row.tdnPercent ? Number(row.tdnPercent) : undefined,
    ndfPercent: row.ndfPercent ? Number(row.ndfPercent) : undefined,
    adfPercent: row.adfPercent ? Number(row.adfPercent) : undefined,
    meValueMjPerKg: row.meValueMjPerKg ? Number(row.meValueMjPerKg) : undefined,
    caPercent: row.caPercent ? Number(row.caPercent) : undefined,
    pPercent: row.pPercent ? Number(row.pPercent) : undefined,
    cfPercent: row.cfPercent ? Number(row.cfPercent) : undefined,
    eePercent: row.eePercent ? Number(row.eePercent) : undefined,
    ashPercent: row.ashPercent ? Number(row.ashPercent) : undefined,
  };

  return {
    id: row.id,
    versionId: row.versionId,
    ingredientCode: row.ingredientCode,
    localNamesBn: row.localNamesBn,
    localNamesEn: row.localNamesEn,
    composition,
    bdAvailability: row.bdAvailability,
    seasonality: (row.seasonalityJson as SeasonalAvailability[] | null) ?? [],
    avgPriceBdtPerKg: row.avgPriceBdtPerKg ? Number(row.avgPriceBdtPerKg) : null,
    priceVolatility: row.priceVolatility,
    speciesRestrictions: row.speciesRestrictions,
    antinutrients: (row.antinutrientJson as AntinutrientInfo[] | null) ?? [],
    maxInclusions: (row.maxInclusionJson as IngredientMaxInclusion[] | null) ?? [],
    feedItemId: row.feedItemId,
    status: row.version.status,
    evidenceLevel: null,
    confidenceScore: null,
  };
}

function buildNutrientRequirementView(
  row: Prisma.VkNutrientRequirementGetPayload<{
    include: { version: { select: { status: true } } };
  }>,
): NutrientRequirementView {
  return {
    id: row.id,
    versionId: row.versionId,
    species: row.species,
    productionStage: row.productionStage,
    breedCategory: row.breedCategory,
    weightRange: {
      minKg: row.weightRangeMinKg ? Number(row.weightRangeMinKg) : null,
      maxKg: row.weightRangeMaxKg ? Number(row.weightRangeMaxKg) : null,
    },
    dmIntake: {
      kgPerDay: row.dmIntakeKgPerDay ? Number(row.dmIntakeKgPerDay) : null,
      percentBw: row.dmIntakePercentBw ? Number(row.dmIntakePercentBw) : null,
    },
    cpPercent: {
      min: row.cpPercentMin ? Number(row.cpPercentMin) : null,
      max: row.cpPercentMax ? Number(row.cpPercentMax) : null,
    },
    tdnPercentMin: row.tdnPercentMin ? Number(row.tdnPercentMin) : null,
    meMinMjPerKg: row.meMinMjPerKg ? Number(row.meMinMjPerKg) : null,
    ndfPercentMax: row.ndfPercentMax ? Number(row.ndfPercentMax) : null,
    caPercentMin: row.caPercentMin ? Number(row.caPercentMin) : null,
    pPercentMin: row.pPercentMin ? Number(row.pPercentMin) : null,
    productionTargets: {
      milkYieldLiters: row.milkYieldLiters ? Number(row.milkYieldLiters) : null,
      adgKg: row.adgKg ? Number(row.adgKg) : null,
    },
    status: row.version.status,
  };
}

function buildToxicFeedAlertView(
  row: Prisma.VkToxicFeedAlertGetPayload<{
    include: { version: { select: { status: true } } };
  }>,
): ToxicFeedAlertView {
  return {
    id: row.id,
    versionId: row.versionId,
    substance: row.substance,
    commonNamesBn: row.commonNamesBn,
    commonNamesEn: row.commonNamesEn,
    speciesAffected: row.speciesAffected,
    toxicThreshold: row.toxicThreshold,
    lethalThreshold: row.lethalThreshold,
    clinicalSignsBn: row.clinicalSignsBn,
    clinicalSignsEn: row.clinicalSignsEn,
    onsetTime: row.onsetTime,
    immediateActionBn: row.immediateActionBn,
    immediateActionEn: row.immediateActionEn,
    vetRequired: row.vetRequired,
    relatedIngredientCodes: row.relatedIngredientCodes,
    status: row.version.status,
  };
}

export class FeedKnowledgeRepository {
  private prisma: PrismaClient;

  constructor(prisma?: PrismaClient) {
    this.prisma = prisma ?? getPrisma();
  }

  async listFeedIngredients(params: {
    status?: VkVersionStatus;
    bdAvailability?: BdFeedAvailability;
    species?: LivestockSpecies;
    limit?: number;
    offset?: number;
  }): Promise<FeedIngredientView[]> {
    const where: Prisma.VkFeedIngredientWhereInput = {};
    if (params.status) {
      where.version = { status: params.status };
    }
    if (params.bdAvailability) {
      where.bdAvailability = params.bdAvailability;
    }
    if (params.species) {
      where.NOT = { speciesRestrictions: { has: params.species } };
    }

    const rows = await this.prisma.vkFeedIngredient.findMany({
      where,
      include: { version: { select: { status: true } } },
      take: params.limit ?? 100,
      skip: params.offset ?? 0,
      orderBy: { ingredientCode: 'asc' },
    });

    return rows.map(buildFeedIngredientView);
  }

  async getFeedIngredientByCode(code: string): Promise<FeedIngredientView | null> {
    const row = await this.prisma.vkFeedIngredient.findUnique({
      where: { ingredientCode: code },
      include: { version: { select: { status: true } } },
    });
    return row ? buildFeedIngredientView(row) : null;
  }

  async getFeedIngredientById(id: string): Promise<FeedIngredientView | null> {
    const row = await this.prisma.vkFeedIngredient.findUnique({
      where: { id },
      include: { version: { select: { status: true } } },
    });
    return row ? buildFeedIngredientView(row) : null;
  }

  async searchFeedIngredients(params: {
    query: string;
    status?: VkVersionStatus;
    limit?: number;
  }): Promise<FeedIngredientView[]> {
    const searchTerms = params.query.toLowerCase().split(/\s+/).filter(Boolean);
    const where: Prisma.VkFeedIngredientWhereInput = {
      AND: searchTerms.map((term) => ({
        OR: [
          { ingredientCode: { contains: term, mode: 'insensitive' as const } },
          { localNamesBn: { hasSome: [term] } },
          { localNamesEn: { hasSome: [term] } },
        ],
      })),
    };

    if (params.status) {
      where.version = { status: params.status };
    }

    const rows = await this.prisma.vkFeedIngredient.findMany({
      where,
      include: { version: { select: { status: true } } },
      take: params.limit ?? 20,
      orderBy: { ingredientCode: 'asc' },
    });

    return rows.map(buildFeedIngredientView);
  }

  async listNutrientRequirements(params: {
    species?: LivestockSpecies;
    productionStage?: ProductionStage;
    breedCategory?: BreedCategory;
    status?: VkVersionStatus;
    limit?: number;
    offset?: number;
  }): Promise<NutrientRequirementView[]> {
    const where: Prisma.VkNutrientRequirementWhereInput = {};
    if (params.species) where.species = params.species;
    if (params.productionStage) where.productionStage = params.productionStage;
    if (params.breedCategory) where.breedCategory = params.breedCategory;
    if (params.status) where.version = { status: params.status };

    const rows = await this.prisma.vkNutrientRequirement.findMany({
      where,
      include: { version: { select: { status: true } } },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      orderBy: [{ species: 'asc' }, { productionStage: 'asc' }],
    });

    return rows.map(buildNutrientRequirementView);
  }

  async getNutrientRequirement(params: {
    species: LivestockSpecies;
    productionStage: ProductionStage;
    breedCategory?: BreedCategory;
  }): Promise<NutrientRequirementView | null> {
    const row = await this.prisma.vkNutrientRequirement.findFirst({
      where: {
        species: params.species,
        productionStage: params.productionStage,
        breedCategory: params.breedCategory ?? null,
        version: { status: 'PUBLISHED' },
      },
      include: { version: { select: { status: true } } },
      orderBy: { createdAt: 'desc' },
    });

    if (row) return buildNutrientRequirementView(row);

    if (params.breedCategory) {
      const fallback = await this.prisma.vkNutrientRequirement.findFirst({
        where: {
          species: params.species,
          productionStage: params.productionStage,
          breedCategory: null,
          version: { status: 'PUBLISHED' },
        },
        include: { version: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
      });
      return fallback ? buildNutrientRequirementView(fallback) : null;
    }

    return null;
  }

  async listToxicFeedAlerts(params: {
    species?: LivestockSpecies;
    status?: VkVersionStatus;
    limit?: number;
    offset?: number;
  }): Promise<ToxicFeedAlertView[]> {
    const where: Prisma.VkToxicFeedAlertWhereInput = {};
    if (params.species) where.speciesAffected = { has: params.species };
    if (params.status) where.version = { status: params.status };

    const rows = await this.prisma.vkToxicFeedAlert.findMany({
      where,
      include: { version: { select: { status: true } } },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      orderBy: { substance: 'asc' },
    });

    return rows.map(buildToxicFeedAlertView);
  }

  async getToxicFeedAlertBySubstance(substance: string): Promise<ToxicFeedAlertView | null> {
    const row = await this.prisma.vkToxicFeedAlert.findFirst({
      where: {
        OR: [
          { substance: { equals: substance, mode: 'insensitive' } },
          { commonNamesBn: { hasSome: [substance] } },
          { commonNamesEn: { hasSome: [substance] } },
          { relatedIngredientCodes: { hasSome: [substance] } },
        ],
      },
      include: { version: { select: { status: true } } },
    });
    return row ? buildToxicFeedAlertView(row) : null;
  }

  async checkToxicIngredients(ingredientCodes: string[]): Promise<ToxicFeedAlertView[]> {
    const rows = await this.prisma.vkToxicFeedAlert.findMany({
      where: {
        relatedIngredientCodes: { hasSome: ingredientCodes },
        version: { status: 'PUBLISHED' },
      },
      include: { version: { select: { status: true } } },
    });
    return rows.map(buildToxicFeedAlertView);
  }

  async createGraphEdge(input: FeedKnowledgeGraphEdgeInput): Promise<string> {
    const edge = await this.prisma.vkFeedKnowledgeGraphEdge.upsert({
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
        labelBn: input.labelBn,
        labelEn: input.labelEn,
        metadataJson: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : Prisma.JsonNull,
      },
      update: {
        weight: input.weight ?? 1.0,
        labelBn: input.labelBn,
        labelEn: input.labelEn,
        metadataJson: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : Prisma.JsonNull,
      },
    });

    const { getUvkgDualWriteService } = await import('../uvkg/services/uvkg-dual-write.service.js');
    void getUvkgDualWriteService()
      .afterFeedGraphEdge({
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

  async getGraphEdges(params: {
    edgeType?: FeedGraphEdgeType;
    fromEntitySlug?: string;
    toEntitySlug?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    edgeType: string;
    fromEntitySlug: string;
    toEntitySlug: string;
    weight: number;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    const where: Prisma.VkFeedKnowledgeGraphEdgeWhereInput = {};
    if (params.edgeType) where.edgeType = params.edgeType;
    if (params.fromEntitySlug) where.fromEntitySlug = params.fromEntitySlug;
    if (params.toEntitySlug) where.toEntitySlug = params.toEntitySlug;

    return this.prisma.vkFeedKnowledgeGraphEdge.findMany({
      where,
      take: params.limit ?? 100,
      orderBy: { weight: 'desc' },
    });
  }

  async expandGraphFromEntity(
    entitySlug: string,
    edgeTypes: FeedGraphEdgeType[],
    maxHops: number = 1,
  ): Promise<Array<{
    edgeType: string;
    fromSlug: string;
    toSlug: string;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    const visited = new Set<string>([entitySlug]);
    const results: Array<{
      edgeType: string;
      fromSlug: string;
      toSlug: string;
      labelBn: string | null;
      labelEn: string | null;
    }> = [];

    let frontier = [entitySlug];

    for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
      const edges = await this.prisma.vkFeedKnowledgeGraphEdge.findMany({
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
}

let repository: FeedKnowledgeRepository | undefined;

export function getFeedKnowledgeRepository(): FeedKnowledgeRepository {
  if (!repository) {
    repository = new FeedKnowledgeRepository();
  }
  return repository;
}
