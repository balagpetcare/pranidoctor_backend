/**
 * Bangladesh Nutrient Requirement Database Seeder
 * Phase F3: Creates VKL-grounded nutrient requirement knowledge entities
 * 
 * Run: npx tsx scripts/knowledge/feed/bd-nutrient-requirement-seed.ts
 */
import { loadEnvironment } from '../../../src/shared/config/load-env.js';

loadEnvironment();

import { Prisma } from '../../../src/generated/prisma/index.js';
import type {
  BreedCategory,
  LivestockSpecies,
  ProductionStage,
} from '../../../src/generated/prisma/index.js';
import { disconnectPrisma, prisma } from '../../../src/lib/prisma.js';

type NutrientRequirementSeed = {
  species: LivestockSpecies;
  productionStage: ProductionStage;
  breedCategory?: BreedCategory;
  weightRangeMinKg?: number;
  weightRangeMaxKg?: number;
  dmIntakeKgPerDay?: number;
  dmIntakePercentBw?: number;
  cpPercentMin: number;
  cpPercentMax?: number;
  tdnPercentMin: number;
  meMinMjPerKg?: number;
  ndfPercentMax?: number;
  caPercentMin?: number;
  pPercentMin?: number;
  milkYieldLiters?: number;
  adgKg?: number;
  sourceNotes: string;
};

