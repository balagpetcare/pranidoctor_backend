import {
  FeedCategory,
  FeedMoistureType,
  FeedUnit,
  FeedVendorVerificationStatus,
  type Prisma,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

type FeedSeedRow = {
  code: string;
  nameBn: string;
  nameEn: string;
  category: FeedCategory;
  defaultUnit: FeedUnit;
  approxPriceBdt: number;
  sortOrder: number;
  moistureType?: FeedMoistureType;
  isSeasonal?: boolean;
  nutrition?: {
    cpPercent?: number;
    tdnPercent?: number;
    dmPercent?: number;
  };
  suitabilityJson?: Prisma.InputJsonValue;
};

const FEED_ITEMS: FeedSeedRow[] = [
  { code: 'p4-bd-rice-straw', nameBn: 'ধানের খড়', nameEn: 'Rice straw', category: FeedCategory.ROUGHAGE, defaultUnit: FeedUnit.BUNDLE, approxPriceBdt: 10, sortOrder: 10, nutrition: { cpPercent: 3, tdnPercent: 45, dmPercent: 90 }, suitabilityJson: { animalTypes: ['COW', 'GOAT', 'BUFFALO'] } },
  { code: 'p4-bd-wheat-bran', nameBn: 'গমের ভুসি', nameEn: 'Wheat bran', category: FeedCategory.CONCENTRATE, defaultUnit: FeedUnit.KG, approxPriceBdt: 28, sortOrder: 20, nutrition: { cpPercent: 15, tdnPercent: 70, dmPercent: 88 }, suitabilityJson: { animalTypes: ['COW', 'GOAT', 'BUFFALO', 'CHICKEN'] } },
  { code: 'p4-bd-mustard-oilcake', nameBn: 'সরিষার খৈল', nameEn: 'Mustard oil cake', category: FeedCategory.CONCENTRATE, defaultUnit: FeedUnit.KG, approxPriceBdt: 42, sortOrder: 30, nutrition: { cpPercent: 38, tdnPercent: 75, dmPercent: 90 }, suitabilityJson: { animalTypes: ['COW', 'GOAT', 'BUFFALO'] } },
  { code: 'p4-bd-rice-polish', nameBn: 'চালের কুড়া', nameEn: 'Rice polish', category: FeedCategory.CONCENTRATE, defaultUnit: FeedUnit.KG, approxPriceBdt: 22, sortOrder: 40, nutrition: { cpPercent: 13, tdnPercent: 80, dmPercent: 88 } },
  { code: 'p4-bd-green-grass', nameBn: 'সবুজ ঘাস', nameEn: 'Green grass', category: FeedCategory.GREEN, defaultUnit: FeedUnit.BUNDLE, approxPriceBdt: 5, sortOrder: 50, moistureType: FeedMoistureType.FRESH, nutrition: { cpPercent: 8, tdnPercent: 55, dmPercent: 25 } },
  { code: 'p4-bd-maize-grain', nameBn: 'ভুট্টা দানা', nameEn: 'Maize grain', category: FeedCategory.CONCENTRATE, defaultUnit: FeedUnit.KG, approxPriceBdt: 35, sortOrder: 60, nutrition: { cpPercent: 9, tdnPercent: 85, dmPercent: 88 } },
  { code: 'p4-bd-mineral-mix', nameBn: 'খনিজ মিশ্রণ', nameEn: 'Mineral mix', category: FeedCategory.MINERAL, defaultUnit: FeedUnit.KG, approxPriceBdt: 120, sortOrder: 70, nutrition: { cpPercent: 0, tdnPercent: 0, dmPercent: 95 } },
  { code: 'p4-bd-molasses', nameBn: 'গুড়', nameEn: 'Molasses', category: FeedCategory.SUPPLEMENT, defaultUnit: FeedUnit.LITER, approxPriceBdt: 45, sortOrder: 80, moistureType: FeedMoistureType.WET },
  { code: 'p4-bd-poultry-feed', nameBn: 'বাণিজ্যিক মুরগির খাবার', nameEn: 'Commercial poultry feed', category: FeedCategory.CONCENTRATE, defaultUnit: FeedUnit.BAG, approxPriceBdt: 2800, sortOrder: 90, nutrition: { cpPercent: 18, tdnPercent: 78, dmPercent: 90 }, suitabilityJson: { animalTypes: ['CHICKEN', 'DUCK'] } },
  { code: 'p4-bd-silage', nameBn: 'সাইলেজ', nameEn: 'Silage', category: FeedCategory.SILAGE, defaultUnit: FeedUnit.KG, approxPriceBdt: 8, sortOrder: 100, moistureType: FeedMoistureType.WET, isSeasonal: true, nutrition: { cpPercent: 8, tdnPercent: 65, dmPercent: 35 } },
];

export const PHASE4_FEED_SEED_COUNT = FEED_ITEMS.length;
export const PHASE4_VENDOR_SEED_COUNT = 2;

export async function runPhase4FeedItemsSeed(): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of FEED_ITEMS) {
    const existing = await prisma.feedItem.findUnique({ where: { code: row.code } });
    const data: Prisma.FeedItemUpdateInput = {
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      category: row.category,
      defaultUnit: row.defaultUnit,
      approxPriceBdt: row.approxPriceBdt,
      moistureType: row.moistureType ?? FeedMoistureType.DRY,
      isSeasonal: row.isSeasonal ?? false,
      isSeeded: true,
      isActive: true,
      sortOrder: row.sortOrder,
    };
    if (row.suitabilityJson !== undefined) {
      data.suitabilityJson = row.suitabilityJson;
    }

    if (existing) {
      await prisma.feedItem.update({ where: { code: row.code }, data });
      if (row.nutrition) {
        const nutritionData = {
          ...(row.nutrition.cpPercent !== undefined ? { cpPercent: row.nutrition.cpPercent } : {}),
          ...(row.nutrition.tdnPercent !== undefined ? { tdnPercent: row.nutrition.tdnPercent } : {}),
          ...(row.nutrition.dmPercent !== undefined ? { dmPercent: row.nutrition.dmPercent } : {}),
          source: 'phase4-seed',
        };
        await prisma.feedNutrition.upsert({
          where: { feedItemId: existing.id },
          create: { feedItemId: existing.id, ...nutritionData },
          update: nutritionData,
        });
      }
      updated += 1;
    } else {
      const createData: Prisma.FeedItemCreateInput = {
        code: row.code,
        nameBn: row.nameBn,
        nameEn: row.nameEn,
        category: row.category,
        defaultUnit: row.defaultUnit,
        approxPriceBdt: row.approxPriceBdt,
        moistureType: row.moistureType ?? FeedMoistureType.DRY,
        isSeasonal: row.isSeasonal ?? false,
        isSeeded: true,
        isActive: true,
        sortOrder: row.sortOrder,
      };
      if (row.suitabilityJson !== undefined) {
        createData.suitabilityJson = row.suitabilityJson;
      }
      if (row.nutrition) {
        createData.nutrition = {
          create: {
            ...(row.nutrition.cpPercent !== undefined ? { cpPercent: row.nutrition.cpPercent } : {}),
            ...(row.nutrition.tdnPercent !== undefined ? { tdnPercent: row.nutrition.tdnPercent } : {}),
            ...(row.nutrition.dmPercent !== undefined ? { dmPercent: row.nutrition.dmPercent } : {}),
            source: 'phase4-seed',
          },
        };
      }
      await prisma.feedItem.create({ data: createData });
      created += 1;
    }
  }

  return { created, updated };
}

