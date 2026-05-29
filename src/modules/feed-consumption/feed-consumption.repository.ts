import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

export class FeedConsumptionRepository {
  async findById(customerId: string, id: string) {
    return prisma.feedConsumption.findFirst({
      where: { id, customerId },
    });
  }

  async findByIdempotencyKey(customerId: string, idempotencyKey: string) {
    return prisma.feedConsumption.findFirst({
      where: { customerId, idempotencyKey },
    });
  }

  async list(params: {
    customerId: string;
    farmRef: string;
    livestockId?: string;
    from?: Date;
    to?: Date;
    skip: number;
    take: number;
  }) {
    const where: Prisma.FeedConsumptionWhereInput = {
      customerId: params.customerId,
      farmRef: params.farmRef,
      ...(params.livestockId ? { livestockId: params.livestockId } : {}),
      ...(params.from || params.to
        ? {
            recordedDate: {
              ...(params.from ? { gte: params.from } : {}),
              ...(params.to ? { lte: params.to } : {}),
            },
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.feedConsumption.count({ where }),
      prisma.feedConsumption.findMany({
        where,
        orderBy: [{ recordedDate: 'desc' }, { createdAt: 'desc' }],
        skip: params.skip,
        take: params.take,
      }),
    ]);

    return { rows, total };
  }

  async createWithOptionalStockDeduct(params: {
    data: Prisma.FeedConsumptionCreateInput;
    feedInventoryId?: string;
    deductAmount?: number;
  }) {
    return prisma.$transaction(async (tx) => {
      if (params.feedInventoryId && params.deductAmount != null) {
        const inv = await tx.feedInventory.findFirst({
          where: { id: params.feedInventoryId, deletedAt: null },
        });
        if (!inv) {
          throw new Error('Feed inventory not found during stock deduct');
        }
        const onHand = Number(inv.quantityOnHand);
        if (onHand < params.deductAmount && !inv.allowNegativeStock) {
          return { insufficientStock: true as const, onHand };
        }
        await tx.feedInventory.update({
          where: { id: inv.id },
          data: {
            quantityOnHand: new Prisma.Decimal(
              (onHand - params.deductAmount).toFixed(3),
            ),
          },
        });
      }

      const row = await tx.feedConsumption.create({ data: params.data });
      return { row, insufficientStock: false as const };
    });
  }

  async update(id: string, data: Prisma.FeedConsumptionUpdateInput) {
    return prisma.feedConsumption.update({ where: { id }, data });
  }

  async hardDelete(id: string) {
    return prisma.feedConsumption.delete({ where: { id } });
  }
}

let repositorySingleton: FeedConsumptionRepository | undefined;

export function getFeedConsumptionRepository(): FeedConsumptionRepository {
  if (!repositorySingleton) {
    repositorySingleton = new FeedConsumptionRepository();
  }
  return repositorySingleton;
}
