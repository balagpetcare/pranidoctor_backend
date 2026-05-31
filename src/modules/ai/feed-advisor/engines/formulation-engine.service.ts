import { randomUUID } from 'crypto';
import type { FormulationStatus } from '../../../../generated/prisma/index.js';
import { getFeedKnowledgeService } from '../../feed-knowledge/feed-knowledge.service.js';
import type { FeedIngredientView } from '../../feed-knowledge/feed-knowledge.types.js';
import { getNutritionalIntelligenceService, type LivestockContext, type NutrientProfile } from '../knowledge/nutritional-intelligence.service.js';
import type {
  FormulationRequestInput,
  FormulationSolution,
  FormulationContext,
  FormulationIngredient,
  FormulationWarning,
  OptimizedRation,
  RationComponent,
  NutrientComposition,
  NutrientMetStatus,
  LpProblem,
  LpVariable,
  LpConstraint,
} from './formulation-types.js';
import { getLpSolver } from './lp-solver.js';
import {
  FEED_FORMULATION_WARNINGS,
  FORMULATION_EXPLANATIONS,
} from './formulation.constants.js';

export class FormulationEngineService {
  private feedKnowledge = getFeedKnowledgeService();
  private nutritionalIntel = getNutritionalIntelligenceService();
  private lpSolver = getLpSolver();

  async formulateRation(input: FormulationRequestInput): Promise<FormulationSolution> {
    const warnings: FormulationWarning[] = [];
    const vklCitations: string[] = [];

    const profile = await this.nutritionalIntel.getNutrientProfile(input.context);
    if (!profile) {
      return this.createFailedSolution('NO_PROFILE', warnings);
    }
    vklCitations.push('VKL:NutrientRequirement');

    const ingredients = await this.resolveIngredients(input, warnings);
    if (ingredients.size === 0) {
      return this.createFailedSolution('NO_INGREDIENTS', warnings);
    }
    vklCitations.push('VKL:FeedIngredient');

    const constraints = await this.nutritionalIntel.buildFormulationConstraints(
      input.context,
      Array.from(ingredients.keys()),
    );

    const context: FormulationContext = {
      request: input,
      profile,
      ingredients,
      constraints,
      objectives: [
        { type: 'minimize_cost', weight: input.preferences?.prioritizeCost ? 1.0 : 0.7 },
        { type: 'balance', weight: 0.3 },
      ],
    };

    this.validateContext(context, warnings);

    const lpProblem = this.buildLpProblem(context);
    const lpSolution = this.lpSolver.solve(lpProblem);

    if (lpSolution.status !== 'optimal') {
      warnings.push(FEED_FORMULATION_WARNINGS.INFEASIBLE_SOLUTION);
      const fallbackRation = await this.attemptFallbackFormulation(context, warnings);
      return {
        status: 'FAILED' as FormulationStatus,
        optimizedRation: fallbackRation,
        alternativeRations: [],
        warnings,
        vklCitations,
        confidenceScore: fallbackRation ? 0.5 : 0,
        explanationBn: FORMULATION_EXPLANATIONS.FALLBACK_BN,
        explanationEn: FORMULATION_EXPLANATIONS.FALLBACK_EN,
      };
    }

    const optimizedRation = this.buildOptimizedRation(
      context,
      lpSolution.variables,
      lpSolution.objectiveValue,
    );

    const nutrientMet = this.evaluateNutrientMet(optimizedRation, profile);
    optimizedRation.nutrientMet = nutrientMet;

    this.addNutrientWarnings(nutrientMet, warnings);

    const alternatives = await this.generateAlternatives(context, optimizedRation);

    const confidence = this.calculateConfidence(optimizedRation, warnings, profile);

    return {
      status: 'COMPLETED' as FormulationStatus,
      optimizedRation,
      alternativeRations: alternatives,
      warnings,
      vklCitations,
      confidenceScore: confidence,
      explanationBn: this.generateExplanationBn(optimizedRation, input.context),
      explanationEn: this.generateExplanationEn(optimizedRation, input.context),
    };
  }