const BD_NUTRIENT_REQUIREMENTS: NutrientRequirementSeed[] = [
  // ── CATTLE - LACTATION ──
  {
    species: 'COW',
    productionStage: 'EARLY_LACTATION',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 15,
    dmIntakePercentBw: 3.5,
    cpPercentMin: 16,
    cpPercentMax: 18,
    tdnPercentMin: 70,
    meMinMjPerKg: 10.5,
    ndfPercentMax: 35,
    caPercentMin: 0.7,
    pPercentMin: 0.45,
    milkYieldLiters: 15,
    sourceNotes: 'NRC 2001, adapted for BD crossbred dairy',
  },
  {
    species: 'COW',
    productionStage: 'EARLY_LACTATION',
    breedCategory: 'LOCAL_DESI',
    weightRangeMinKg: 200,
    weightRangeMaxKg: 300,
    dmIntakeKgPerDay: 8,
    dmIntakePercentBw: 3.0,
    cpPercentMin: 14,
    cpPercentMax: 16,
    tdnPercentMin: 65,
    meMinMjPerKg: 9.5,
    ndfPercentMax: 40,
    caPercentMin: 0.6,
    pPercentMin: 0.35,
    milkYieldLiters: 5,
    sourceNotes: 'BLRI recommendations for local cattle',
  },
  {
    species: 'COW',
    productionStage: 'EARLY_LACTATION',
    breedCategory: 'CROSSBRED',
    weightRangeMinKg: 350,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 16,
    dmIntakePercentBw: 3.5,
    cpPercentMin: 17,
    cpPercentMax: 19,
    tdnPercentMin: 72,
    meMinMjPerKg: 11.0,
    ndfPercentMax: 32,
    caPercentMin: 0.8,
    pPercentMin: 0.5,
    milkYieldLiters: 18,
    sourceNotes: 'NRC 2001, for Holstein x Local crossbred',
  },
  {
    species: 'COW',
    productionStage: 'MID_LACTATION',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 14,
    dmIntakePercentBw: 3.2,
    cpPercentMin: 15,
    cpPercentMax: 17,
    tdnPercentMin: 68,
    meMinMjPerKg: 10.0,
    ndfPercentMax: 38,
    caPercentMin: 0.6,
    pPercentMin: 0.4,
    milkYieldLiters: 12,
    sourceNotes: 'NRC 2001',
  },
  {
    species: 'COW',
    productionStage: 'LATE_LACTATION',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 12,
    dmIntakePercentBw: 2.8,
    cpPercentMin: 13,
    cpPercentMax: 15,
    tdnPercentMin: 62,
    meMinMjPerKg: 9.0,
    ndfPercentMax: 42,
    caPercentMin: 0.5,
    pPercentMin: 0.35,
    milkYieldLiters: 8,
    sourceNotes: 'NRC 2001',
  },
  {
    species: 'COW',
    productionStage: 'DRY_COW',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 10,
    dmIntakePercentBw: 2.2,
    cpPercentMin: 12,
    cpPercentMax: 14,
    tdnPercentMin: 55,
    meMinMjPerKg: 8.0,
    ndfPercentMax: 50,
    caPercentMin: 0.45,
    pPercentMin: 0.25,
    sourceNotes: 'NRC 2001, far-off dry period',
  },
  {
    species: 'COW',
    productionStage: 'LATE_PREGNANT',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 11,
    dmIntakePercentBw: 2.5,
    cpPercentMin: 14,
    cpPercentMax: 15,
    tdnPercentMin: 60,
    meMinMjPerKg: 9.0,
    ndfPercentMax: 45,
    caPercentMin: 0.6,
    pPercentMin: 0.35,
    sourceNotes: 'NRC 2001, close-up dry period',
  },

  // ── CATTLE - GROWTH ──
  {
    species: 'COW',
    productionStage: 'CALF_PRE_WEANING',
    weightRangeMinKg: 30,
    weightRangeMaxKg: 80,
    dmIntakeKgPerDay: 2,
    dmIntakePercentBw: 3.0,
    cpPercentMin: 18,
    cpPercentMax: 22,
    tdnPercentMin: 75,
    meMinMjPerKg: 12.5,
    ndfPercentMax: 25,
    caPercentMin: 0.8,
    pPercentMin: 0.5,
    adgKg: 0.5,
    sourceNotes: 'NRC 2001, milk replacer + starter',
  },
  {
    species: 'COW',
    productionStage: 'CALF_POST_WEANING',
    weightRangeMinKg: 80,
    weightRangeMaxKg: 150,
    dmIntakeKgPerDay: 4,
    dmIntakePercentBw: 3.5,
    cpPercentMin: 16,
    cpPercentMax: 18,
    tdnPercentMin: 70,
    meMinMjPerKg: 11.0,
    ndfPercentMax: 30,
    caPercentMin: 0.6,
    pPercentMin: 0.4,
    adgKg: 0.7,
    sourceNotes: 'NRC 2001',
  },
  {
    species: 'COW',
    productionStage: 'GROWING',
    weightRangeMinKg: 150,
    weightRangeMaxKg: 300,
    dmIntakeKgPerDay: 8,
    dmIntakePercentBw: 3.0,
    cpPercentMin: 14,
    cpPercentMax: 16,
    tdnPercentMin: 65,
    meMinMjPerKg: 10.0,
    ndfPercentMax: 40,
    caPercentMin: 0.5,
    pPercentMin: 0.35,
    adgKg: 0.8,
    sourceNotes: 'NRC 2001',
  },
  {
    species: 'COW',
    productionStage: 'FATTENING',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 12,
    dmIntakePercentBw: 2.8,
    cpPercentMin: 12,
    cpPercentMax: 14,
    tdnPercentMin: 72,
    meMinMjPerKg: 11.5,
    ndfPercentMax: 30,
    caPercentMin: 0.45,
    pPercentMin: 0.3,
    adgKg: 1.2,
    sourceNotes: 'NRC 2001, finishing beef',
  },
  {
    species: 'COW',
    productionStage: 'MAINTENANCE',
    weightRangeMinKg: 300,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 8,
    dmIntakePercentBw: 2.0,
    cpPercentMin: 8,
    cpPercentMax: 10,
    tdnPercentMin: 50,
    meMinMjPerKg: 7.5,
    ndfPercentMax: 60,
    caPercentMin: 0.3,
    pPercentMin: 0.2,
    sourceNotes: 'NRC 2001, maintenance only',
  },

  // ── GOAT ──
  {
    species: 'GOAT',
    productionStage: 'EARLY_LACTATION',
    weightRangeMinKg: 25,
    weightRangeMaxKg: 40,
    dmIntakeKgPerDay: 1.5,
    dmIntakePercentBw: 4.5,
    cpPercentMin: 14,
    cpPercentMax: 16,
    tdnPercentMin: 65,
    meMinMjPerKg: 10.0,
    ndfPercentMax: 40,
    caPercentMin: 0.5,
    pPercentMin: 0.3,
    milkYieldLiters: 1.5,
    sourceNotes: 'NRC 2007 Goat',
  },
  {
    species: 'GOAT',
    productionStage: 'GROWING',
    weightRangeMinKg: 10,
    weightRangeMaxKg: 25,
    dmIntakeKgPerDay: 0.8,
    dmIntakePercentBw: 4.0,
    cpPercentMin: 14,
    cpPercentMax: 16,
    tdnPercentMin: 68,
    meMinMjPerKg: 10.5,
    ndfPercentMax: 35,
    caPercentMin: 0.5,
    pPercentMin: 0.3,
    adgKg: 0.1,
    sourceNotes: 'NRC 2007 Goat',
  },
  {
    species: 'GOAT',
    productionStage: 'FATTENING',
    weightRangeMinKg: 20,
    weightRangeMaxKg: 35,
    dmIntakeKgPerDay: 1.2,
    dmIntakePercentBw: 4.0,
    cpPercentMin: 12,
    cpPercentMax: 14,
    tdnPercentMin: 70,
    meMinMjPerKg: 11.0,
    ndfPercentMax: 30,
    caPercentMin: 0.4,
    pPercentMin: 0.25,
    adgKg: 0.15,
    sourceNotes: 'NRC 2007 Goat, Black Bengal fattening',
  },
  {
    species: 'GOAT',
    productionStage: 'MAINTENANCE',
    weightRangeMinKg: 25,
    weightRangeMaxKg: 40,
    dmIntakeKgPerDay: 1.0,
    dmIntakePercentBw: 3.0,
    cpPercentMin: 8,
    cpPercentMax: 10,
    tdnPercentMin: 55,
    meMinMjPerKg: 8.5,
    ndfPercentMax: 50,
    caPercentMin: 0.3,
    pPercentMin: 0.2,
    sourceNotes: 'NRC 2007 Goat',
  },
  {
    species: 'GOAT',
    productionStage: 'PREGNANT',
    weightRangeMinKg: 25,
    weightRangeMaxKg: 40,
    dmIntakeKgPerDay: 1.2,
    dmIntakePercentBw: 3.5,
    cpPercentMin: 12,
    cpPercentMax: 14,
    tdnPercentMin: 62,
    meMinMjPerKg: 9.5,
    ndfPercentMax: 45,
    caPercentMin: 0.45,
    pPercentMin: 0.28,
    sourceNotes: 'NRC 2007 Goat, late gestation',
  },

  // ── BUFFALO ──
  {
    species: 'BUFFALO',
    productionStage: 'EARLY_LACTATION',
    weightRangeMinKg: 400,
    weightRangeMaxKg: 600,
    dmIntakeKgPerDay: 16,
    dmIntakePercentBw: 3.0,
    cpPercentMin: 15,
    cpPercentMax: 17,
    tdnPercentMin: 68,
    meMinMjPerKg: 10.0,
    ndfPercentMax: 38,
    caPercentMin: 0.7,
    pPercentMin: 0.45,
    milkYieldLiters: 10,
    sourceNotes: 'ICAR Buffalo recommendations',
  },
  {
    species: 'BUFFALO',
    productionStage: 'FATTENING',
    weightRangeMinKg: 350,
    weightRangeMaxKg: 500,
    dmIntakeKgPerDay: 14,
    dmIntakePercentBw: 2.8,
    cpPercentMin: 11,
    cpPercentMax: 13,
    tdnPercentMin: 70,
    meMinMjPerKg: 11.0,
    ndfPercentMax: 32,
    caPercentMin: 0.4,
    pPercentMin: 0.28,
    adgKg: 1.0,
    sourceNotes: 'ICAR Buffalo recommendations',
  },
  {
    species: 'BUFFALO',
    productionStage: 'MAINTENANCE',
    weightRangeMinKg: 400,
    weightRangeMaxKg: 600,
    dmIntakeKgPerDay: 10,
    dmIntakePercentBw: 2.0,
    cpPercentMin: 7,
    cpPercentMax: 9,
    tdnPercentMin: 50,
    meMinMjPerKg: 7.5,
    ndfPercentMax: 60,
    caPercentMin: 0.25,
    pPercentMin: 0.18,
    sourceNotes: 'ICAR Buffalo recommendations',
  },

  // ── POULTRY - CHICKEN ──
  {
    species: 'CHICKEN',
    productionStage: 'LAYING',
    dmIntakePercentBw: 5.0,
    cpPercentMin: 16,
    cpPercentMax: 18,
    tdnPercentMin: 75,
    meMinMjPerKg: 11.5,
    caPercentMin: 3.5,
    pPercentMin: 0.4,
    sourceNotes: 'NRC Poultry 1994, layer phase',
  },
  {
    species: 'CHICKEN',
    productionStage: 'STARTER',
    dmIntakePercentBw: 6.0,
    cpPercentMin: 22,
    cpPercentMax: 24,
    tdnPercentMin: 78,
    meMinMjPerKg: 12.5,
    caPercentMin: 1.0,
    pPercentMin: 0.45,
    sourceNotes: 'NRC Poultry 1994, broiler starter 0-3 weeks',
  },
  {
    species: 'CHICKEN',
    productionStage: 'GROWING',
    dmIntakePercentBw: 5.5,
    cpPercentMin: 20,
    cpPercentMax: 22,
    tdnPercentMin: 78,
    meMinMjPerKg: 13.0,
    caPercentMin: 0.9,
    pPercentMin: 0.4,
    sourceNotes: 'NRC Poultry 1994, broiler grower 3-6 weeks',
  },
  {
    species: 'CHICKEN',
    productionStage: 'FINISHER',
    dmIntakePercentBw: 5.0,
    cpPercentMin: 18,
    cpPercentMax: 20,
    tdnPercentMin: 80,
    meMinMjPerKg: 13.5,
    caPercentMin: 0.85,
    pPercentMin: 0.35,
    sourceNotes: 'NRC Poultry 1994, broiler finisher 6+ weeks',
  },

  // ── DUCK ──
  {
    species: 'DUCK',
    productionStage: 'LAYING',
    dmIntakePercentBw: 5.5,
    cpPercentMin: 17,
    cpPercentMax: 19,
    tdnPercentMin: 72,
    meMinMjPerKg: 11.0,
    caPercentMin: 3.0,
    pPercentMin: 0.45,
    sourceNotes: 'NRC Poultry 1994, duck layer',
  },
  {
    species: 'DUCK',
    productionStage: 'GROWING',
    dmIntakePercentBw: 6.0,
    cpPercentMin: 16,
    cpPercentMax: 18,
    tdnPercentMin: 70,
    meMinMjPerKg: 11.5,
    caPercentMin: 0.65,
    pPercentMin: 0.4,
    sourceNotes: 'NRC Poultry 1994, duck grower',
  },
];

