import type { Prisma } from '@/generated/prisma/client';

export type SortOrder = 'asc' | 'desc';

export function parsePagination(query: {
  page?: string | number | null;
  limit?: string | number | null;
}) {
  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export function parseDateParam(value: string | null | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function buildSearchFilter(search: string | undefined): Prisma.StringFilter | undefined {
  const q = search?.trim();
  if (!q) return undefined;
  return { contains: q, mode: 'insensitive' };
}
