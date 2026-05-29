import type { Prisma } from '@/generated/prisma/client';
import { FeedVendorVerificationStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import { buildSearchFilter } from '../phase4-shared/query.js';

function vendorSearchOr(search: string): Prisma.FeedVendorWhereInput[] {
  const filter = buildSearchFilter(search);
  if (!filter) return [];
  return [{ name: filter }, { nameBn: filter }, { phone: filter }];
}

export class VendorsRepository {
  async listVendors(params: {
    skip: number;
    take: number;
    verificationStatus?: FeedVendorVerificationStatus;
    districtId?: string;
    search?: string;
    activeOnly?: boolean;
  }) {
    const where: Prisma.FeedVendorWhereInput = {
      ...(params.verificationStatus ? { verificationStatus: params.verificationStatus } : {}),
      ...(params.districtId ? { districtId: params.districtId } : {}),
      ...(params.activeOnly === true ? { isActive: true } : {}),
      ...(params.search ? { OR: vendorSearchOr(params.search) } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.feedVendor.count({ where }),
      prisma.feedVendor.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async findVendorById(id: string) {
    return prisma.feedVendor.findUnique({ where: { id } });
  }

  async findVendorWithProducts(id: string) {
    return prisma.feedVendor.findUnique({
      where: { id },
      include: {
        products: {
          where: { isActive: true },
          orderBy: { displayName: 'asc' },
        },
      },
    });
  }

  async createVendor(data: Prisma.FeedVendorCreateInput) {
    return prisma.feedVendor.create({ data });
  }

  async updateVendor(id: string, data: Prisma.FeedVendorUpdateInput) {
    return prisma.feedVendor.update({ where: { id }, data });
  }

  async listVerifiedVendors(params: {
    skip: number;
    take: number;
    districtId?: string;
    search?: string;
  }) {
    const where: Prisma.FeedVendorWhereInput = {
      verificationStatus: FeedVendorVerificationStatus.VERIFIED,
      isActive: true,
      ...(params.districtId ? { districtId: params.districtId } : {}),
      ...(params.search ? { OR: vendorSearchOr(params.search) } : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.feedVendor.count({ where }),
      prisma.feedVendor.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }
}

let repositorySingleton: VendorsRepository | undefined;

export function getVendorsRepository(): VendorsRepository {
  if (!repositorySingleton) {
    repositorySingleton = new VendorsRepository();
  }
  return repositorySingleton;
}