async function createVkEntityAndVersion(requirement: NutrientRequirementSeed): Promise<{ entityId: string; versionId: string }> {
  const slug = `nutrient-req-${requirement.species.toLowerCase()}-${requirement.productionStage.toLowerCase().replace(/_/g, '-')}${requirement.breedCategory ? `-${requirement.breedCategory.toLowerCase().replace(/_/g, '-')}` : ''}`;
  
  const titleBn = `${requirement.species} ${requirement.productionStage} পুষ্টি চাহিদা`;
  const titleEn = `${requirement.species} ${requirement.productionStage.replace(/_/g, ' ')} Nutrient Requirements`;

  const entity = await prisma.vkKnowledgeEntity.upsert({
    where: { slug },
    update: {},
    create: {
      domain: 'FEED',
      entityType: 'NUTRIENT_REQUIREMENT',
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

  const bodyBn = `${requirement.species} প্রাণীর ${requirement.productionStage} পর্যায়ে পুষ্টি চাহিদা: প্রোটিন ${requirement.cpPercentMin}-${requirement.cpPercentMax ?? requirement.cpPercentMin}%, TDN ${requirement.tdnPercentMin}%। ${requirement.sourceNotes}`;
  const bodyEn = `Nutrient requirements for ${requirement.species} in ${requirement.productionStage} stage: CP ${requirement.cpPercentMin}-${requirement.cpPercentMax ?? requirement.cpPercentMin}%, TDN ${requirement.tdnPercentMin}%. ${requirement.sourceNotes}`;

  const version = await prisma.vkKnowledgeVersion.create({
    data: {
      entityId: entity.id,
      versionNumber: 1,
      status: 'PUBLISHED',
      titleBn,
      titleEn,
      bodyBn,
      bodyEn,
      species: [requirement.species],
      keywordsBn: [requirement.species, requirement.productionStage, 'পুষ্টি'],
      keywordsEn: [requirement.species, requirement.productionStage.replace(/_/g, ' '), 'nutrition'],
      colloquialBn: [],
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

async function seedNutrientRequirement(requirement: NutrientRequirementSeed): Promise<void> {
  const { versionId } = await createVkEntityAndVersion(requirement);

  const existing = await prisma.vkNutrientRequirement.findFirst({
    where: {
      species: requirement.species,
      productionStage: requirement.productionStage,
      breedCategory: requirement.breedCategory ?? null,
    },
  });

  if (existing) {
    await prisma.vkNutrientRequirement.update({
      where: { id: existing.id },
      data: {
        versionId,
        weightRangeMinKg: requirement.weightRangeMinKg != null ? new Prisma.Decimal(requirement.weightRangeMinKg) : null,
        weightRangeMaxKg: requirement.weightRangeMaxKg != null ? new Prisma.Decimal(requirement.weightRangeMaxKg) : null,
        dmIntakeKgPerDay: requirement.dmIntakeKgPerDay != null ? new Prisma.Decimal(requirement.dmIntakeKgPerDay) : null,
        dmIntakePercentBw: requirement.dmIntakePercentBw != null ? new Prisma.Decimal(requirement.dmIntakePercentBw) : null,
        cpPercentMin: new Prisma.Decimal(requirement.cpPercentMin),
        cpPercentMax: requirement.cpPercentMax != null ? new Prisma.Decimal(requirement.cpPercentMax) : null,
        tdnPercentMin: new Prisma.Decimal(requirement.tdnPercentMin),
        meMinMjPerKg: requirement.meMinMjPerKg != null ? new Prisma.Decimal(requirement.meMinMjPerKg) : null,
        ndfPercentMax: requirement.ndfPercentMax != null ? new Prisma.Decimal(requirement.ndfPercentMax) : null,
        caPercentMin: requirement.caPercentMin != null ? new Prisma.Decimal(requirement.caPercentMin) : null,
        pPercentMin: requirement.pPercentMin != null ? new Prisma.Decimal(requirement.pPercentMin) : null,
        milkYieldLiters: requirement.milkYieldLiters != null ? new Prisma.Decimal(requirement.milkYieldLiters) : null,
        adgKg: requirement.adgKg != null ? new Prisma.Decimal(requirement.adgKg) : null,
        sourceNotes: requirement.sourceNotes,
      },
    });
  } else {
    await prisma.vkNutrientRequirement.create({
      data: {
        versionId,
        species: requirement.species,
        productionStage: requirement.productionStage,
        breedCategory: requirement.breedCategory ?? null,
        weightRangeMinKg: requirement.weightRangeMinKg != null ? new Prisma.Decimal(requirement.weightRangeMinKg) : null,
        weightRangeMaxKg: requirement.weightRangeMaxKg != null ? new Prisma.Decimal(requirement.weightRangeMaxKg) : null,
        dmIntakeKgPerDay: requirement.dmIntakeKgPerDay != null ? new Prisma.Decimal(requirement.dmIntakeKgPerDay) : null,
        dmIntakePercentBw: requirement.dmIntakePercentBw != null ? new Prisma.Decimal(requirement.dmIntakePercentBw) : null,
        cpPercentMin: new Prisma.Decimal(requirement.cpPercentMin),
        cpPercentMax: requirement.cpPercentMax != null ? new Prisma.Decimal(requirement.cpPercentMax) : null,
        tdnPercentMin: new Prisma.Decimal(requirement.tdnPercentMin),
        meMinMjPerKg: requirement.meMinMjPerKg != null ? new Prisma.Decimal(requirement.meMinMjPerKg) : null,
        ndfPercentMax: requirement.ndfPercentMax != null ? new Prisma.Decimal(requirement.ndfPercentMax) : null,
        caPercentMin: requirement.caPercentMin != null ? new Prisma.Decimal(requirement.caPercentMin) : null,
        pPercentMin: requirement.pPercentMin != null ? new Prisma.Decimal(requirement.pPercentMin) : null,
        milkYieldLiters: requirement.milkYieldLiters != null ? new Prisma.Decimal(requirement.milkYieldLiters) : null,
        adgKg: requirement.adgKg != null ? new Prisma.Decimal(requirement.adgKg) : null,
        sourceNotes: requirement.sourceNotes,
      },
    });
  }
}

export async function seedBdNutrientRequirements(): Promise<{ seeded: number }> {
  let seeded = 0;

  for (const requirement of BD_NUTRIENT_REQUIREMENTS) {
    try {
      await seedNutrientRequirement(requirement);
      seeded += 1;
      console.log(`[nutrient-seed] Seeded: ${requirement.species} ${requirement.productionStage}${requirement.breedCategory ? ` (${requirement.breedCategory})` : ''}`);
    } catch (err) {
      console.error(`[nutrient-seed] Failed to seed ${requirement.species} ${requirement.productionStage}:`, err);
    }
  }

  return { seeded };
}

async function runCli(): Promise<void> {
  console.log(`[nutrient-seed] Starting Bangladesh Nutrient Requirement Database seed...`);
  console.log(`[nutrient-seed] Total requirements: ${BD_NUTRIENT_REQUIREMENTS.length}`);

  const result = await seedBdNutrientRequirements();

  console.log(`[nutrient-seed] Completed. Seeded: ${result.seeded}/${BD_NUTRIENT_REQUIREMENTS.length}`);
}

const isDirectRun =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('bd-nutrient-requirement-seed.ts') ||
    process.argv[1].endsWith('bd-nutrient-requirement-seed.js'));

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

export { BD_NUTRIENT_REQUIREMENTS };
