import type { FeedCategory, FeedMoistureType, FeedUnit, Prisma } from '@/generated/prisma/client';

import type { SortOrder } from '../phase4-shared/query.js';
import type { FeedItemSortField } from './constants.js';

export type FeedNutritionRow = {
  id: string;
  feedItemId: string;
  cpPercent: Prisma.Decimal | null;
  tdnPercent: Prisma.Decimal | null;
  cfPercent: Prisma.Decimal | null;
  eePercent: Prisma.Decimal | null;
  caPercent: Prisma.Decimal | null;
  pPercent: Prisma.Decimal | null;
  dmPercent: Prisma.Decimal | null;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FeedItemRow = {
  id: string;
  code: string;
  category: FeedCategory;
  nameBn: string;
  nameEn: string;
  defaultUnit: FeedUnit;
  approxPriceBdt: Prisma.Decimal | null;
  moistureType: FeedMoistureType;
  isSeasonal: boolean;
  seasonNotesBn: string | null;
  seasonNotesEn: string | null;
  restrictionJson: Prisma.JsonValue;
  suitabilityJson: Prisma.JsonValue;
  isSeeded: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  nutrition: FeedNutritionRow | null;
};

export type ListFeedItemsQuery = {
  category?: FeedCategory;
  search?: string;
  isActive?: boolean;
  page: number;
  limit: number;
  sortBy: FeedItemSortField;
  sortOrder: SortOrder;
};

export type FeedNutritionInput = {
  cpPercent?: number | null;
  tdnPercent?: number | null;
  cfPercent?: number | null;
  eePercent?: number | null;
  caPercent?: number | null;
  pPercent?: number | null;
  dmPercent?: number | null;
  source?: string | null;
};

export type CreateFeedItemInput = {
  code: string;
  category: FeedCategory;
  nameBn: string;
  nameEn: string;
  defaultUnit: FeedUnit;
  approxPriceBdt?: number | null;
  moistureType?: FeedMoistureType;
  isSeasonal?: boolean;
  seasonNotesBn?: string | null;
  seasonNotesEn?: string | null;
  restrictionJson?: Prisma.InputJsonValue | null;
  suitabilityJson?: Prisma.InputJsonValue | null;
  isSeeded?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  nutrition?: FeedNutritionInput;
};

export type UpdateFeedItemInput = Partial<Omit<CreateFeedItemInput, 'code'>> & {
  nutrition?: FeedNutritionInput | null;
};

export type PaginatedFeedItems = {
  items: FeedItemRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};
