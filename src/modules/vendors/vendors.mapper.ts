import type { FeedVendor, FeedVendorProduct } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import type { VendorDto, VendorProductDto, VendorWithProductsDto } from './vendors.dto.js';

export function toVendorProductDto(row: FeedVendorProduct): VendorProductDto {
  return {
    id: row.id,
    vendorId: row.vendorId,
    feedItemId: row.feedItemId,
    displayName: row.displayName,
    unit: row.unit,
    unitWeightKg: decimalToNumber(row.unitWeightKg),
    priceBdt: decimalToNumber(row.priceBdt),
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVendorDto(row: FeedVendor): VendorDto {
  return {
    id: row.id,
    name: row.name,
    nameBn: row.nameBn,
    phone: row.phone,
    districtId: row.districtId,
    address: row.address,
    verificationStatus: row.verificationStatus,
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toVendorWithProductsDto(
  row: FeedVendor & { products: FeedVendorProduct[] },
): VendorWithProductsDto {
  return {
    ...toVendorDto(row),
    products: row.products.map(toVendorProductDto),
  };
}
