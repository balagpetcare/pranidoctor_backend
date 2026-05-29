export const FEED_DEFAULT_PAGE = 1;
export const FEED_DEFAULT_LIMIT = 20;
export const FEED_MAX_LIMIT = 100;

export const FEED_ITEM_SORT_FIELDS = [
  'sortOrder',
  'nameBn',
  'nameEn',
  'createdAt',
  'updatedAt',
] as const;

export type FeedItemSortField = (typeof FEED_ITEM_SORT_FIELDS)[number];

export const FEED_ITEM_DEFAULT_SORT: FeedItemSortField = 'sortOrder';
