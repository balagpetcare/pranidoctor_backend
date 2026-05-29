import { FeedVendorVerificationStatus } from '@/generated/prisma/client';

import type {
  PaginatedVendorsDto,
  VendorDto,
  VendorWithProductsDto,
} from './vendors.dto.js';
import { toVendorDto, toVendorWithProductsDto } from './vendors.mapper.js';
import { getVendorsRepository } from './vendors.repository.js';
import type {
  AdminVendorListQuery,
  CreateVendorBody,
  MobileVendorListQuery,
  UpdateVendorBody,
} from './vendors.schemas.js';

export class VendorNotFoundError extends Error {
  constructor(message = 'Vendor not found') {
    super(message);
    this.name = 'VendorNotFoundError';
  }
}

export class VendorVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VendorVerificationError';
  }
}

export class VendorsService {
  constructor(private readonly repo = getVendorsRepository()) {}

  async listVendors(query: AdminVendorListQuery): Promise<PaginatedVendorsDto> {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.repo.listVendors({
      skip,
      take: query.limit,
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.activeOnly !== undefined ? { activeOnly: query.activeOnly } : {}),
    });

    return {
      items: rows.map(toVendorDto),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async createVendor(body: CreateVendorBody): Promise<VendorDto> {
    const row = await this.repo.createVendor({
      name: body.name,
      nameBn: body.nameBn ?? null,
      phone: body.phone ?? null,
      districtId: body.districtId ?? null,
      address: body.address ?? null,
      notes: body.notes ?? null,
      isActive: body.isActive ?? true,
      verificationStatus: FeedVendorVerificationStatus.PENDING,
    });

    return toVendorDto(row);
  }

  async updateVendor(id: string, body: UpdateVendorBody): Promise<VendorDto> {
    const existing = await this.repo.findVendorById(id);
    if (!existing) throw new VendorNotFoundError();

    const row = await this.repo.updateVendor(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.nameBn !== undefined ? { nameBn: body.nameBn } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.districtId !== undefined ? { districtId: body.districtId } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    });

    return toVendorDto(row);
  }

  async verifyVendor(
    id: string,
    status: 'VERIFIED' | 'REJECTED',
  ): Promise<VendorDto> {
    if (
      status !== FeedVendorVerificationStatus.VERIFIED &&
      status !== FeedVendorVerificationStatus.REJECTED
    ) {
      throw new VendorVerificationError('Verification status must be VERIFIED or REJECTED');
    }

    const existing = await this.repo.findVendorById(id);
    if (!existing) throw new VendorNotFoundError();

    const row = await this.repo.updateVendor(id, {
      verificationStatus: status,
    });

    return toVendorDto(row);
  }

  async listVerifiedVendors(query: MobileVendorListQuery): Promise<PaginatedVendorsDto> {
    const skip = (query.page - 1) * query.limit;
    const { rows, total } = await this.repo.listVerifiedVendors({
      skip,
      take: query.limit,
      ...(query.districtId ? { districtId: query.districtId } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    return {
      items: rows.map(toVendorDto),
      page: query.page,
      limit: query.limit,
      total,
      hasMore: query.page * query.limit < total,
    };
  }

  async getVendorWithProducts(id: string): Promise<VendorWithProductsDto> {
    const row = await this.repo.findVendorWithProducts(id);
    if (!row) throw new VendorNotFoundError();
    if (
      row.verificationStatus !== FeedVendorVerificationStatus.VERIFIED ||
      !row.isActive
    ) {
      throw new VendorNotFoundError('Verified vendor not found');
    }

    return toVendorWithProductsDto(row);
  }
}

let serviceSingleton: VendorsService | undefined;

export function getVendorsService(): VendorsService {
  if (!serviceSingleton) {
    serviceSingleton = new VendorsService();
  }
  return serviceSingleton;
}

export function mapVendorsError(
  e: unknown,
): { code: string; status: number; message: string } | null {
  if (e instanceof VendorNotFoundError) {
    return { code: 'NOT_FOUND', status: 404, message: e.message };
  }
  if (e instanceof VendorVerificationError) {
    return { code: 'VALIDATION_ERROR', status: 400, message: e.message };
  }
  return null;
}
