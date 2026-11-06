import type { HubCategoryDef, HubCategoryKey } from './discovery.types.js';

/** Service-hub tiles. Order is the display order on the Services page. */
export const HUB_CATEGORIES: readonly HubCategoryDef[] = [
  {
    key: 'emergency_doctor',
    kind: 'DOCTOR',
    labelBn: 'ইমার্জেন্সি ডাক্তার',
    labelEn: 'Emergency doctor',
    hintBn: 'এখনই ভিডিও, অডিও বা চ্যাটে কথা',
    emergencyOnly: true,
  },
  {
    key: 'cattle_goat',
    kind: 'DOCTOR',
    labelBn: 'গরু ও ছাগলের ডাক্তার',
    labelEn: 'Cattle & goat doctor',
    hintBn: 'গাভী, ষাঁড়, ছাগল, ভেড়া',
    species: 'cattle_goat',
  },
  {
    key: 'poultry_duck',
    kind: 'DOCTOR',
    labelBn: 'হাঁস-মুরগির ডাক্তার',
    labelEn: 'Poultry & duck doctor',
    hintBn: 'লেয়ার, ব্রয়লার, সোনালী, হাঁস',
    species: 'poultry_duck',
  },
  {
    key: 'pet',
    kind: 'DOCTOR',
    labelBn: 'পেট ডাক্তার',
    labelEn: 'Pet doctor',
    hintBn: 'কুকুর, বিড়াল, পাখি, খরগোশ',
    species: 'pet',
  },
  {
    key: 'ai_technician',
    kind: 'AI_TECHNICIAN',
    labelBn: 'এআই টেকনিশিয়ান',
    labelEn: 'AI technician',
    hintBn: 'কৃত্রিম প্রজনন, বাড়িতে এসে',
  },
  {
    key: 'health_worker',
    kind: 'HEALTH_WORKER',
    labelBn: 'প্রাণী স্বাস্থ্যকর্মী',
    labelEn: 'Animal health worker',
    hintBn: 'ইনজেকশন, স্যালাইন, কৃমিনাশক',
  },
  {
    key: 'home_visit',
    kind: 'DOCTOR',
    labelBn: 'বাড়িতে ডাক্তার',
    labelEn: 'Home-visit doctor',
    hintBn: 'খামারে বা বাড়িতে এসে দেখবেন',
    homeVisitOnly: true,
  },
] as const;

export const HUB_CATEGORY_BY_KEY: ReadonlyMap<HubCategoryKey, HubCategoryDef> = new Map(
  HUB_CATEGORIES.map((c) => [c.key, c]),
);

/** Doctor service-category slugs that mean "comes to you". */
export const HOME_VISIT_CATEGORY_SLUGS = ['doctor-visit', 'livestock-health-check'] as const;

/** A provider that has not sent a heartbeat for this long is shown offline. */
export const PRESENCE_STALE_SECONDS = 300;

/** Redis TTLs (seconds). Short on purpose: availability changes quickly. */
export const DISCOVERY_CACHE_TTL = {
  hub: 60,
  list: 30,
  detail: 60,
  area: 600,
} as const;

/** Hard caps that protect the database from oversized scans. */
export const DISCOVERY_LIMITS = {
  maxPage: 20,
  maxPageSize: 30,
  defaultPageSize: 15,
  maxScopeAreas: 3000,
} as const;
