import type { PaginationMeta, PaginationParams, PaginatedResult } from '../types/api.types.js';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizePagination(params: PaginationParams): Required<PaginationParams> {
  return {
    page: Math.max(1, params.page ?? DEFAULT_PAGE),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE)),
  };
}

export function createPaginationMeta(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  return {
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  return {
    data,
    meta: createPaginationMeta(total, page, pageSize),
  };
}

export function calculateSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
