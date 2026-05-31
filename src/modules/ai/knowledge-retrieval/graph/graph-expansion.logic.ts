/** Pure symptom-token matching for graph-assisted retrieval (Phase 6E.2). */

export type GraphHint = {
  edgeType: string;
  fromSlug: string;
  toSlug: string;
  label: string;
};

export type SymptomTokenMatch = {
  symptomCode: string;
  labelBn: string;
  matchedToken: string;
};

const SYMPTOM_QUERY_TOKENS: Array<{ token: string; symptomCode: string }> = [
  { token: 'জ্বর', symptomCode: 'fever' },
  { token: 'fever', symptomCode: 'fever' },
  { token: 'pyrexia', symptomCode: 'fever' },
  { token: 'ডায়রিয়া', symptomCode: 'diarrhea' },
  { token: 'diarrhea', symptomCode: 'diarrhea' },
  { token: 'scours', symptomCode: 'diarrhea' },
  { token: 'ঝরা', symptomCode: 'abortion' },
  { token: 'abortion', symptomCode: 'abortion' },
  { token: 'শ্বাস', symptomCode: 'respiratory-distress' },
  { token: 'শ্বাসকষ্ট', symptomCode: 'respiratory-distress' },
  { token: 'respiratory', symptomCode: 'respiratory-distress' },
  { token: 'পেট ফোলা', symptomCode: 'bloat-signs' },
  { token: 'ফুলে গেল', symptomCode: 'bloat-signs' },
  { token: 'হঠাৎ ফুলে', symptomCode: 'bloat-signs' },
  { token: 'ফুলে', symptomCode: 'bloat-signs' },
  { token: 'bloat', symptomCode: 'bloat-signs' },
  { token: 'মরে যাচ্ছে', symptomCode: 'sudden-death' },
  { token: 'মরছে', symptomCode: 'sudden-death' },
  { token: 'newcastle', symptomCode: 'respiratory-distress' },
  { token: 'নিউক্যাসল', symptomCode: 'respiratory-distress' },
  { token: 'রক্ত', symptomCode: 'bleeding' },
  { token: 'bleeding', symptomCode: 'bleeding' },
  { token: 'হঠাৎ মৃত্যু', symptomCode: 'sudden-death' },
  { token: 'sudden death', symptomCode: 'sudden-death' },
  { token: 'পড়ে', symptomCode: 'collapse' },
  { token: 'collapse', symptomCode: 'collapse' },
  { token: 'mastitis', symptomCode: 'mastitis-signs' },
  { token: 'দুধ কম', symptomCode: 'mastitis-signs' },
  { token: 'খায় না', symptomCode: 'inappetence' },
  { token: 'inappetence', symptomCode: 'inappetence' },
  { token: 'লাথি', symptomCode: 'lameness' },
  { token: 'lameness', symptomCode: 'lameness' },
  { token: 'টিকা', symptomCode: 'vaccination' },
  { token: 'vaccination', symptomCode: 'vaccination' },
  { token: 'vaccine', symptomCode: 'vaccination' },
];

export function detectSymptomCodesFromQuery(query: string, expandedTerms: string[]): string[] {
  const haystack = `${query} ${expandedTerms.join(' ')}`.toLowerCase().normalize('NFC');
  const codes = new Set<string>();

  for (const { token, symptomCode } of SYMPTOM_QUERY_TOKENS) {
    if (haystack.includes(token.toLowerCase().normalize('NFC'))) {
      codes.add(symptomCode);
    }
  }

  return [...codes];
}

export function buildGraphHints(
  links: Array<{ symptomCode: string; diseaseSlug: string; labelBn: string }>,
): GraphHint[] {
  return links.map((link) => ({
    edgeType: 'HAS_SYMPTOM',
    fromSlug: link.symptomCode,
    toSlug: link.diseaseSlug,
    label: link.labelBn,
  }));
}

export const GRAPH_SLUG_BOOST = 0.35;
export const GRAPH_EMERGENCY_SLUG_BOOST = 0.45;
export const MAX_GRAPH_SLUGS = 8;

const EMERGENCY_QUERY_TOKENS = ['জরুরি', 'emergency', 'urgent', 'মরে যাচ্ছে', 'মরছে', 'রক্ত'];

export function detectEmergencyQuery(query: string): boolean {
  const haystack = query.toLowerCase().normalize('NFC');
  return EMERGENCY_QUERY_TOKENS.some((token) => haystack.includes(token.toLowerCase().normalize('NFC')));
}
