import { FeedVendorVerificationStatus } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

export type ModerationQueueItem =
  | {
      type: 'vendor';
      id: string;
      title: string;
      titleBn: string | null;
      status: FeedVendorVerificationStatus;
      createdAt: string;
    }
  | {
      type: 'feed_item';
      id: string;
      title: string;
      titleBn: string;
      status: 'INACTIVE';
      createdAt: string;
    };

export type ModerationQueueResult = {
  pendingVendors: number;
  inactiveFeedItems: number;
  items: ModerationQueueItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export async function adminListModerationQueue(params: {
  page: number;
  limit: number;
  type?: 'vendor' | 'feed_item' | 'all';
}): Promise<ModerationQueueResult> {
  const type = params.type ?? 'all';

  const [pendingVendors, inactiveFeedItems] = await Promise.all([
    prisma.feedVendor.count({
      where: { verificationStatus: FeedVendorVerificationStatus.PENDING },
    }),
    prisma.feedItem.count({ where: { isActive: false } }),
  ]);

  const items: ModerationQueueItem[] = [];

  if (type === 'all' || type === 'vendor') {
    const vendors = await prisma.feedVendor.findMany({
      where: { verificationStatus: FeedVendorVerificationStatus.PENDING },
      orderBy: { createdAt: 'desc' },
      take: params.limit,
      skip: type === 'vendor' ? (params.page - 1) * params.limit : 0,
    });
    items.push(
      ...vendors.map((v) => ({
        type: 'vendor' as const,
        id: v.id,
        title: v.name,
        titleBn: v.nameBn,
        status: v.verificationStatus,
        createdAt: v.createdAt.toISOString(),
      })),
    );
  }

  if (type === 'all' || type === 'feed_item') {
    const feedItems = await prisma.feedItem.findMany({
      where: { isActive: false },
      orderBy: { updatedAt: 'desc' },
      take: params.limit,
      skip: type === 'feed_item' ? (params.page - 1) * params.limit : 0,
    });
    items.push(
      ...feedItems.map((f) => ({
        type: 'feed_item' as const,
        id: f.id,
        title: f.nameEn,
        titleBn: f.nameBn,
        status: 'INACTIVE' as const,
        createdAt: f.updatedAt.toISOString(),
      })),
    );
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total =
    type === 'vendor'
      ? pendingVendors
      : type === 'feed_item'
        ? inactiveFeedItems
        : pendingVendors + inactiveFeedItems;

  const start = (params.page - 1) * params.limit;
  const pageItems = type === 'all' ? items.slice(start, start + params.limit) : items;

  return {
    pendingVendors,
    inactiveFeedItems,
    items: pageItems,
    page: params.page,
    limit: params.limit,
    total,
    hasMore: params.page * params.limit < total,
  };
}
