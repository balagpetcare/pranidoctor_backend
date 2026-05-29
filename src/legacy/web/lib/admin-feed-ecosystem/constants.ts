import { FeedCategory } from '@/generated/prisma/client';

export const FEED_CATEGORY_META_SETTING_KEY = 'feedCategoryMeta';
export const FEED_RECOMMENDATION_RULES_SETTING_KEY = 'feedRecommendationRules';
export const FEED_SEED_LAST_RUN_SETTING_KEY = 'feedEcosystemSeedLastRun';

export const DEFAULT_FEED_CATEGORY_META: Record<
  FeedCategory,
  { labelBn: string; labelEn: string; descriptionBn: string }
> = {
  ROUGHAGE: {
    labelBn: 'শুষ্ক খাদ্য',
    labelEn: 'Roughage',
    descriptionBn: 'খড়, ভুসি ইত্যাদি ফাইবার-ভিত্তিক খাদ্য',
  },
  GREEN: {
    labelBn: 'সবুজ খাদ্য',
    labelEn: 'Green fodder',
    descriptionBn: 'তাজা ঘাস ও সবুজ ফসল',
  },
  CONCENTRATE: {
    labelBn: 'কেন্দ্রীভূত',
    labelEn: 'Concentrate',
    descriptionBn: 'উচ্চ শক্তির দানা ও মিশ্রণ',
  },
  SUPPLEMENT: {
    labelBn: 'সম্পূরক',
    labelEn: 'Supplement',
    descriptionBn: 'ভিটামিন, গুড় ও অন্যান্য সম্পূরক',
  },
  MINERAL: {
    labelBn: 'খনিজ',
    labelEn: 'Mineral',
    descriptionBn: 'খনিজ মিশ্রণ ও লবণ',
  },
  SILAGE: {
    labelBn: 'সাইলেজ',
    labelEn: 'Silage',
    descriptionBn: 'সংরক্ষিত সিলেজ',
  },
  CUSTOM: {
    labelBn: 'কাস্টম',
    labelEn: 'Custom',
    descriptionBn: 'অন্যান্য বা স্থানীয় খাদ্য',
  },
};
