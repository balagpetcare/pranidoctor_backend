import type { RetrievalLocale } from '../knowledge-retrieval.types.js';
import { resolveVreConfig } from '../config/vre-config.js';
import { expandColloquialTerms } from './colloquial-map.js';

export type NormalizedQuery = {
  original: string;
  text: string;
  locale: RetrievalLocale;
  expandedTerms: string[];
  colloquialExpanded: boolean;
  speciesHint?: string;
};

const SPECIES_HINTS: Record<string, string> = {
  গরু: 'COW',
  goru: 'COW',
  cow: 'COW',
  গাভী: 'COW',
  ছাগল: 'GOAT',
  goat: 'GOAT',
  ভেড়া: 'SHEEP',
  sheep: 'SHEEP',
  মুরগি: 'CHICKEN',
  chicken: 'CHICKEN',
};

function detectLocale(query: string): RetrievalLocale {
  return /[\u0980-\u09FF]/.test(query) ? 'bn' : 'en';
}

function extractSpeciesHint(query: string): string | undefined {
  const lower = query.toLowerCase();
  for (const [term, species] of Object.entries(SPECIES_HINTS)) {
    if (lower.includes(term.toLowerCase())) return species;
  }
  return undefined;
}

export function normalizeQueryForRetrieval(params: {
  query: string;
  locale?: RetrievalLocale;
}): NormalizedQuery {
  const original = params.query;
  const locale = params.locale ?? detectLocale(original);
  const base = original.trim().replace(/\s+/g, ' ');
  const config = resolveVreConfig();

  let text = base;
  let expandedTerms: string[] = [];
  let colloquialExpanded = false;

  if (config.colloquialExpansionEnabled && (locale === 'bn' || /[\u0980-\u09FF]/.test(base))) {
    const expansion = expandColloquialTerms(base);
    text = expansion.expandedQuery;
    expandedTerms = expansion.expandedTerms;
    colloquialExpanded = expansion.matched;
  }

  const speciesHint = extractSpeciesHint(text);

  return {
    original,
    text,
    locale,
    expandedTerms,
    colloquialExpanded,
    ...(speciesHint ? { speciesHint } : {}),
  };
}

/** Backward-compatible single-string normalizer. */
export function normalizeRetrievalQueryText(query: string, locale?: RetrievalLocale): string {
  return normalizeQueryForRetrieval({ query, ...(locale ? { locale } : {}) }).text;
}
