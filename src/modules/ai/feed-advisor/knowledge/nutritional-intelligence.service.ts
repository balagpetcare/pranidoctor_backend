import type {
  BreedCategory,
  LivestockSpecies,
  ProductionStage,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { getFeedKnowledgeService } from '../../feed-knowledge/feed-knowledge.service.js';
import type { NutrientRequirementView, FeedIngredientView } from '../../feed-knowledge/feed-knowledge.types.js';

export type LivestockContext = {
  species: LivestockSpecies;
  productionStage: ProductionStage;
  breedCategory?: BreedCategory;
  weightKg?: number;
  ageMonths?: number;
  milkYieldLitersPerDay?: number;
  targetAdgKg?: number;
  isPregnant?: boolean;
  gestationWeek?: number;
};

export type NutrientTarget = {
  nutrient: string;
  minValue: number;
  maxValue?: number;
  unit: string;
  priority: 'critical' | 'important' | 'optional';
  source: string;
};

export type NutrientProfile = {
  dmIntakeKgPerDay: number;
  dmIntakePercentBw: number | null;
  targets: NutrientTarget[];
  adjustments: NutrientAdjustment[];
  confidenceScore: number;
  sourceNotes: string;
};

export type NutrientAdjustment = {
  reason: string;
  nutrient: string;
  adjustment: number;
  unit: 'percent' | 'absolute';
};

export type IngredientMatch = {
  ingredient: FeedIngredientView;
  matchScore: number;
  matchReasons: string[];
  exclusionReasons: string[];
  maxInclusionPercent: number | null;
};

export type FormulationConstraint = {
  ingredientCode: string;
  constraintType: 'min' | 'max' | 'exact';
  value: number;
  reason: string;
};

export class NutritionalIntelligenceService {
  private feedKnowledge = getFeedKnowledgeService();

  async getNutrientProfile(context: LivestockContext): Promise<NutrientProfile | null> {
    const baseRequirement = await this.feedKnowledge.getNutrientRequirements({
      species: context.species,
      productionStage: context.productionStage,
      breedCategory: context.breedCategory,
    });

    if (!baseRequirement) {
      return null;
    }

    const targets = this.buildNutrientTargets(baseRequirement, context);
    const adjustments = this.calculateAdjustments(baseRequirement, context);
    const adjustedTargets = this.applyAdjustments(targets, adjustments);
    const dmIntake = this.calculateDmIntake(baseRequirement, context);

    return {
      dmIntakeKgPerDay: dmIntake,
      dmIntakePercentBw: baseRequirement.dmIntake.percentBw,
      targets: adjustedTargets,
      adjustments,
      confidenceScore: this.calculateConfidence(baseRequirement, context),
      sourceNotes: `Based on ${baseRequirement.species} ${baseRequirement.productionStage} requirements`,
    };
  }

  private buildNutrientTargets(
    req: NutrientRequirementView,
    context: LivestockContext,
  ): NutrientTarget[] {
    const targets: NutrientTarget[] = [];

    if (req.cpPercent.min != null) {
      targets.push({
        nutrient: 'CP',
        minValue: req.cpPercent.min,
        maxValue: req.cpPercent.max ?? undefined,
        unit: '% DM',
        priority: 'critical',
        source: 'VKL-NutrientRequirement',
      });
    }

    if (req.tdnPercentMin != null) {
      targets.push({
        nutrient: 'TDN',
        minValue: req.tdnPercentMin,
        unit: '% DM',
        priority: 'critical',
        source: 'VKL-NutrientRequirement',
      });
    }

    if (req.meMinMjPerKg != null) {
      targets.push({
        nutrient: 'ME',
        minValue: req.meMinMjPerKg,
        unit: 'MJ/kg DM',
        priority: 'critical',
        source: 'VKL-NutrientRequirement',
      });
    }

    if (req.ndfPercentMax != null) {
      targets.push({
        nutrient: 'NDF',
        minValue: 0,
        maxValue: req.ndfPercentMax,
        unit: '% DM',
        priority: 'important',
        source: 'VKL-NutrientRequirement',
      });
    }

    if (req.caPercentMin != null) {
      targets.push({
        nutrient: 'Ca',
        minValue: req.caPercentMin,
        unit: '% DM',
        priority: 'important',
        source: 'VKL-NutrientRequirement',
      });
    }

    if (req.pPercentMin != null) {
      targets.push({
        nutrient: 'P',
        minValue: req.pPercentMin,
        unit: '% DM',
        priority: 'important',
        source: 'VKL-NutrientRequirement',
      });
    }

    return targets;
  }

  private calculateAdjustments(
    req: NutrientRequirementView,
    context: LivestockContext,
  ): NutrientAdjustment[] {
    const adjustments: NutrientAdjustment[] = [];

    if (context.milkYieldLitersPerDay && req.productionTargets.milkYieldLiters) {
      const baseYield = req.productionTargets.milkYieldLiters;
      const actualYield = context.milkYieldLitersPerDay;
      const yieldDiff = actualYield - baseYield;

      if (Math.abs(yieldDiff) > 2) {
        const cpAdjustment = yieldDiff * 0.2;
        adjustments.push({
          reason: `Milk yield ${actualYield}L vs base ${baseYield}L`,
          nutrient: 'CP',
          adjustment: cpAdjustment,
          unit: 'percent',
        });

        const tdnAdjustment = yieldDiff * 0.3;
        adjustments.push({
          reason: `Milk yield adjustment`,
          nutrient: 'TDN',
          adjustment: tdnAdjustment,
          unit: 'percent',
        });
      }
    }

    if (context.targetAdgKg && req.productionTargets.adgKg) {
      const baseAdg = req.productionTargets.adgKg;
      const targetAdg = context.targetAdgKg;
      const adgDiff = targetAdg - baseAdg;

      if (Math.abs(adgDiff) > 0.1) {
        const cpAdjustment = adgDiff * 1.5;
        adjustments.push({
          reason: `Target ADG ${targetAdg}kg vs base ${baseAdg}kg`,
          nutrient: 'CP',
          adjustment: cpAdjustment,
          unit: 'percent',
        });
      }
    }

    if (context.weightKg && req.weightRange.minKg && req.weightRange.maxKg) {
      const midWeight = (req.weightRange.minKg + req.weightRange.maxKg) / 2;
      const weightRatio = context.weightKg / midWeight;

      if (weightRatio < 0.8) {
        adjustments.push({
          reason: `Lighter animal (${context.weightKg}kg)`,
          nutrient: 'CP',
          adjustment: 1.0,
          unit: 'percent',
        });
      } else if (weightRatio > 1.2) {
        adjustments.push({
          reason: `Heavier animal (${context.weightKg}kg)`,
          nutrient: 'CP',
          adjustment: -0.5,
          unit: 'percent',
        });
      }
    }

    if (context.isPregnant && context.gestationWeek && context.gestationWeek > 30) {
      adjustments.push({
        reason: `Late pregnancy (week ${context.gestationWeek})`,
        nutrient: 'CP',
        adjustment: 2.0,
        unit: 'percent',
      });
      adjustments.push({
        reason: `Late pregnancy energy needs`,
        nutrient: 'TDN',
        adjustment: 5.0,
        unit: 'percent',
      });
      adjustments.push({
        reason: `Fetal Ca deposition`,
        nutrient: 'Ca',
        adjustment: 0.1,
        unit: 'absolute',
      });
    }

    if (context.breedCategory === 'LOCAL_DESI' && !req.breedCategory) {
      adjustments.push({
        reason: `Local desi breed - lower maintenance`,
        nutrient: 'TDN',
        adjustment: -3,
        unit: 'percent',
      });
    } else if (context.breedCategory === 'EXOTIC_PURE' && !req.breedCategory) {
      adjustments.push({
        reason: `Exotic pure breed - higher requirements`,
        nutrient: 'CP',
        adjustment: 1.5,
        unit: 'percent',
      });
      adjustments.push({
        reason: `Exotic pure breed - higher energy`,
        nutrient: 'TDN',
        adjustment: 3,
        unit: 'percent',
      });
    }

    return adjustments;
  }

  private applyAdjustments(
    targets: NutrientTarget[],
    adjustments: NutrientAdjustment[],
  ): NutrientTarget[] {
    const adjustedTargets = targets.map((t) => ({ ...t }));

    for (const adj of adjustments) {
      const target = adjustedTargets.find((t) => t.nutrient === adj.nutrient);
      if (target) {
        if (adj.unit === 'percent') {
          target.minValue += adj.adjustment;
          if (target.maxValue != null) {
            target.maxValue += adj.adjustment;
          }
        } else {
          target.minValue += adj.adjustment;
          if (target.maxValue != null) {
            target.maxValue += adj.adjustment;
          }
        }
        target.minValue = Math.max(0, target.minValue);
        if (target.maxValue != null) {
          target.maxValue = Math.max(target.minValue, target.maxValue);
        }
      }
    }

    return adjustedTargets;
  }

  private calculateDmIntake(
    req: NutrientRequirementView,
    context: LivestockContext,
  ): number {
    if (req.dmIntake.kgPerDay != null) {
      let dmIntake = req.dmIntake.kgPerDay;

      if (context.weightKg && req.weightRange.minKg && req.weightRange.maxKg) {
        const midWeight = (req.weightRange.minKg + req.weightRange.maxKg) / 2;
        const ratio = context.weightKg / midWeight;
        dmIntake *= Math.pow(ratio, 0.75);
      }

      if (context.milkYieldLitersPerDay && req.productionTargets.milkYieldLiters) {
        const yieldRatio = context.milkYieldLitersPerDay / req.productionTargets.milkYieldLiters;
        dmIntake *= (1 + (yieldRatio - 1) * 0.3);
      }

      return Math.round(dmIntake * 10) / 10;
    }

    if (req.dmIntake.percentBw != null && context.weightKg) {
      return Math.round((context.weightKg * req.dmIntake.percentBw / 100) * 10) / 10;
    }

    return this.estimateDmIntake(context);
  }

  private estimateDmIntake(context: LivestockContext): number {
    const defaults: Record<LivestockSpecies, number> = {
      COW: 12,
      GOAT: 1.2,
      SHEEP: 1.5,
      BUFFALO: 14,
      CHICKEN: 0.12,
      DUCK: 0.15,
      PIGEON: 0.04,
      HORSE: 10,
      CUSTOM: 5,
      OTHER: 5,
    };

    return defaults[context.species] ?? 5;
  }

  private calculateConfidence(
    req: NutrientRequirementView,
    context: LivestockContext,
  ): number {
    let confidence = 0.7;

    if (req.breedCategory === context.breedCategory) {
      confidence += 0.1;
    }

    if (context.weightKg && req.weightRange.minKg && req.weightRange.maxKg) {
      if (context.weightKg >= req.weightRange.minKg && context.weightKg <= req.weightRange.maxKg) {
        confidence += 0.1;
      }
    }

    if (req.cpPercent.min != null && req.tdnPercentMin != null) {
      confidence += 0.05;
    }

    return Math.min(0.95, confidence);
  }

  async matchIngredients(
    context: LivestockContext,
    availableIngredientCodes?: string[],
  ): Promise<IngredientMatch[]> {
    const ingredients = availableIngredientCodes
      ? await Promise.all(
          availableIngredientCodes.map((code) => this.feedKnowledge.getPublishedIngredient(code)),
        ).then((list) => list.filter((i): i is FeedIngredientView => i != null))
      : await this.feedKnowledge.getIngredientsBySpecies(context.species, 50);

    const matches: IngredientMatch[] = [];

    for (const ingredient of ingredients) {
      const exclusionReasons: string[] = [];
      const matchReasons: string[] = [];
      let matchScore = 0.5;

      if (ingredient.speciesRestrictions.includes(context.species)) {
        exclusionReasons.push(`Species restriction for ${context.species}`);
        matchScore = 0;
      } else {
        matchScore += 0.1;
      }

      if (ingredient.bdAvailability === 'WIDELY_AVAILABLE') {
        matchScore += 0.15;
        matchReasons.push('Widely available in BD');
      } else if (ingredient.bdAvailability === 'RARELY_AVAILABLE') {
        matchScore -= 0.1;
      }

      const stageInclusion = ingredient.maxInclusions.find(
        (inc) => inc.species === context.species && inc.productionStage === context.productionStage,
      );
      if (stageInclusion) {
        matchScore += 0.1;
        matchReasons.push(`Suitable for ${context.productionStage}`);
      }

      if (ingredient.composition.cpPercent && ingredient.composition.cpPercent >= 15) {
        matchReasons.push('Good protein source');
        matchScore += 0.05;
      }

      if (ingredient.composition.tdnPercent && ingredient.composition.tdnPercent >= 70) {
        matchReasons.push('High energy');
        matchScore += 0.05;
      }

      if (ingredient.antinutrients.length > 0) {
        matchScore -= 0.05;
        matchReasons.push(`Contains antinutrients: ${ingredient.antinutrients.map((a) => a.compound).join(', ')}`);
      }

      matches.push({
        ingredient,
        matchScore: Math.max(0, Math.min(1, matchScore)),
        matchReasons,
        exclusionReasons,
        maxInclusionPercent: stageInclusion?.maxPercentDm ?? null,
      });
    }

    return matches
      .filter((m) => m.exclusionReasons.length === 0)
      .sort((a, b) => b.matchScore - a.matchScore);
  }

  async buildFormulationConstraints(
    context: LivestockContext,
    ingredientCodes: string[],
  ): Promise<FormulationConstraint[]> {
    const constraints: FormulationConstraint[] = [];

    for (const code of ingredientCodes) {
      const ingredient = await this.feedKnowledge.getPublishedIngredient(code);
      if (!ingredient) continue;

      const stageInclusion = ingredient.maxInclusions.find(
        (inc) => inc.species === context.species && inc.productionStage === context.productionStage,
      );

      if (stageInclusion) {
        constraints.push({
          ingredientCode: code,
          constraintType: 'max',
          value: stageInclusion.maxPercentDm,
          reason: stageInclusion.reason ?? 'Maximum inclusion limit',
        });
      }

      for (const antinutrient of ingredient.antinutrients) {
        if (antinutrient.mitigation?.toLowerCase().includes('limit')) {
          constraints.push({
            ingredientCode: code,
            constraintType: 'max',
            value: 15,
            reason: `Antinutrient limit: ${antinutrient.compound}`,
          });
        }
      }
    }

    return constraints;
  }

  inferProductionStage(params: {
    species: LivestockSpecies;
    ageMonths?: number;
    isLactating?: boolean;
    milkYieldLiters?: number;
    isPregnant?: boolean;
    gestationWeek?: number;
  }): ProductionStage {
    const { species, ageMonths, isLactating, milkYieldLiters, isPregnant, gestationWeek } = params;

    if (species === 'CHICKEN' || species === 'DUCK') {
      if (ageMonths && ageMonths < 1) return 'STARTER';
      if (ageMonths && ageMonths < 2) return 'GROWING';
      if (ageMonths && ageMonths < 5) return 'FINISHER';
      if (isLactating || (ageMonths && ageMonths >= 5)) return 'LAYING';
      return 'GROWING';
    }

    if (species === 'COW' || species === 'BUFFALO') {
      if (ageMonths && ageMonths < 3) return 'CALF_PRE_WEANING';
      if (ageMonths && ageMonths < 6) return 'CALF_POST_WEANING';
      if (ageMonths && ageMonths < 15) return 'GROWING';

      if (isLactating && milkYieldLiters) {
        if (milkYieldLiters >= 12) return 'EARLY_LACTATION';
        if (milkYieldLiters >= 6) return 'MID_LACTATION';
        return 'LATE_LACTATION';
      }

      if (isPregnant) {
        if (gestationWeek && gestationWeek > 36) return 'LATE_PREGNANT';
        return 'PREGNANT';
      }

      return 'MAINTENANCE';
    }

    if (species === 'GOAT' || species === 'SHEEP') {
      if (ageMonths && ageMonths < 4) return 'GROWING';
      if (isLactating) return 'EARLY_LACTATION';
      if (isPregnant) return 'PREGNANT';
      return 'MAINTENANCE';
    }

    return 'MAINTENANCE';
  }
}

let service: NutritionalIntelligenceService | undefined;

export function getNutritionalIntelligenceService(): NutritionalIntelligenceService {
  if (!service) {
    service = new NutritionalIntelligenceService();
  }
  return service;
}
