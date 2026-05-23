import type { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { isProfileComplete, readAreaLabel } from './customer-address.schema.js';

const SUPPORTED_LOCALES = new Set(['bn-BD', 'en-US']);

function serializeAddress(
  addressJson: unknown,
  primaryVillageId?: string | null,
): MobileMeAddressDto | null {
  if (addressJson == null || typeof addressJson !== 'object' || Array.isArray(addressJson)) {
    if (primaryVillageId) {
      return { villageId: primaryVillageId };
    }
    return null;
  }
  const o = addressJson as Record<string, unknown>;
  const address: MobileMeAddressDto = {};
  if (typeof o.divisionId === 'string') address.divisionId = o.divisionId;
  if (typeof o.districtId === 'string') address.districtId = o.districtId;
  if (typeof o.upazilaId === 'string') address.upazilaId = o.upazilaId;
  if (typeof o.unionId === 'string') address.unionId = o.unionId;
  if (typeof o.villageId === 'string') address.villageId = o.villageId;
  if (!address.villageId && primaryVillageId) {
    address.villageId = primaryVillageId;
  }
  const villageName = o.villageNameBn ?? o.villageName;
  if (typeof villageName === 'string' && villageName.trim()) {
    address.villageName = villageName.trim();
  }
  if (typeof o.line1 === 'string') address.line1 = o.line1;
  if (typeof o.postalCode === 'string') address.postalCode = o.postalCode;
  return Object.keys(address).length > 0 ? address : null;
}

export type MobileMeAddressDto = {
  divisionId?: string;
  districtId?: string;
  upazilaId?: string;
  unionId?: string;
  villageId?: string;
  villageName?: string;
  line1?: string;
  postalCode?: string;
};

export type MobileMeDto = {
  id: string;
  name: string;
  phone: string;
  email: string;
  area: string | null;
  address?: MobileMeAddressDto | null;
  locale: string;
  role: 'customer';
  profilePhotoUrl: string | null;
  profilePhotoThumbUrl: string | null;
  coverPhotoUrl: string | null;
  coverPhotoThumbUrl: string | null;
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
      profilePhotoThumbUrl: string | null;
      coverPhotoUrl: string | null;
      coverPhotoThumbUrl: string | null;
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
      address: serializeAddress(cp.addressJson, cp.primaryVillageId ?? null),
      locale,
      role: 'customer',
      profilePhotoUrl: cp.profilePhotoUrl,
      profilePhotoThumbUrl: cp.profilePhotoThumbUrl,
      coverPhotoUrl: cp.coverPhotoUrl,
      coverPhotoThumbUrl: cp.coverPhotoThumbUrl,
      profileComplete,
      // Backward-compatible aliases for mobile clients
      avatarUrl: cp.profilePhotoUrl,
      avatarThumbUrl: cp.profilePhotoThumbUrl,
      coverUrl: cp.coverPhotoUrl,
      coverThumbUrl: cp.coverPhotoThumbUrl,
      profileImageUrl: cp.profilePhotoUrl,
      profileImageThumbUrl: cp.profilePhotoThumbUrl,
      coverImageUrl: cp.coverPhotoUrl,
      coverImageThumbUrl: cp.coverPhotoThumbUrl,
    } as MobileMeDto & {
      avatarUrl: string | null;
      avatarThumbUrl: string | null;
      coverUrl: string | null;
      coverThumbUrl: string | null;
      profileImageUrl: string | null;
      profileImageThumbUrl: string | null;
      coverImageUrl: string | null;
      coverImageThumbUrl: string | null;
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
