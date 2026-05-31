import { describe, expect, it } from 'vitest';

import { buildChunksForEntry, resolveChunkPolicyId } from './chunking/chunk-pipeline.service.js';
import {
  buildCitationBlock,
  buildSourceAttribution,
  renderHumanCitation,
  renderInlineRagCitation,
} from './citation/citation.service.js';
import { buildSearchText, dedupKeyForRow, normalizeImportRow } from './normalization/knowledge-normalizer.js';
import {
  assignProvisionalEvidenceLevel,
  evidenceLevelScore,
  finalizeEvidenceLevel,
  inferClinicalRiskTier,
} from './scoring/evidence-level.engine.js';
import { computeConfidenceScore, meetsRetrievalGate } from './scoring/confidence.engine.js';
import { PROVISIONAL_CONFIDENCE_CAP } from './knowledge-ingestion.types.js';

describe('knowledge-normalizer', () => {
  it('normalizes slug and species aliases', () => {
    const row = normalizeImportRow({
      slug: ' Mastitis Guide ',
      contentType: 'DISEASE',
      titleBn: 'নিউমোনিয়া',
      titleEn: 'Mastitis',
      bodyBn: 'বর্ণনা',
      bodyEn: 'Description',
      species: ['cattle', 'murgi'],
    });
    expect(row.slug).toBe('mastitis-guide');
    expect(row.species).toEqual(expect.arrayContaining(['COW', 'CHICKEN']));
    expect(dedupKeyForRow(row)).toBe('DISEASE:mastitis-guide');
  });

  it('builds lowercase search text', () => {
    expect(
      buildSearchText({
        titleBn: 'শিরোনাম',
        titleEn: 'Title',
        bodyBn: 'বডি',
        bodyEn: 'Body',
      }),
    ).toContain('title');
  });
});

describe('evidence-level.engine', () => {
  it('assigns provisional evidence from govt source', () => {
    const level = assignProvisionalEvidenceLevel({
      sourceClass: 'GOVT_LIVESTOCK',
      sourceDefaultLevel: 'L2',
      contentType: 'FARM_MGMT',
    });
    expect(level).toBe('L2');
    expect(evidenceLevelScore(level)).toBe(0.7);
  });

  it('requires L2 minimum for high risk on finalize', () => {
    const level = finalizeEvidenceLevel({
      provisional: 'L1',
      clinicalRiskTier: 'HIGH',
    });
    expect(level).toBe('L2');
  });
});

describe('confidence.engine', () => {
  it('caps provisional confidence', () => {
    const score = computeConfidenceScore({
      evidenceLevel: 'L5',
      trustTier: 1,
      extractQualityScore: 1,
      dedupConfidence: 1,
      provisional: true,
    });
    expect(score).toBeLessThanOrEqual(PROVISIONAL_CONFIDENCE_CAP);
  });

  it('evaluates retrieval gates', () => {
    expect(
      meetsRetrievalGate({
        confidence: 0.8,
        evidenceLevel: 'L2',
        minConfidence: 0.75,
        minEvidence: 'L2',
      }),
    ).toBe(true);
  });
});

describe('chunk-pipeline', () => {
  it('resolves medicine chunk policy', () => {
    expect(resolveChunkPolicyId('MEDICINE')).toBe('MEDICINE_BY_SECTION');
  });

  it('builds BN-first bilingual chunks', () => {
    const chunks = buildChunksForEntry({
      titleBn: 'mastitis-bn',
      titleEn: 'mastitis-en',
      bodyBn: '## লক্ষণ\nজ্বর',
      bodyEn: '## Signs\nFever',
      contentType: 'DISEASE',
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.contentBn).toContain('জ্বর');
    expect(chunks[0]?.contentEn).toContain('Fever');
  });
});

describe('citation.service', () => {
  it('renders inline and human citations', () => {
    const attr = buildSourceAttribution({ sourceId: 'src-1', pageRef: 'p. 12' });
    expect(renderInlineRagCitation('dls-manual', 'p.12')).toBe('[dls-manual|p.12]');
    expect(
      renderHumanCitation(
        {
          sourceKey: 'dls-manual',
          titleBn: 'ডিএলএস',
          titleEn: 'DLS',
          publisher: 'DLS',
          publishYear: 2024,
        },
        'bn',
        { pageRef: 'p. 12' },
      ),
    ).toContain('ডিএলএস');
    expect(buildCitationBlock([{ title: 'Test', citation: 'Ref' }], 'bn')).toContain('তথ্যসূত্র');
    expect(attr.sourceId).toBe('src-1');
  });
});

describe('clinical risk inference', () => {
  it('marks medicine as high risk', () => {
    expect(inferClinicalRiskTier('MEDICINE')).toBe('HIGH');
    expect(inferClinicalRiskTier('FARM_MGMT')).toBe('LOW');
  });
});