  private async resolveIngredients(
    input: FormulationRequestInput,
    warnings: FormulationWarning[],
  ): Promise<Map<string, FormulationIngredient>> {
    const ingredients = new Map<string, FormulationIngredient>();

    for (const avail of input.availableIngredients) {
      if (avail.forcedExclude) continue;

      const view = await this.feedKnowledge.getPublishedIngredient(avail.ingredientCode);
      if (!view) {
        warnings.push({
          code: 'INGREDIENT_NOT_FOUND',
          severity: 'warning',
          messageBn: `${avail.ingredientCode} পাওয়া যায়নি`,
          messageEn: `Ingredient ${avail.ingredientCode} not found in knowledge base`,
          relatedIngredients: [avail.ingredientCode],
        });
        continue;
      }

      if (view.speciesRestrictions.includes(input.context.species)) {
        warnings.push({
          code: 'SPECIES_RESTRICTION',
          severity: 'warning',
          messageBn: `${view.primaryName} ${input.context.species} এর জন্য উপযুক্ত নয়`,
          messageEn: `${view.primaryName} not suitable for ${input.context.species}`,
          relatedIngredients: [avail.ingredientCode],
        });
        continue;
      }

      const maxIncl = view.maxInclusions.find(
        (m) => m.species === input.context.species && m.productionStage === input.context.productionStage,
      );

      const pricePerKg = avail.priceOverrideTkPerKg ?? view.bdPriceTkPerKg ?? 50;

      ingredients.set(avail.ingredientCode, {
        code: avail.ingredientCode,
        name: view.primaryName,
        view,
        pricePerKg,
        availableKg: avail.availableKg ?? null,
        isRoughage: this.isRoughage(view),
        minInclusionPercent: avail.forcedInclude ? 1 : 0,
        maxInclusionPercent: maxIncl?.maxPercentDm ?? 100,
        forcedInclude: avail.forcedInclude ?? false,
        forcedExclude: false,
      });
    }

    return ingredients;
  }

  private isRoughage(view: FeedIngredientView): boolean {
    const roughageCategories = ['FODDER_GREEN', 'FODDER_DRY', 'STRAW', 'SILAGE', 'HAY'];
    return roughageCategories.includes(view.category);
  }

  private validateContext(context: FormulationContext, warnings: FormulationWarning[]): void {
    const { profile, ingredients, request } = context;

    if (request.preferences?.roughageConcentrateRatio) {
      const roughageCount = Array.from(ingredients.values()).filter((i) => i.isRoughage).length;
      const concentrateCount = ingredients.size - roughageCount;

      if (roughageCount === 0) {
        warnings.push(FEED_FORMULATION_WARNINGS.NO_ROUGHAGE);
      }
      if (concentrateCount === 0) {
        warnings.push(FEED_FORMULATION_WARNINGS.NO_CONCENTRATE);
      }
    }

    const hasProteinSource = Array.from(ingredients.values()).some(
      (i) => (i.view.composition.cpPercent ?? 0) >= 15,
    );
    if (!hasProteinSource) {
      warnings.push(FEED_FORMULATION_WARNINGS.LOW_PROTEIN_SOURCES);
    }

    if (request.budgetConstraints?.maxCostPerKgTk) {
      const minCost = Math.min(...Array.from(ingredients.values()).map((i) => i.pricePerKg));
      if (minCost > request.budgetConstraints.maxCostPerKgTk) {
        warnings.push(FEED_FORMULATION_WARNINGS.BUDGET_TOO_LOW);
      }
    }
  }

