import { randomUUID } from 'crypto';
import type { FeedAdvisorSessionState } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getFeedKnowledgeService } from '../feed-knowledge/feed-knowledge.service.js';
import { getNutritionalIntelligenceService, type LivestockContext } from './knowledge/nutritional-intelligence.service.js';
import { getFormulationEngineService } from './engines/formulation-engine.service.js';
import { getIntentClassifierService } from './intent-classifier.service.js';
import type {
  FeedAdvisorQuery,
  FeedAdvisorResponse,
  FeedAdvisorIntent,
  FeedAdvisorStructuredData,
  FeedAdvisorSessionData,
  IngredientListData,
  NutrientInfoData,
  ToxicAlertData,
  FEED_ADVISOR_SAFETY_THRESHOLDS,
  FEED_ADVISOR_DISCLAIMERS,
} from './feed-advisor.types.js';
import type { FormulationSolution, IngredientAvailability } from './engines/formulation-types.js';
import {
  FEED_ADVISOR_FEATURE,
  FEED_ADVISOR_TASK_TYPE,
  FEED_SAFETY_DISCLAIMERS,
} from '../feed-knowledge/feed-knowledge.constants.js';

const SAFETY_THRESHOLDS = {
  MIN_CONFIDENCE_FOR_FORMULATION: 0.7,
  MIN_CONFIDENCE_FOR_ADVICE: 0.5,
  ESCALATION_THRESHOLD: 0.4,
  TOXIC_ALERT_PRIORITY: 1.0,
} as const;

const DISCLAIMERS = {
  BN: {
    GENERAL: 'এই পরামর্শ শুধুমাত্র তথ্যমূলক। গুরুতর সমস্যায় পশু চিকিৎসকের সাথে পরামর্শ করুন।',
    FORMULATION: 'খাদ্য মিশ্রণ স্থানীয় পরিস্থিতি অনুযায়ী সমন্বয় করুন।',
    TOXIC: '⚠️ বিষাক্ততার ঝুঁকি - অবিলম্বে পশু চিকিৎসকের সাথে যোগাযোগ করুন।',
  },
  EN: {
    GENERAL: 'This advice is informational only. Consult a veterinarian for serious issues.',
    FORMULATION: 'Adjust feed mixture based on local conditions.',
    TOXIC: '⚠️ Toxicity risk - contact a veterinarian immediately.',
  },
} as const;

export class FeedAdvisorOrchestratorService {
  private feedKnowledge = getFeedKnowledgeService();
  private nutritionalIntel = getNutritionalIntelligenceService();
  private formulator = getFormulationEngineService();
  private intentClassifier = getIntentClassifierService();

  async processQuery(query: FeedAdvisorQuery): Promise<FeedAdvisorResponse> {
    const sessionId = query.sessionId ?? randomUUID();
    const lang = query.queryLanguage;

    const classification = this.intentClassifier.classifyIntent(query.queryText);

    if (classification.intent === 'OUT_OF_SCOPE') {
      return this.createOutOfScopeResponse(sessionId, lang);
    }

    if (classification.intent === 'CLARIFICATION_NEEDED') {
      const clarification = this.intentClassifier.suggestClarification(
        classification.intent,
        classification.entities,
        lang,
      );
      return this.createClarificationResponse(sessionId, clarification, lang);
    }

    if (classification.intent === 'TOXIC_CHECK') {
      return await this.handleToxicCheck(sessionId, query, classification.entities);
    }

    const livestockContext = this.buildLivestockContext(query, classification.entities);

    let structuredData: FeedAdvisorStructuredData = { type: 'none', data: null };
    let responseText = '';
    let citations: string[] = [];
    let confidenceScore = classification.confidence;
    const disclaimers: string[] = [DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].GENERAL];
    let escalationRequired = false;
    let escalationReason: string | undefined;

