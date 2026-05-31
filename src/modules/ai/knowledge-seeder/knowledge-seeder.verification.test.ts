import { describe, expect, it } from 'vitest';

import { seederRowToImportRecord } from './adapters/seeder-bundle.adapter.js';
import { resolveChunkPolicyForDomain } from '../knowledge-chunking/policies/chunk-policy.registry.js';
import { getTemplateValidatorService } from './validation/template-validator.service.js';
import { DOMAIN_TEMPLATE_REGISTRY, SEEDER_DOMAINS } from './index.js';
import type { SeederBundleRow } from './knowledge-seeder.types.js';

const baseRow = (domain: SeederBundleRow['domain'], overrides?: Partial<SeederBundleRow>): SeederBundleRow => ({
  slug: 'test-entity',
  domain,
  titleBn: 'বাংলা শিরোনাম',
  titleEn: 'English title',
  bodyBn: 'বাংলা বিবরণ',
  bodyEn: 'English body content.',
  sourceSpanRefs: [{ page: 1, sectionId: 'sec-1' }],
  structuredJson: {},
  ...overrides,
});

describe('Phase 6E knowledge population verification', () => {
  it('registers eight domain templates aligned with Phase 6E plan', () => {
    expect(SEEDER_DOMAINS).toEqual([
      'DISEASE',
      'MEDICINE',
      'VACCINE',
      'FEED',
      'BREED',
      'REPRODUCTION',
      'EMERGENCY',
      'CLINICAL_PROTOCOL',
    ]);
  });

  it('applies domain defaults on import record mapping', () => {
    const record = seederRowToImportRecord(
      baseRow('MEDICINE', {
        structuredJson: { genericName: 'TestDrug' },
      }),
    );
    expect(record.entityType).toBe('Drug');
    expect(record.chunkPolicyId).toBe('MEDICINE_BY_SECTION');
    expect(record.clinicalRiskTier).toBe('HIGH');
    expect(record.regionScope).toBe('BD');
  });

  it('uses registered chunk policies for all seeder domains', () => {
    for (const domain of SEEDER_DOMAINS) {
      const template = DOMAIN_TEMPLATE_REGISTRY[domain];
      const resolved = resolveChunkPolicyForDomain(domain, template.defaultChunkPolicyId);
      expect(resolved).toBeTruthy();
    }
  });

  it('requires source span refs for auditable citations', () => {
    const issues = getTemplateValidatorService().validateRow(
      baseRow('EMERGENCY', {
        sourceSpanRefs: undefined,
        structuredJson: { vetRequiredWithinHours: 2 },
      }),
      0,
    );
    expect(issues.some((i) => i.code === 'SOURCE_SPAN_REQUIRED')).toBe(true);
  });

  it('enforces BN-first on all domain templates', () => {
    for (const domain of SEEDER_DOMAINS) {
      const issues = getTemplateValidatorService().validateRow(
        baseRow(domain, { bodyBn: '', titleBn: '' }),
        0,
      );
      expect(issues.some((i) => i.code === 'BN_REQUIRED')).toBe(true);
    }
  });
});
