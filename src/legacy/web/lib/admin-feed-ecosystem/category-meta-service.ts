import { FeedCategory } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma.js';

import {
  DEFAULT_FEED_CATEGORY_META,
  FEED_CATEGORY_META_SETTING_KEY,
} from './constants.js';

export type FeedCategoryMetaRow = {
  value: FeedCategory;
  labelBn: string;
  labelEn: string;
  descriptionBn: string;
};

type MetaOverrides = Partial<
  Record<FeedCategory, Partial<Omit<FeedCategoryMetaRow, 'value'>>>
>;

function mergeMeta(overrides: MetaOverrides | null): FeedCategoryMetaRow[] {
  return Object.values(FeedCategory).map((value) => {
    const base = DEFAULT_FEED_CATEGORY_META[value];
    const patch = overrides?.[value];
    return {
      value,
      labelBn: patch?.labelBn?.trim() || base.labelBn,
      labelEn: patch?.labelEn?.trim() || base.labelEn,
      descriptionBn: patch?.descriptionBn?.trim() || base.descriptionBn,
    };
  });
}

export async function adminListFeedCategoryMeta(): Promise<FeedCategoryMetaRow[]> {
  const row = await prisma.setting.findUnique({
    where: { key: FEED_CATEGORY_META_SETTING_KEY },
  });
  const overrides =
    row?.valueJson && typeof row.valueJson === 'object' && !Array.isArray(row.valueJson)
      ? (row.valueJson as MetaOverrides)
      : null;
  return mergeMeta(overrides);
}

export async function adminPatchFeedCategoryMeta(
  patches: MetaOverrides,
): Promise<FeedCategoryMetaRow[]> {
  const existing = await prisma.setting.findUnique({
    where: { key: FEED_CATEGORY_META_SETTING_KEY },
  });
  const current =
    existing?.valueJson && typeof existing.valueJson === 'object' && !Array.isArray(existing.valueJson)
      ? (existing.valueJson as MetaOverrides)
      : {};

  const merged: MetaOverrides = { ...current };
  for (const [key, patch] of Object.entries(patches)) {
    if (!(key in FeedCategory)) continue;
    merged[key as FeedCategory] = {
      ...merged[key as FeedCategory],
      ...patch,
    };
  }

  await prisma.setting.upsert({
    where: { key: FEED_CATEGORY_META_SETTING_KEY },
    create: { key: FEED_CATEGORY_META_SETTING_KEY, valueJson: merged },
    update: { valueJson: merged },
  });

  return mergeMeta(merged);
}
