import { UserRole, UserStatus } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getCustomerProfileService } from '../../profile/customer-profile.service.js';
import { getFarmContextService } from '../../profile/farm-context.service.js';
import { readAreaLabel } from '../../profile/customer-address.schema.js';

import type { ProfileSummaryDto } from '../identity.types.js';

/** Read-only profile aggregation — does not modify frozen profile services. */
export class ProfileFacade {
  async getSummary(userId: string): Promise<ProfileSummaryDto | null> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user?.customerProfile) {
      return null;
    }

    const profileService = getCustomerProfileService();
    const me = profileService.serializeMobileMe({
      id: user.id,
      email: user.email,
      phone: user.phone,
      customerProfile: user.customerProfile,
    });

    const addressJson = user.customerProfile.addressJson;
    const areaLabel = readAreaLabel(addressJson);
    const hasAddress =
      areaLabel != null || user.customerProfile.primaryVillageId != null;

    let farm: ProfileSummaryDto['farm'] = null;
    try {
      const farmSummary = await getFarmContextService().buildFarmSummary(user.customerProfile.id);
      farm = farmSummary;
    } catch {
      farm = null;
    }

    return {
      userId,
      basic: {
        name: me.name,
        phone: me.phone,
        email: me.email,
        locale: me.locale,
        profileComplete: me.profileComplete ?? false,
      },
      address: {
        hasAddress,
        areaLabel,
      },
      farm,
    };
  }

  async getLocale(userId: string): Promise<string | null> {
    const summary = await this.getSummary(userId);
    return summary?.basic.locale ?? null;
  }
}

let facade: ProfileFacade | null = null;

export function getProfileFacade(): ProfileFacade {
  if (!facade) facade = new ProfileFacade();
  return facade;
}
