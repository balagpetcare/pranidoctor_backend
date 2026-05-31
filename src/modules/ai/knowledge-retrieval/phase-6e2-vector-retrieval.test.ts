import { describe, expect, it } from 'vitest';

import {
  detectSymptomCodesFromQuery,
  buildGraphHints,
  GRAPH_SLUG_BOOST,
} from './graph/graph-expansion.logic.js';
import { fuseHybridCandidates } from './search/hybrid-fusion.service.js';
import { RETRIEVAL_PROFILES } from './profiles/retrieval-profile.registry.js';
import type { KeywordSearchHit } from './search/keyword-search.service.js';
import type { SemanticSearchHit } from './search/semantic-search.service.js';

describe('Phase 6E.2 — graph expansion logic', () => {
  it('detects fever symptom from BN query', () => {
    const codes = detectSymptomCodesFromQuery('গরু জ্বর করছে', ['fever', 'pyrexia']);
    expect(codes).toContain('fever');
  });

  it('detects feed-related tokens separately from fever', () => {
    const codes = detectSymptomCodesFromQuery('গরুর খাদ্য হিসাব', ['ration', 'feed']);
    expect(codes).not.toContain('fever');
  });

  it('builds HAS_SYMPTOM graph hints', () => {
    const hints = buildGraphHints([
      { symptomCode: 'fever', diseaseSlug: 'hemorrhagic-septicemia', labelBn: 'জ্বর' },
    ]);
    expect(hints[0]?.edgeType).toBe('HAS_SYMPTOM');
    expect(hints[0]?.toSlug).toBe('hemorrhagic-septicemia');
  });
});

describe('Phase 6E.2 — hybrid fusion graph boost', () => {
  it('applies slug boost to fused score', () => {
    const profile = RETRIEVAL_PROFILES['ai-doctor-v1']!;
    const lexical: KeywordSearchHit[] = [
      {
        knowledgeEntryId: 'e1',
        chunkIndex: 0,
        entryVersion: 1,
        lexicalScore: 0.5,
      },
    ];
    const semantic: SemanticSearchHit[] = [];
    const contentTypeByEntry = new Map([['e1', 'DISEASE' as const]]);
    const slugByEntryId = new Map([['e1', 'hemorrhagic-septicemia']]);
    const slugBoosts = new Map([['hemorrhagic-septicemia', GRAPH_SLUG_BOOST]]);

    const withoutBoost = fuseHybridCandidates({
      lexical,
      semantic,
      profile,
      contentTypeByEntry,
    });
    const withBoost = fuseHybridCandidates({
      lexical,
      semantic,
      profile,
      contentTypeByEntry,
      slugByEntryId,
      slugBoosts,
    });

    expect(withBoost[0]!.fusedScore).toBeGreaterThan(withoutBoost[0]!.fusedScore);
  });
});

describe('Phase 6E.2 — feed colloquial expansion', () => {
  it('expands খাদ্য হিসাব to ration terms', async () => {
    const { expandColloquialTerms } = await import('./query/colloquial-map.js');
    const result = expandColloquialTerms('গরুর খাদ্য হিসাব');
    expect(result.matched).toBe(true);
    expect(result.expandedTerms.some((t) => t.includes('ration') || t.includes('feed'))).toBe(true);
  });
});

describe('Phase 6E.2 — feed profile calibration', () => {
  it('applies feed-advisor calibration', async () => {
    const { applyMedicalConfidenceCalibration, MEDICAL_CONFIDENCE_CALIBRATION } = await import(
      './calibration/medical-confidence.calibration.js'
    );
    const calibrated = applyMedicalConfidenceCalibration(RETRIEVAL_PROFILES['feed-advisor-v1']!);
    expect(calibrated.minConfidence).toBe(
      MEDICAL_CONFIDENCE_CALIBRATION['feed-advisor-v1']!.minConfidence,
    );
    expect(calibrated.rerankerEnabled).toBe(true);
  });
});
