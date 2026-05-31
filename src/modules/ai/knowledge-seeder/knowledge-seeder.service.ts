import { getBatchImportService } from './batch/batch-import.service.js';
import { getSeederApprovalService } from './tools/seeder-approval.service.js';
import { getSeederAuditService } from './tools/seeder-audit.service.js';
import { getSeederValidationService } from './validation/seeder-validation.service.js';
import {
  DOMAIN_TEMPLATE_REGISTRY,
  listDomainTemplates,
  KNOWLEDGE_IMPORT_CSV_HEADERS,
} from './templates/domain-templates.js';
import type {
  SeederBatchManifest,
  SeederDomain,
  SeederImportInput,
  SeederApprovalSubmitInput,
} from './knowledge-seeder.types.js';
import {
  KNOWLEDGE_SEEDER_SCHEMA_VERSION,
  KNOWLEDGE_SEEDER_SETTING_KEY,
  PRODUCTION_SEED_ENV_FLAG,
} from './knowledge-seeder.constants.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { toInputJson } from '../../../shared/database/prisma-json.js';

export class KnowledgeSeederService {
  readonly name = 'KnowledgeSeederService';
  readonly schemaVersion = KNOWLEDGE_SEEDER_SCHEMA_VERSION;

  assertProductionAllowed(): void {
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    if (nodeEnv === 'production' && process.env[PRODUCTION_SEED_ENV_FLAG] !== 'true') {
      throw new Error(
        `Knowledge seeding blocked in production. Set ${PRODUCTION_SEED_ENV_FLAG}=true to override.`,
      );
    }
  }

  validateBundle(filePath: string, domain?: SeederDomain) {
    return getSeederValidationService().validateFile(filePath, domain);
  }

  async importBundle(input: SeederImportInput) {
    this.assertProductionAllowed();
    return getBatchImportService().importBundle(input);
  }

  async importBatchManifest(
    manifestPath: string,
    options?: { dryRun?: boolean; actorId?: string; actorRole?: string },
  ) {
    this.assertProductionAllowed();
    return getBatchImportService().importBatchManifest(manifestPath, options);
  }

  listDomainTemplates() {
    return listDomainTemplates();
  }

  getDomainTemplate(domain: SeederDomain) {
    return DOMAIN_TEMPLATE_REGISTRY[domain];
  }

  getImportCsvHeaders(): string {
    return KNOWLEDGE_IMPORT_CSV_HEADERS;
  }

  async recordRunSummary(summary: {
    actorId?: string;
    importRunId?: string;
    filePath?: string;
    dryRun?: boolean;
  }): Promise<void> {
    await getPrisma().setting.upsert({
      where: { key: KNOWLEDGE_SEEDER_SETTING_KEY },
      create: {
        key: KNOWLEDGE_SEEDER_SETTING_KEY,
        valueJson: toInputJson({
          schemaVersion: KNOWLEDGE_SEEDER_SCHEMA_VERSION,
          lastRunAt: new Date().toISOString(),
          ...summary,
        }),
      },
      update: {
        valueJson: toInputJson({
          schemaVersion: KNOWLEDGE_SEEDER_SCHEMA_VERSION,
          lastRunAt: new Date().toISOString(),
          ...summary,
        }),
      },
    });
  }

  exportAudit(filter?: { importRunId?: string }) {
    return getSeederAuditService().exportReport(filter);
  }

  submitForReview(input: SeederApprovalSubmitInput) {
    return getSeederApprovalService().submitForReview(input);
  }

  getApprovalStatus(versionIds: string[]) {
    return getSeederApprovalService().getApprovalStatus(versionIds);
  }
}

let service: KnowledgeSeederService | null = null;

export function getKnowledgeSeederService(): KnowledgeSeederService {
  if (!service) service = new KnowledgeSeederService();
  return service;
}

export function resetKnowledgeSeederServiceForTests(): void {
  service = null;
}

export type { SeederBatchManifest };
