/**
 * Bangladesh Feed Ingredient Database Seeder
 * Phase F2: Creates VKL-grounded feed ingredient knowledge entities
 * 
 * Run: npx tsx scripts/knowledge/feed/bd-feed-ingredient-seed.ts
 */
import { loadEnvironment } from '../../../src/shared/config/load-env.js';

loadEnvironment();

import { Prisma } from '../../../src/generated/prisma/index.js';
import type {
  BdFeedAvailability,
  FeedPriceVolatility,
  LivestockSpecies,
  ProductionStage,
} from '../../../src/generated/prisma/index.js';
import { disconnectPrisma, prisma } from '../../../src/lib/prisma.js';

type FeedIngredientSeed = {
  ingredientCode: string;
  localNamesBn: string[];
  localNamesEn: string[];
  titleBn: string;
  titleEn: string;
  dmPercent: number;
  cpPercent?: number;
  tdnPercent?: number;
  ndfPercent?: number;
  adfPercent?: number;
  meValueMjPerKg?: number;
  caPercent?: number;
  pPercent?: number;
  cfPercent?: number;
  eePercent?: number;
  ashPercent?: number;
  bdAvailability: BdFeedAvailability;
  priceVolatility: FeedPriceVolatility;
  avgPriceBdtPerKg: number;
  speciesRestrictions?: LivestockSpecies[];
  maxInclusions?: Array<{
    species: LivestockSpecies;
    productionStage: ProductionStage;
    maxPercentDm: number;
    reason?: string;
  }>;
  antinutrients?: Array<{
    compound: string;
    threshold: string;
    effect: string;
    mitigation?: string;
  }>;
  seasonality?: Array<{
    month: number;
    availability: 'high' | 'medium' | 'low' | 'none';
    priceIndex: number;
  }>;
  feedItemCode?: string;
  sourceAttributions: string[];
};

