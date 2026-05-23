import {
  AnimalCategory,
  AnimalType,
  Gender,
  Prisma,
} from "../../../generated/prisma/client.js";

import {
  animalName,
  dateOfBirthFromAgeYears,
  hashSeed,
  pick,
  placeholderAnimalPhotoUrl,
  stableId,
  type SeedResult,
  type SeedTx,
  type UserSeedContext,
} from "./faker.js";

const ANIMAL_TYPE_MIX: { type: AnimalType; species: string; category: AnimalCategory }[] = [
  { type: AnimalType.CATTLE, species: "গরু", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.GOAT, species: "ছাগল", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.POULTRY, species: "মুরগি", category: AnimalCategory.LIVESTOCK },
  { type: AnimalType.CAT, species: "বিড়াল", category: AnimalCategory.PET },
  { type: AnimalType.DOG, species: "কুকুর", category: AnimalCategory.PET },
];

const HEALTH_NOTES = [
  "নিয়মিত টিকা সম্পন্ন; সাম্প্রতিক চেকআপে সুস্থ।",
  "হালকা জ্বরের ইতিহাস; পর্যবেক্ষণে আছে।",
  "দুধ উৎপাদন স্বাভাবিক; খাদ্য গ্রহণ ভালো।",
  "পোকামাকড় নিয়ন্ত্রণে; গ্রাসিং স্বাভাবিক।",
  "গর্ভাবস্থায়; পুষ্টি সম্পূরক চলছে।",
];

function weightKg(animalType: AnimalType, rng: () => number): Prisma.Decimal {
  const base: Record<AnimalType, number> = {
    [AnimalType.CATTLE]: 180 + rng() * 120,
    [AnimalType.GOAT]: 15 + rng() * 25,
    [AnimalType.POULTRY]: 1.5 + rng() * 2,
    [AnimalType.DOG]: 8 + rng() * 22,
    [AnimalType.CAT]: 2 + rng() * 5,
    [AnimalType.OTHER]: 20 + rng() * 40,
  };
  return new Prisma.Decimal(base[animalType].toFixed(3));
}

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedAnimalsForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;

  for (let i = 1; i <= ctx.counts.animals; i++) {
    const id = stableId(ctx.idPrefix, "animal", i);
    if (await tx.animalProfile.findUnique({ where: { id }, select: { id: true } })) {
      skipped++;
      ctx.animalIds.push(id);
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "animal", String(i)));
    const mix = pick(rng, ANIMAL_TYPE_MIX);
    const ageYears = 1 + Math.floor(rng() * 12);

    if (ctx.dryRun) {
      created++;
      ctx.animalIds.push(id);
      continue;
    }

    await tx.animalProfile.create({
      data: {
        id,
        customerId: ctx.customerProfileId,
        name: animalName(rng, mix.type),
        species: mix.species,
        breed: rng() > 0.3 ? pick(rng, ["Local", "Cross", "Sahiwal", "Friesian"]) : null,
        category: mix.category,
        animalType: mix.type,
        gender: pick(rng, [Gender.MALE, Gender.FEMALE, Gender.UNKNOWN]),
        dateOfBirth: dateOfBirthFromAgeYears(rng, ageYears),
        weightKg: weightKg(mix.type, rng),
        photoUrl: rng() > 0.2 ? placeholderAnimalPhotoUrl(id) : null,
        notes: pick(rng, HEALTH_NOTES),
        active: rng() > 0.1,
      },
    });
    ctx.animalIds.push(id);
    created++;
  }

  return { created, skipped };
}

export async function clearAnimalsForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const result = await tx.animalProfile.deleteMany({
    where: { id: { startsWith: `${idPrefix}-animal-` } },
  });
  return result.count;
}