    switch (classification.intent) {
      case 'FORMULATION_REQUEST':
        if (livestockContext && confidenceScore >= SAFETY_THRESHOLDS.MIN_CONFIDENCE_FOR_FORMULATION) {
          const result = await this.handleFormulationRequest(
            query,
            livestockContext,
            classification.entities.ingredients,
          );
          structuredData = { type: 'formulation', data: result };
          responseText = this.formatFormulationResponse(result, lang);
          citations = result.vklCitations;
          confidenceScore = result.confidenceScore;
          disclaimers.push(DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].FORMULATION);
        } else {
          const clarification = this.intentClassifier.suggestClarification(
            'FORMULATION_REQUEST',
            classification.entities,
            lang,
          );
          return this.createClarificationResponse(sessionId, clarification, lang);
        }
        break;

      case 'INGREDIENT_INQUIRY':
        const ingredientResult = await this.handleIngredientInquiry(
          classification.entities.ingredients,
          livestockContext,
        );
        structuredData = { type: 'ingredient_list', data: ingredientResult };
        responseText = this.formatIngredientResponse(ingredientResult, lang);
        citations.push('VKL:FeedIngredient');
        break;

      case 'NUTRIENT_INQUIRY':
        const nutrientResult = await this.handleNutrientInquiry(
          classification.entities.nutrients ?? [],
          livestockContext,
        );
        structuredData = { type: 'nutrient_info', data: nutrientResult };
        responseText = this.formatNutrientResponse(nutrientResult, lang);
        citations.push('VKL:NutrientRequirement');
        break;

      case 'PRICE_INQUIRY':
        const priceResult = await this.handlePriceInquiry(
          classification.entities.ingredients,
          livestockContext,
        );
        structuredData = { type: 'price_comparison', data: priceResult };
        responseText = this.formatPriceResponse(priceResult, lang);
        citations.push('VKL:FeedIngredient');
        break;

      case 'SEASONAL_AVAILABILITY':
        const seasonalResult = await this.handleSeasonalInquiry();
        structuredData = { type: 'seasonal_calendar', data: seasonalResult };
        responseText = this.formatSeasonalResponse(seasonalResult, lang);
        citations.push('VKL:SeasonalFeedCalendar');
        break;