const BD_FEED_INGREDIENTS: FeedIngredientSeed[] = [
  // ── ROUGHAGE & FODDER ──
  {
    ingredientCode: 'BD_RICE_STRAW',
    localNamesBn: ['ধানের খড়', 'খড়', 'rice khad'],
    localNamesEn: ['Rice Straw', 'Paddy Straw'],
    titleBn: 'ধানের খড়',
    titleEn: 'Rice Straw',
    dmPercent: 90,
    cpPercent: 3.5,
    tdnPercent: 45,
    ndfPercent: 75,
    adfPercent: 48,
    cfPercent: 38,
    eePercent: 1.5,
    ashPercent: 14,
    caPercent: 0.21,
    pPercent: 0.07,
    meValueMjPerKg: 6.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 10,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 50, reason: 'Low energy density' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 40, reason: 'Limits growth' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 60, reason: 'Fiber tolerance' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_WHEAT_STRAW',
    localNamesBn: ['গমের খড়', 'wheat khad'],
    localNamesEn: ['Wheat Straw'],
    titleBn: 'গমের খড়',
    titleEn: 'Wheat Straw',
    dmPercent: 91,
    cpPercent: 3.8,
    tdnPercent: 44,
    ndfPercent: 78,
    adfPercent: 50,
    cfPercent: 40,
    eePercent: 1.3,
    ashPercent: 8,
    caPercent: 0.18,
    pPercent: 0.05,
    meValueMjPerKg: 6.2,
    bdAvailability: 'SEASONALLY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 12,
    seasonality: [
      { month: 3, availability: 'high', priceIndex: 0.8 },
      { month: 4, availability: 'high', priceIndex: 0.7 },
      { month: 5, availability: 'medium', priceIndex: 0.9 },
      { month: 6, availability: 'low', priceIndex: 1.2 },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_NAPIER_GRASS',
    localNamesBn: ['নেপিয়ার ঘাস', 'হাতি ঘাস', 'napier'],
    localNamesEn: ['Napier Grass', 'Elephant Grass'],
    titleBn: 'নেপিয়ার ঘাস',
    titleEn: 'Napier Grass',
    dmPercent: 22,
    cpPercent: 9,
    tdnPercent: 55,
    ndfPercent: 65,
    adfPercent: 38,
    cfPercent: 32,
    eePercent: 2.5,
    ashPercent: 12,
    caPercent: 0.4,
    pPercent: 0.25,
    meValueMjPerKg: 8.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 3,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 70, reason: 'Excellent roughage' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 60, reason: 'High palatability' },
    ],
    sourceAttributions: ['BLRI-Feed-DB-2023', 'FAO-Feed-Tables'],
  },
  {
    ingredientCode: 'BD_GERMAN_GRASS',
    localNamesBn: ['জার্মান ঘাস', 'para grass'],
    localNamesEn: ['German Grass', 'Para Grass'],
    titleBn: 'জার্মান ঘাস',
    titleEn: 'German Grass',
    dmPercent: 18,
    cpPercent: 8,
    tdnPercent: 52,
    ndfPercent: 68,
    adfPercent: 40,
    cfPercent: 30,
    eePercent: 2.2,
    ashPercent: 10,
    caPercent: 0.35,
    pPercent: 0.22,
    meValueMjPerKg: 8.0,
    bdAvailability: 'SEASONALLY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 4,
    sourceAttributions: ['BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_MAIZE_SILAGE',
    localNamesBn: ['ভুট্টা সাইলেজ', 'corn silage'],
    localNamesEn: ['Maize Silage', 'Corn Silage'],
    titleBn: 'ভুট্টা সাইলেজ',
    titleEn: 'Maize Silage',
    dmPercent: 32,
    cpPercent: 8,
    tdnPercent: 68,
    ndfPercent: 48,
    adfPercent: 28,
    cfPercent: 22,
    eePercent: 3.2,
    ashPercent: 5,
    caPercent: 0.25,
    pPercent: 0.22,
    meValueMjPerKg: 10.8,
    bdAvailability: 'REGIONAL_LIMITED',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 15,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 60, reason: 'High energy' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 70, reason: 'Excellent for finishing' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },

  // ── CONCENTRATES - ENERGY ──
  {
    ingredientCode: 'BD_RICE_BRAN',
    localNamesBn: ['চালের কুঁড়া', 'কুঁড়া', 'rice polish'],
    localNamesEn: ['Rice Bran', 'Rice Polish'],
    titleBn: 'চালের কুঁড়া',
    titleEn: 'Rice Bran',
    dmPercent: 90,
    cpPercent: 13,
    tdnPercent: 65,
    ndfPercent: 25,
    adfPercent: 12,
    cfPercent: 12,
    eePercent: 14,
    ashPercent: 10,
    caPercent: 0.07,
    pPercent: 1.5,
    meValueMjPerKg: 11.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 25,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 30, reason: 'High fat content' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 35, reason: 'Energy density' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 25, reason: 'Fat tolerance' },
    ],
    antinutrients: [
      { compound: 'Phytic acid', threshold: '5-7%', effect: 'Reduces P availability', mitigation: 'Phytase supplementation' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023', 'FAO-Feed-Tables'],
  },
  {
    ingredientCode: 'BD_WHEAT_BRAN',
    localNamesBn: ['গমের ভুষি', 'ভুষি', 'wheat atta'],
    localNamesEn: ['Wheat Bran'],
    titleBn: 'গমের ভুষি',
    titleEn: 'Wheat Bran',
    dmPercent: 89,
    cpPercent: 15.5,
    tdnPercent: 67,
    ndfPercent: 45,
    adfPercent: 13,
    cfPercent: 10,
    eePercent: 4,
    ashPercent: 6,
    caPercent: 0.13,
    pPercent: 1.2,
    meValueMjPerKg: 10.8,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 32,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 40, reason: 'Good palatability' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 35, reason: 'Fiber content' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_MAIZE_BROKEN',
    localNamesBn: ['ভুট্টা ভাঙ্গা', 'corn ভাঙ্গা', 'cracked corn'],
    localNamesEn: ['Cracked Maize', 'Broken Corn'],
    titleBn: 'ভুট্টা ভাঙ্গা',
    titleEn: 'Cracked Maize',
    dmPercent: 88,
    cpPercent: 9,
    tdnPercent: 80,
    ndfPercent: 12,
    adfPercent: 3,
    cfPercent: 2.5,
    eePercent: 4,
    ashPercent: 1.5,
    caPercent: 0.02,
    pPercent: 0.28,
    meValueMjPerKg: 13.8,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 30,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 50, reason: 'Starch fermentation' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 60, reason: 'Energy finishing' },
      { species: 'CHICKEN', productionStage: 'LAYING', maxPercentDm: 65, reason: 'Primary energy' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_MOLASSES',
    localNamesBn: ['মোলাসেস', 'চিটাগুড়', 'gur molasses'],
    localNamesEn: ['Molasses', 'Sugarcane Molasses'],
    titleBn: 'মোলাসেস',
    titleEn: 'Molasses',
    dmPercent: 75,
    cpPercent: 3,
    tdnPercent: 72,
    ndfPercent: 0,
    adfPercent: 0,
    cfPercent: 0,
    eePercent: 0.1,
    ashPercent: 10,
    caPercent: 0.8,
    pPercent: 0.08,
    meValueMjPerKg: 10.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 40,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 15, reason: 'Rapid fermentation' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 20, reason: 'Palatability enhancer' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 10, reason: 'Digestive upset risk' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },

  // ── CONCENTRATES - PROTEIN ──
  {
    ingredientCode: 'BD_MUSTARD_CAKE',
    localNamesBn: ['সরিষার খৈল', 'খৈল', 'sarisha khail'],
    localNamesEn: ['Mustard Oilcake', 'Rapeseed Cake'],
    titleBn: 'সরিষার খৈল',
    titleEn: 'Mustard Oilcake',
    dmPercent: 90,
    cpPercent: 35,
    tdnPercent: 70,
    ndfPercent: 28,
    adfPercent: 18,
    cfPercent: 10,
    eePercent: 10,
    ashPercent: 8,
    caPercent: 0.6,
    pPercent: 1.0,
    meValueMjPerKg: 11.2,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 50,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 25, reason: 'Glucosinolates' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 20, reason: 'Glucosinolate toxicity' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 15, reason: 'Higher sensitivity' },
    ],
    antinutrients: [
      { compound: 'Glucosinolates', threshold: '< 30 μmol/g', effect: 'Thyroid depression, reduced intake', mitigation: 'Limit inclusion, heat treatment' },
      { compound: 'Erucic acid', threshold: '< 2%', effect: 'Cardiac lipidosis', mitigation: 'Use low-erucic varieties' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023', 'FAO-Feed-Tables'],
  },
  {
    ingredientCode: 'BD_SOYBEAN_MEAL',
    localNamesBn: ['সয়াবিন খৈল', 'সয়া মিল', 'soybean meal'],
    localNamesEn: ['Soybean Meal', 'Soy Meal'],
    titleBn: 'সয়াবিন খৈল',
    titleEn: 'Soybean Meal',
    dmPercent: 89,
    cpPercent: 44,
    tdnPercent: 78,
    ndfPercent: 14,
    adfPercent: 8,
    cfPercent: 6,
    eePercent: 1.5,
    ashPercent: 6.5,
    caPercent: 0.35,
    pPercent: 0.65,
    meValueMjPerKg: 13.2,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'HIGH',
    avgPriceBdtPerKg: 60,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 35, reason: 'RUP balance' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 25, reason: 'Cost optimization' },
      { species: 'CHICKEN', productionStage: 'LAYING', maxPercentDm: 30, reason: 'Primary protein' },
    ],
    antinutrients: [
      { compound: 'Trypsin inhibitors', threshold: '< 4 mg/g', effect: 'Reduced protein digestion', mitigation: 'Proper heat treatment' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_SESAME_CAKE',
    localNamesBn: ['তিলের খৈল', 'til khail'],
    localNamesEn: ['Sesame Oilcake', 'Sesame Cake'],
    titleBn: 'তিলের খৈল',
    titleEn: 'Sesame Oilcake',
    dmPercent: 92,
    cpPercent: 40,
    tdnPercent: 72,
    ndfPercent: 20,
    adfPercent: 12,
    cfPercent: 8,
    eePercent: 8,
    ashPercent: 11,
    caPercent: 2.0,
    pPercent: 1.3,
    meValueMjPerKg: 11.8,
    bdAvailability: 'REGIONAL_LIMITED',
    priceVolatility: 'HIGH',
    avgPriceBdtPerKg: 58,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 20, reason: 'Palatability' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 25, reason: 'Good protein source' },
    ],
    antinutrients: [
      { compound: 'Oxalic acid', threshold: '< 2%', effect: 'Calcium binding', mitigation: 'Limit inclusion' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_FISH_MEAL',
    localNamesBn: ['মাছের গুঁড়া', 'শুটকি গুঁড়া', 'fish powder'],
    localNamesEn: ['Fish Meal', 'Dried Fish Meal'],
    titleBn: 'মাছের গুঁড়া',
    titleEn: 'Fish Meal',
    dmPercent: 92,
    cpPercent: 60,
    tdnPercent: 75,
    ndfPercent: 0,
    adfPercent: 0,
    cfPercent: 1,
    eePercent: 10,
    ashPercent: 20,
    caPercent: 5.0,
    pPercent: 2.8,
    meValueMjPerKg: 12.5,
    bdAvailability: 'REGIONAL_LIMITED',
    priceVolatility: 'VERY_HIGH',
    avgPriceBdtPerKg: 75,
    speciesRestrictions: ['COW', 'GOAT', 'BUFFALO'],
    maxInclusions: [
      { species: 'CHICKEN', productionStage: 'LAYING', maxPercentDm: 10, reason: 'Egg taint' },
      { species: 'DUCK', productionStage: 'LAYING', maxPercentDm: 15, reason: 'Higher tolerance' },
    ],
    sourceAttributions: ['NRC-1994', 'BLRI-Feed-DB-2023'],
  },

  // ── MINERALS & SUPPLEMENTS ──
  {
    ingredientCode: 'BD_SALT',
    localNamesBn: ['লবণ', 'খাবার লবণ', 'common salt'],
    localNamesEn: ['Common Salt', 'Sodium Chloride'],
    titleBn: 'লবণ',
    titleEn: 'Common Salt',
    dmPercent: 99,
    cpPercent: 0,
    tdnPercent: 0,
    ndfPercent: 0,
    adfPercent: 0,
    cfPercent: 0,
    eePercent: 0,
    ashPercent: 99,
    caPercent: 0,
    pPercent: 0,
    meValueMjPerKg: 0,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 20,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 1, reason: 'Na toxicity' },
      { species: 'COW', productionStage: 'MAINTENANCE', maxPercentDm: 0.5, reason: 'Requirement lower' },
    ],
    sourceAttributions: ['NRC-2001'],
  },
  {
    ingredientCode: 'BD_DCP',
    localNamesBn: ['ডি সি পি', 'ডাইক্যালসিয়াম ফসফেট'],
    localNamesEn: ['Dicalcium Phosphate', 'DCP'],
    titleBn: 'ডাইক্যালসিয়াম ফসফেট (DCP)',
    titleEn: 'Dicalcium Phosphate (DCP)',
    dmPercent: 98,
    cpPercent: 0,
    tdnPercent: 0,
    ndfPercent: 0,
    adfPercent: 0,
    cfPercent: 0,
    eePercent: 0,
    ashPercent: 92,
    caPercent: 22,
    pPercent: 18,
    meValueMjPerKg: 0,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 110,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 2, reason: 'Mineral balance' },
      { species: 'CHICKEN', productionStage: 'LAYING', maxPercentDm: 2.5, reason: 'Eggshell quality' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_MINERAL_MIX',
    localNamesBn: ['মিনারেল মিক্স', 'খনিজ মিশ্রণ'],
    localNamesEn: ['Mineral Mix', 'Mineral Premix'],
    titleBn: 'মিনারেল মিক্স',
    titleEn: 'Mineral Mix',
    dmPercent: 98,
    cpPercent: 0,
    tdnPercent: 0,
    ndfPercent: 0,
    adfPercent: 0,
    cfPercent: 0,
    eePercent: 0,
    ashPercent: 95,
    caPercent: 15,
    pPercent: 8,
    meValueMjPerKg: 0,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 95,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 1.5, reason: 'Trace minerals' },
      { species: 'CHICKEN', productionStage: 'LAYING', maxPercentDm: 1, reason: 'Requirement based' },
    ],
    sourceAttributions: ['BLRI-Feed-DB-2023'],
  },

  // ── GREEN FODDER ──
  {
    ingredientCode: 'BD_BANANA_STEM',
    localNamesBn: ['কলাগাছ', 'কলার ভেতু', 'banana tree'],
    localNamesEn: ['Banana Pseudostem', 'Banana Stem'],
    titleBn: 'কলাগাছ',
    titleEn: 'Banana Pseudostem',
    dmPercent: 8,
    cpPercent: 4,
    tdnPercent: 45,
    ndfPercent: 55,
    adfPercent: 35,
    cfPercent: 25,
    eePercent: 1,
    ashPercent: 12,
    caPercent: 0.5,
    pPercent: 0.15,
    meValueMjPerKg: 6.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 2,
    maxInclusions: [
      { species: 'COW', productionStage: 'MAINTENANCE', maxPercentDm: 40, reason: 'Low DM content' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 30, reason: 'Palatability' },
    ],
    sourceAttributions: ['BLRI-Feed-DB-2023', 'FAO-Feed-Tables'],
  },
  {
    ingredientCode: 'BD_WATER_HYACINTH',
    localNamesBn: ['কচুরিপানা', 'kachuripana'],
    localNamesEn: ['Water Hyacinth'],
    titleBn: 'কচুরিপানা',
    titleEn: 'Water Hyacinth',
    dmPercent: 6,
    cpPercent: 12,
    tdnPercent: 40,
    ndfPercent: 60,
    adfPercent: 40,
    cfPercent: 20,
    eePercent: 2,
    ashPercent: 18,
    caPercent: 1.2,
    pPercent: 0.4,
    meValueMjPerKg: 5.8,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'STABLE',
    avgPriceBdtPerKg: 1,
    maxInclusions: [
      { species: 'COW', productionStage: 'MAINTENANCE', maxPercentDm: 30, reason: 'Very high moisture' },
      { species: 'DUCK', productionStage: 'GROWING', maxPercentDm: 25, reason: 'Good for ducks' },
    ],
    antinutrients: [
      { compound: 'Oxalic acid', threshold: '< 3%', effect: 'Ca binding', mitigation: 'Wilting, limited use' },
    ],
    sourceAttributions: ['BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_SUGARCANE_TOPS',
    localNamesBn: ['আখের ছিবড়া', 'sugarcane tops'],
    localNamesEn: ['Sugarcane Tops'],
    titleBn: 'আখের ছিবড়া',
    titleEn: 'Sugarcane Tops',
    dmPercent: 25,
    cpPercent: 5,
    tdnPercent: 50,
    ndfPercent: 70,
    adfPercent: 45,
    cfPercent: 35,
    eePercent: 1.5,
    ashPercent: 8,
    caPercent: 0.3,
    pPercent: 0.12,
    meValueMjPerKg: 7.5,
    bdAvailability: 'SEASONALLY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 2,
    seasonality: [
      { month: 11, availability: 'high', priceIndex: 0.8 },
      { month: 12, availability: 'high', priceIndex: 0.7 },
      { month: 1, availability: 'high', priceIndex: 0.7 },
      { month: 2, availability: 'medium', priceIndex: 0.9 },
      { month: 3, availability: 'low', priceIndex: 1.2 },
    ],
    maxInclusions: [
      { species: 'COW', productionStage: 'MAINTENANCE', maxPercentDm: 50, reason: 'Good roughage' },
      { species: 'BUFFALO', productionStage: 'MAINTENANCE', maxPercentDm: 55, reason: 'High fiber tolerance' },
    ],
    sourceAttributions: ['BLRI-Feed-DB-2023', 'FAO-Feed-Tables'],
  },

  // ── MORE INGREDIENTS for comprehensive coverage ──
  {
    ingredientCode: 'BD_COCONUT_CAKE',
    localNamesBn: ['নারিকেলের খৈল', 'copra cake'],
    localNamesEn: ['Coconut Oilcake', 'Copra Cake'],
    titleBn: 'নারিকেলের খৈল',
    titleEn: 'Coconut Oilcake',
    dmPercent: 92,
    cpPercent: 22,
    tdnPercent: 78,
    ndfPercent: 52,
    adfPercent: 25,
    cfPercent: 12,
    eePercent: 8,
    ashPercent: 6,
    caPercent: 0.2,
    pPercent: 0.6,
    meValueMjPerKg: 12.5,
    bdAvailability: 'REGIONAL_LIMITED',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 45,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 30, reason: 'Good energy and protein' },
      { species: 'GOAT', productionStage: 'GROWING', maxPercentDm: 25, reason: 'Palatability' },
    ],
    sourceAttributions: ['NRC-2001', 'FAO-Feed-Tables'],
  },
  {
    ingredientCode: 'BD_GROUNDNUT_CAKE',
    localNamesBn: ['বাদামের খৈল', 'চিনাবাদাম খৈল'],
    localNamesEn: ['Groundnut Oilcake', 'Peanut Cake'],
    titleBn: 'বাদামের খৈল',
    titleEn: 'Groundnut Oilcake',
    dmPercent: 92,
    cpPercent: 45,
    tdnPercent: 80,
    ndfPercent: 18,
    adfPercent: 10,
    cfPercent: 7,
    eePercent: 7,
    ashPercent: 5,
    caPercent: 0.2,
    pPercent: 0.6,
    meValueMjPerKg: 13.0,
    bdAvailability: 'REGIONAL_LIMITED',
    priceVolatility: 'HIGH',
    avgPriceBdtPerKg: 65,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 25, reason: 'Aflatoxin risk' },
    ],
    antinutrients: [
      { compound: 'Aflatoxin', threshold: '< 20 ppb', effect: 'Liver damage, carcinogenic', mitigation: 'Source quality, storage' },
    ],
    sourceAttributions: ['NRC-2001', 'BLRI-Feed-DB-2023'],
  },
  {
    ingredientCode: 'BD_LINSEED_CAKE',
    localNamesBn: ['তিসির খৈল', 'flaxseed cake'],
    localNamesEn: ['Linseed Oilcake', 'Flaxseed Cake'],
    titleBn: 'তিসির খৈল',
    titleEn: 'Linseed Oilcake',
    dmPercent: 90,
    cpPercent: 35,
    tdnPercent: 78,
    ndfPercent: 22,
    adfPercent: 12,
    cfPercent: 8,
    eePercent: 6,
    ashPercent: 5,
    caPercent: 0.4,
    pPercent: 0.8,
    meValueMjPerKg: 12.8,
    bdAvailability: 'IMPORT_DEPENDENT',
    priceVolatility: 'HIGH',
    avgPriceBdtPerKg: 70,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 15, reason: 'Mucilage content' },
    ],
    antinutrients: [
      { compound: 'Cyanogenic glycosides', threshold: '< 200 ppm', effect: 'HCN release', mitigation: 'Heat treatment' },
    ],
    sourceAttributions: ['NRC-2001'],
  },

  // ── COMMERCIAL FEEDS ──
  {
    ingredientCode: 'BD_CATTLE_FEED_PELLET',
    localNamesBn: ['গরুর ফিড', 'রেডিমেড ফিড', 'cattle pellet'],
    localNamesEn: ['Cattle Feed Pellet', 'Commercial Cattle Feed'],
    titleBn: 'গরুর ফিড (পেলেট)',
    titleEn: 'Cattle Feed Pellet',
    dmPercent: 88,
    cpPercent: 16,
    tdnPercent: 72,
    ndfPercent: 25,
    adfPercent: 12,
    cfPercent: 8,
    eePercent: 3,
    ashPercent: 8,
    caPercent: 1.0,
    pPercent: 0.5,
    meValueMjPerKg: 11.5,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 48,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 60, reason: 'Complete feed' },
      { species: 'COW', productionStage: 'FATTENING', maxPercentDm: 70, reason: 'Finishing' },
    ],
    sourceAttributions: ['Commercial-BD-Standards'],
  },
  {
    ingredientCode: 'BD_DAIRY_FEED',
    localNamesBn: ['দুগ্ধ ফিড', 'দুধেল গাভীর খাদ্য', 'dairy pellet'],
    localNamesEn: ['Dairy Feed', 'Lactating Cow Feed'],
    titleBn: 'দুগ্ধ ফিড',
    titleEn: 'Dairy Feed',
    dmPercent: 88,
    cpPercent: 18,
    tdnPercent: 75,
    ndfPercent: 22,
    adfPercent: 10,
    cfPercent: 7,
    eePercent: 4,
    ashPercent: 9,
    caPercent: 1.2,
    pPercent: 0.6,
    meValueMjPerKg: 12.0,
    bdAvailability: 'WIDELY_AVAILABLE',
    priceVolatility: 'MODERATE',
    avgPriceBdtPerKg: 56,
    maxInclusions: [
      { species: 'COW', productionStage: 'EARLY_LACTATION', maxPercentDm: 65, reason: 'Optimized for milk' },
    ],
    sourceAttributions: ['Commercial-BD-Standards'],
  },
];

