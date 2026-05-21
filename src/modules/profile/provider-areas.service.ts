import { getPrisma } from '../../shared/database/prisma.js';

export type VillageCoverageRow = {
  villageId: string;
  villageNameBn: string;
  unionNameBn: string;
  priority: number | null;
};

export class ProviderAreasService {
  readonly name = 'ProviderAreasService';

  async listDoctorVillageCoverage(doctorProfileId: string): Promise<VillageCoverageRow[]> {
    const rows = await getPrisma().doctorServiceArea.findMany({
      where: { doctorId: doctorProfileId },
      include: {
        village: {
          include: { union: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => ({
      villageId: r.villageId,
      villageNameBn:
        r.village.nameBn?.trim() || r.village.nameEn?.trim() || r.village.name,
      unionNameBn:
        r.village.union.nameBn?.trim() ||
        r.village.union.nameEn?.trim() ||
        r.village.union.name,
      priority: r.priority,
    }));
  }

  async listTechnicianVillageCoverage(
    technicianProfileId: string,
  ): Promise<VillageCoverageRow[]> {
    const rows = await getPrisma().aiTechnicianServiceArea.findMany({
      where: { aiTechnicianId: technicianProfileId },
      include: {
        village: {
          include: { union: true },
        },
      },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });

    return rows.map((r) => ({
      villageId: r.villageId,
      villageNameBn:
        r.village.nameBn?.trim() || r.village.nameEn?.trim() || r.village.name,
      unionNameBn:
        r.village.union.nameBn?.trim() ||
        r.village.union.nameEn?.trim() ||
        r.village.union.name,
      priority: r.priority,
    }));
  }
}

let defaultProviderAreasService: ProviderAreasService | null = null;

export function getProviderAreasService(): ProviderAreasService {
  if (!defaultProviderAreasService) {
    defaultProviderAreasService = new ProviderAreasService();
  }
  return defaultProviderAreasService;
}
