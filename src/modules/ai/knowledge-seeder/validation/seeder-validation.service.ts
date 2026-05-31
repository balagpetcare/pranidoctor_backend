import { getValidationPipelineService } from '../../knowledge-import/index.js';
import { parseCsvReferenceRows } from '../../knowledge-import/adapters/csv-reference.adapter.js';
import type { SeederValidationReport } from '../knowledge-seeder.types.js';
import { rowsToImportRecords } from '../adapters/seeder-bundle.adapter.js';
import { loadBundleFile } from '../adapters/seeder-bundle.adapter.js';
import { getTemplateValidatorService } from './template-validator.service.js';
import type { SeederDomain } from '../knowledge-seeder.types.js';

export class SeederValidationService {
  readonly name = 'SeederValidationService';

  validateFile(filePath: string, domain?: SeederDomain): SeederValidationReport {
    const rows = loadBundleFile(filePath);
    const templateReport = getTemplateValidatorService().validateBundle(rows, filePath, domain);

    const kipIssues = this.validateAgainstKip(rows, filePath, domain);
    const issues = [...templateReport.issues, ...kipIssues];
    const invalidRowIndexes = new Set(issues.map((i) => i.rowIndex));

    return {
      ...templateReport,
      issues,
      invalidRows: invalidRowIndexes.size,
      validRows: rows.length - invalidRowIndexes.size,
      passed: issues.length === 0 && rows.length > 0,
    };
  }

  private validateAgainstKip(
    rows: ReturnType<typeof loadBundleFile>,
    filePath: string,
    domain?: SeederDomain,
  ): SeederValidationReport['issues'] {
    const importRecords = rowsToImportRecords(rows);
    const extracts = parseCsvReferenceRows(importRecords);
    const validator = getValidationPipelineService();
    const issues: SeederValidationReport['issues'] = [];

    for (const extract of extracts) {
      const rowDomain =
        extract.domain ??
        rows[extract.extractIndex]?.domain ??
        domain ??
        extract.contentType;

      const result = validator.validateExtract(extract, {
        licenseActive: true,
        allowsAiExtraction: true,
        allowedDomains: domain ? [domain] : [rowDomain],
      });

      if (!result.passed) {
        for (const failure of result.failures) {
          issues.push({
            rowIndex: extract.extractIndex,
            slug: extract.slug,
            code: failure.code,
            message: failure.message,
          });
        }
      }

      if (result.warnings.includes('BN_PENDING')) {
        issues.push({
          rowIndex: extract.extractIndex,
          slug: extract.slug,
          code: 'BN_REQUIRED',
          message: 'Bangla title and body required (BN-first policy)',
        });
      }
    }

    if (issues.length === 0 && rows.length === 0) {
      issues.push({
        rowIndex: 0,
        code: 'EMPTY_BUNDLE',
        message: `Bundle file is empty: ${filePath}`,
      });
    }

    return issues;
  }
}

let service: SeederValidationService | null = null;

export function getSeederValidationService(): SeederValidationService {
  if (!service) service = new SeederValidationService();
  return service;
}

export function resetSeederValidationServiceForTests(): void {
  service = null;
}
