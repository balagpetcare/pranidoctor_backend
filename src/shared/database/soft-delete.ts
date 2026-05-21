/**
 * Soft-delete query helpers for Prisma models with deletedAt.
 */

export const activeOnly = {
  deletedAt: null,
} as const;

export function softDeleteData(): { deletedAt: Date } {
  return { deletedAt: new Date() };
}

export function restoreData(): { deletedAt: null } {
  return { deletedAt: null };
}
