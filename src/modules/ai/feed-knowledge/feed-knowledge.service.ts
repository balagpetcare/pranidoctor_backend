import type {
  BdFeedAvailability,
  BreedCategory,
  LivestockSpecies,
  ProductionStage,
  VkVersionStatus,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { FEED_KNOWLEDGE_DOMAIN, FEED_KNOWLEDGE_MIN_CONFIDENCE, FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL } from './feed-knowledge.constants.js';
import {
  getFeedKnowledgeRepository,
  type FeedKnowledgeRepository,
} from './feed-knowledge.repository.js';
import type {
  FeedGraphEdgeType,
  FeedIngredientView,
  FeedKnowledgeGraphEdgeInput,
  FeedStructuredFact,
  NutrientRequirementView,
  ToxicFeedAlertView,
} from './feed-knowledge.types.js';

export type IngredientSearchParams = {
  query?: string;
  status?: VkVersionStatus;
  bdAvailability?: BdFeedAvailability;
  species?: LivestockSpecies;
  limit?: number;
  offset?: number;
};

export type NutrientRequirementLookupParams = {
  species: LivestockSpecies;
  productionStage: ProductionStage;
  breedCategory?: BreedCategory;
};

export type ToxicCheckResult = {
  hasToxicAlert: boolean;
  alerts: ToxicFeedAlertView[];
  ingredientsWithAlerts: string[];
  recommendedAction: 'PROCEED' | 'WARN' | 'BLOCK';
};

export type StructuredFactsResult = {
  facts: FeedStructuredFact[];
  coverage: number;
  missingFactTypes: string[];
};

export class FeedKnowledgeService {
  private repository: FeedKnowledgeRepository;

  constructor(repository?: FeedKnowledgeRepository) {
    this.repository = repository ?? getFeedKnowledgeRepository();
  }

  async listIngredients(params: IngredientSearchParams): Promise<FeedIngredientView[]> {
    if (params.query) {
      return this.repository.searchFeedIngredients({
        query: params.query,
        status: params.status,
        limit: params.limit,
      });
    }
    return this.repository.listFeedIngredients({
      status: params.status,
      bdAvailability: params.bdAvailability,
      species: params.species,
      limit: params.limit,
      offset: params.offset,
    });
  }

  async getIngredientByCode(code: string): Promise<FeedIngredientView | null> {
    return this.repository.getFeedIngredientByCode(code);
  }

  async getPublishedIngredient(code: string): Promise<FeedIngredientView | null> {
    const ingredient = await this.repository.getFeedIngredientByCode(code);
    if (!ingredient || ingredient.status !== 'PUBLISHED') return null;
    return ingredient;
  }

  async getIngredientsBySpecies(
    species: LivestockSpecies,
    limit?: number,
  ): Promise<FeedIngredientView[]> {
    return this.repository.listFeedIngredients({
      status: 'PUBLISHED',
      species,
      limit,
    });
  }

  async getNutrientRequirements(
    params: NutrientRequirementLookupParams,
  ): Promise<NutrientRequirementView | null> {
    return this.repository.getNutrientRequirement(params);
  }

  async listNutrientRequirements(params: {
    species?: LivestockSpecies;
    productionStage?: ProductionStage;
    status?: VkVersionStatus;
    limit?: number;
  }): Promise<NutrientRequirementView[]> {
    return this.repository.listNutrientRequirements({
      ...params,
      status: params.status ?? 'PUBLISHED',
    });
  }

  async checkToxicIngredients(ingredientCodes: string[]): Promise<ToxicCheckResult> {
    if (ingredientCodes.length === 0) {
      return {
        hasToxicAlert: false,
        alerts: [],
        ingredientsWithAlerts: [],
        recommendedAction: 'PROCEED',
      };
    }

    const alerts = await this.repository.checkToxicIngredients(ingredientCodes);
    const ingredientsWithAlerts = Array.from(
      new Set(
        alerts.flatMap((a) =>
          a.relatedIngredientCodes.filter((c) => ingredientCodes.includes(c)),
        ),
      ),
    );

    if (alerts.length === 0) {
      return {
        hasToxicAlert: false,
        alerts: [],
        ingredientsWithAlerts: [],
        recommendedAction: 'PROCEED',
      };
    }

    const hasVetRequired = alerts.some((a) => a.vetRequired);

    return {
      hasToxicAlert: true,
      alerts,
      ingredientsWithAlerts,
      recommendedAction: hasVetRequired ? 'BLOCK' : 'WARN',
    };
  }

  async listToxicAlerts(params: {
    species?: LivestockSpecies;
    limit?: number;
  }): Promise<ToxicFeedAlertView[]> {
    return this.repository.listToxicFeedAlerts({
      species: params.species,
      status: 'PUBLISHED',
      limit: params.limit,
    });
  }

  async getGraphEdges(params: {
    edgeType?: FeedGraphEdgeType;
    fromSlug?: string;
    toSlug?: string;
    limit?: number;
  }): Promise<Array<{
    edgeType: string;
    fromSlug: string;
    toSlug: string;
    weight: number;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    const edges = await this.repository.getGraphEdges({
      edgeType: params.edgeType,
      fromEntitySlug: params.fromSlug,
      toEntitySlug: params.toSlug,
      limit: params.limit,
    });

    return edges.map((e) => ({
      edgeType: e.edgeType,
      fromSlug: e.fromEntitySlug,
      toSlug: e.toEntitySlug,
      weight: e.weight,
      labelBn: e.labelBn,
      labelEn: e.labelEn,
    }));
  }

  async expandGraph(
    entitySlug: string,
    edgeTypes: FeedGraphEdgeType[],
    maxHops?: number,
  ): Promise<Array<{
    edgeType: string;
    fromSlug: string;
    toSlug: string;
    labelBn: string | null;
    labelEn: string | null;
  }>> {
    return this.repository.expandGraphFromEntity(entitySlug, edgeTypes, maxHops);
  }

  async createGraphEdge(input: FeedKnowledgeGraphEdgeInput): Promise<string> {
    return this.repository.createGraphEdge(input);
  }

  async buildStructuredFacts(params: {
    species: LivestockSpecies;
    productionStage: ProductionStage;
    breedCategory?: BreedCategory;
    ingredientCodes?: string[];
  }): Promise<StructuredFactsResult> {
    const facts: FeedStructuredFact[] = [];
    const missingFactTypes: string[] = [];

    const requirement = await this.getNutrientRequirements({
      species: params.species,
      productionStage: params.productionStage,
      breedCategory: params.breedCategory,
    });

    if (requirement) {
      if (requirement.cpPercent.min != null) {
        facts.push({
          factId: `cp-${requirement.id}`,
          factType: 'NUTRIENT_CP_PERCENT',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.cpPercent.min,
          unit: '%',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      } else {
        missingFactTypes.push('NUTRIENT_CP_PERCENT');
      }

      if (requirement.tdnPercentMin != null) {
        facts.push({
          factId: `tdn-${requirement.id}`,
          factType: 'NUTRIENT_TDN_PERCENT',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.tdnPercentMin,
          unit: '%',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      } else {
        missingFactTypes.push('NUTRIENT_TDN_PERCENT');
      }

      if (requirement.dmIntake.kgPerDay != null) {
        facts.push({
          factId: `dmi-${requirement.id}`,
          factType: 'NUTRIENT_DM_INTAKE_KG',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.dmIntake.kgPerDay,
          unit: 'kg/day',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      }

      if (requirement.ndfPercentMax != null) {
        facts.push({
          factId: `ndf-${requirement.id}`,
          factType: 'NUTRIENT_NDF_MAX',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.ndfPercentMax,
          unit: '%',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      }

      if (requirement.caPercentMin != null) {
        facts.push({
          factId: `ca-${requirement.id}`,
          factType: 'NUTRIENT_CA_MIN',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.caPercentMin,
          unit: '%',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      }

      if (requirement.pPercentMin != null) {
        facts.push({
          factId: `p-${requirement.id}`,
          factType: 'NUTRIENT_P_MIN',
          species: params.species,
          productionStage: params.productionStage,
          value: requirement.pPercentMin,
          unit: '%',
          evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
          confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
          sourceCitation: `NRC-${params.species}`,
        });
      }
    } else {
      missingFactTypes.push('NUTRIENT_CP_PERCENT', 'NUTRIENT_TDN_PERCENT');
    }

    if (params.ingredientCodes && params.ingredientCodes.length > 0) {
      for (const code of params.ingredientCodes) {
        const ingredient = await this.getPublishedIngredient(code);
        if (ingredient) {
          facts.push({
            factId: `ing-${ingredient.id}`,
            factType: 'INGREDIENT_COMPOSITION',
            ingredientCode: code,
            value: JSON.stringify({
              dm: ingredient.composition.dmPercent,
              cp: ingredient.composition.cpPercent,
              tdn: ingredient.composition.tdnPercent,
            }),
            evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
            confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
            sourceCitation: `BD-Feed-DB`,
          });

          if (ingredient.avgPriceBdtPerKg != null) {
            facts.push({
              factId: `price-${ingredient.id}`,
              factType: 'INGREDIENT_PRICE_BDT',
              ingredientCode: code,
              value: ingredient.avgPriceBdtPerKg,
              unit: 'BDT/kg',
              evidenceLevel: 'L1',
              confidenceScore: 0.5,
              sourceCitation: `BD-Market-${new Date().toISOString().slice(0, 7)}`,
            });
          }

          for (const inc of ingredient.maxInclusions) {
            if (
              inc.species === params.species &&
              inc.productionStage === params.productionStage
            ) {
              facts.push({
                factId: `max-${ingredient.id}-${inc.species}-${inc.productionStage}`,
                factType: 'INGREDIENT_MAX_INCLUSION',
                ingredientCode: code,
                species: inc.species,
                productionStage: inc.productionStage,
                value: inc.maxPercentDm,
                unit: '% DM',
                evidenceLevel: FEED_KNOWLEDGE_MIN_EVIDENCE_LEVEL,
                confidenceScore: FEED_KNOWLEDGE_MIN_CONFIDENCE,
                sourceCitation: `BD-Feed-DB`,
              });
            }
          }
        }
      }
    }

    const requiredFactTypes = ['NUTRIENT_CP_PERCENT', 'NUTRIENT_TDN_PERCENT'];
    const foundTypes = new Set(facts.map((f) => f.factType));
    const coverage =
      requiredFactTypes.filter((t) => foundTypes.has(t as any)).length /
      requiredFactTypes.length;

    return {
      facts,
      coverage,
      missingFactTypes: Array.from(new Set(missingFactTypes)),
    };
  }

  async getSeasonalCalendar(month: number, regionCode?: string): Promise<{
    month: number;
    regionCode: string;
    availableIngredientCodes: string[];
    peakIngredientCodes: string[];
    scarcityIngredientCodes: string[];
    guidelinesBn: string | null;
    guidelinesEn: string | null;
  } | null> {
    const calendar = await getPrisma().vkSeasonalFeedCalendar.findFirst({
      where: {
        month,
        regionCode: regionCode ?? 'BD',
        version: { status: 'PUBLISHED' },
      },
      include: { version: { select: { status: true } } },
    });

    if (!calendar) return null;

    return {
      month: calendar.month,
      regionCode: calendar.regionCode,
      availableIngredientCodes: calendar.availableIngredientCodes,
      peakIngredientCodes: calendar.peakIngredientCodes,
      scarcityIngredientCodes: calendar.scarcityIngredientCodes,
      guidelinesBn: calendar.guidelinesBn,
      guidelinesEn: calendar.guidelinesEn,
    };
  }

  async getRationTemplates(params: {
    species: LivestockSpecies;
    productionStage?: ProductionStage;
    limit?: number;
  }): Promise<Array<{
    templateCode: string;
    templateNameBn: string;
    templateNameEn: string;
    species: LivestockSpecies;
    productionStage: ProductionStage;
    targetProduction: string | null;
    ingredientsJson: unknown;
    calculatedCpPercent: number | null;
    calculatedTdnPercent: number | null;
    estimatedCostBdtPerKg: number | null;
  }>> {
    const where: any = {
      species: params.species,
      version: { status: 'PUBLISHED' },
    };
    if (params.productionStage) {
      where.productionStage = params.productionStage;
    }

    const templates = await getPrisma().vkRationTemplate.findMany({
      where,
      take: params.limit ?? 10,
      orderBy: { templateCode: 'asc' },
    });

    return templates.map((t) => ({
      templateCode: t.templateCode,
      templateNameBn: t.templateNameBn,
      templateNameEn: t.templateNameEn,
      species: t.species,
      productionStage: t.productionStage,
      targetProduction: t.targetProduction,
      ingredientsJson: t.ingredientsJson,
      calculatedCpPercent: t.calculatedCpPercent ? Number(t.calculatedCpPercent) : null,
      calculatedTdnPercent: t.calculatedTdnPercent ? Number(t.calculatedTdnPercent) : null,
      estimatedCostBdtPerKg: t.estimatedCostBdtPerKg ? Number(t.estimatedCostBdtPerKg) : null,
    }));
  }
}

let service: FeedKnowledgeService | undefined;

export function getFeedKnowledgeService(): FeedKnowledgeService {
  if (!service) {
    service = new FeedKnowledgeService();
  }
  return service;
}
