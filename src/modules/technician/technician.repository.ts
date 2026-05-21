import type { AiTechnicianStatus, ProviderStatus } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import type { ModuleService } from '../../shared/module/module.types.js';

import { getAreaCatalogService } from '../area/area-catalog.service.js';

export type TechnicianProfileRow = {
  id: string;
  userId: string;
  displayName: string | null;
  providerStatus: ProviderStatus;
  status: AiTechnicianStatus;
  districtId: string | null;
  upazilaId: string | null;
  unionId: string | null;
  district: string | null;
  upazila: string | null;
  unionOrArea: string | null;
};

export type TechnicianAreaPatch = {
  districtId?: string | null;
  upazilaId?: string | null;
  unionId?: string | null;
};

export interface TechnicianRepositoryInterface extends ModuleService {
  findByUserId(userId: string): Promise<TechnicianProfileRow | null>;
  updateAreaFields(
    profileId: string,
    patch: TechnicianAreaPatch,
  ): Promise<TechnicianProfileRow>;
}

export class TechnicianRepository implements TechnicianRepositoryInterface {
  readonly name = 'TechnicianRepository';

  async findByUserId(userId: string): Promise<TechnicianProfileRow | null> {
    const row = await getPrisma().aiTechnicianProfile.findUnique({
      where: { userId },
    });
    return row ?? null;
  }

  async updateAreaFields(
    profileId: string,
    patch: TechnicianAreaPatch,
  ): Promise<TechnicianProfileRow> {
    const catalog = getAreaCatalogService();
    const hierarchyInput: {
      districtId?: string;
      upazilaId?: string;
      unionId?: string;
    } = {};
    if (patch.districtId) hierarchyInput.districtId = patch.districtId;
    if (patch.upazilaId) hierarchyInput.upazilaId = patch.upazilaId;
    if (patch.unionId) hierarchyInput.unionId = patch.unionId;

    const resolved = await catalog.validateAndResolveHierarchy(hierarchyInput);

    if (!resolved.ok && (patch.districtId || patch.upazilaId || patch.unionId)) {
      throw new Error(resolved.code);
    }

    const data: Record<string, unknown> = {
      districtId: patch.districtId ?? null,
      upazilaId: patch.upazilaId ?? null,
      unionId: patch.unionId ?? null,
    };

    if (resolved.ok) {
      if (resolved.resolved.districtNameBn) {
        data.district = resolved.resolved.districtNameBn;
      }
      if (resolved.resolved.upazilaNameBn) {
        data.upazila = resolved.resolved.upazilaNameBn;
      }
      if (resolved.resolved.unionNameBn) {
        data.unionOrArea = resolved.resolved.unionNameBn;
      }
    }

    const updated = await getPrisma().aiTechnicianProfile.update({
      where: { id: profileId },
      data,
    });
    return updated;
  }
}