      default:
        responseText = await this.handleGeneralAdvice(query.queryText, lang);
        citations.push('VKL:General');
    }

    if (confidenceScore < SAFETY_THRESHOLDS.ESCALATION_THRESHOLD) {
      escalationRequired = true;
      escalationReason = lang === 'bn'
        ? 'এই প্রশ্নের জন্য বিশেষজ্ঞ পরামর্শ প্রয়োজন'
        : 'Expert consultation recommended for this query';
    }

    const followUpQuestions = this.generateFollowUpQuestions(classification.intent, lang);

    return {
      sessionId,
      responseText,
      responseBn: lang === 'bn' ? responseText : await this.translateToEnglish(responseText),
      responseEn: lang === 'en' ? responseText : responseText,
      intent: classification.intent,
      structuredData,
      citations,
      followUpQuestions,
      confidenceScore,
      disclaimers,
      escalationRequired,
      escalationReason,
    };
  }

  private buildLivestockContext(
    query: FeedAdvisorQuery,
    entities: { species?: string; productionStage?: string },
  ): LivestockContext | null {
    if (query.context?.livestock) {
      return query.context.livestock;
    }

    if (!entities.species) {
      return null;
    }

    const species = entities.species as LivestockContext['species'];
    const productionStage = (entities.productionStage ?? 'MAINTENANCE') as LivestockContext['productionStage'];

    return {
      species,
      productionStage,
    };
  }

  private async handleFormulationRequest(
    query: FeedAdvisorQuery,
    context: LivestockContext,
    ingredientNames?: string[],
  ): Promise<FormulationSolution> {
    let availableIngredients: IngredientAvailability[] = [];

    if (ingredientNames && ingredientNames.length > 0) {
      const mappedCodes = await this.mapIngredientNamesToCode(ingredientNames);
      availableIngredients = mappedCodes.map((code) => ({ ingredientCode: code }));
    } else {
      const defaultIngredients = await this.feedKnowledge.getIngredientsBySpecies(context.species, 10);
      availableIngredients = defaultIngredients.map((i) => ({ ingredientCode: i.code }));
    }

    const result = await this.formulator.formulateRation({
      customerId: query.customerId,
      livestockId: query.context?.livestockId,
      context,
      availableIngredients,
      budgetConstraints: query.context?.budgetTkPerDay
        ? { maxCostPerKgTk: query.context.budgetTkPerDay }
        : undefined,
    });

    return result;
  }

  private async mapIngredientNamesToCode(names: string[]): Promise<string[]> {
    const codes: string[] = [];
    const nameToCode: Record<string, string> = {
      'ভুট্টা': 'MAIZE-GRAIN',
      'maize': 'MAIZE-GRAIN',
      'corn': 'MAIZE-GRAIN',
      'সয়াবিন': 'SOYBEAN-MEAL',
      'soybean': 'SOYBEAN-MEAL',
      'গমের ভুষি': 'WHEAT-BRAN',
      'wheat bran': 'WHEAT-BRAN',
      'চালের কুড়া': 'RICE-BRAN',
      'rice bran': 'RICE-BRAN',
      'সরিষার খৈল': 'MUSTARD-CAKE',
      'mustard cake': 'MUSTARD-CAKE',
      'খড়': 'RICE-STRAW',
      'straw': 'RICE-STRAW',
      'ঘাস': 'NAPIER-GRASS',
      'grass': 'NAPIER-GRASS',
      'fodder': 'NAPIER-GRASS',
    };

    for (const name of names) {
      const code = nameToCode[name.toLowerCase()];
      if (code) {
        codes.push(code);
      }
    }

    return codes;
  }

  private async handleIngredientInquiry(
    ingredientNames?: string[],
    context?: LivestockContext | null,
  ): Promise<IngredientListData> {
    let ingredients = [];

    if (ingredientNames && ingredientNames.length > 0) {
      const codes = await this.mapIngredientNamesToCode(ingredientNames);
      for (const code of codes) {
        const ing = await this.feedKnowledge.getPublishedIngredient(code);
        if (ing) {
          ingredients.push(ing);
        }
      }
    } else if (context) {
      ingredients = await this.feedKnowledge.getIngredientsBySpecies(context.species, 10);
    } else {
      ingredients = await this.feedKnowledge.listIngredients(10);
    }

    return {
      ingredients: ingredients.map((i) => ({
        code: i.code,
        name: i.primaryName,
        localNames: i.localNames,
        cpPercent: i.composition.cpPercent ?? null,
        tdnPercent: i.composition.tdnPercent ?? null,
        priceTkPerKg: i.bdPriceTkPerKg ?? null,
        availability: i.bdAvailability ?? 'UNKNOWN',
      })),
    };
  }

  private async handleNutrientInquiry(
    nutrients: string[],
    context?: LivestockContext | null,
  ): Promise<NutrientInfoData> {
    const nutrient = nutrients[0] ?? 'CP';
    let requirement = null;

    if (context) {
      const profile = await this.nutritionalIntel.getNutrientProfile(context);
      if (profile) {
        const target = profile.targets.find((t) => t.nutrient === nutrient);
        if (target) {
          requirement = {
            species: context.species,
            stage: context.productionStage,
            minValue: target.minValue,
            maxValue: target.maxValue,
            unit: target.unit,
          };
        }
      }
    }

    const sources: { ingredientName: string; value: number }[] = [];
    const ingredients = await this.feedKnowledge.listIngredients(20);

    for (const ing of ingredients) {
      let value: number | null = null;
      switch (nutrient) {
        case 'CP': value = ing.composition.cpPercent; break;
        case 'TDN': value = ing.composition.tdnPercent; break;
        case 'Ca': value = ing.composition.caPercent; break;
        case 'P': value = ing.composition.pPercent; break;
      }
      if (value != null && value > 0) {
        sources.push({ ingredientName: ing.primaryName, value });
      }
    }

    sources.sort((a, b) => b.value - a.value);

    return {
      nutrient,
      description: this.getNutrientDescription(nutrient),
      requirement,
      sources: sources.slice(0, 5),
    };
  }

  private getNutrientDescription(nutrient: string): string {
    const descriptions: Record<string, string> = {
      CP: 'Crude Protein - essential for growth, milk production, and reproduction',
      TDN: 'Total Digestible Nutrients - measure of energy content',
      ME: 'Metabolizable Energy - energy available for metabolism',
      NDF: 'Neutral Detergent Fiber - affects feed intake and digestion',
      Ca: 'Calcium - critical for bones, milk, and muscle function',
      P: 'Phosphorus - important for energy metabolism and bone health',
    };
    return descriptions[nutrient] ?? 'Essential nutrient';
  }

  private async handleToxicCheck(
    sessionId: string,
    query: FeedAdvisorQuery,
    entities: { ingredients?: string[] },
  ): Promise<FeedAdvisorResponse> {
    const lang = query.queryLanguage;
    const alerts: ToxicAlertData['alerts'] = [];

    if (entities.ingredients) {
      const codes = await this.mapIngredientNamesToCode(entities.ingredients);
      for (const code of codes) {
        const ing = await this.feedKnowledge.getPublishedIngredient(code);
        if (ing && ing.antinutrients.length > 0) {
          for (const anti of ing.antinutrients) {
            alerts.push({
              substance: anti.compound,
              affectedSpecies: ing.speciesRestrictions,
              threshold: `${anti.levelMgPerKg} mg/kg`,
              symptoms: [],
              emergencyAction: anti.mitigation ?? 'Reduce inclusion level',
            });
          }
        }
      }
    }

    const toxicIngredients = await this.feedKnowledge.checkToxicIngredients(
      entities.ingredients ?? [],
    );
    for (const toxic of toxicIngredients) {
      alerts.push({
        substance: toxic.substance,
        affectedSpecies: toxic.affectedSpecies,
        threshold: toxic.threshold,
        symptoms: toxic.symptoms,
        emergencyAction: toxic.emergencyAction,
      });
    }

    const responseText = alerts.length > 0
      ? (lang === 'bn'
        ? `⚠️ সতর্কতা: ${alerts.length}টি সম্ভাব্য বিষাক্ত উপাদান পাওয়া গেছে।`
        : `⚠️ Warning: ${alerts.length} potentially toxic substance(s) found.`)
      : (lang === 'bn'
        ? 'কোনো বিষাক্ত উপাদান পাওয়া যায়নি।'
        : 'No toxic substances detected.');

    return {
      sessionId,
      responseText,
      responseBn: lang === 'bn' ? responseText : '',
      responseEn: lang === 'en' ? responseText : '',
      intent: 'TOXIC_CHECK',
      structuredData: { type: 'toxic_alert', data: { alerts } },
      citations: ['VKL:ToxicFeedAlert'],
      followUpQuestions: [],
      confidenceScore: alerts.length > 0 ? 0.95 : 0.8,
      disclaimers: [DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].TOXIC],
      escalationRequired: alerts.length > 0,
      escalationReason: alerts.length > 0
        ? (lang === 'bn' ? 'বিষাক্ততার ঝুঁকি - পশু চিকিৎসক প্রয়োজন' : 'Toxicity risk - vet consultation needed')
        : undefined,
    };
  }

  private async handlePriceInquiry(
    ingredientNames?: string[],
    context?: LivestockContext | null,
  ): Promise<{ ingredients: { code: string; name: string; priceTkPerKg: number; volatility: string; costPerCpUnit: number }[] }> {
    const ingredientData = await this.handleIngredientInquiry(ingredientNames, context);

    return {
      ingredients: ingredientData.ingredients
        .filter((i) => i.priceTkPerKg != null)
        .map((i) => ({
          code: i.code,
          name: i.name,
          priceTkPerKg: i.priceTkPerKg!,
          volatility: 'STABLE',
          costPerCpUnit: i.cpPercent && i.cpPercent > 0
            ? Math.round((i.priceTkPerKg! / i.cpPercent) * 100) / 100
            : 0,
        }))
        .sort((a, b) => a.costPerCpUnit - b.costPerCpUnit),
    };
  }

  private async handleSeasonalInquiry(): Promise<{ month: number; ingredients: { code: string; name: string; availability: 'high' | 'medium' | 'low'; priceIndex: number }[] }> {
    const currentMonth = new Date().getMonth() + 1;

    const seasonalData = await this.feedKnowledge.getSeasonalCalendar(currentMonth);

    return {
      month: currentMonth,
      ingredients: seasonalData.map((s) => ({
        code: s.ingredientCode,
        name: s.ingredientCode,
        availability: s.availability as 'high' | 'medium' | 'low',
        priceIndex: s.priceMultiplier,
      })),
    };
  }

  private async handleGeneralAdvice(queryText: string, lang: 'bn' | 'en'): Promise<string> {
    return lang === 'bn'
      ? 'আপনার প্রশ্নের উত্তর দিতে আমার আরো তথ্য প্রয়োজন। দয়া করে পশুর প্রজাতি, বয়স এবং অবস্থা জানান।'
      : 'I need more information to answer your question. Please provide the animal species, age, and status.';
  }

  private formatFormulationResponse(result: FormulationSolution, lang: 'bn' | 'en'): string {
    if (!result.optimizedRation) {
      return lang === 'bn' ? result.explanationBn : result.explanationEn;
    }

    const ration = result.optimizedRation;
    const ingredients = ration.ingredients
      .slice(0, 5)
      .map((i) => `${i.ingredientName}: ${i.percentDm}%`)
      .join('\n');

    if (lang === 'bn') {
      return `খাদ্য মিশ্রণ (${ration.totalKg} কেজি):\n${ingredients}\n\nখরচ: ${ration.costPerKgTk} টাকা/কেজি\nপ্রোটিন: ${ration.nutrientComposition.cpPercent}%`;
    } else {
      return `Feed Ration (${ration.totalKg} kg):\n${ingredients}\n\nCost: ${ration.costPerKgTk} Tk/kg\nProtein: ${ration.nutrientComposition.cpPercent}%`;
    }
  }

  private formatIngredientResponse(data: IngredientListData, lang: 'bn' | 'en'): string {
    const list = data.ingredients
      .slice(0, 5)
      .map((i) => `• ${i.name} - CP: ${i.cpPercent ?? 'N/A'}%, ${i.priceTkPerKg ?? 'N/A'} Tk/kg`)
      .join('\n');

    return lang === 'bn'
      ? `পাওয়া গেছে ${data.ingredients.length}টি উপাদান:\n${list}`
      : `Found ${data.ingredients.length} ingredients:\n${list}`;
  }

  private formatNutrientResponse(data: NutrientInfoData, lang: 'bn' | 'en'): string {
    const sources = data.sources
      .slice(0, 3)
      .map((s) => `• ${s.ingredientName}: ${s.value}%`)
      .join('\n');

    if (lang === 'bn') {
      return `${data.nutrient}: ${data.description}\n\nশীর্ষ উৎস:\n${sources}`;
    } else {
      return `${data.nutrient}: ${data.description}\n\nTop sources:\n${sources}`;
    }
  }

  private formatPriceResponse(
    data: { ingredients: { name: string; priceTkPerKg: number; costPerCpUnit: number }[] },
    lang: 'bn' | 'en',
  ): string {
    const list = data.ingredients
      .slice(0, 5)
      .map((i) => `• ${i.name}: ${i.priceTkPerKg} Tk/kg (${i.costPerCpUnit} Tk/CP unit)`)
      .join('\n');

    return lang === 'bn'
      ? `মূল্য তুলনা (প্রোটিন দক্ষতা অনুসারে):\n${list}`
      : `Price comparison (by protein efficiency):\n${list}`;
  }

  private formatSeasonalResponse(
    data: { month: number; ingredients: { name: string; availability: string; priceIndex: number }[] },
    lang: 'bn' | 'en',
  ): string {
    const monthNames = lang === 'bn'
      ? ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
      : ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return lang === 'bn'
      ? `${monthNames[data.month - 1]} মাসে খাদ্য উপাদানের অবস্থা:`
      : `Feed ingredient availability for ${monthNames[data.month - 1]}:`;
  }

  private generateFollowUpQuestions(intent: FeedAdvisorIntent, lang: 'bn' | 'en'): string[] {
    const followUps: Record<FeedAdvisorIntent, { bn: string[]; en: string[] }> = {
      FORMULATION_REQUEST: {
        bn: ['বাজেট কত?', 'কোন উপাদান আছে?', 'দৈনিক কত খাবার দেন?'],
        en: ['What is your budget?', 'What ingredients are available?', 'How much do you feed daily?'],
      },
      INGREDIENT_INQUIRY: {
        bn: ['এই উপাদানের দাম কত?', 'কোন মৌসুমে পাওয়া যায়?'],
        en: ['What is the price of this ingredient?', 'When is it available?'],
      },
      NUTRIENT_INQUIRY: {
        bn: ['কোন খাবারে এটি বেশি?', 'কতটুকু দিতে হবে?'],
        en: ['Which feed has more of this?', 'How much should I provide?'],
      },
      TOXIC_CHECK: {
        bn: ['নিরাপদ পরিমাণ কত?', 'বিকল্প কি?'],
        en: ['What is the safe limit?', 'What are the alternatives?'],
      },
      SEASONAL_AVAILABILITY: {
        bn: ['এখন কি সস্তা?', 'সংরক্ষণ করা যায়?'],
        en: ['What is cheap now?', 'Can it be stored?'],
      },
      PRICE_INQUIRY: {
        bn: ['সবচেয়ে সাশ্রয়ী কোনটি?', 'গুণমান কেমন?'],
        en: ['Which is most economical?', 'How is the quality?'],
      },
      GENERAL_ADVICE: {
        bn: ['খাদ্য তালিকা বানাতে চান?', 'পুষ্টি সম্পর্কে জানতে চান?'],
        en: ['Want a feed formula?', 'Want to know about nutrients?'],
      },
      CLARIFICATION_NEEDED: { bn: [], en: [] },
      OUT_OF_SCOPE: { bn: [], en: [] },
    };

    return followUps[intent]?.[lang] ?? [];
  }

  private createOutOfScopeResponse(sessionId: string, lang: 'bn' | 'en'): FeedAdvisorResponse {
    return {
      sessionId,
      responseText: lang === 'bn'
        ? 'এই প্রশ্ন খাদ্য পরামর্শের বাইরে। রোগ বা চিকিৎসার জন্য পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
        : 'This question is outside feed advice scope. Contact a veterinarian for disease or treatment queries.',
      responseBn: 'এই প্রশ্ন খাদ্য পরামর্শের বাইরে।',
      responseEn: 'This question is outside feed advice scope.',
      intent: 'OUT_OF_SCOPE',
      structuredData: { type: 'none', data: null },
      citations: [],
      followUpQuestions: [],
      confidenceScore: 0.9,
      disclaimers: [],
      escalationRequired: true,
      escalationReason: lang === 'bn' ? 'বিশেষজ্ঞ প্রয়োজন' : 'Expert required',
    };
  }

  private createClarificationResponse(
    sessionId: string,
    clarification: string,
    lang: 'bn' | 'en',
  ): FeedAdvisorResponse {
    return {
      sessionId,
      responseText: clarification,
      responseBn: lang === 'bn' ? clarification : '',
      responseEn: lang === 'en' ? clarification : '',
      intent: 'CLARIFICATION_NEEDED',
      structuredData: { type: 'none', data: null },
      citations: [],
      followUpQuestions: [],
      confidenceScore: 0.5,
      disclaimers: [],
      escalationRequired: false,
    };
  }

  private async translateToEnglish(text: string): Promise<string> {
    return text;
  }
}

let service: FeedAdvisorOrchestratorService | undefined;

export function getFeedAdvisorOrchestratorService(): FeedAdvisorOrchestratorService {
  if (!service) {
    service = new FeedAdvisorOrchestratorService();
  }
  return service;
}
