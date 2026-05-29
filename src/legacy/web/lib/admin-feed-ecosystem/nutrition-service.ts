import { prisma } from '@/lib/prisma.js';

import { decimalToNumber } from '../../../../modules/phase4-shared/decimal.js';

export type AdminNutritionRow = {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  category: string;
  hasNutrition: boolean;
  cpPercent: number | null;
  tdnPercent: number | null;
  dmPercent: number | null;
  source: string | null;
};

export async function adminListFeedNutrition(params: {
  page: number;
  limit: number;
  search?: string;
  missingOnly?: boolean;
}): Promise<{
  items: AdminNutritionRow[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}> {
  const where = {
    isActive: true,
    ...(params.search?.trim()
      ? {
          OR: [
            { nameEn: { contains: params.search.trim(), mode: 'insensitive' as const } },
            { nameBn: { contains: params.search.trim(), mode: 'insensitive' as const } },
            { code: { contains: params.search.trim(), mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(params.missingOnly ? { nutrition: { is: null } } : {}),
  };

  const skip = (params.page - 1) * params.limit;
  const [total, rows] = await Promise.all([
    prisma.feedItem.count({ where }),
    prisma.feedItem.findMany({
      where,
      include: { nutrition: true },
      orderBy: [{ sortOrder: 'asc' }, { nameBn: 'asc' }],
      skip,
      take: params.limit,
    }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameBn: row.nameBn,
      nameEn: row.nameEn,
      category: row.category,
      hasNutrition: row.nutrition != null,
      cpPercent: decimalToNumber(row.nutrition?.cpPercent),
      tdnPercent: decimalToNumber(row.nutrition?.tdnPercent),
      dmPercent: decimalToNumber(row.nutrition?.dmPercent),
      source: row.nutrition?.source ?? null,
    })),
    page: params.page,
    limit: params.limit,
    total,
    hasMore: params.page * params.limit < total,
  };
}
