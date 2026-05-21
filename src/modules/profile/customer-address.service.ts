import type { Prisma } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';

import { getAreaCatalogService } from '../area/area-catalog.service.js';

import {
  customerAddressJsonSchema,
  isProfileComplete,
  patchAddressBodySchema,
  readAreaLabel,
  type CustomerAddressJson,
} from './customer-address.schema.js';
import { getCustomerProfileService, type MobileMeDto } from './customer-profile.service.js';

export type PatchMobileMeInput = {
  name?: string;
  email?: string;
  area?: string;
  locale?: 'bn-BD' | 'en-US';
  address?: {
    divisionId?: string;
    districtId?: string;
    upazilaId?: string;
    unionId?: string;
    villageId?: string;
    line1?: string;
    postalCode?: string;
  };
};

export type PatchMobileMeResult =
  | { ok: true; data: MobileMeDto }
  | { ok: false; httpStatus: number; code: string; details?: unknown };

export class CustomerAddressService {
  readonly name = 'CustomerAddressService';

  async patchMobileMe(userId: string, input: PatchMobileMeInput): Promise<PatchMobileMeResult> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { customerProfile: true },
    });

    if (!user?.customerProfile) {
      return { ok: false, httpStatus: 404, code: 'CUSTOMER_PROFILE_MISSING' };
    }

    if (input.email !== undefined) {
      const clash = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: user.id } },
        select: { id: true },
      });
      if (clash) {
        return { ok: false, httpStatus: 409, code: 'EMAIL_IN_USE' };
      }
    }

    const existingJson =
      user.customerProfile.addressJson &&
      typeof user.customerProfile.addressJson === 'object' &&
      !Array.isArray(user.customerProfile.addressJson)
        ? (user.customerProfile.addressJson as Record<string, unknown>)
        : {};

    let nextAddress: CustomerAddressJson | undefined;
    let primaryVillageId: string | undefined | null;

    if (input.area !== undefined) {
      nextAddress = customerAddressJsonSchema.parse({
        ...existingJson,
        areaLabel: input.area,
      });
    }

    if (input.address !== undefined) {
      const parsedAddr = patchAddressBodySchema.safeParse(input.address);
      if (!parsedAddr.success) {
        return {
          ok: false,
          httpStatus: 422,
          code: 'VALIDATION_ERROR',
          details: parsedAddr.error.flatten(),
        };
      }

      const catalog = getAreaCatalogService();
      const hierarchyInput: {
        divisionId?: string;
        districtId?: string;
        upazilaId?: string;
        unionId?: string;
        villageId?: string;
      } = {};
      const d = parsedAddr.data;
      if (d.divisionId) hierarchyInput.divisionId = d.divisionId;
      if (d.districtId) hierarchyInput.districtId = d.districtId;
      if (d.upazilaId) hierarchyInput.upazilaId = d.upazilaId;
      if (d.unionId) hierarchyInput.unionId = d.unionId;
      if (d.villageId) hierarchyInput.villageId = d.villageId;

      const resolved = await catalog.validateAndResolveHierarchy(hierarchyInput);
      if (!resolved.ok) {
        return { ok: false, httpStatus: 422, code: resolved.code };
      }

      nextAddress = customerAddressJsonSchema.parse({
        ...existingJson,
        ...(nextAddress ?? {}),
        ...resolved.resolved,
        areaLabel: resolved.resolved.areaLabel ?? readAreaLabel(existingJson) ?? undefined,
        line1: parsedAddr.data.line1 ?? (existingJson.line1 as string | undefined),
        postalCode:
          parsedAddr.data.postalCode ?? (existingJson.postalCode as string | undefined),
      });

      if (resolved.resolved.villageId) {
        primaryVillageId = resolved.resolved.villageId;
      }
    }

    const profileCompletedAt =
      isProfileComplete({
        displayName: input.name ?? user.customerProfile.displayName,
        addressJson: nextAddress ?? user.customerProfile.addressJson,
        primaryVillageId:
          primaryVillageId !== undefined
            ? primaryVillageId
            : user.customerProfile.primaryVillageId,
      })
        ? user.customerProfile.profileCompletedAt ?? new Date()
        : user.customerProfile.profileCompletedAt;

    await prisma.$transaction(async (tx) => {
      if (input.email !== undefined) {
        await tx.user.update({
          where: { id: user.id },
          data: { email: input.email },
        });
      }
      if (
        input.name !== undefined ||
        nextAddress !== undefined ||
        input.locale !== undefined ||
        primaryVillageId !== undefined
      ) {
        await tx.customerProfile.update({
          where: { id: user.customerProfile!.id },
          data: {
            ...(input.name !== undefined ? { displayName: input.name } : {}),
            ...(nextAddress !== undefined
              ? { addressJson: nextAddress as Prisma.InputJsonValue }
              : {}),
            ...(input.locale !== undefined ? { locale: input.locale } : {}),
            ...(primaryVillageId !== undefined
              ? { primaryVillageId: primaryVillageId ?? null }
              : {}),
            ...(profileCompletedAt !== undefined ? { profileCompletedAt } : {}),
          },
        });
      }
    });

    const me = await getCustomerProfileService().getMobileMe(userId);
    if (!me) {
      return { ok: false, httpStatus: 404, code: 'CUSTOMER_PROFILE_MISSING' };
    }
    return { ok: true, data: me };
  }
}

let defaultCustomerAddressService: CustomerAddressService | null = null;

export function getCustomerAddressService(): CustomerAddressService {
  if (!defaultCustomerAddressService) {
    defaultCustomerAddressService = new CustomerAddressService();
  }
  return defaultCustomerAddressService;
}
