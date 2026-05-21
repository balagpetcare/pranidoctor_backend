import { ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import type { ModuleService } from '../../shared/module/module.types.js';

export type DoctorProfileRow = {
  id: string;
  userId: string;
  licenseNumber: string;
  specialization: string | null;
  displayName: string | null;
  providerStatus: ProviderStatus;
  profilePhotoUrl: string | null;
  bio: string | null;
  experienceYears: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export interface DoctorRepositoryInterface extends ModuleService {
  findById(id: string): Promise<DoctorProfileRow | null>;
  findByUserId(userId: string): Promise<DoctorProfileRow | null>;
}

export class DoctorRepository implements DoctorRepositoryInterface {
  readonly name = 'DoctorRepository';

  async findById(id: string): Promise<DoctorProfileRow | null> {
    const row = await getPrisma().doctorProfile.findUnique({ where: { id } });
    return row ?? null;
  }

  async findByUserId(userId: string): Promise<DoctorProfileRow | null> {
    const row = await getPrisma().doctorProfile.findUnique({ where: { userId } });
    return row ?? null;
  }
}
