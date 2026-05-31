import type { Prisma } from "@/generated/prisma/client";
import { AnimalWeightMethod } from "@/generated/prisma/client";

export async function mirrorAnimalProfileWeight(
  tx: Prisma.TransactionClient,
  animalId: string,
  params: {
    weightKg: Prisma.Decimal;
    method: AnimalWeightMethod;
    measuredAt: Date;
  },
): Promise<void> {
  await tx.animalProfile.update({
    where: { id: animalId },
    data: {
      weightKg: params.weightKg,
      lastWeightMethod: params.method,
      lastWeightMeasuredAt: params.measuredAt,
    },
  });
}