  private buildLpProblem(context: FormulationContext): LpProblem {
    const { profile, ingredients, request, constraints } = context;
    const targetBatchKg = request.budgetConstraints?.targetBatchKg ?? 100;

    const variables: LpVariable[] = [];
    const lpConstraints: LpConstraint[] = [];

    for (const [code, ing] of ingredients) {
      variables.push({
        name: code,
        lowerBound: (ing.minInclusionPercent / 100) * targetBatchKg,
        upperBound: Math.min(
          (ing.maxInclusionPercent / 100) * targetBatchKg,
          ing.availableKg ?? Infinity,
        ),
        coefficient: ing.pricePerKg,
      });
    }

    const totalConstraintVars = Array.from(ingredients.keys()).map((code) => ({
      name: code,
      coefficient: 1,
    }));
    lpConstraints.push({
      name: 'total_batch',
      variables: totalConstraintVars,
      relation: 'eq',
      rhs: targetBatchKg,
    });

    for (const target of profile.targets) {
      const nutrientKey = this.mapNutrientToCompositionKey(target.nutrient);
      if (!nutrientKey) continue;

      const constraintVars: { name: string; coefficient: number }[] = [];
      for (const [code, ing] of ingredients) {
        const nutrientValue = ing.view.composition[nutrientKey as keyof typeof ing.view.composition] as number ?? 0;
        const dmPercent = (ing.view.composition.dmPercent ?? 90) / 100;
        constraintVars.push({
          name: code,
          coefficient: nutrientValue * dmPercent,
        });
      }

      lpConstraints.push({
        name: `${target.nutrient}_min`,
        variables: constraintVars,
        relation: 'ge',
        rhs: target.minValue * targetBatchKg / 100,
      });

      if (target.maxValue != null) {
        lpConstraints.push({
          name: `${target.nutrient}_max`,
          variables: constraintVars,
          relation: 'le',
          rhs: target.maxValue * targetBatchKg / 100,
        });
      }
    }

    for (const c of constraints) {
      const ing = ingredients.get(c.ingredientCode);
      if (!ing) continue;

      lpConstraints.push({
        name: `constraint_${c.ingredientCode}`,
        variables: [{ name: c.ingredientCode, coefficient: 1 }],
        relation: c.constraintType === 'max' ? 'le' : c.constraintType === 'min' ? 'ge' : 'eq',
        rhs: (c.value / 100) * targetBatchKg,
      });
    }

    if (request.preferences?.roughageConcentrateRatio) {
      const { roughagePercent } = request.preferences.roughageConcentrateRatio;

      const roughageVars: { name: string; coefficient: number }[] = [];
      for (const [code, ing] of ingredients) {
        if (ing.isRoughage) {
          roughageVars.push({ name: code, coefficient: 1 });
        }
      }

      if (roughageVars.length > 0) {
        lpConstraints.push({
          name: 'roughage_min',
          variables: roughageVars,
          relation: 'ge',
          rhs: (roughagePercent / 100) * targetBatchKg * 0.9,
        });
        lpConstraints.push({
          name: 'roughage_max',
          variables: roughageVars,
          relation: 'le',
          rhs: (roughagePercent / 100) * targetBatchKg * 1.1,
        });
      }
    }

    if (request.budgetConstraints?.maxCostPerKgTk) {
      const costVars: { name: string; coefficient: number }[] = [];
      for (const [code, ing] of ingredients) {
        costVars.push({ name: code, coefficient: ing.pricePerKg });
      }
      lpConstraints.push({
        name: 'max_cost',
        variables: costVars,
        relation: 'le',
        rhs: request.budgetConstraints.maxCostPerKgTk * targetBatchKg,
      });
    }

    return {
      objective: 'minimize',
      variables,
      constraints: lpConstraints,
    };
  }

  private mapNutrientToCompositionKey(nutrient: string): string | null {
    const mapping: Record<string, string> = {
      'CP': 'cpPercent',
      'TDN': 'tdnPercent',
      'ME': 'meMinMjPerKg',
      'NDF': 'ndfPercent',
      'ADF': 'adfPercent',
      'CF': 'cfPercent',
      'Ca': 'caPercent',
      'P': 'pPercent',
    };
    return mapping[nutrient] ?? null;
  }

  private buildOptimizedRation(
    context: FormulationContext,
    variableValues: Map<string, number>,
    objectiveValue: number,
  ): OptimizedRation {
    const components: RationComponent[] = [];
    let totalKg = 0;
    let totalCost = 0;

    for (const [code, amountKg] of variableValues) {
      if (amountKg < 0.001) continue;

      const ing = context.ingredients.get(code);
      if (!ing) continue;

      const costTk = amountKg * ing.pricePerKg;
      totalKg += amountKg;
      totalCost += costTk;

      components.push({
        ingredientCode: code,
        ingredientName: ing.name,
        amountKg: Math.round(amountKg * 100) / 100,
        percentDm: 0,
        costTk: Math.round(costTk * 100) / 100,
        isRoughage: ing.isRoughage,
        evidenceGrade: ing.view.evidenceGrade ?? 'C',
      });
    }

    for (const comp of components) {
      comp.percentDm = Math.round((comp.amountKg / totalKg) * 10000) / 100;
    }

    const nutrientComp = this.calculateNutrientComposition(components, context.ingredients);

    return {
      id: randomUUID(),
      ingredients: components.sort((a, b) => b.percentDm - a.percentDm),
      totalKg: Math.round(totalKg * 100) / 100,
      costPerKgTk: Math.round((totalCost / totalKg) * 100) / 100,
      totalCostTk: Math.round(totalCost * 100) / 100,
      nutrientComposition: nutrientComp,
      nutrientMet: [],
      rationScore: 0,
    };
  }

