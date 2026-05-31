/** Curated Bangla colloquial → canonical veterinary term map (Phase 6C.13). */
export type ColloquialMapEntry = {
  colloquial: string;
  canonical: string;
  domain?: string;
  confidence: number;
};

export const COLLOQUIAL_BN_MAP: ColloquialMapEntry[] = [
  { colloquial: 'গাভী', canonical: 'cow dairy cattle', domain: 'FARM_MGMT', confidence: 0.95 },
  { colloquial: 'গরু', canonical: 'cow cattle', domain: 'FARM_MGMT', confidence: 0.95 },
  { colloquial: 'ছাগল', canonical: 'goat', domain: 'FARM_MGMT', confidence: 0.95 },
  { colloquial: 'ভেড়া', canonical: 'sheep', domain: 'FARM_MGMT', confidence: 0.95 },
  { colloquial: 'মুরগি', canonical: 'poultry chicken', domain: 'FARM_MGMT', confidence: 0.95 },
  { colloquial: 'দুধ কম', canonical: 'mastitis milk production drop', domain: 'DISEASE', confidence: 0.85 },
  { colloquial: 'দুধ কমে গেছে', canonical: 'mastitis milk yield', domain: 'DISEASE', confidence: 0.85 },
  { colloquial: 'খাবার খায় না', canonical: 'anorexia inappetence', domain: 'DISEASE', confidence: 0.82 },
  { colloquial: 'পায়ে ফোলা', canonical: 'lameness foot rot swelling', domain: 'DISEASE', confidence: 0.88 },
  { colloquial: 'জ্বর', canonical: 'fever pyrexia', domain: 'DISEASE', confidence: 0.9 },
  { colloquial: 'ডায়রিয়া', canonical: 'diarrhea scours', domain: 'DISEASE', confidence: 0.9 },
  { colloquial: 'ঝরা', canonical: 'abortion pregnancy loss', domain: 'DISEASE', confidence: 0.88 },
  { colloquial: 'টিকা', canonical: 'vaccine vaccination', domain: 'VACCINE', confidence: 0.92 },
  { colloquial: 'ওষুধ', canonical: 'medicine drug antibiotic', domain: 'MEDICINE', confidence: 0.9 },
  { colloquial: 'মাত্রা', canonical: 'dose dosage mg/kg', domain: 'MEDICINE', confidence: 0.88 },
  { colloquial: 'mastitis', canonical: 'mastitis udder infection', domain: 'DISEASE', confidence: 0.95 },
  { colloquial: 'খামার', canonical: 'farm livestock management', domain: 'FARM_MGMT', confidence: 0.85 },
  { colloquial: 'খাদ্য', canonical: 'feed nutrition ration', domain: 'FEED', confidence: 0.88 },
  { colloquial: 'খাদ্য হিসাব', canonical: 'cattle feed ration calculation lactating', domain: 'FEED', confidence: 0.92 },
  { colloquial: 'খাবার পরিমাণ', canonical: 'feed amount requirement daily ration', domain: 'FEED', confidence: 0.9 },
  { colloquial: 'হিসাব', canonical: 'ration calculation feed amount', domain: 'FEED', confidence: 0.85 },
  { colloquial: 'দানাদার', canonical: 'concentrate grain bran maize', domain: 'FEED', confidence: 0.85 },
  { colloquial: 'সবুজ ঘাস', canonical: 'green grass forage', domain: 'FEED', confidence: 0.9 },
  { colloquial: 'ভুসি', canonical: 'rice bran wheat bran concentrate', domain: 'FEED', confidence: 0.88 },
  { colloquial: 'চালের কুঁড়া', canonical: 'rice bran concentrate', domain: 'FEED', confidence: 0.9 },
  { colloquial: 'রক্ত', canonical: 'bleeding hemorrhage emergency', domain: 'EMERGENCY', confidence: 0.9 },
  { colloquial: 'জরুরি', canonical: 'emergency urgent', domain: 'EMERGENCY', confidence: 0.95 },
  { colloquial: 'ফুলে গেল', canonical: 'acute bloat tympany rumen distension emergency', domain: 'EMERGENCY', confidence: 0.92 },
  { colloquial: 'হঠাৎ ফুলে', canonical: 'acute bloat emergency', domain: 'EMERGENCY', confidence: 0.92 },
  { colloquial: 'মরে যাচ্ছে', canonical: 'sudden death collapse emergency acute crisis', domain: 'EMERGENCY', confidence: 0.9 },
  { colloquial: 'newcastle', canonical: 'newcastle disease ND poultry', domain: 'DISEASE', confidence: 0.95 },
  { colloquial: 'নিউক্যাসল', canonical: 'newcastle disease ND poultry', domain: 'DISEASE', confidence: 0.95 },
  { colloquial: 'টিকা কখন', canonical: 'vaccine schedule vaccination timing cattle', domain: 'VACCINE', confidence: 0.9 },
  { colloquial: 'কখন দিব', canonical: 'vaccination schedule when to vaccinate', domain: 'VACCINE', confidence: 0.88 },
];

function normalizeBnToken(token: string): string {
  return token.trim().toLowerCase().normalize('NFC');
}

export function expandColloquialTerms(query: string): {
  expandedQuery: string;
  expandedTerms: string[];
  matched: boolean;
} {
  const normalized = query.trim().normalize('NFC');
  if (!normalized) {
    return { expandedQuery: query, expandedTerms: [], matched: false };
  }

  const expandedTerms = new Set<string>();
  const lower = normalized.toLowerCase();

  for (const entry of COLLOQUIAL_BN_MAP) {
    const colloquial = normalizeBnToken(entry.colloquial);
    if (lower.includes(colloquial) && entry.confidence >= 0.7) {
      for (const term of entry.canonical.split(/\s+/)) {
        expandedTerms.add(term);
      }
    }
  }

  if (expandedTerms.size === 0) {
    return { expandedQuery: normalized, expandedTerms: [], matched: false };
  }

  const expandedQuery = `${normalized} ${[...expandedTerms].join(' ')}`.trim();
  return { expandedQuery, expandedTerms: [...expandedTerms], matched: true };
}

export function expandQueryTokens(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const token of tokens) {
    for (const entry of COLLOQUIAL_BN_MAP) {
      if (normalizeBnToken(token) === normalizeBnToken(entry.colloquial)) {
        entry.canonical.split(/\s+/).forEach((t) => out.add(t));
      }
    }
  }
  return [...out];
}
