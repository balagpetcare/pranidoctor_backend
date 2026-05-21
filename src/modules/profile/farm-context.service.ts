import { getPrisma } from '../../shared/database/prisma.js';

export type FarmSummaryDto = {
  animalCount: number;
  activeAnimalCount: number;
  primaryVillageId: string | null;
  primaryVillageLabelBn: string | null;
};

export class FarmContextService {
  readonly name = 'FarmContextService';

  async buildFarmSummary(customerProfileId: string): Promise<FarmSummaryDto> {
    const prisma = getPrisma();
    const profile = await prisma.customerProfile.findUnique({
      where: { id: customerProfileId },
      select: {
        primaryVillageId: true,
        addressJson: true,
        primaryVillage: {
          select: { nameBn: true, nameEn: true, name: true },
        },
      },
    });

    const [animalCount, activeAnimalCount] = await Promise.all([
      prisma.animalProfile.count({ where: { customerId: customerProfileId } }),
      prisma.animalProfile.count({
        where: { customerId: customerProfileId, active: true },
      }),
    ]);

    const villageLabel =
      profile?.primaryVillage != null
        ? profile.primaryVillage.nameBn?.trim() ||
          profile.primaryVillage.nameEn?.trim() ||
          profile.primaryVillage.name
        : null;

    return {
      animalCount,
      activeAnimalCount,
      primaryVillageId: profile?.primaryVillageId ?? null,
      primaryVillageLabelBn: villageLabel,
    };
  }
}

let defaultFarmContextService: FarmContextService | null = null;

export function getFarmContextService(): FarmContextService {
  if (!defaultFarmContextService) {
    defaultFarmContextService = new FarmContextService();
  }
  return defaultFarmContextService;
}
