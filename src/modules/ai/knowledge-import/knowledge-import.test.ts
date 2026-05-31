import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../shared/database/prisma.js', () => ({
  getPrisma: () => ({
    vkKnowledgeEntity: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
  }),
}));

import { parseCsvReferenceRows, dedupKeyForExtract } from './adapters/csv-reference.adapter.js';
import { SOURCE_FAMILY_PROFILES, resolveProfileForSourceClass } from './registry/source-family.profiles.js';
import { getValidationPipelineService, resetValidationPipelineForTests } from './validation/validation-pipeline.service.js';
import { getNormalizationEngine, resetNormalizationEngineForTests } from './normalization/normalization.engine.js';
import { getDuplicateDetectionService, resetDuplicateDetectionForTests } from './deduplication/duplicate-detection.service.js';

describe('knowledge-import source registry', () => {
  it('defines eight source family profiles including population bundle', () => {
    expect(SOURCE_FAMILY_PROFILES).toHaveLength(8);
    const families = new Set(SOURCE_FAMILY_PROFILES.map((p) => p.sourceFamily));
    expect(families.size).toBeGreaterThanOrEqual(7);
  });

  it('resolves medicine reference profile', () => {
    const profile = resolveProfileForSourceClass('MEDICINE_REFERENCE');
    expect(profile.sourceFamily).toBe('MEDICINE_REFERENCE');
    expect(profile.defaultClinicalRiskTier).toBe('CRITICAL');
  });
});

describe('csv-reference adapter', () => {
  it('parses rows into raw extracts with section hashes', () => {
    const extracts = parseCsvReferenceRows([
      {
        slug: 'ivermectin-cow',
        contentType: 'MEDICINE',
        titleBn: 'ইভারমেকটিন',
        titleEn: 'Ivermectin',
        bodyBn: 'bn body',
        bodyEn: 'en body with dose 0.2 mg/kg',
        structuredJson: { genericName: 'Ivermectin' },
      },
    ]);
    expect(extracts).toHaveLength(1);
    expect(extracts[0]!.slug).toBe('ivermectin-cow');
    expect(extracts[0]!.sectionHash).toBeTruthy();
    expect(dedupKeyForExtract(extracts[0]!)).toContain('MEDICINE');
  });
});

describe('validation pipeline', () => {
  beforeEach(() => {
    resetValidationPipelineForTests();
  });

  it('passes valid medicine extract', () => {
    const result = getValidationPipelineService().validateExtract(
      {
        extractIndex: 0,
        slug: 'drug-1',
        contentType: 'MEDICINE',
        titleBn: 'bn',
        titleEn: 'Drug',
        bodyBn: 'bn',
        bodyEn: 'dose 1 mg/kg',
        structuredJson: { genericName: 'X' },
      },
      {
        licenseActive: true,
        allowsAiExtraction: true,
        allowedDomains: ['MEDICINE', 'REGULATORY_BD'],
      },
    );
    expect(result.passed).toBe(true);
  });

  it('fails when EN missing', () => {
    const result = getValidationPipelineService().validateExtract(
      {
        extractIndex: 0,
        slug: 'x',
        contentType: 'FEED',
        titleBn: 'bn',
        titleEn: '',
        bodyBn: 'bn',
        bodyEn: '',
      },
      {
        licenseActive: true,
        allowsAiExtraction: true,
        allowedDomains: ['FEED'],
      },
    );
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.code === 'EN_REQUIRED')).toBe(true);
  });
});

describe('normalization engine', () => {
  beforeEach(() => {
    resetNormalizationEngineForTests();
  });

  it('normalizes extract to entity draft with dedup key', () => {
    const profile = resolveProfileForSourceClass('FEED_REFERENCE');
    const draft = getNormalizationEngine().normalizeExtract(
      {
        extractIndex: 0,
        slug: 'maize',
        contentType: 'FEED',
        titleBn: 'ভুট্টা',
        titleEn: 'Maize',
        bodyBn: 'bn',
        bodyEn: 'en',
      },
      profile,
      { importRunId: 'run-1' },
    );
    expect(draft.domain).toBe('FEED');
    expect(draft.dedupKey).toContain('FEED');
    expect(draft.regionScope).toBe('BD');
  });
});

describe('duplicate detection', () => {
  beforeEach(() => {
    resetDuplicateDetectionForTests();
  });

  it('skips intra-batch duplicates', async () => {
    const seen = new Set<string>();
    const draft = {
      extractIndex: 1,
      entityType: 'feed',
      domain: 'FEED',
      slug: 'maize',
      titleBn: 'a',
      titleEn: 'b',
      bodyBn: 'c',
      bodyEn: 'd',
      species: [],
      audience: 'FARMER' as const,
      regionScope: 'BD',
      clinicalRiskTier: 'LOW',
      localeFlags: [],
      provenanceJson: {},
      dedupKey: 'FEED:maize',
    };

    const deduper = getDuplicateDetectionService();
    const first = await deduper.detect(draft, {
      importRunId: 'r1',
      seenKeys: seen,
    });
    expect(first.decision).toBe('CREATE_NEW');

    const second = await deduper.detect(draft, {
      importRunId: 'r1',
      seenKeys: seen,
    });
    expect(second.decision).toBe('SKIP_DUPLICATE');
  });
});
