import { PrescriptionStatus } from "../../../generated/prisma/client.js";

import {
  daysAgo,
  hashSeed,
  pick,
  pickMedicines,
  stableId,
  type SeedResult,
  type SeedTx,
  type UserSeedContext,
} from "./faker.js";

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedPrescriptionsForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;

  const eligible = ctx.serviceRequestIds.filter((_, idx) => idx % 2 === 0);
  const pool = eligible.length > 0 ? eligible : ctx.serviceRequestIds;
  if (pool.length === 0) {
    return { created, skipped };
  }

  for (let i = 1; i <= ctx.counts.prescriptions; i++) {
    const id = stableId(ctx.idPrefix, "rx", i);
    if (!ctx.dryRun && (await tx.prescription.findUnique({ where: { id }, select: { id: true } }))) {
      skipped++;
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "rx", String(i)));
    const srId = pool[(i - 1) % pool.length]!;

    if (ctx.dryRun) {
      created++;
      continue;
    }

    const sr = await tx.serviceRequest.findUnique({
      where: { id: srId },
      select: { animalId: true, assignedDoctorId: true },
    });
    if (!sr) continue;

    await tx.prescription.create({
      data: {
        id,
        serviceRequestId: srId,
        animalId: sr.animalId,
        doctorId: sr.assignedDoctorId,
        status: pick(rng, [PrescriptionStatus.ACTIVE, PrescriptionStatus.VOIDED]),
        instructions: pick(rng, [
          "খাবারের সাথে ওষুধ দিন; পানি ঠিক রাখুন।",
          "৭ দিন পর ফলো-আপ করুন।",
          "আলাদা রাখুন; সংক্রমণ রোধে সাবধানতা।",
        ]),
        validUntil: daysAgo(rng, -30),
        items: {
          create: pickMedicines(rng, 1 + Math.floor(rng() * 4)).map((name, idx) => ({
            id: stableId(ctx.idPrefix, `rxitem-${i}`, idx + 1, 3),
            medicineName: name,
            dosage: pick(rng, ["5ml", "10ml", "1 tablet", "2 tablet"]),
            duration: pick(rng, ["3 days", "5 days", "7 days"]),
            instruction: "After feed",
          })),
        },
      },
    });
    created++;
  }

  return { created, skipped };
}

export async function clearPrescriptionsForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const prescriptions = await tx.prescription.findMany({
    where: { id: { startsWith: `${idPrefix}-rx-` } },
    select: { id: true },
  });
  const ids = prescriptions.map((p) => p.id);
  if (ids.length === 0) return 0;

  await tx.prescriptionItem.deleteMany({
    where: { prescriptionId: { in: ids } },
  });
  const result = await tx.prescription.deleteMany({
    where: { id: { in: ids } },
  });
  return result.count;
}
