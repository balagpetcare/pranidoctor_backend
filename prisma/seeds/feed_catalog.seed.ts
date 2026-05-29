/**
 * Bangladesh cattle feed master catalog — idempotent upsert by `code`.
 * Run: npm run db:seed:feed-catalog
 *
 * Extended metadata (aliases, nutrientTags, isPopular) stored in nutritionJson.
 */
import { loadEnvironment } from '../../src/shared/config/load-env.js';

loadEnvironment();

import { FeedCategory, FeedUnit, Prisma } from '../../src/generated/prisma/index.js';
import { disconnectPrisma, prisma } from '../../src/lib/prisma.js';

type SeedRow = {
  code: string;
  nameBn: string;
  nameEn: string;
  category: FeedCategory;
  defaultUnit: FeedUnit;
  approxPriceBdt: number;
  sortOrder: number;
  availabilityScore?: number;
  aliases?: string[];
  nutrientTags?: string[];
  isPopular?: boolean;
};

function priceMultiplier(): number {
  const raw = process.env.FEED_CATALOG_PRICE_MULTIPLIER?.trim();
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function metaJson(row: SeedRow): Prisma.InputJsonValue {
  return {
    aliases: row.aliases ?? [],
    nutrientTags: row.nutrientTags ?? [],
    isPopular: row.isPopular ?? false,
  };
}

const BANGLADESH_FEEDS: SeedRow[] = [
  // ── A. Roughage ──
  {
    code: 'bd-straw-generic',
    nameBn: 'খড়',
    nameEn: 'Straw (general)',
    category: FeedCategory.ROUGHAGE,
    defaultUnit: FeedUnit.BUNDLE,
    approxPriceBdt: 9,
    sortOrder: 10,
    availabilityScore: 5,
    aliases: ['খড়', 'dry straw'],
    nutrientTags: ['roughage', 'fiber'],
    isPopular: true,
  },
  {
    code: 'bd-rice-straw',
    nameBn: 'ধানের খড়',
    nameEn: 'Rice straw',
    category: FeedCategory.ROUGHAGE,
    defaultUnit: FeedUnit.BUNDLE,
    approxPriceBdt: 10,
    sortOrder: 20,
    availabilityScore: 5,
    aliases: ['ধানের খড়', 'rice straw'],
    nutrientTags: ['roughage', 'fiber'],
    isPopular: true,
  },
  {
    code: 'bd-wheat-straw',
    nameBn: 'গমের খড়',
    nameEn: 'Wheat straw',
    category: FeedCategory.ROUGHAGE,
    defaultUnit: FeedUnit.BUNDLE,
    approxPriceBdt: 12,
    sortOrder: 30,
    availabilityScore: 4,
    aliases: ['গমের খড়', 'wheat straw'],
    nutrientTags: ['roughage', 'fiber'],
    isPopular: true,
  },
  {
    code: 'bd-green-grass',
    nameBn: 'সবুজ ঘাস',
    nameEn: 'Green grass',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 2,
    sortOrder: 40,
    availabilityScore: 5,
    aliases: ['green fodder', 'fresh grass'],
    nutrientTags: ['roughage', 'green'],
    isPopular: true,
  },
  {
    code: 'bd-napier-grass',
    nameBn: 'নেপিয়ার',
    nameEn: 'Napier grass',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 3,
    sortOrder: 50,
    availabilityScore: 4,
    aliases: ['নেপিয়ার', 'napier'],
    nutrientTags: ['roughage', 'green'],
    isPopular: true,
  },
  {
    code: 'bd-german-grass',
    nameBn: 'জার্মান ঘাস',
    nameEn: 'German grass',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 4,
    sortOrder: 60,
    availabilityScore: 3,
    aliases: ['german fodder'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-maize-silage',
    nameBn: 'ভুট্টা সাইলেজ',
    nameEn: 'Maize silage',
    category: FeedCategory.SILAGE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 15,
    sortOrder: 70,
    availabilityScore: 3,
    aliases: ['corn silage', 'maize silage'],
    nutrientTags: ['roughage', 'energy'],
    isPopular: true,
  },
  {
    code: 'bd-hay',
    nameBn: 'হে',
    nameEn: 'Hay',
    category: FeedCategory.ROUGHAGE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 14,
    sortOrder: 80,
    availabilityScore: 3,
    aliases: ['dried hay', 'hay bale'],
    nutrientTags: ['roughage', 'fiber'],
  },

  // ── B. Bran / Energy ──
  {
    code: 'bd-wheat-bran',
    nameBn: 'গমের ভুষি',
    nameEn: 'Wheat bran',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 32,
    sortOrder: 100,
    availabilityScore: 4,
    aliases: ['গম ভুসি', 'wheat pollard', 'ভুষি'],
    nutrientTags: ['energy', 'bran'],
    isPopular: true,
  },
  {
    code: 'bd-rice-bran',
    nameBn: 'চালের কুঁড়া',
    nameEn: 'Rice bran',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 25,
    sortOrder: 110,
    availabilityScore: 5,
    aliases: ['rice pollard', 'কুঁড়া'],
    nutrientTags: ['energy', 'bran'],
    isPopular: true,
  },
  {
    code: 'bd-parboiled-rice-bran',
    nameBn: 'আতপ কুঁড়া',
    nameEn: 'Parboiled rice bran',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 28,
    sortOrder: 120,
    availabilityScore: 4,
    aliases: ['atap kurra', 'parboiled bran'],
    nutrientTags: ['energy', 'bran'],
    isPopular: true,
  },
  {
    code: 'bd-maize-broken',
    nameBn: 'ভুট্টা ভাঙ্গা',
    nameEn: 'Cracked maize',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 30,
    sortOrder: 130,
    availabilityScore: 4,
    aliases: ['broken corn', 'cracked corn'],
    nutrientTags: ['energy', 'starch'],
    isPopular: true,
  },
  {
    code: 'bd-maize-meal',
    nameBn: 'ভুট্টা গুঁড়া',
    nameEn: 'Maize meal',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 34,
    sortOrder: 140,
    availabilityScore: 4,
    aliases: ['corn meal', 'maize grind'],
    nutrientTags: ['energy', 'starch'],
  },
  {
    code: 'bd-chitagur',
    nameBn: 'চিটাগুড়',
    nameEn: 'Date palm jaggery (Chitagur)',
    category: FeedCategory.SUPPLEMENT,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 55,
    sortOrder: 150,
    availabilityScore: 3,
    aliases: ['date jaggery', 'palm gur'],
    nutrientTags: ['energy', 'supplement'],
  },
  {
    code: 'bd-molasses',
    nameBn: 'মোলাসেস',
    nameEn: 'Molasses',
    category: FeedCategory.SUPPLEMENT,
    defaultUnit: FeedUnit.LITER,
    approxPriceBdt: 40,
    sortOrder: 160,
    availabilityScore: 4,
    aliases: ['gur molasses', 'treacle'],
    nutrientTags: ['energy', 'supplement'],
    isPopular: true,
  },

  // ── C. Protein ──
  {
    code: 'bd-mustard-cake',
    nameBn: 'সরিষার খৈল',
    nameEn: 'Mustard oilcake',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 50,
    sortOrder: 200,
    availabilityScore: 4,
    aliases: ['খৈল', 'mustard cake', 'sarisha khail'],
    nutrientTags: ['protein', 'oilcake'],
    isPopular: true,
  },
  {
    code: 'bd-soybean-meal',
    nameBn: 'সয়াবিন খৈল',
    nameEn: 'Soybean meal',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 60,
    sortOrder: 210,
    availabilityScore: 3,
    aliases: ['soy meal', 'soybean cake'],
    nutrientTags: ['protein', 'oilcake'],
    isPopular: true,
  },
  {
    code: 'bd-sesame-cake',
    nameBn: 'তিলের খৈল',
    nameEn: 'Sesame oilcake',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 58,
    sortOrder: 220,
    availabilityScore: 3,
    aliases: ['til khail', 'sesame cake'],
    nutrientTags: ['protein', 'oilcake'],
  },
  {
    code: 'bd-coconut-cake',
    nameBn: 'নারিকেলের খৈল',
    nameEn: 'Coconut oilcake',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 45,
    sortOrder: 230,
    availabilityScore: 3,
    aliases: ['copra cake', 'narikel khail'],
    nutrientTags: ['protein', 'oilcake'],
  },
  {
    code: 'bd-pulse-broken',
    nameBn: 'ডাল ভাঙ্গা',
    nameEn: 'Broken pulses',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 55,
    sortOrder: 240,
    availabilityScore: 4,
    aliases: ['dal vanga', 'broken dal'],
    nutrientTags: ['protein', 'pulse'],
  },
  {
    code: 'bd-fish-meal',
    nameBn: 'মাছের গুঁড়া',
    nameEn: 'Fish meal',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 75,
    sortOrder: 250,
    availabilityScore: 2,
    aliases: ['fish powder', 'machher gura'],
    nutrientTags: ['protein', 'animal'],
  },

  // ── D. Mineral ──
  {
    code: 'bd-salt',
    nameBn: 'লবণ',
    nameEn: 'Salt',
    category: FeedCategory.MINERAL,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 20,
    sortOrder: 300,
    availabilityScore: 5,
    aliases: ['salt lick', 'common salt'],
    nutrientTags: ['mineral', 'sodium'],
    isPopular: true,
  },
  {
    code: 'bd-mineral-mix',
    nameBn: 'মিনারেল মিক্স',
    nameEn: 'Mineral mix',
    category: FeedCategory.MINERAL,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 95,
    sortOrder: 310,
    availabilityScore: 4,
    aliases: ['mineral premix', 'trace minerals'],
    nutrientTags: ['mineral'],
    isPopular: true,
  },
  {
    code: 'bd-dcp',
    nameBn: 'ডি সি পি',
    nameEn: 'Dicalcium phosphate (DCP)',
    category: FeedCategory.MINERAL,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 110,
    sortOrder: 320,
    availabilityScore: 3,
    aliases: ['DCP', 'dicalcium phosphate'],
    nutrientTags: ['mineral', 'phosphorus', 'calcium'],
  },
  {
    code: 'bd-calcium',
    nameBn: 'ক্যালসিয়াম',
    nameEn: 'Calcium supplement',
    category: FeedCategory.MINERAL,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 85,
    sortOrder: 330,
    availabilityScore: 3,
    aliases: ['calcium powder', 'lime supplement'],
    nutrientTags: ['mineral', 'calcium'],
  },

  // ── E. Commercial ──
  {
    code: 'bd-cattle-feed-pellet',
    nameBn: 'ফিড মিল গরুর খাদ্য',
    nameEn: 'Cattle feed pellet (feed mill)',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 48,
    sortOrder: 400,
    availabilityScore: 4,
    aliases: ['ready feed', 'pellet feed', 'রেডিমেড ফিড'],
    nutrientTags: ['commercial', 'complete'],
    isPopular: true,
  },
  {
    code: 'bd-grower-feed',
    nameBn: 'গ্রোয়ার',
    nameEn: 'Grower feed',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 52,
    sortOrder: 410,
    availabilityScore: 3,
    aliases: ['grower pellet', 'growth feed'],
    nutrientTags: ['commercial', 'growth'],
  },
  {
    code: 'bd-finisher-feed',
    nameBn: 'ফিনিশার',
    nameEn: 'Finisher feed',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 54,
    sortOrder: 420,
    availabilityScore: 3,
    aliases: ['finishing feed', 'fattening pellet'],
    nutrientTags: ['commercial', 'finishing'],
    isPopular: true,
  },
  {
    code: 'bd-dairy-feed',
    nameBn: 'দুগ্ধ ফিড',
    nameEn: 'Dairy feed',
    category: FeedCategory.CONCENTRATE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 56,
    sortOrder: 430,
    availabilityScore: 4,
    aliases: ['milk feed', 'dairy pellet'],
    nutrientTags: ['commercial', 'dairy'],
    isPopular: true,
  },

  // ── F. Others ──
  {
    code: 'bd-banana-tree',
    nameBn: 'কলাগাছ',
    nameEn: 'Banana pseudostem',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 2,
    sortOrder: 500,
    availabilityScore: 4,
    aliases: ['banana stem', 'kola gach'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-vegetable-waste',
    nameBn: 'সবজি অবশিষ্ট',
    nameEn: 'Vegetable waste',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 1,
    sortOrder: 510,
    availabilityScore: 4,
    aliases: ['kitchen waste', 'veg scraps'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-water-hyacinth',
    nameBn: 'কচুরিপানা',
    nameEn: 'Water hyacinth',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 1,
    sortOrder: 520,
    availabilityScore: 3,
    aliases: ['kochuripana', 'hyacinth'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-maize-leaves',
    nameBn: 'ভুট্টা পাতা',
    nameEn: 'Maize leaves',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 2,
    sortOrder: 530,
    availabilityScore: 4,
    aliases: ['corn leaves', 'maize fodder leaves'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-sugarcane-tops',
    nameBn: 'আখের ছিবড়া',
    nameEn: 'Sugarcane tops',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 2,
    sortOrder: 540,
    availabilityScore: 4,
    aliases: ['sugar cane tops', 'akh chibora'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-fruit-waste',
    nameBn: 'ফল অবশিষ্ট',
    nameEn: 'Fruit waste',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 1,
    sortOrder: 550,
    availabilityScore: 3,
    aliases: ['fruit scraps', 'fol oboshishto'],
    nutrientTags: ['roughage', 'green'],
  },
  {
    code: 'bd-grass-silage',
    nameBn: 'ঘাস সাইলেজ',
    nameEn: 'Grass silage',
    category: FeedCategory.SILAGE,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 12,
    sortOrder: 560,
    availabilityScore: 3,
    aliases: ['grass silage bale'],
    nutrientTags: ['roughage', 'silage'],
  },
  {
    code: 'bd-local-grass',
    nameBn: 'স্থানীয় ঘাস',
    nameEn: 'Local grass',
    category: FeedCategory.GREEN,
    defaultUnit: FeedUnit.KG,
    approxPriceBdt: 2,
    sortOrder: 570,
    availabilityScore: 5,
    aliases: ['local fodder'],
    nutrientTags: ['roughage', 'green'],
  },
];

export async function seedFeedCatalogBangladesh(): Promise<{ created: number; updated: number }> {
  const mult = priceMultiplier();
  let created = 0;
  let updated = 0;

  for (const row of BANGLADESH_FEEDS) {
    const price = new Prisma.Decimal((row.approxPriceBdt * mult).toFixed(2));
    const existing = await prisma.feedCatalog.findUnique({ where: { code: row.code } });

    if (!existing) {
      await prisma.feedCatalog.create({
        data: {
          code: row.code,
          nameBn: row.nameBn,
          nameEn: row.nameEn,
          category: row.category,
          defaultUnit: row.defaultUnit,
          approxPriceBdt: price,
          nutritionJson: metaJson(row),
          availabilityScore: row.availabilityScore ?? null,
          isSeeded: true,
          isActive: true,
          sortOrder: row.sortOrder,
        },
      });
      created += 1;
    } else {
      await prisma.feedCatalog.update({
        where: { code: row.code },
        data: {
          nameBn: row.nameBn,
          nameEn: row.nameEn,
          category: row.category,
          defaultUnit: row.defaultUnit,
          nutritionJson: metaJson(row),
          availabilityScore: row.availabilityScore ?? null,
          isSeeded: true,
          isActive: existing.isActive,
          sortOrder: row.sortOrder,
          ...(existing.approxPriceBdt == null ? { approxPriceBdt: price } : {}),
        },
      });
      updated += 1;
    }
  }

  return { created, updated };
}

async function runCli(): Promise<void> {
  const result = await seedFeedCatalogBangladesh();
  console.log(
    `[feed-catalog seed] Bangladesh master feeds: ${BANGLADESH_FEEDS.length} codes, created=${result.created}, updated=${result.updated}`,
  );
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('feed_catalog.seed.ts') ||
    process.argv[1].endsWith('feed_catalog.seed.js'));

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

export { BANGLADESH_FEEDS };
