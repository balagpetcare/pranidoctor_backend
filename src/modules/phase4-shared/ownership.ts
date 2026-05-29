import { prisma } from '@/lib/prisma.js';

export class OwnershipError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'FORBIDDEN',
    message: string,
  ) {
    super(message);
    this.name = 'OwnershipError';
  }
}

export async function assertLivestockOwned(
  customerId: string,
  livestockId: string,
  options?: { deploymentBranch?: string | null },
) {
  const row = await prisma.livestock.findFirst({
    where: {
      id: livestockId,
      customerId,
      deletedAt: null,
      ...(options?.deploymentBranch
        ? { OR: [{ deploymentBranch: null }, { deploymentBranch: options.deploymentBranch }] }
        : {}),
    },
    select: { id: true, farmRef: true, species: true, gender: true, weightKg: true, healthStatus: true, pregnancyStatus: true, purpose: true, dateOfBirth: true },
  });
  if (!row) throw new OwnershipError('NOT_FOUND', 'Livestock not found');
  return row;
}

export async function assertFeedInventoryOwned(
  customerId: string,
  feedInventoryId: string,
) {
  const row = await prisma.feedInventory.findFirst({
    where: { id: feedInventoryId, customerId, deletedAt: null },
  });
  if (!row) throw new OwnershipError('NOT_FOUND', 'Feed inventory not found');
  return row;
}

export async function assertFeedItemExists(feedItemId: string) {
  const row = await prisma.feedItem.findFirst({
    where: { id: feedItemId, isActive: true },
    include: { nutrition: true },
  });
  if (!row) throw new OwnershipError('NOT_FOUND', 'Feed item not found');
  return row;
}