async function createVkEntityAndVersion(ingredient: FeedIngredientSeed): Promise<{ entityId: string; versionId: string }> {
  const slug = `feed-ingredient-${ingredient.ingredientCode.toLowerCase().replace(/_/g, '-')}`;

  const entity = await prisma.vkKnowledgeEntity.upsert({
    where: { slug },
    update: {},
    create: {
      domain: 'FEED',
      entityType: 'FEED_INGREDIENT',
      slug,
    },
  });

  const existingVersion = await prisma.vkKnowledgeVersion.findFirst({
    where: { entityId: entity.id, status: 'PUBLISHED' },
    orderBy: { versionNumber: 'desc' },
  });

  if (existingVersion) {
    return { entityId: entity.id, versionId: existingVersion.id };
  }

  const bodyBn = `${ingredient.titleBn} একটি গুরুত্বপূর্ণ পশুখাদ্য উপাদান। শুষ্ক পদার্থ: ${ingredient.dmPercent}%, প্রোটিন: ${ingredient.cpPercent ?? 'N/A'}%, TDN: ${ingredient.tdnPercent ?? 'N/A'}%। বাংলাদেশে ${ingredient.bdAvailability === 'WIDELY_AVAILABLE' ? 'সহজলভ্য' : 'সীমিত পরিমাণে পাওয়া যায়'}।`;
  const bodyEn = `${ingredient.titleEn} is an important livestock feed ingredient. Dry matter: ${ingredient.dmPercent}%, Crude protein: ${ingredient.cpPercent ?? 'N/A'}%, TDN: ${ingredient.tdnPercent ?? 'N/A'}%. In Bangladesh, it is ${ingredient.bdAvailability === 'WIDELY_AVAILABLE' ? 'widely available' : 'available in limited quantities'}.`;

  const version = await prisma.vkKnowledgeVersion.create({
    data: {
      entityId: entity.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      titleBn: ingredient.titleBn,
      titleEn: ingredient.titleEn,
      bodyBn,
      bodyEn,
      species: [],
      keywordsBn: ingredient.localNamesBn,
      keywordsEn: ingredient.localNamesEn,
      colloquialBn: ingredient.localNamesBn,
      clinicalRiskTier: 'LOW',
      publishedAt: new Date(),
    },
  });

  await prisma.vkKnowledgeEntity.update({
    where: { id: entity.id },
    data: { currentPublishedVersionId: version.id },
  });

  return { entityId: entity.id, versionId: version.id };
}

