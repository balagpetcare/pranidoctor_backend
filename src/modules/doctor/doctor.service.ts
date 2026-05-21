import { getProviderAreasService } from '../profile/provider-areas.service.js';

import type { DoctorProfileRow, DoctorRepositoryInterface } from './doctor.repository.js';
import { DoctorRepository } from './doctor.repository.js';

export class DoctorService {
  readonly name = 'DoctorService';

  constructor(private readonly repository: DoctorRepositoryInterface) {}

  findById(id: string): Promise<DoctorProfileRow | null> {
    return this.repository.findById(id);
  }

  findByUserId(userId: string): Promise<DoctorProfileRow | null> {
    return this.repository.findByUserId(userId);
  }

  async getVillageCoverage(doctorProfileId: string) {
    return getProviderAreasService().listDoctorVillageCoverage(doctorProfileId);
  }
}

let defaultDoctorService: DoctorService | null = null;

export function getDoctorService(): DoctorService {
  if (!defaultDoctorService) {
    defaultDoctorService = new DoctorService(new DoctorRepository());
  }
  return defaultDoctorService;
}