  private calculateNutrientComposition(
    components: RationComponent[],
    ingredients: Map<string, FormulationIngredient>,
  ): NutrientComposition {
    const totalKg = components.reduce((s, c) => s + c.amountKg, 0);

    let cp = 0, tdn = 0, me = 0, ndf = 0, ca = 0, p = 0, cf = 0, dm = 0;

    for (const comp of components) {
      const ing = ingredients.get(comp.ingredientCode);
      if (!ing) continue;

      const fraction = comp.amountKg / totalKg;
      const c = ing.view.composition;

      cp += (c.cpPercent ?? 0) * fraction;
      tdn += (c.tdnPercent ?? 0) * fraction;
      me += (c.meMinMjPerKg ?? 0) * fraction;
      ndf += (c.ndfPercent ?? 0) * fraction;
      ca += (c.caPercent ?? 0) * fraction;
      p += (c.pPercent ?? 0) * fraction;
      cf += (c.cfPercent ?? 0) * fraction;
      dm += (c.dmPercent ?? 90) * fraction;
    }

    return {
      dmPercent: Math.round(dm * 100) / 100,
      cpPercent: Math.round(cp * 100) / 100,
      tdnPercent: Math.round(tdn * 100) / 100,
      meMjPerKg: Math.round(me * 100) / 100,
      ndfPercent: Math.round(ndf * 100) / 100,
      caPercent: Math.round(ca * 1000) / 1000,
      pPercent: Math.round(p * 1000) / 1000,
      cfPercent: Math.round(cf * 100) / 100,
    };
  }

  private evaluateNutrientMet(
    ration: OptimizedRation,
    profile: NutrientProfile,
  ): NutrientMetStatus[] {
    const results: NutrientMetStatus[] = [];
    const comp = ration.nutrientComposition;

    for (const target of profile.targets) {
      let achieved: number;
      switch (target.nutrient) {
        case 'CP': achieved = comp.cpPercent; break;
        case 'TDN': achieved = comp.tdnPercent; break;
        case 'ME': achieved = comp.meMjPerKg; break;
        case 'NDF': achieved = comp.ndfPercent; break;
        case 'Ca': achieved = comp.caPercent; break;
        case 'P': achieved = comp.pPercent; break;
        default: continue;
      }

      let metStatus: NutrientMetStatus['metStatus'];
      let deviation: number;

      if (achieved < target.minValue) {
        metStatus = 'below_min';
        deviation = target.minValue - achieved;
      } else if (target.maxValue != null && achieved > target.maxValue) {
        metStatus = 'above_max';
        deviation = achieved - target.maxValue;
      } else if (achieved >= target.minValue * 1.1) {
        metStatus = 'exceeded';
        deviation = achieved - target.minValue;
      } else {
        metStatus = 'met';
        deviation = 0;
      }

      results.push({
        nutrient: target.nutrient,
        target: target.minValue,
        achieved: Math.round(achieved * 100) / 100,
        unit: target.unit,
        metStatus,
        deviation: Math.round(deviation * 100) / 100,
      });
    }

    return results;
  }

  private addNutrientWarnings(
    nutrientMet: NutrientMetStatus[],
    warnings: FormulationWarning[],
  ): void {
    for (const nm of nutrientMet) {
      if (nm.metStatus === 'below_min') {
        warnings.push({
          code: `NUTRIENT_DEFICIENT_${nm.nutrient}`,
          severity: 'warning',
          messageBn: `${nm.nutrient} লক্ষ্যমাত্রার চেয়ে ${nm.deviation}${nm.unit} কম`,
          messageEn: `${nm.nutrient} is ${nm.deviation}${nm.unit} below target`,
        });
      }
    }
  }

