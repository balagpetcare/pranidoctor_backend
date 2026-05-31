import { randomUUID } from 'crypto';
import { AiMessageRole, type FeedAdvisorSessionState } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval/knowledge-retrieval.service.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { buildEnrichedPromptContext } from '../knowledge-retrieval/grounding/grounding-engine.js';
import { validateLlmOutput } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
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
} from './feed-advisor.types.js';
import type { FormulationSolution, IngredientAvailability } from './engines/formulation-types.js';
import {
  FEED_ADVISOR_FEATURE,
  FEED_ADVISOR_TASK_TYPE,
  FEED_ADVISOR_RETRIEVAL_PROFILE,
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

/**
 * VRE-Integrated Feed Advisor Orchestrator
 * 
 * This service integrates the Feed Intelligence system with the existing
 * AI infrastructure:
 * - Uses KnowledgeRetrievalService for VKL grounding
 * - Routes through AiFoundationService for safety
 * - Integrates with AiAuditService for compliance
 * - Follows established AI safety patterns
 */
export class FeedAdvisorVreOrchestratorService {
  private feedKnowledge = getFeedKnowledgeService();
  private nutritionalIntel = getNutritionalIntelligenceService();
  private formulator = getFormulationEngineService();
  private intentClassifier = getIntentClassifierService();
  private knowledgeRetrieval = getKnowledgeRetrievalService();
  private aiFoundation = getAiFoundationService();
  private audit = getAiAuditService();

  async processQuery(query: FeedAdvisorQuery): Promise<FeedAdvisorResponse> {
    const sessionId = query.sessionId ?? randomUUID();
    const lang = query.queryLanguage;

    // Audit the query
    await this.audit.log({
      feature: FEED_ADVISOR_FEATURE,
      taskType: FEED_ADVISOR_TASK_TYPE,
      userId: query.userId,
      customerId: query.customerId,
      sessionId,
      eventType: 'FEED_QUERY_START',
      metadata: {
        queryText: query.queryText,
        queryLanguage: lang,
        context: query.context,
      },
    });

    const classification = this.intentClassifier.classifyIntent(query.queryText);

    // Handle out-of-scope and clarification cases first (no VRE needed)
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

    // For safety-critical toxic checks, use VRE with fail-closed behavior
    if (classification.intent === 'TOXIC_CHECK') {
      return await this.handleToxicCheckWithVre(sessionId, query, classification.entities);
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
          const result = await this.handleFormulationRequestWithVre(
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
        const ingredientResult = await this.handleIngredientInquiryWithVre(
          classification.entities.ingredients,
          livestockContext,
          query.queryText,
          lang,
        );
        structuredData = { type: 'ingredient_list', data: ingredientResult.data };
        responseText = ingredientResult.response;
        citations = ingredientResult.citations;
        break;

      case 'NUTRIENT_INQUIRY':
        const nutrientResult = await this.handleNutrientInquiryWithVre(
          classification.entities.nutrients ?? [],
          livestockContext,
          query.queryText,
          lang,
        );
        structuredData = { type: 'nutrient_info', data: nutrientResult.data };
        responseText = nutrientResult.response;
        citations = nutrientResult.citations;
        break;

      default:
        responseText = await this.handleGeneralAdviceWithVre(query.queryText, lang);
        citations.push('VKL:General');
    }

    if (confidenceScore < SAFETY_THRESHOLDS.ESCALATION_THRESHOLD) {
      escalationRequired = true;
      escalationReason = lang === 'bn'
        ? 'এই প্রশ্নের জন্য বিশেষজ্ঞ পরামর্শ প্রয়োজন'
        : 'Expert consultation recommended for this query';
    }

    const followUpQuestions = this.generateFollowUpQuestions(classification.intent, lang);

    // Add disclaimer
    const disclaimer = resolveAiResponseDisclaimer(FEED_ADVISOR_FEATURE, lang);
    if (disclaimer) {
      disclaimers.push(disclaimer);
    }

    // Audit the response
    await this.audit.log({
      feature: FEED_ADVISOR_FEATURE,
      taskType: FEED_ADVISOR_TASK_TYPE,
      userId: query.userId,
      customerId: query.customerId,
      sessionId,
      eventType: 'FEED_QUERY_COMPLETE',
      metadata: {
        intent: classification.intent,
        confidenceScore,
        citations,
        escalationRequired,
        structuredDataType: structuredData.type,
      },
    });

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

  private async handleToxicCheckWithVre(
    sessionId: string,
    query: FeedAdvisorQuery,
    entities: { ingredients?: string[] },
  ): Promise<FeedAdvisorResponse> {
    const lang = query.queryLanguage;

    // Build retrieval query for toxic substances
    const retrievalQuery = `toxic substances feed safety ${entities.ingredients?.join(' ') ?? ''}`;

    try {
      // Use VRE to retrieve toxic alert information
      const pack = await this.knowledgeRetrieval.retrieveKnowledge({
        taskType: FEED_ADVISOR_TASK_TYPE,
        retrievalProfileId: FEED_ADVISOR_RETRIEVAL_PROFILE,
        query: retrievalQuery,
        species: query.context?.livestock?.species,
        customerId: query.customerId,
        userId: query.userId,
        sessionId,
        locale: lang,
      });

      // Check if we have high-confidence toxic information
      const hasHighConfidenceToxicInfo = pack.chunks.some(
        chunk => chunk.confidence > 0.8 && chunk.text.toLowerCase().includes('toxic')
      );

      if (hasHighConfidenceToxicInfo) {
        // Use LLM to synthesize the toxic alert information
        const llmResult = await this.aiFoundation.complete({
          messages: [
            {
              role: AiMessageRole.USER,
              content: buildEnrichedPromptContext({
                userQuery: query.queryText,
                context: pack,
                instructions: `You are a feed safety expert. Based on the provided knowledge, 
                  assess if the mentioned ingredients contain toxic substances. 
                  Respond in ${lang === 'bn' ? 'Bengali' : 'English'}.
                  If toxic, provide immediate safety actions.
                  Be specific about affected species and thresholds.`,
                locale: lang,
              }),
            },
          ],
          feature: FEED_ADVISOR_FEATURE,
          taskType: FEED_ADVISOR_TASK_TYPE,
          customerId: query.customerId,
          userId: query.userId,
          sessionId,
        });

        // Validate the LLM output
        const validation = validateLlmOutput(llmResult.content, pack);

        return {
          sessionId,
          responseText: validation.validatedContent,
          responseBn: lang === 'bn' ? validation.validatedContent : '',
          responseEn: lang === 'en' ? validation.validatedContent : '',
          intent: 'TOXIC_CHECK',
          structuredData: { type: 'toxic_alert', data: { alerts: [] } },
          citations: pack.chunks.map(c => c.citationKey),
          followUpQuestions: [],
          confidenceScore: Math.min(pack.confidence, validation.confidence),
          disclaimers: [DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].TOXIC],
          escalationRequired: true,
          escalationReason: lang === 'bn' ? 'বিষাক্ততার ঝুঁকি' : 'Toxicity risk detected',
        };
      } else {
        // No high-confidence toxic information found
        return {
          sessionId,
          responseText: lang === 'bn'
            ? 'প্রদত্ত উপাদানগুলির বিষাক্ততার তথ্য পাওয়া যায়নি। নিরাপত্তার জন্য পশু চিকিৎসকের পরামর্শ নিন।'
            : 'No toxicity information found for the mentioned ingredients. Consult a veterinarian for safety.',
          responseBn: lang === 'bn' ? 'বিষাক্ততার তথ্য পাওয়া যায়নি।' : '',
          responseEn: lang === 'en' ? 'No toxicity information found.' : '',
          intent: 'TOXIC_CHECK',
          structuredData: { type: 'toxic_alert', data: { alerts: [] } },
          citations: pack.chunks.map(c => c.citationKey),
          followUpQuestions: [],
          confidenceScore: pack.confidence,
          disclaimers: [DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].GENERAL],
          escalationRequired: true,
          escalationReason: lang === 'bn' ? 'নিরাপত্তার জন্য যাচাই প্রয়োজন' : 'Safety verification needed',
        };
      }
    } catch (error) {
      // VRE retrieval failed - fail closed for safety
      return {
        sessionId,
        responseText: lang === 'bn'
          ? '⚠️ নিরাপত্তার তথ্য যাচাই করতে সমস্যা হয়েছে। অবিলম্বে পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
          : '⚠️ Unable to verify safety information. Contact a veterinarian immediately.',
        responseBn: '⚠️ নিরাপত্তার তথ্য যাচাই করতে সমস্যা',
        responseEn: '⚠️ Unable to verify safety information',
        intent: 'TOXIC_CHECK',
        structuredData: { type: 'none', data: null },
        citations: [],
        followUpQuestions: [],
        confidenceScore: 0,
        disclaimers: [DISCLAIMERS[lang === 'bn' ? 'BN' : 'EN'].TOXIC],
        escalationRequired: true,
        escalationReason: lang === 'bn' ? 'সিস্টেম ত্রুটি - নিরাপত্তা যাচাই করুন' : 'System error - verify safety',
      };
    }
  }

  private async handleFormulationRequestWithVre(
    query: FeedAdvisorQuery,
    context: LivestockContext,
    ingredientNames?: string[],
  ): Promise<FormulationSolution> {
    // First get nutrient requirements through VRE
    const requirementQuery = `nutrient requirements ${context.species} ${context.productionStage}`;
    
    const pack = await this.knowledgeRetrieval.retrieveKnowledge({
      taskType: FEED_ADVISOR_TASK_TYPE,
      retrievalProfileId: FEED_ADVISOR_RETRIEVAL_PROFILE,
      query: requirementQuery,
      species: context.species,
      customerId: query.customerId,
      userId: query.userId,
      sessionId: query.sessionId,
      locale: query.queryLanguage,
    });

    // Use the formulation engine with VKL-grounded data
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

    // Add VKL citations from retrieval
    result.vklCitations.push(...pack.chunks.map(c => c.citationKey));
    
    return result;
  }

  private async handleIngredientInquiryWithVre(
    ingredientNames?: string[],
    context?: LivestockContext | null,
    queryText?: string,
    lang?: 'bn' | 'en',
  ): Promise<{ data: IngredientListData; response: string; citations: string[] }> {
    // Use VRE to get ingredient information
    const retrievalQuery = `feed ingredients composition ${ingredientNames?.join(' ') ?? ''} ${context?.species ?? ''}`;
    
    const pack = await this.knowledgeRetrieval.retrieveKnowledge({
      taskType: FEED_ADVISOR_TASK_TYPE,
      retrievalProfileId: FEED_ADVISOR_RETRIEVAL_PROFILE,
      query: retrievalQuery,
      species: context?.species,
      customerId: 'system', // System query
      userId: 'system',
      locale: lang ?? 'bn',
    });

    // Get structured ingredient data
    const ingredientData = await this.getIngredientListData(ingredientNames, context);

    // Generate LLM response if we have good VKL data
    let response = '';
    if (pack.confidence > 0.6) {
      const llmResult = await this.aiFoundation.complete({
        messages: [
          {
            role: AiMessageRole.USER,
            content: buildEnrichedPromptContext({
              userQuery: queryText ?? 'Tell me about these ingredients',
              context: pack,
              instructions: `Provide information about feed ingredients based on the knowledge provided.
                Include nutritional composition, availability in Bangladesh, and usage recommendations.
                Respond in ${lang === 'bn' ? 'Bengali' : 'English'}.`,
              locale: lang ?? 'bn',
            }),
          },
        ],
        feature: FEED_ADVISOR_FEATURE,
        taskType: FEED_ADVISOR_TASK_TYPE,
        customerId: 'system',
        userId: 'system',
      });

      response = llmResult.content;
    } else {
      // Fallback to structured response
      response = this.formatIngredientResponse(ingredientData, lang ?? 'bn');
    }

    return {
      data: ingredientData,
      response,
      citations: pack.chunks.map(c => c.citationKey),
    };
  }

  private async handleNutrientInquiryWithVre(
    nutrients: string[],
    context?: LivestockContext | null,
    queryText?: string,
    lang?: 'bn' | 'en',
  ): Promise<{ data: NutrientInfoData; response: string; citations: string[] }> {
    const nutrient = nutrients[0] ?? 'protein';
    
    // Use VRE to get nutrient requirement information
    const retrievalQuery = `nutrient requirements ${nutrient} ${context?.species ?? ''} ${context?.productionStage ?? ''}`;
    
    const pack = await this.knowledgeRetrieval.retrieveKnowledge({
      taskType: FEED_ADVISOR_TASK_TYPE,
      retrievalProfileId: FEED_ADVISOR_RETRIEVAL_PROFILE,
      query: retrievalQuery,
      species: context?.species,
      customerId: 'system',
      userId: 'system',
      locale: lang ?? 'bn',
    });

    // Get structured nutrient data
    const nutrientData = await this.getNutrientInfoData(nutrients, context);

    // Generate LLM response
    let response = '';
    if (pack.confidence > 0.6) {
      const llmResult = await this.aiFoundation.complete({
        messages: [
          {
            role: AiMessageRole.USER,
            content: buildEnrichedPromptContext({
              userQuery: queryText ?? `Tell me about ${nutrient} requirements`,
              context: pack,
              instructions: `Explain nutrient requirements and sources based on the provided knowledge.
                Include species-specific requirements and good feed sources.
                Respond in ${lang === 'bn' ? 'Bengali' : 'English'}.`,
              locale: lang ?? 'bn',
            }),
          },
        ],
        feature: FEED_ADVISOR_FEATURE,
        taskType: FEED_ADVISOR_TASK_TYPE,
        customerId: 'system',
        userId: 'system',
      });

      response = llmResult.content;
    } else {
      // Fallback to structured response
      response = this.formatNutrientResponse(nutrientData, lang ?? 'bn');
    }

    return {
      data: nutrientData,
      response,
      citations: pack.chunks.map(c => c.citationKey),
    };
  }

  private async handleGeneralAdviceWithVre(queryText: string, lang: 'bn' | 'en'): Promise<string> {
    try {
      // Use VRE for general feed advice
      const pack = await this.knowledgeRetrieval.retrieveKnowledge({
        taskType: FEED_ADVISOR_TASK_TYPE,
        retrievalProfileId: FEED_ADVISOR_RETRIEVAL_PROFILE,
        query: queryText,
        customerId: 'system',
        userId: 'system',
        locale: lang,
      });

      if (pack.confidence > 0.5) {
        const llmResult = await this.aiFoundation.complete({
          messages: [
            {
              role: AiMessageRole.USER,
              content: buildEnrichedPromptContext({
                userQuery: queryText,
                context: pack,
                instructions: `Provide helpful feed advice based on the provided knowledge.
                  Be specific and practical for Bangladesh livestock farmers.
                  Respond in ${lang === 'bn' ? 'Bengali' : 'English'}.`,
                locale: lang,
              }),
            },
          ],
          feature: FEED_ADVISOR_FEATURE,
          taskType: FEED_ADVISOR_TASK_TYPE,
          customerId: 'system',
          userId: 'system',
        });

        return llmResult.content;
      }
    } catch (error) {
      // VRE failed - provide safe fallback
    }

    return lang === 'bn'
      ? 'আপনার প্রশ্নের উত্তর দিতে আমার আরো তথ্য প্রয়োজন। দয়া করে পশুর প্রজাতি, বয়স এবং অবস্থা জানান।'
      : 'I need more information to answer your question. Please provide the animal species, age, and status.';
  }

  // Helper methods (delegate to existing implementations)
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

  private async getIngredientListData(
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

  private async getNutrientInfoData(
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
    return text; // Placeholder - implement translation service if needed
  }
}

let service: FeedAdvisorVreOrchestratorService | undefined;

export function getFeedAdvisorVreOrchestratorService(): FeedAdvisorVreOrchestratorService {
  if (!service) {
    service = new FeedAdvisorVreOrchestratorService();
  }
  return service;
}