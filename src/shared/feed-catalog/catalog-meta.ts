export type FeedCatalogNutritionMeta = {
  aliases?: string[];
  nutrientTags?: string[];
  isPopular?: boolean;
};

export function parseFeedCatalogMeta(
  nutritionJson: unknown,
): FeedCatalogNutritionMeta {
  if (nutritionJson == null || typeof nutritionJson !== 'object') {
    return {};
  }
  const raw = nutritionJson as Record<string, unknown>;
  const aliases = Array.isArray(raw.aliases)
    ? raw.aliases.filter((a): a is string => typeof a === 'string')
    : undefined;
  const nutrientTags = Array.isArray(raw.nutrientTags)
    ? raw.nutrientTags.filter((t): t is string => typeof t === 'string')
    : undefined;
  const isPopular = typeof raw.isPopular === 'boolean' ? raw.isPopular : undefined;
  const meta: FeedCatalogNutritionMeta = {};
  if (aliases != null) meta.aliases = aliases;
  if (nutrientTags != null) meta.nutrientTags = nutrientTags;
  if (isPopular != null) meta.isPopular = isPopular;
  return meta;
}

export function feedCatalogMatchesQuery(
  row: {
    nameBn: string;
    nameEn: string;
    code: string;
    nutritionJson: unknown;
  },
  q: string,
): boolean {
  const needle = q.trim();
  if (!needle) return true;
  const lower = needle.toLowerCase();
  if (row.nameEn.toLowerCase().includes(lower)) return true;
  if (row.nameBn.includes(needle)) return true;
  if (row.code.toLowerCase().includes(lower)) return true;
  const meta = parseFeedCatalogMeta(row.nutritionJson);
  return (meta.aliases ?? []).some(
    (alias) => alias.includes(needle) || alias.toLowerCase().includes(lower),
  );
}

export function mapFeedCatalogItem(row: {
  id: string;
  code: string;
  nameBn: string;
  nameEn: string;
  category: string;
  defaultUnit: string;
  approxPriceBdt: unknown;
  availabilityScore: number | null;
  sortOrder: number;
  nutritionJson: unknown;
  legacyFeedType: string;
}) {
  const meta = parseFeedCatalogMeta(row.nutritionJson);
  return {
    id: row.id,
    code: row.code,
    nameBn: row.nameBn,
    nameEn: row.nameEn,
    category: row.category,
    defaultUnit: row.defaultUnit,
    legacyFeedType: row.legacyFeedType,
    approxPriceBdt:
      row.approxPriceBdt == null ? null : Number(row.approxPriceBdt),
    availabilityScore: row.availabilityScore,
    sortOrder: row.sortOrder,
    aliases: meta.aliases ?? [],
    nutrientTags: meta.nutrientTags ?? [],
    isPopular: meta.isPopular ?? false,
  };
}