  private async attemptFallbackFormulation(
    context: FormulationContext,
    warnings: FormulationWarning[],
  ): Promise<OptimizedRation | null> {
    const totalKg = context.request.budgetConstraints?.targetBatchKg ?? 100;
    const ingredientList = Array.from(context.ingredients.values());

    if (ingredientList.length === 0) return null;

    const components: RationComponent[] = [];
    const equalShare = totalKg / ingredientList.length;

    let totalCost = 0;
    for (const ing of ingredientList) {
      const amount = Math.min(
        equalShare,
        (ing.maxInclusionPercent / 100) * totalKg,
        ing.availableKg ?? Infinity,
      );
      const cost = amount * ing.pricePerKg;
      totalCost += cost;

      components.push({
        ingredientCode: ing.code,
        ingredientName: ing.name,
        amountKg: Math.round(amount * 100) / 100,
        percentDm: Math.round((amount / totalKg) * 10000) / 100,
        costTk: Math.round(cost * 100) / 100,
        isRoughage: ing.isRoughage,
        evidenceGrade: ing.view.evidenceGrade ?? 'C',
      });
    }

    const nutrientComp = this.calculateNutrientComposition(components, context.ingredients);

    warnings.push({
      code: 'FALLBACK_FORMULA',
      severity: 'warning',
      messageBn: 'সর্বোত্তম ফর্মুলা খুঁজে পাওয়া যায়নি, সমান অংশের মিশ্রণ ব্যবহার করা হয়েছে',
      messageEn: 'Optimal formula not found, using equal-parts mixture',
    });

    return {
      id: randomUUID(),
      ingredients: components,
      totalKg,
      costPerKgTk: Math.round((totalCost / totalKg) * 100) / 100,
      totalCostTk: Math.round(totalCost * 100) / 100,
      nutrientComposition: nutrientComp,
      nutrientMet: [],
      rationScore: 0.3,
    };
  }

  private async generateAlternatives(
    context: FormulationContext,
    primary: OptimizedRation,
  ): Promise<OptimizedRation[]> {
    const alternatives: OptimizedRation[] = [];

    const economyContext = { ...context };
    economyContext.objectives = [{ type: 'minimize_cost' as const, weight: 1.0 }];

    return alternatives;
  }

  private calculateConfidence(
    ration: OptimizedRation,
    warnings: FormulationWarning[],
    profile: NutrientProfile,
  ): number {
    let confidence = profile.confidenceScore;

    const criticalWarnings = warnings.filter((w) => w.severity === 'critical').length;
    const regularWarnings = warnings.filter((w) => w.severity === 'warning').length;

    confidence -= criticalWarnings * 0.15;
    confidence -= regularWarnings * 0.05;

    const belowMinCount = ration.nutrientMet.filter((n) => n.metStatus === 'below_min').length;
    confidence -= belowMinCount * 0.1;

    const avgGrade = ration.ingredients.reduce((sum, i) => {
      const gradeValue = { A: 1, B: 0.8, C: 0.6, D: 0.4 }[i.evidenceGrade] ?? 0.5;
      return sum + gradeValue;
    }, 0) / ration.ingredients.length;

    confidence *= avgGrade;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private generateExplanationBn(ration: OptimizedRation, context: LivestockContext): string {
    const topIngredients = ration.ingredients.slice(0, 3).map((i) => i.ingredientName).join(', ');
    return `এই খাদ্য মিশ্রণে ${topIngredients} প্রধান উপাদান হিসেবে ব্যবহার করা হয়েছে। ` +
      `প্রতি কেজি খরচ ${ration.costPerKgTk} টাকা এবং প্রোটিন ${ration.nutrientComposition.cpPercent}%।`;
  }

  private generateExplanationEn(ration: OptimizedRation, context: LivestockContext): string {
    const topIngredients = ration.ingredients.slice(0, 3).map((i) => i.ingredientName).join(', ');
    return `This ration uses ${topIngredients} as primary ingredients. ` +
      `Cost is ${ration.costPerKgTk} Tk/kg with ${ration.nutrientComposition.cpPercent}% CP.`;
  }

  private createFailedSolution(
    reason: string,
    warnings: FormulationWarning[],
  ): FormulationSolution {
    warnings.push({
      code: reason,
      severity: 'critical',
      messageBn: reason === 'NO_PROFILE' 
        ? 'পুষ্টি চাহিদা প্রোফাইল পাওয়া যায়নি'
        : 'কোনো উপাদান পাওয়া যায়নি',
      messageEn: reason === 'NO_PROFILE'
        ? 'Nutrient profile not found'
        : 'No ingredients available',
    });

    return {
      status: 'FAILED' as FormulationStatus,
      optimizedRation: null,
      alternativeRations: [],
      warnings,
      vklCitations: [],
      confidenceScore: 0,
      explanationBn: 'খাদ্য তৈরি করা সম্ভব হয়নি',
      explanationEn: 'Unable to formulate ration',
    };
  }
}

let service: FormulationEngineService | undefined;

export function getFormulationEngineService(): FormulationEngineService {
  if (!service) {
    service = new FormulationEngineService();
  }
  return service;
}
