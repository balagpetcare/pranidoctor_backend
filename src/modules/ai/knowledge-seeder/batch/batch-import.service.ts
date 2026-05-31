import { readFileSync } from 'node:fs';

import { getKnowledgeImportOrchestratorService } from '../../knowledge-import/index.js';
import type {
  SeederBatchManifest,
  SeederBatchResult,
  SeederImportInput,
  SeederImportResult,
} from '../knowledge-seeder.types.js';
import {
  loadBundleFile,
  rowsToImportRecords,
} from '../adapters/seeder-bundle.adapter.js';
import { getSeederAuditService } from '../tools/seeder-audit.service.js';
import { getSeederValidationService } from '../validation/seeder-validation.service.js';

export class BatchImportService {
  readonly name = 'BatchImportService';

  async importBundle(input: SeederImportInput): Promise<SeederImportResult> {
    await getSeederAuditService().record({
      eventType: 'SEEDER_VALIDATE_STARTED',
      ...(input.actorId ? { actorId: input.actorId } : {}),
      detail: {
        filePath: input.filePath,
        sourceId: input.sourceId,
        ...(input.domain ? { domain: input.domain } : {}),
      },
    });

    const validation = getSeederValidationService().validateFile(input.filePath, input.domain);
    await getSeederAuditService().record({
      eventType: 'SEEDER_VALIDATE_COMPLETED',
      ...(input.actorId ? { actorId: input.actorId } : {}),
      detail: {
        filePath: input.filePath,
        passed: validation.passed,
        issueCount: validation.issues.length,
        totalRows: validation.totalRows,
      },
    });

    if (!validation.passed) {
      throw new Error(
        `Validation failed for ${input.filePath}: ${validation.issues.length} issue(s). First: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
    }

    const rows = loadBundleFile(input.filePath);
    const importRows = rowsToImportRecords(rows);

    await getSeederAuditService().record({
      eventType: 'SEEDER_IMPORT_STARTED',
      ...(input.actorId ? { actorId: input.actorId } : {}),
      detail: {
        filePath: input.filePath,
        sourceId: input.sourceId,
        rowCount: rows.length,
        dryRun: input.dryRun ?? false,
      },
    });

    const orchestrator = getKnowledgeImportOrchestratorService();
    const triggeredById = input.triggeredById ?? input.actorId;
    const result = await orchestrator.startImport(
      {
        sourceId: input.sourceId,
        rows: importRows,
        dryRun: input.dryRun ?? false,
        sync: true,
        ...(input.documentId ? { documentId: input.documentId } : {}),
        ...(triggeredById ? { triggeredById } : {}),
      },
      input.actorId
        ? { id: input.actorId, role: input.actorRole ?? 'KNOWLEDGE_SEEDER' }
        : undefined,
    );

    await getSeederAuditService().record({
      eventType: 'SEEDER_IMPORT_COMPLETED',
      ...(input.actorId ? { actorId: input.actorId } : {}),
      detail: {
        importRunId: result.importRunId,
        filePath: input.filePath,
        stats: result.stats,
        versionCount: result.versionIds.length,
      },
    });

    return {
      importRunId: result.importRunId,
      stats: result.stats,
      versionIds: result.versionIds,
      validation,
    };
  }

  async importBatchManifest(manifestPath: string, options?: {
    dryRun?: boolean;
    actorId?: string;
    actorRole?: string;
  }): Promise<SeederBatchResult> {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as SeederBatchManifest;

    await getSeederAuditService().record({
      eventType: 'SEEDER_BATCH_STARTED',
      ...(options?.actorId ? { actorId: options.actorId } : {}),
      detail: {
        manifestPath,
        entryCount: manifest.entries.length,
        manifestVersion: manifest.manifestVersion,
      },
    });

    const results: SeederImportResult[] = [];
    const failures: Array<{ filePath: string; error: string }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const entry of manifest.entries) {
      try {
        const bundleInput: SeederImportInput = {
          sourceId: entry.sourceId,
          filePath: entry.filePath,
          ...(entry.documentId ? { documentId: entry.documentId } : {}),
          ...(entry.domain ? { domain: entry.domain } : {}),
          ...(options?.actorId ? { actorId: options.actorId } : {}),
          ...(options?.actorRole ? { actorRole: options.actorRole } : {}),
        };
        if (options?.dryRun === true) {
          bundleInput.dryRun = true;
        }
        const result = await this.importBundle(bundleInput);
        results.push(result);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        failures.push({
          filePath: entry.filePath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await getSeederAuditService().record({
      eventType: 'SEEDER_BATCH_COMPLETED',
      ...(options?.actorId ? { actorId: options.actorId } : {}),
      detail: {
        manifestPath,
        succeeded,
        failed,
        totalEntries: manifest.entries.length,
        ...(failures.length ? { failures } : {}),
      },
    });

    return {
      results,
      totalEntries: manifest.entries.length,
      succeeded,
      failed,
    };
  }
}

let service: BatchImportService | null = null;

export function getBatchImportService(): BatchImportService {
  if (!service) service = new BatchImportService();
  return service;
}

export function resetBatchImportServiceForTests(): void {
  service = null;
}
