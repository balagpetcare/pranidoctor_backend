import { prisma } from '@/lib/prisma.js';

import {
  PHASE4_FEED_SEED_COUNT,
  PHASE4_VENDOR_SEED_COUNT,
  runPhase4FeedItemsSeed,
  runPhase4VendorsSeed,
} from '../../../../shared/feed-ecosystem/phase4-seed-runners.js';
import { FEED_SEED_LAST_RUN_SETTING_KEY } from './constants.js';

export type SeedPreview = {
  feedItems: { dbCount: number; seededCount: number; seedFileCount: number };
  vendors: { dbCount: number; seededCount: number; seedFileCount: number };
  feedCatalog: { dbCount: number; seededCount: number };
};

export type SeedRunReport = {
  ranAt: string;
  actorUserId: string;
  feedItems?: { created: number; updated: number };
  vendors?: { created: number; updated: number };
  errors: string[];
};

export async function adminGetSeedPreview(): Promise<SeedPreview> {
  const [feedItemDb, feedItemSeeded, vendorDb, vendorSeeded, catalogDb, catalogSeeded] =
    await Promise.all([
      prisma.feedItem.count(),
      prisma.feedItem.count({ where: { isSeeded: true } }),
      prisma.feedVendor.count(),
      prisma.feedVendor.count({ where: { notes: { contains: 'seed' } } }).catch(() => 0),
      prisma.feedCatalog.count(),
      prisma.feedCatalog.count({ where: { isSeeded: true } }),
    ]);

  return {
    feedItems: {
      dbCount: feedItemDb,
      seededCount: feedItemSeeded,
      seedFileCount: PHASE4_FEED_SEED_COUNT,
    },
    vendors: {
      dbCount: vendorDb,
      seededCount: vendorSeeded,
      seedFileCount: PHASE4_VENDOR_SEED_COUNT,
    },
    feedCatalog: {
      dbCount: catalogDb,
      seededCount: catalogSeeded,
    },
  };
}

export async function adminGetLastSeedRun(): Promise<SeedRunReport | null> {
  const row = await prisma.setting.findUnique({
    where: { key: FEED_SEED_LAST_RUN_SETTING_KEY },
  });
  if (!row?.valueJson || typeof row.valueJson !== 'object') return null;
  return row.valueJson as SeedRunReport;
}

export async function adminSaveSeedRunReport(report: SeedRunReport): Promise<void> {
  await prisma.setting.upsert({
    where: { key: FEED_SEED_LAST_RUN_SETTING_KEY },
    create: { key: FEED_SEED_LAST_RUN_SETTING_KEY, valueJson: report },
    update: { valueJson: report },
  });
}

export async function adminRunPhase4FeedSeed(): Promise<Pick<SeedRunReport, 'feedItems' | 'errors'>> {
  const errors: string[] = [];
  try {
    const feedItems = await runPhase4FeedItemsSeed();
    return { feedItems, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Feed seed failed');
    return { errors };
  }
}

export async function adminRunPhase4VendorSeed(): Promise<Pick<SeedRunReport, 'vendors' | 'errors'>> {
  const errors: string[] = [];
  try {
    const vendors = await runPhase4VendorsSeed();
    return { vendors, errors };
  } catch (e) {
    errors.push(e instanceof Error ? e.message : 'Vendor seed failed');
    return { errors };
  }
}
