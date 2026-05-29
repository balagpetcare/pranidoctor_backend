import type { Prisma } from '@/generated/prisma/client';

import { decimalToNumber } from '../phase4-shared/decimal.js';
import type { FeedItemRow, FeedNutritionRow } from './types.js';

export type FeedNutritionDto = {
  id: string;
  feedItemId: string;
  cpPercent: number | null;
  tdnPercent: number | null;
  cfPercent: number | null;
  eePercent: number | null;
  caPercent: number | null;
  pPercent: number | null;
  dmPercent: number | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedItemDto = {
  id: string;
  code: string;
  category: string;
  nameBn: string;
  nameEn: string;
  defaultUnit: string;
  approxPriceBdt: number | null;
  moistureType: string;
  isSeasonal: boolean;
  seasonNotesBn: string | null;
  seasonNotesEn: string | null;
  restrictionJson: Prisma.JsonValue;
  suitabilityJson: Prisma.JsonValue;
  isSeeded: boolean;
  isActive: boolean;
  sortOrder: number;
  nutrition: FeedNutritionDto | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedItemListResponseDto = {
  items: FeedItemDto[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

function toFeedNutritionDto(row: FeedNutritionRow): FeedNutritionDto {
  return {
    id: row.id,
    feedItemId: row.feedItemId,
    cpPercent: decimalToNumber(row.cpPercent),
    tdnPercent: decimalToNumber(row.tdnPercent),
    cfPercent: decimalToNumber(row.cfPercent),
    eePercent: decimalToNumber(row.eePercent),
    caPercent: decimalToNumber(row.caPercent),
    pPercent: decimalToNumber(row.pPercent),
    dmPercent: decimalToNumber(row.dmPercent),
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFeedItemDto(row: FeedItemRow): FeedItemDto {
  return {
    id: row.id,
    code: row.code,
    category: row.category,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    defaultUnit: row.defaultUnit,
    approxPriceBdt: decimalToNumber(row.approxPriceBdt),
    moistureType: row.moistureType,
    isSeasonal: row.isSeasonal,
    seasonNotesBn: row.seasonNotesBn,
    seasonNotesEn: row.seasonNotesEn,
    restrictionJson: row.restrictionJson,
    suitabilityJson: row.suitabilityJson,
    isSeeded: row.isSeeded,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    nutrition: row.nutrition ? toFeedNutritionDto(row.nutrition) : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toFeedItemListResponseDto(result: {
  items: FeedItemRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}): FeedItemListResponseDto {
  return {
    items: result.items.map(toFeedItemDto),
    page: result.page,
    limit: result.limit,
    total: result.total,
    hasMore: result.hasMore,
  };
}
