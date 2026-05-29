import { FeedCategory, FeedType } from '@/generated/prisma/client';

/** Maps master catalog category to legacy FeedType for FeedRecord / InventoryItem. */
export function feedCategoryToFeedType(category: FeedCategory): FeedType {
  switch (category) {
    case FeedCategory.ROUGHAGE:
      return FeedType.STRAW;
    case FeedCategory.GREEN:
      return FeedType.GRASS;
    case FeedCategory.CONCENTRATE:
      return FeedType.CONCENTRATE;
    case FeedCategory.MINERAL:
      return FeedType.MINERAL;
    case FeedCategory.SILAGE:
      return FeedType.SILAGE;
    case FeedCategory.SUPPLEMENT:
    case FeedCategory.CUSTOM:
    default:
      return FeedType.OTHER;
  }
}
