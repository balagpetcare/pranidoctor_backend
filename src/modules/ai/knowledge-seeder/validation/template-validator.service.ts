import type {
  SeederBundleRow,
  SeederDomain,
  SeederValidationIssue,
  SeederValidationReport,
} from '../knowledge-seeder.types.js';
import { getDomainTemplate } from '../templates/domain-templates.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class TemplateValidatorService {
  readonly name = 'TemplateValidatorService';

  validateRow(row: SeederBundleRow, rowIndex: number, expectedDomain?: SeederDomain): SeederValidationIssue[] {
    const issues: SeederValidationIssue[] = [];
    const template = getDomainTemplate(row.domain);

    if (expectedDomain && row.domain !== expectedDomain) {
      issues.push({
        rowIndex,
        slug: row.slug,
        code: 'DOMAIN_MISMATCH',
        message: `Expected domain ${expectedDomain}, got ${row.domain}`,
        field: 'domain',
      });
    }

    for (const field of template.requiredFields) {
      const value = row[field as keyof SeederBundleRow];
      if (value == null || (typeof value === 'string' && !value.trim())) {
        issues.push({
          rowIndex,
          slug: row.slug,
          code: 'REQUIRED_FIELD_MISSING',
          message: `Required field "${field}" is missing or empty`,
          field,
        });
      }
    }

    for (const field of template.requiredBnFields) {
      const value = row[field as keyof SeederBundleRow];
      if (typeof value !== 'string' || !value.trim()) {
        issues.push({
          rowIndex,
          slug: row.slug,
          code: 'BN_REQUIRED',
          message: `Bangla field "${field}" is required (BN-first policy)`,
          field,
        });
      }
    }

    if (row.slug && !SLUG_PATTERN.test(row.slug)) {
      issues.push({
        rowIndex,
        slug: row.slug,
        code: 'INVALID_SLUG',
        message: 'Slug must be lowercase kebab-case (a-z, 0-9, hyphen)',
        field: 'slug',
      });
    }

    if (row.regionScope && row.regionScope !== 'BD' && row.regionScope !== 'GLOBAL') {
      issues.push({
        rowIndex,
        slug: row.slug,
        code: 'INVALID_REGION_SCOPE',
        message: 'regionScope must be BD or GLOBAL for population bundles',
        field: 'regionScope',
      });
    }

    if (template.structuredJsonRequiredKeys?.length) {
      if (!row.structuredJson) {
        issues.push({
          rowIndex,
          slug: row.slug,
          code: 'STRUCTURED_JSON_REQUIRED',
          message: `structuredJson required for ${row.domain} entities`,
          field: 'structuredJson',
        });
      } else {
        for (const key of template.structuredJsonRequiredKeys) {
          if (row.structuredJson[key] == null) {
            issues.push({
              rowIndex,
              slug: row.slug,
              code: 'STRUCTURED_KEY_MISSING',
              message: `structuredJson.${key} is required for ${row.domain}`,
              field: `structuredJson.${key}`,
            });
          }
        }
      }
    }

    if (!row.sourceSpanRefs?.length) {
      issues.push({
        rowIndex,
        slug: row.slug,
        code: 'SOURCE_SPAN_REQUIRED',
        message: 'At least one sourceSpanRef is required for auditable population',
        field: 'sourceSpanRefs',
      });
    }

    return issues;
  }

  validateBundle(
    rows: SeederBundleRow[],
    filePath: string,
    expectedDomain?: SeederDomain,
  ): SeederValidationReport {
    const issues: SeederValidationIssue[] = [];
    const slugSet = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const rowIssues = this.validateRow(row, i, expectedDomain);
      issues.push(...rowIssues);

      const slugKey = `${row.domain}:${row.slug}`;
      if (slugSet.has(slugKey)) {
        issues.push({
          rowIndex: i,
          slug: row.slug,
          code: 'DUPLICATE_SLUG_IN_BATCH',
          message: `Duplicate slug in batch: ${slugKey}`,
          field: 'slug',
        });
      } else if (row.slug) {
        slugSet.add(slugKey);
      }
    }

    const invalidRows = new Set(issues.map((issue) => issue.rowIndex)).size;

    return {
      filePath,
      ...(expectedDomain ? { domain: expectedDomain } : {}),
      totalRows: rows.length,
      validRows: rows.length - invalidRows,
      invalidRows,
      issues,
      passed: issues.length === 0 && rows.length > 0,
    };
  }
}

let service: TemplateValidatorService | null = null;

export function getTemplateValidatorService(): TemplateValidatorService {
  if (!service) service = new TemplateValidatorService();
  return service;
}

export function resetTemplateValidatorServiceForTests(): void {
  service = null;
}
