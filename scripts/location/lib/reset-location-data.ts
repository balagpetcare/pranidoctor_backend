import type { PrismaClient } from "../../../src/generated/prisma/index.js";

export type ResetLocationResult = {
  serviceRequestVillageIdNullified: number;
  customerPrimaryVillageIdNullified: number;
  aiTechnicianProfileDistrictNullified: number;
  aiTechnicianProfileUpazilaNullified: number;
  aiTechnicianProfileUnionNullified: number;
  aiTechnicianDivisionServiceAreaDistrictNullified: number;
  aiTechnicianDivisionServiceAreaUpazilaNullified: number;
  aiTechnicianDivisionServiceAreaUnionNullified: number;
  villagesDeleted: number;
  unionsDeleted: number;
  upazilasDeleted: number;
  districtsDeleted: number;
  divisionsDeleted: number;
};

/**
 * Delete normalized location master bottom-up inside a transaction.
 * IDs use cuid — no PostgreSQL sequences to reset.
 */
export async function resetLocationData(
  prisma: PrismaClient,
): Promise<ResetLocationResult> {
  const counts: ResetLocationResult = {
    serviceRequestVillageIdNullified: 0,
    customerPrimaryVillageIdNullified: 0,
    aiTechnicianProfileDistrictNullified: 0,
    aiTechnicianProfileUpazilaNullified: 0,
    aiTechnicianProfileUnionNullified: 0,
    aiTechnicianDivisionServiceAreaDistrictNullified: 0,
    aiTechnicianDivisionServiceAreaUpazilaNullified: 0,
    aiTechnicianDivisionServiceAreaUnionNullified: 0,
    villagesDeleted: 0,
    unionsDeleted: 0,
    upazilasDeleted: 0,
    districtsDeleted: 0,
    divisionsDeleted: 0,
  };

  await prisma.$transaction(async (tx) => {
    counts.serviceRequestVillageIdNullified = (
      await tx.serviceRequest.updateMany({
        where: { villageId: { not: null } },
        data: { villageId: null },
      })
    ).count;

    counts.customerPrimaryVillageIdNullified = (
      await tx.customerProfile.updateMany({
        where: { primaryVillageId: { not: null } },
        data: { primaryVillageId: null },
      })
    ).count;

    counts.aiTechnicianProfileDistrictNullified = (
      await tx.aiTechnicianProfile.updateMany({
        where: { districtId: { not: null } },
        data: { districtId: null },
      })
    ).count;

    counts.aiTechnicianProfileUpazilaNullified = (
      await tx.aiTechnicianProfile.updateMany({
        where: { upazilaId: { not: null } },
        data: { upazilaId: null },
      })
    ).count;

    counts.aiTechnicianProfileUnionNullified = (
      await tx.aiTechnicianProfile.updateMany({
        where: { unionId: { not: null } },
        data: { unionId: null },
      })
    ).count;

    counts.aiTechnicianDivisionServiceAreaDistrictNullified = (
      await tx.aiTechnicianDivisionServiceArea.updateMany({
        where: { districtId: { not: null } },
        data: { districtId: null },
      })
    ).count;

    counts.aiTechnicianDivisionServiceAreaUpazilaNullified = (
      await tx.aiTechnicianDivisionServiceArea.updateMany({
        where: { upazilaId: { not: null } },
        data: { upazilaId: null },
      })
    ).count;

    counts.aiTechnicianDivisionServiceAreaUnionNullified = (
      await tx.aiTechnicianDivisionServiceArea.updateMany({
        where: { unionId: { not: null } },
        data: { unionId: null },
      })
    ).count;

    counts.villagesDeleted = (await tx.village.deleteMany({})).count;
    counts.unionsDeleted = (await tx.union.deleteMany({})).count;
    counts.upazilasDeleted = (await tx.upazila.deleteMany({})).count;
    counts.districtsDeleted = (await tx.district.deleteMany({})).count;
    counts.divisionsDeleted = (await tx.division.deleteMany({})).count;
  });

  return counts;
}
