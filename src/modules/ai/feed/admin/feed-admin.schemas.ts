import { z } from 'zod';
import {
  BdFeedAvailability,
  FeedPriceVolatility,
  LivestockSpecies,
} from '../../../../generated/prisma/index.js';

const livestockSpecies = z.nativeEnum(LivestockSpecies);
const bdAvailability = z.nativeEnum(BdFeedAvailability);
const priceVolatility = z.nativeEnum(FeedPriceVolatility);

const compositionSchema = z.object({
  dmPercent: z.number().min(0).max(100),
  cpPercent: z.number().min(0).max(100).optional(),
  tdnPercent: z.number().min(0).max(100).optional(),
  ndfPercent: z.number().min(0).max(100).optional(),
  adfPercent: z.number().min(0).max(100).optional(),
  meValueMjPerKg: z.number().min(0).optional(),
  caPercent: z.number().min(0).optional(),
  pPercent: z.number().min(0).optional(),
  cfPercent: z.number().min(0).max(100).optional(),
  eePercent: z.number().min(0).max(100).optional(),
  ashPercent: z.number().min(0).max(100).optional(),
});

const knowledgeMetaSchema = z.object({
  titleBn: z.string().min(1),
  titleEn: z.string().min(1),
  summaryBn: z.string().optional(),
  summaryEn: z.string().optional(),
  bodyBn: z.string().min(1),
  bodyEn: z.string().min(1),
  species: z.array(livestockSpecies).min(1),
  keywordsBn: z.array(z.string()).optional(),
  keywordsEn: z.array(z.string()).optional(),
  colloquialBn: z.array(z.string()).optional(),
});

export const listFeedIngredientsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED', 'ALL']).optional(),
  bdAvailability: bdAvailability.optional(),
  species: livestockSpecies.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const createFeedIngredientSchema = knowledgeMetaSchema.extend({
  ingredientCode: z.string().min(1).max(64),
  localNamesBn: z.array(z.string()).min(1),
  localNamesEn: z.array(z.string()).optional(),
  composition: compositionSchema,
  bdAvailability: bdAvailability,
  avgPriceBdtPerKg: z.number().min(0).optional(),
  priceVolatility: priceVolatility.optional(),
  speciesRestrictions: z.array(livestockSpecies).optional(),
  feedItemId: z.string().optional(),
});

export const updateFeedIngredientSchema = createFeedIngredientSchema.partial();

export const listToxicAlertsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['DRAFT', 'IN_REVIEW', 'PUBLISHED', 'DEPRECATED', 'ALL']).optional(),
  species: livestockSpecies.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const createToxicAlertSchema = knowledgeMetaSchema.extend({
  substance: z.string().min(1).max(128),
  commonNamesBn: z.array(z.string()).min(1),
  commonNamesEn: z.array(z.string()).optional(),
  speciesAffected: z.array(livestockSpecies).min(1),
  toxicThreshold: z.string().min(1).max(128),
  lethalThreshold: z.string().max(128).optional(),
  clinicalSignsBn: z.array(z.string()).min(1),
  clinicalSignsEn: z.array(z.string()).optional(),
  onsetTime: z.string().max(64).optional(),
  immediateActionBn: z.string().min(1),
  immediateActionEn: z.string().min(1),
  relatedIngredientCodes: z.array(z.string()).optional(),
});

export const updateToxicAlertSchema = createToxicAlertSchema.partial();

export const governanceNotesSchema = z.object({
  notes: z.string().optional(),
  reason: z.string().optional(),
});
