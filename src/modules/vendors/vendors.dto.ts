import type { FeedUnit, FeedVendorVerificationStatus } from '@/generated/prisma/client';

export type VendorProductDto = {
  id: string;
  vendorId: string;
  feedItemId: string | null;
  displayName: string;
  unit: FeedUnit;
  unitWeightKg: number | null;
  priceBdt: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type VendorDto = {
  id: string;
  name: string;
  nameBn: string | null;
  phone: string | null;
  districtId: string | null;
  address: string | null;
  verificationStatus: FeedVendorVerificationStatus;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VendorWithProductsDto = VendorDto & {
  products: VendorProductDto[];
};

export type PaginatedVendorsDto = {
  items: VendorDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};