async function seedFeedIngredient(ingredient: FeedIngredientSeed): Promise<void> {
  const { versionId } = await createVkEntityAndVersion(ingredient);

  const feedItem = ingredient.feedItemCode
    ? await prisma.feedItem.findUnique({ where: { code: ingredient.feedItemCode } })
    : null;

  await prisma.vkFeedIngredient.upsert({
    where: { ingredientCode: ingredient.ingredientCode },
    update: {
      localNamesBn: ingredient.localNamesBn,
      localNamesEn: ingredient.localNamesEn,
      dmPercent: new Prisma.Decimal(ingredient.dmPercent),
      cpPercent: ingredient.cpPercent != null ? new Prisma.Decimal(ingredient.cpPercent) : null,
      tdnPercent: ingredient.tdnPercent != null ? new Prisma.Decimal(ingredient.tdnPercent) : null,
      ndfPercent: ingredient.ndfPercent != null ? new Prisma.Decimal(ingredient.ndfPercent) : null,
      adfPercent: ingredient.adfPercent != null ? new Prisma.Decimal(ingredient.adfPercent) : null,
      meValueMjPerKg: ingredient.meValueMjPerKg != null ? new Prisma.Decimal(ingredient.meValueMjPerKg) : null,
      caPercent: ingredient.caPercent != null ? new Prisma.Decimal(ingredient.caPercent) : null,
      pPercent: ingredient.pPercent != null ? new Prisma.Decimal(ingredient.pPercent) : null,
      cfPercent: ingredient.cfPercent != null ? new Prisma.Decimal(ingredient.cfPercent) : null,
      eePercent: ingredient.eePercent != null ? new Prisma.Decimal(ingredient.eePercent) : null,
      ashPercent: ingredient.ashPercent != null ? new Prisma.Decimal(ingredient.ashPercent) : null,
      bdAvailability: ingredient.bdAvailability,
      priceVolatility: ingredient.priceVolatility,
      avgPriceBdtPerKg: new Prisma.Decimal(ingredient.avgPriceBdtPerKg),
      seasonalityJson: ingredient.seasonality ?? Prisma.JsonNull,
      speciesRestrictions: ingredient.speciesRestrictions ?? [],
      antinutrientJson: ingredient.antinutrients ?? Prisma.JsonNull,
      maxInclusionJson: ingredient.maxInclusions ?? Prisma.JsonNull,
      sourceAttributionsJson: ingredient.sourceAttributions,
      feedItemId: feedItem?.id ?? null,
      lastPriceUpdateAt: new Date(),
    },
    create: {
      versionId,
      ingredientCode: ingredient.ingredientCode,
      localNamesBn: ingredient.localNamesBn,
      localNamesEn: ingredient.localNamesEn,
      dmPercent: new Prisma.Decimal(ingredient.dmPercent),
      cpPercent: ingredient.cpPercent != null ? new Prisma.Decimal(ingredient.cpPercent) : null,
      tdnPercent: ingredient.tdnPercent != null ? new Prisma.Decimal(ingredient.tdnPercent) : null,
      ndfPercent: ingredient.ndfPercent != null ? new Prisma.Decimal(ingredient.ndfPercent) : null,
      adfPercent: ingredient.adfPercent != null ? new Prisma.Decimal(ingredient.adfPercent) : null,
      meValueMjPerKg: ingredient.meValueMjPerKg != null ? new Prisma.Decimal(ingredient.meValueMjPerKg) : null,
      caPercent: ingredient.caPercent != null ? new Prisma.Decimal(ingredient.caPercent) : null,
      pPercent: ingredient.pPercent != null ? new Prisma.Decimal(ingredient.pPercent) : null,
      cfPercent: ingredient.cfPercent != null ? new Prisma.Decimal(ingredient.cfPercent) : null,
      eePercent: ingredient.eePercent != null ? new Prisma.Decimal(ingredient.eePercent) : null,
      ashPercent: ingredient.ashPercent != null ? new Prisma.Decimal(ingredient.ashPercent) : null,
      bdAvailability: ingredient.bdAvailability,
      priceVolatility: ingredient.priceVolatility,
      avgPriceBdtPerKg: new Prisma.Decimal(ingredient.avgPriceBdtPerKg),
      seasonalityJson: ingredient.seasonality ?? Prisma.JsonNull,
      speciesRestrictions: ingredient.speciesRestrictions ?? [],
      antinutrientJson: ingredient.antinutrients ?? Prisma.JsonNull,
      maxInclusionJson: ingredient.maxInclusions ?? Prisma.JsonNull,
      sourceAttributionsJson: ingredient.sourceAttributions,
      feedItemId: feedItem?.id ?? null,
      lastPriceUpdateAt: new Date(),
    },
  });
}