export async function runPhase4VendorsSeed(): Promise<{ created: number; updated: number }> {
  const VENDORS = [
    {
      name: 'Dhaka Feed Supply',
      nameBn: 'ঢাকা ফিড সাপ্লাই',
      phone: '01700000001',
      address: 'Kawran Bazar, Dhaka',
      products: [
        { displayName: 'Mustard oil cake (50kg bag)', unit: FeedUnit.BAG, priceBdt: 2100, feedCode: 'p4-bd-mustard-oilcake' },
        { displayName: 'Wheat bran', unit: FeedUnit.KG, priceBdt: 28, feedCode: 'p4-bd-wheat-bran' },
      ],
    },
    {
      name: 'Rajshahi Agro Store',
      nameBn: 'রাজশাহী এগ্রো স্টোর',
      phone: '01700000002',
      address: 'Saheb Bazar, Rajshahi',
      products: [
        { displayName: 'Rice straw bundle', unit: FeedUnit.BUNDLE, priceBdt: 12, feedCode: 'p4-bd-rice-straw' },
      ],
    },
  ];

  let created = 0;
  let updated = 0;

  for (const v of VENDORS) {
    const existing = await prisma.feedVendor.findUnique({ where: { id: `seed-vendor-${v.phone}` } });
    const vendor = await prisma.feedVendor.upsert({
      where: { id: `seed-vendor-${v.phone}` },
      create: {
        id: `seed-vendor-${v.phone}`,
        name: v.name,
        nameBn: v.nameBn,
        phone: v.phone,
        address: v.address,
        notes: 'phase4-seed',
        verificationStatus: FeedVendorVerificationStatus.VERIFIED,
        isActive: true,
      },
      update: {
        name: v.name,
        nameBn: v.nameBn,
        address: v.address,
        notes: 'phase4-seed',
        verificationStatus: FeedVendorVerificationStatus.VERIFIED,
        isActive: true,
      },
    });

    if (existing) updated += 1;
    else created += 1;

    for (const p of v.products) {
      const feedItem = await prisma.feedItem.findUnique({ where: { code: p.feedCode } });
      const product = await prisma.feedVendorProduct.findFirst({
        where: { vendorId: vendor.id, displayName: p.displayName },
      });
      if (product) {
        await prisma.feedVendorProduct.update({
          where: { id: product.id },
          data: { priceBdt: p.priceBdt, feedItemId: feedItem?.id ?? null, isActive: true },
        });
      } else {
        await prisma.feedVendorProduct.create({
          data: {
            vendorId: vendor.id,
            displayName: p.displayName,
            unit: p.unit,
            priceBdt: p.priceBdt,
            feedItemId: feedItem?.id ?? null,
            isActive: true,
          },
        });
      }
    }
  }

  return { created, updated };
}
