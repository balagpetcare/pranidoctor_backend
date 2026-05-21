import { getProviderAreasService } from '../profile/provider-areas.service.js';

import type {
  TechnicianAreaPatch,
  TechnicianProfileRow,
  TechnicianRepositoryInterface,
} from './technician.repository.js';
import { TechnicianRepository } from './technician.repository.js';

export class TechnicianService {
  readonly name = 'TechnicianService';

  constructor(private readonly repository: TechnicianRepositoryInterface) {}

  findByUserId(userId: string): Promise<TechnicianProfileRow | null> {
    return this.repository.findByUserId(userId);
  }

  updateAreaFields(
    profileId: string,
    patch: TechnicianAreaPatch,
  ): Promise<TechnicianProfileRow> {
    return this.repository.updateAreaFields(profileId, patch);
  }

  getVillageCoverage(technicianProfileId: string) {
    return getProviderAreasService().listTechnicianVillageCoverage(technicianProfileId);
  }
}

let defaultTechnicianService: TechnicianService | null = null;

export function getTechnicianService(): TechnicianService {
  if (!defaultTechnicianService) {
    defaultTechnicianService = new TechnicianService(new TechnicianRepository());
  }
  return defaultTechnicianService;
}
