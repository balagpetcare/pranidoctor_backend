import { Prisma } from '@/generated/prisma/client';

import { OwnershipError } from '../phase4-shared/ownership.js';
import type { FeedItemDto, FeedItemListResponseDto } from './feed.dto.js';
import { toFeedItemDto, toFeedItemListResponseDto } from './feed.dto.js';
import { getFeedRepository } from './feed.repository.js';
import type {
  CreateFeedItemBodyInput,
  ListFeedItemsQueryInput,
  UpdateFeedItemBodyInput,
} from './feed.validator.js';

export class FeedError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'DUPLICATE_CODE' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'FeedError';
  }
}

export class FeedService {
  constructor(private readonly repo = getFeedRepository()) {}

  async listFeedItems(
    query: ListFeedItemsQueryInput,
    _customerId?: string | null,
  ): Promise<FeedItemListResponseDto> {
    const result = await this.repo.listFeedItems(query);
    return toFeedItemListResponseDto(result);
  }

  async getFeedItemById(id: string, _customerId?: string | null): Promise<FeedItemDto> {
    const row = await this.repo.findFeedItemById(id);
    if (!row) {
      throw new FeedError('NOT_FOUND', 'Feed item not found');
    }
    return toFeedItemDto(row);
  }

  async createFeedItem(
    body: CreateFeedItemBodyInput,
    _customerId?: string | null,
  ): Promise<FeedItemDto> {
    try {
      const row = await this.repo.createFeedItem(body);
      return toFeedItemDto(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new FeedError('DUPLICATE_CODE', 'Feed item code already exists');
      }
      throw e;
    }
  }

  async updateFeedItem(
    id: string,
    body: UpdateFeedItemBodyInput,
    _customerId?: string | null,
  ): Promise<FeedItemDto> {
    const row = await this.repo.updateFeedItem(id, body);
    if (!row) {
      throw new FeedError('NOT_FOUND', 'Feed item not found');
    }
    return toFeedItemDto(row);
  }

  async deactivateFeedItem(id: string, _customerId?: string | null): Promise<FeedItemDto> {
    const row = await this.repo.deactivateFeedItem(id);
    if (!row) {
      throw new FeedError('NOT_FOUND', 'Feed item not found');
    }
    return toFeedItemDto(row);
  }
}

let serviceSingleton: FeedService | undefined;

export function getFeedService(): FeedService {
  if (!serviceSingleton) {
    serviceSingleton = new FeedService();
  }
  return serviceSingleton;
}

export function mapFeedError(e: unknown): { code: string; status: number; message: string } | null {
  if (e instanceof FeedError) {
    switch (e.code) {
      case 'NOT_FOUND':
        return { code: 'FEED_ITEM_NOT_FOUND', status: 404, message: e.message };
      case 'DUPLICATE_CODE':
        return { code: 'FEED_ITEM_DUPLICATE', status: 409, message: e.message };
      default:
        return { code: e.code, status: 400, message: e.message };
    }
  }
  if (e instanceof OwnershipError) {
    return {
      code: e.code === 'NOT_FOUND' ? 'FEED_ITEM_NOT_FOUND' : 'FORBIDDEN',
      status: e.code === 'NOT_FOUND' ? 404 : 403,
      message: e.message,
    };
  }
  return null;
}
