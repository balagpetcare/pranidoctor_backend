import { Prisma } from '@/generated/prisma/client';

import {
  assertFeedInventoryOwned,
  assertFeedItemExists,
  assertLivestockOwned,
  OwnershipError,
} from '../phase4-shared/ownership.js';
import { parsePagination } from '../phase4-shared/query.js';

import { toFeedConsumptionDto } from './feed-consumption.dto.js';
import type {
  CreateFeedConsumptionInput,
  FeedConsumptionErrorCode,
  FeedConsumptionListQuery,
  UpdateFeedConsumptionInput,
} from './feed-consumption.types.js';
import { getFeedConsumptionRepository } from './feed-consumption.repository.js';

export class FeedConsumptionError extends Error {
  constructor(
    readonly code: FeedConsumptionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FeedConsumptionError';
  }
}

function parseRecordedDate(value: Date | string): Date {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const [y, m, d] = value.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

export class FeedConsumptionService {
  readonly name = 'FeedConsumptionService';

  constructor(private readonly repo = getFeedConsumptionRepository()) {}

  async list(customerId: string, query: FeedConsumptionListQuery) {
    const { page, limit, skip } = parsePagination(query);
    const { rows, total } = await this.repo.list({
      customerId,
      farmRef: query.farmRef,
      ...(query.livestockId ? { livestockId: query.livestockId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      skip,
      take: limit,
    });

    return {
      items: rows.map(toFeedConsumptionDto),
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async create(
    customerId: string,
    body: CreateFeedConsumptionInput,
    idempotencyKey?: string,
  ) {
    if (idempotencyKey) {
      const existing = await this.repo.findByIdempotencyKey(customerId, idempotencyKey);
      if (existing) return toFeedConsumptionDto(existing);
    }

    if (body.livestockId) {
      const livestock = await assertLivestockOwned(customerId, body.livestockId);
      if (livestock.farmRef !== body.farmRef) {
        throw new FeedConsumptionError(
          'VALIDATION_ERROR',
          'Livestock does not belong to the specified farm',
        );
      }
    }

    let feedInventory: Awaited<ReturnType<typeof assertFeedInventoryOwned>> | undefined;
    if (body.feedInventoryId) {
      feedInventory = await assertFeedInventoryOwned(customerId, body.feedInventoryId);
      if (feedInventory.farmRef !== body.farmRef) {
        throw new FeedConsumptionError(
          'VALIDATION_ERROR',
          'Feed inventory does not belong to the specified farm',
        );
      }
    }

    if (body.feedItemId) {
      await assertFeedItemExists(body.feedItemId);
    }

    const deductStock = body.deductStock ?? false;
    const deductAmount = deductStock && body.feedInventoryId ? body.amount : undefined;

    const createData: Prisma.FeedConsumptionCreateInput = {
      customer: { connect: { id: customerId } },
      farmRef: body.farmRef,
      amount: new Prisma.Decimal(body.amount.toFixed(3)),
      unit: body.unit,
      deductStock,
      recordedDate: parseRecordedDate(body.recordedDate),
      ...(body.livestockId ? { livestock: { connect: { id: body.livestockId } } } : {}),
      ...(body.feedInventoryId
        ? { feedInventory: { connect: { id: body.feedInventoryId } } }
        : {}),
      ...(body.feedItemId ? { feedItem: { connect: { id: body.feedItemId } } } : {}),
      ...(body.costBdt != null
        ? { costBdt: new Prisma.Decimal(body.costBdt.toFixed(2)) }
        : {}),
      ...(body.notes?.trim() ? { notes: body.notes.trim() } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    try {
      const result = await this.repo.createWithOptionalStockDeduct({
        data: createData,
        ...(body.feedInventoryId ? { feedInventoryId: body.feedInventoryId } : {}),
        ...(deductAmount != null ? { deductAmount } : {}),
      });

      if ('insufficientStock' in result && result.insufficientStock) {
        throw new FeedConsumptionError(
          'INSUFFICIENT_STOCK',
          `Insufficient stock: ${result.onHand} on hand, ${body.amount} requested`,
        );
      }

      return toFeedConsumptionDto(result.row!);
    } catch (e) {
      if (e instanceof FeedConsumptionError) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        if (idempotencyKey) {
          const existing = await this.repo.findByIdempotencyKey(customerId, idempotencyKey);
          if (existing) return toFeedConsumptionDto(existing);
        }
        throw new FeedConsumptionError('DUPLICATE_IDEMPOTENCY', 'Duplicate idempotency key');
      }
      throw e;
    }
  }

  async getById(customerId: string, id: string) {
    const row = await this.repo.findById(customerId, id);
    if (!row) {
      throw new FeedConsumptionError('NOT_FOUND', 'Feed consumption record not found');
    }
    return toFeedConsumptionDto(row);
  }

  async update(customerId: string, id: string, body: UpdateFeedConsumptionInput) {
    const existing = await this.repo.findById(customerId, id);
    if (!existing) {
      throw new FeedConsumptionError('NOT_FOUND', 'Feed consumption record not found');
    }

    const farmRef = body.farmRef ?? existing.farmRef;

    if (body.livestockId) {
      const livestock = await assertLivestockOwned(customerId, body.livestockId);
      if (livestock.farmRef !== farmRef) {
        throw new FeedConsumptionError(
          'VALIDATION_ERROR',
          'Livestock does not belong to the specified farm',
        );
      }
    }

    if (body.feedInventoryId) {
      const inv = await assertFeedInventoryOwned(customerId, body.feedInventoryId);
      if (inv.farmRef !== farmRef) {
        throw new FeedConsumptionError(
          'VALIDATION_ERROR',
          'Feed inventory does not belong to the specified farm',
        );
      }
    }

    if (body.feedItemId) {
      await assertFeedItemExists(body.feedItemId);
    }

    const updateData: Prisma.FeedConsumptionUpdateInput = {
      ...(body.farmRef != null ? { farmRef: body.farmRef } : {}),
      ...(body.amount != null ? { amount: new Prisma.Decimal(body.amount.toFixed(3)) } : {}),
      ...(body.unit != null ? { unit: body.unit } : {}),
      ...(body.deductStock != null ? { deductStock: body.deductStock } : {}),
      ...(body.recordedDate != null
        ? { recordedDate: parseRecordedDate(body.recordedDate) }
        : {}),
      ...(body.costBdt !== undefined
        ? {
            costBdt:
              body.costBdt == null
                ? null
                : new Prisma.Decimal(body.costBdt.toFixed(2)),
          }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.livestockId !== undefined
        ? body.livestockId == null
          ? { livestock: { disconnect: true } }
          : { livestock: { connect: { id: body.livestockId } } }
        : {}),
      ...(body.feedInventoryId !== undefined
        ? body.feedInventoryId == null
          ? { feedInventory: { disconnect: true } }
          : { feedInventory: { connect: { id: body.feedInventoryId } } }
        : {}),
      ...(body.feedItemId !== undefined
        ? body.feedItemId == null
          ? { feedItem: { disconnect: true } }
          : { feedItem: { connect: { id: body.feedItemId } } }
        : {}),
    };

    const updated = await this.repo.update(id, updateData);
    return toFeedConsumptionDto(updated);
  }

  async delete(customerId: string, id: string) {
    const existing = await this.repo.findById(customerId, id);
    if (!existing) {
      throw new FeedConsumptionError('NOT_FOUND', 'Feed consumption record not found');
    }
    await this.repo.hardDelete(id);
  }
}

let serviceSingleton: FeedConsumptionService | undefined;

export function getFeedConsumptionService(): FeedConsumptionService {
  if (!serviceSingleton) {
    serviceSingleton = new FeedConsumptionService();
  }
  return serviceSingleton;
}

export function mapFeedConsumptionError(
  e: unknown,
): { code: string; status: number; message: string } | null {
  if (e instanceof FeedConsumptionError) {
    switch (e.code) {
      case 'NOT_FOUND':
        return { code: 'NOT_FOUND', status: 404, message: e.message };
      case 'INSUFFICIENT_STOCK':
        return { code: 'INSUFFICIENT_STOCK', status: 409, message: e.message };
      case 'DUPLICATE_IDEMPOTENCY':
        return { code: 'CONFLICT', status: 409, message: e.message };
      default:
        return { code: 'VALIDATION_ERROR', status: 400, message: e.message };
    }
  }
  if (e instanceof OwnershipError) {
    return {
      code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'FORBIDDEN',
      status: e.code === 'NOT_FOUND' ? 404 : 403,
      message: e.message,
    };
  }
  return null;
}