export async function seedBdFeedIngredients(): Promise<{ seeded: number }> {
  let seeded = 0;

  for (const ingredient of BD_FEED_INGREDIENTS) {
    try {
      await seedFeedIngredient(ingredient);
      seeded += 1;
      console.log(`[feed-seed] Seeded: ${ingredient.ingredientCode}`);
    } catch (err) {
      console.error(`[feed-seed] Failed to seed ${ingredient.ingredientCode}:`, err);
    }
  }

  return { seeded };
}

async function runCli(): Promise<void> {
  console.log(`[feed-seed] Starting Bangladesh Feed Ingredient Database seed...`);
  console.log(`[feed-seed] Total ingredients: ${BD_FEED_INGREDIENTS.length}`);

  const result = await seedBdFeedIngredients();

  console.log(`[feed-seed] Completed. Seeded: ${result.seeded}/${BD_FEED_INGREDIENTS.length}`);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('bd-feed-ingredient-seed.ts') ||
    process.argv[1].endsWith('bd-feed-ingredient-seed.js'));

if (isDirectRun) {
  runCli()
    .then(async () => {
      await disconnectPrisma();
    })
    .catch(async (e: unknown) => {
      console.error(e);
      await disconnectPrisma();
      process.exit(1);
    });
}

export { BD_FEED_INGREDIENTS };
