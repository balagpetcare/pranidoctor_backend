import type {
  LivestockSpecies,
  ProductionStage,
} from '../../../generated/prisma/index.js';
import type {
  FeedAdvisorIntent,
  IntentClassification,
  ExtractedEntities,
} from './feed-advisor.types.js';

const INTENT_PATTERNS: Record<FeedAdvisorIntent, RegExp[]> = {
  FORMULATION_REQUEST: [
    /খাদ্য (মিশ্রণ|ফর্মুলা|তালিকা|রেশন)/i,
    /feed (formula|ration|mix|recipe)/i,
    /কিভাবে খাওয়াব/i,
    /how (much|to) feed/i,
    /balanced (diet|ration)/i,
    /সুষম খাদ্য/i,
    /দৈনিক খাবার/i,
    /daily feed/i,
  ],
  INGREDIENT_INQUIRY: [
    /(কোন|কি) (খাদ্য|উপাদান)/i,
    /what (feed|ingredient)/i,
    /(ভুট্টা|সয়াবিন|খৈল|কুড়া|ভুষি)/i,
    /(maize|corn|soybean|bran|cake)/i,
    /উপকারিতা/i,
    /benefits/i,
    /পুষ্টিমান/i,
    /nutritional value/i,
  ],
  NUTRIENT_INQUIRY: [
    /(প্রোটিন|শক্তি|ক্যালসিয়াম|ফসফরাস)/i,
    /(protein|energy|calcium|phosphorus|tdn|cp)/i,
    /পুষ্টি (চাহিদা|প্রয়োজন)/i,
    /nutrient (requirement|need)/i,
    /(কত|কতটুকু) (প্রোটিন|শক্তি)/i,
    /how much (protein|energy)/i,
  ],
  TOXIC_CHECK: [
    /(বিষ|বিষাক্ত|ক্ষতিকর|বিপজ্জনক)/i,
    /(toxic|poison|harmful|danger)/i,
    /খাওয়ানো (যাবে না|ঠিক হবে না)/i,
    /(can'?t|should not) feed/i,
    /এন্টিনিউট্রিয়েন্ট/i,
    /antinutrient/i,
    /গসিপল|অ্যাফ্লাটক্সিন/i,
    /gossypol|aflatoxin/i,
  ],
  SEASONAL_AVAILABILITY: [
    /(মৌসুম|ঋতু|সময়)/i,
    /(season|seasonal|month)/i,
    /(কখন|কোন সময়) পাওয়া যায়/i,
    /when (available|to get)/i,
    /(বর্ষা|গ্রীষ্ম|শীত)/i,
    /(monsoon|summer|winter)/i,
  ],
  PRICE_INQUIRY: [
    /(দাম|মূল্য|খরচ)/i,
    /(price|cost|rate)/i,
    /কত টাকা/i,
    /how much (cost|money)/i,
    /সাশ্রয়ী/i,
    /(cheap|affordable|budget)/i,
  ],
  GENERAL_ADVICE: [
    /(পরামর্শ|সাহায্য|জানতে চাই)/i,
    /(advice|help|want to know)/i,
    /কিভাবে/i,
    /how to/i,
    /সমস্যা/i,
    /problem/i,
  ],
  CLARIFICATION_NEEDED: [],
  OUT_OF_SCOPE: [
    /(চিকিৎসা|ওষুধ|ইনজেকশন|ভ্যাক্সিন)/i,
    /(treatment|medicine|injection|vaccine)/i,
    /(রোগ নির্ণয়|ডায়াগনোসিস)/i,
    /(diagnos|disease)/i,
  ],
};

const SPECIES_PATTERNS: Record<LivestockSpecies, RegExp[]> = {
  COW: [/গরু|গাভী|বাছুর|cow|cattle|calf|bovine/i],
  BUFFALO: [/মহিষ|buffalo/i],
  GOAT: [/ছাগল|goat/i],
  SHEEP: [/ভেড়া|sheep/i],
  CHICKEN: [/মুরগি|ব্রয়লার|লেয়ার|chicken|broiler|layer|poultry/i],
  DUCK: [/হাঁস|duck/i],
  PIGEON: [/কবুতর|pigeon/i],
  HORSE: [/ঘোড়া|horse/i],
  CUSTOM: [],
  OTHER: [],
};

const STAGE_PATTERNS: Record<ProductionStage, RegExp[]> = {
  CALF_PRE_WEANING: [/দুধ খাওয়া বাছুর|pre-?weaning|suckling/i],
  CALF_POST_WEANING: [/দুধ ছাড়া বাছুর|post-?weaning|weaned/i],
  GROWING: [/বাড়ন্ত|growing|grower/i],
  FATTENING: [/মোটাতাজা|মোটাতাজাকরণ|fattening|beef/i],
  MAINTENANCE: [/রক্ষণাবেক্ষণ|maintenance|dry/i],
  PREGNANT: [/গর্ভবতী|pregnant|gestation/i],
  LATE_PREGNANT: [/শেষ গর্ভাবস্থা|late pregnant/i],
  EARLY_LACTATION: [/প্রথম দিকের দুধ|early lactation|fresh/i],
  MID_LACTATION: [/মধ্য দুগ্ধকাল|mid lactation/i],
  LATE_LACTATION: [/শেষ দুগ্ধকাল|late lactation/i],
  BREEDING: [/প্রজনন|breeding|bull/i],
  STARTER: [/স্টার্টার|starter|chick/i],
  FINISHER: [/ফিনিশার|finisher/i],
  LAYING: [/ডিম দেওয়া|laying|layer/i],
};

const NUTRIENT_PATTERNS: Record<string, RegExp[]> = {
  CP: [/প্রোটিন|protein|cp/i],
  TDN: [/শক্তি|energy|tdn|total digestible/i],
  ME: [/মেটাবলিজম শক্তি|metabolizable energy|me/i],
  NDF: [/এনডিএফ|ndf|fiber|আঁশ/i],
  Ca: [/ক্যালসিয়াম|calcium|ca/i],
  P: [/ফসফরাস|phosphorus|p/i],
};

export class IntentClassifierService {
  classifyIntent(queryText: string): IntentClassification {
    const normalizedQuery = queryText.toLowerCase().trim();

    let bestIntent: FeedAdvisorIntent = 'GENERAL_ADVICE';
    let bestConfidence = 0;

    for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          const matchCount = (normalizedQuery.match(pattern) || []).length;
          const confidence = Math.min(0.5 + matchCount * 0.2, 0.95);
          if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = intent as FeedAdvisorIntent;
          }
        }
      }
    }

    if (bestConfidence < 0.3) {
      bestIntent = 'CLARIFICATION_NEEDED';
      bestConfidence = 0.6;
    }

    const entities = this.extractEntities(normalizedQuery);

    if (bestIntent === 'FORMULATION_REQUEST' && !entities.species) {
      bestIntent = 'CLARIFICATION_NEEDED';
      bestConfidence = 0.5;
    }

    return {
      intent: bestIntent,
      confidence: bestConfidence,
      entities,
    };
  }

  extractEntities(queryText: string): ExtractedEntities {
    const entities: ExtractedEntities = {};
    const normalizedQuery = queryText.toLowerCase();

    for (const [species, patterns] of Object.entries(SPECIES_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          entities.species = species as LivestockSpecies;
          break;
        }
      }
      if (entities.species) break;
    }

    for (const [stage, patterns] of Object.entries(STAGE_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          entities.productionStage = stage as ProductionStage;
          break;
        }
      }
      if (entities.productionStage) break;
    }

    const nutrients: string[] = [];
    for (const [nutrient, patterns] of Object.entries(NUTRIENT_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedQuery)) {
          nutrients.push(nutrient);
          break;
        }
      }
    }
    if (nutrients.length > 0) {
      entities.nutrients = nutrients;
    }

    const ingredientNames = [
      'ভুট্টা', 'maize', 'corn',
      'সয়াবিন', 'soybean',
      'গমের ভুষি', 'wheat bran',
      'চালের কুড়া', 'rice bran',
      'সরিষার খৈল', 'mustard cake',
      'তিলের খৈল', 'sesame cake',
      'খড়', 'straw',
      'ঘাস', 'grass', 'fodder',
    ];
    const foundIngredients: string[] = [];
    for (const name of ingredientNames) {
      if (normalizedQuery.includes(name.toLowerCase())) {
        foundIngredients.push(name);
      }
    }
    if (foundIngredients.length > 0) {
      entities.ingredients = foundIngredients;
    }

    const quantityMatch = normalizedQuery.match(/(\d+)\s*(কেজি|kg|কেজি\/দিন|kg\/day)/i);
    if (quantityMatch) {
      entities.quantity = parseInt(quantityMatch[1], 10);
    }

    const priceMatch = normalizedQuery.match(/(\d+)\s*(টাকা|tk|taka)/i);
    if (priceMatch) {
      entities.priceLimit = parseInt(priceMatch[1], 10);
    }

    return entities;
  }

  suggestClarification(
    intent: FeedAdvisorIntent,
    entities: ExtractedEntities,
    language: 'bn' | 'en',
  ): string {
    const clarifications: Record<string, { bn: string; en: string }> = {
      NO_SPECIES: {
        bn: 'কোন পশুর জন্য খাদ্য চান? (যেমন: গরু, ছাগল, মুরগি)',
        en: 'Which animal do you need feed for? (e.g., cow, goat, chicken)',
      },
      NO_STAGE: {
        bn: 'পশুর বয়স বা অবস্থা কি? (যেমন: বাড়ন্ত, দুগ্ধবতী, গর্ভবতী)',
        en: 'What is the animal\'s age or status? (e.g., growing, lactating, pregnant)',
      },
      VAGUE_QUERY: {
        bn: 'দয়া করে আপনার প্রশ্ন আরো বিস্তারিত করুন।',
        en: 'Please provide more details about your question.',
      },
    };

    if (intent === 'FORMULATION_REQUEST' && !entities.species) {
      return clarifications.NO_SPECIES[language];
    }
    if (intent === 'FORMULATION_REQUEST' && !entities.productionStage) {
      return clarifications.NO_STAGE[language];
    }
    return clarifications.VAGUE_QUERY[language];
  }
}

let service: IntentClassifierService | undefined;

export function getIntentClassifierService(): IntentClassifierService {
  if (!service) {
    service = new IntentClassifierService();
  }
  return service;
}
