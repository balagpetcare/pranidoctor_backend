import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadBundleFile,
  rowsToImportRecords,
  seederRowToImportRecord,
} from './adapters/seeder-bundle.adapter.js';
import {
  getTemplateValidatorService,
  resetTemplateValidatorServiceForTests,
} from './validation/template-validator.service.js';
import {
  getSeederValidationService,
  resetSeederValidationServiceForTests,
} from './validation/seeder-validation.service.js';
import {
  DOMAIN_TEMPLATE_REGISTRY,
  listDomainTemplates,
  resolveSeederDomain,
} from './templates/domain-templates.js';
import {
  resetAllKnowledgeSeederForTests,
  SEEDER_DOMAINS,
  type SeederBundleRow,
} from './index.js';

const validDiseaseRow: SeederBundleRow = {
  slug: 'mastitis',
  domain: 'DISEASE',
  entityType: 'Disease',
  titleBn: 'স্থনপ্রদাহ',
  titleEn: 'Mastitis',
  bodyBn: 'লক্ষণ ও পরিচর্যা বিবরণ',
  bodyEn: 'Signs and management description from source.',
  species: ['COW'],
  regionScope: 'BD',
  clinicalRiskTier: 'MEDIUM',
  structuredJson: { diseaseCode: 'MAST-001', endemicBd: true },
  sourceSpanRefs: [{ page: 42, sectionId: 'ch4-mastitis' }],
  colloquialBn: ['দুধ থেকে পুঁজ'],
};

describe('knowledge-seeder domain templates', () => {
  it('registers all Phase 6E population domains', () => {
    expect(SEEDER_DOMAINS).toHaveLength(8);
    expect(listDomainTemplates()).toHaveLength(8);
    for (const domain of SEEDER_DOMAINS) {
      expect(DOMAIN_TEMPLATE_REGISTRY[domain].domain).toBe(domain);
      expect(DOMAIN_TEMPLATE_REGISTRY[domain].requiredBnFields).toContain('titleBn');
      expect(DOMAIN_TEMPLATE_REGISTRY[domain].requiredBnFields).toContain('bodyBn');
    }
  });

  it('resolves domain aliases', () => {
    expect(resolveSeederDomain('disease')).toBe('DISEASE');
    expect(resolveSeederDomain('invalid')).toBeNull();
  });
});

describe('template validator (BN-first)', () => {
  beforeEach(() => {
    resetTemplateValidatorServiceForTests();
  });

  it('passes a structurally valid disease row', () => {
    const issues = getTemplateValidatorService().validateRow(validDiseaseRow, 0);
    expect(issues).toHaveLength(0);
  });

  it('fails when Bangla body missing', () => {
    const issues = getTemplateValidatorService().validateRow(
      { ...validDiseaseRow, bodyBn: '' },
      0,
    );
    expect(issues.some((i) => i.code === 'BN_REQUIRED')).toBe(true);
  });

  it('fails when source span missing', () => {
    const issues = getTemplateValidatorService().validateRow(
      { ...validDiseaseRow, sourceSpanRefs: undefined },
      0,
    );
    expect(issues.some((i) => i.code === 'SOURCE_SPAN_REQUIRED')).toBe(true);
  });

  it('fails medicine row without genericName in structuredJson', () => {
    const issues = getTemplateValidatorService().validateRow(
      {
        ...validDiseaseRow,
        domain: 'MEDICINE',
        structuredJson: {},
      },
      0,
    );
    expect(issues.some((i) => i.code === 'STRUCTURED_KEY_MISSING')).toBe(true);
  });
});

describe('seeder bundle adapter', () => {
  it('maps seeder row to KIP import record with BD defaults', () => {
    const record = seederRowToImportRecord(validDiseaseRow);
    expect(record.domain).toBe('DISEASE');
    expect(record.regionScope).toBe('BD');
    expect(record.contentType).toBe('DISEASE');
    expect(record.sourceSpanRefs).toEqual(validDiseaseRow.sourceSpanRefs);
  });

  it('loads JSON bundle array from string path via write to temp', () => {
    const rows = [validDiseaseRow];
    const importRecords = rowsToImportRecords(rows);
    expect(importRecords).toHaveLength(1);
    expect(importRecords[0]!.slug).toBe('mastitis');
  });
});

describe('seeder validation service (KIP integration)', () => {
  beforeEach(() => {
    resetSeederValidationServiceForTests();
    resetAllKnowledgeSeederForTests();
  });

  it('flags EN_REQUIRED via KIP validator', () => {
    const rows = [{ ...validDiseaseRow, bodyEn: '', titleEn: '' }];
    const report = getTemplateValidatorService().validateBundle(rows, 'inline', 'DISEASE');
    expect(report.passed).toBe(false);
  });
});

vi.mock('../../knowledge-import/pipeline/knowledge-import-orchestrator.service.js', () => ({
  getKnowledgeImportOrchestratorService: () => ({
    startImport: vi.fn().mockResolvedValue({
      importRunId: 'run-1',
      stats: { versionsCreated: 1, quarantined: 0 },
      versionIds: ['ver-1'],
    }),
  }),
}));

describe('bundle file loader', () => {
  it('rejects unsupported extensions', () => {
    expect(() => loadBundleFile('/tmp/bundle.txt')).toThrow(/Unsupported bundle format/);
  });
});
