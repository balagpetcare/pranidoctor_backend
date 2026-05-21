import type { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { isProfileComplete, readAreaLabel } from './customer-address.schema.js';

const SUPPORTED_LOCALES = new Set(['bn-BD', 'en-US']);

export type MobileMeDto = {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string | null;
  locale: string;
  role: 'customer';
  profilePhotoUrl: string | null;
  coverPhotoUrl: string | null;
  profileComplete?: boolean;
};

export type EnsureCustomerProfileHints = {
  displayName?: string;
  locale?: string;
};

export class CustomerProfileService {
  readonly name = 'CustomerProfileService';

  async ensureCustomerProfile(
    userId: string,
    hints?: EnsureCustomerProfileHints,
  ): Promise<void> {
    const prisma = getPrisma();
    const existing = await prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) return;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });
    const phoneSuffix = user?.phone?.slice(-4) ?? '0000';
    const displayName =
      hints?.displayName?.trim() || `গ্রাহক ${phoneSuffix}`;

    await prisma.customerProfile.create({
      data: {
        userId,
        displayName,
        locale: hints?.locale && SUPPORTED_LOCALES.has(hints.locale) ? hints.locale : 'bn-BD',
      },
    });
  }

  serializeMobileMe(user: {
    id: string;
    email: string;
    phone: string | null;
    customerProfile: {
      displayName: string;
      locale: string | null;
      addressJson: Prisma.JsonValue | null;
      profilePhotoUrl: string | null;
      coverPhotoUrl: string | null;
      primaryVillageId?: string | null;
    };
  }): MobileMeDto {
    const cp = user.customerProfile;
    const area = readAreaLabel(cp.addressJson);
    const locale =
      cp.locale && SUPPORTED_LOCALES.has(cp.locale) ? cp.locale : 'bn-BD';
    const profileComplete = isProfileComplete({
      displayName: cp.displayName,
      addressJson: cp.addressJson,
      primaryVillageId: cp.primaryVillageId ?? null,
    });

    return {
      id: user.id,
      name: cp.displayName,
      phone: user.phone ?? '',
      email: user.email,
      area,
      locale,
      role: 'customer',
      profilePhotoUrl: cp.profilePhotoUrl,
      coverPhotoUrl: cp.coverPhotoUrl,
      profileComplete,
    };
  }

  async getMobileMe(userId: string): Promise<MobileMeDto | null> {
    const user = await getPrisma().user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });
    if (!user?.customerProfile) return null;
    return this.serializeMobileMe({
      id: user.id,
      email: user.email,
      phone: user.phone,
      customerProfile: user.customerProfile,
    });
  }
}

let defaultCustomerProfileService: CustomerProfileService | null = null;

export function getCustomerProfileService(): CustomerProfileService {
  if (!defaultCustomerProfileService) {
    defaultCustomerProfileService = new CustomerProfileService();
  }
  return defaultCustomerProfileService;
}
