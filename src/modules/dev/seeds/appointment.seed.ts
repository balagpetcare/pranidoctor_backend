import {
  ServiceRequestStatus,
  ServiceRequestType,
} from "../../../generated/prisma/client.js";

import {
  daysAgo,
  hashSeed,
  pick,
  stableId,
  type SeedResult,
  type SeedTx,
  type UserSeedContext,
} from "./faker.js";

const APPOINTMENT_STATUSES: ServiceRequestStatus[] = [
  ServiceRequestStatus.PENDING,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.COMPLETED,
  ServiceRequestStatus.CANCELLED,
  ServiceRequestStatus.IN_PROGRESS,
  ServiceRequestStatus.ASSIGNED,
];

function createRng(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedAppointmentsForUser(
  tx: SeedTx,
  ctx: UserSeedContext,
): Promise<SeedResult> {
  let created = 0;
  let skipped = 0;

  if (ctx.animalIds.length === 0) {
    return { created, skipped };
  }

  const doctorCount = ctx.doctorProfileIds.length;

  for (let i = 1; i <= ctx.counts.appointments; i++) {
    const id = stableId(ctx.idPrefix, "appt", i);
    if (await tx.serviceRequest.findUnique({ where: { id }, select: { id: true } })) {
      skipped++;
      ctx.serviceRequestIds.push(id);
      continue;
    }

    const rng = createRng(hashSeed(ctx.userId, "appt", String(i)));
    const status = APPOINTMENT_STATUSES[i % APPOINTMENT_STATUSES.length]!;
    const animalId = ctx.animalIds[(i - 1) % ctx.animalIds.length]!;
    const isEmergency = status === ServiceRequestStatus.PENDING && rng() > 0.85;
    const assignedDoctorId =
      doctorCount > 0 &&
      [
        ServiceRequestStatus.ACCEPTED,
        ServiceRequestStatus.ASSIGNED,
        ServiceRequestStatus.IN_PROGRESS,
        ServiceRequestStatus.COMPLETED,
      ].includes(status)
        ? ctx.doctorProfileIds[i % doctorCount]!
        : null;

    const createdAt = daysAgo(rng, 120);
    const completedAt =
      status === ServiceRequestStatus.COMPLETED ? daysAgo(rng, 30) : null;
    const cancelledAt =
      status === ServiceRequestStatus.CANCELLED ? daysAgo(rng, 20) : null;

    if (ctx.dryRun) {
      created++;
      ctx.serviceRequestIds.push(id);
      continue;
    }

    await tx.serviceRequest.create({
      data: {
        id,
        customerId: ctx.customerProfileId,
        animalId,
        serviceCategoryId: isEmergency ? ctx.emergencyCategoryId : ctx.serviceCategoryId,
        status,
        serviceType: isEmergency
          ? ServiceRequestType.EMERGENCY_DOCTOR
          : ServiceRequestType.DOCTOR_HOME_VISIT,
        isEmergency,
        problemOrSymptom: pick(rng, [
          "জ্বর ও খাওয়া কমেছে",
          "হাঁটাহাটি করতে পারছে না",
          "দুধ কমে গেছে",
          "কাশি ও নাক থেকে স্রাব",
        ]),
        preferredTime: pick(rng, ["সকাল", "দুপুর", "বিকেল", "যেকোনো"]),
        locationText: `Demo visit location note #${i}`,
        assignedDoctorId,
        assignedAt: assignedDoctorId ? createdAt : null,
        startedAt:
          status === ServiceRequestStatus.IN_PROGRESS ||
          status === ServiceRequestStatus.COMPLETED
            ? daysAgo(rng, 25)
            : null,
        completedAt,
        cancelledAt,
        cancelReason:
          status === ServiceRequestStatus.CANCELLED ? "Customer rescheduled" : null,
        createdAt,
        submittedAt: createdAt,
      },
    });
    ctx.serviceRequestIds.push(id);
    created++;
  }

  return { created, skipped };
}

export async function clearAppointmentsForUser(tx: SeedTx, idPrefix: string): Promise<number> {
  const result = await tx.serviceRequest.deleteMany({
    where: { id: { startsWith: `${idPrefix}-appt-` } },
  });
  return result.count;
}
