import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

import { getKnowledgeImportAuditRepository } from '../../knowledge-import/audit/knowledge-import-audit.repository.js';

import {
  KNOWLEDGE_SEEDER_AUDIT_SETTING_KEY,
  type SeederAuditEventType,
} from '../knowledge-seeder.constants.js';
import type { SeederAuditEntry } from '../knowledge-seeder.types.js';

const MAX_AUDIT_ENTRIES = 200;

export class SeederAuditService {
  readonly name = 'SeederAuditService';

  async record(entry: {
    eventType: SeederAuditEventType;
    actorId?: string;
    detail: Record<string, unknown>;
  }): Promise<void> {
    const auditEntry: SeederAuditEntry = {
      eventType: entry.eventType,
      at: new Date().toISOString(),
      ...(entry.actorId ? { actorId: entry.actorId } : {}),
      detail: entry.detail,
    };

    const existing = await getPrisma().setting.findUnique({
      where: { key: KNOWLEDGE_SEEDER_AUDIT_SETTING_KEY },
    });

    const prior =
      existing?.valueJson &&
      typeof existing.valueJson === 'object' &&
      Array.isArray((existing.valueJson as { entries?: unknown[] }).entries)
        ? ((existing.valueJson as { entries: SeederAuditEntry[] }).entries ?? [])
        : [];

    const entries = [...prior, auditEntry].slice(-MAX_AUDIT_ENTRIES);

    await getPrisma().setting.upsert({
      where: { key: KNOWLEDGE_SEEDER_AUDIT_SETTING_KEY },
      create: {
        key: KNOWLEDGE_SEEDER_AUDIT_SETTING_KEY,
        valueJson: toInputJson({ entries, updatedAt: new Date().toISOString() }),
      },
      update: {
        valueJson: toInputJson({ entries, updatedAt: new Date().toISOString() }),
      },
    });
  }

  async listEntries(limit = 50): Promise<SeederAuditEntry[]> {
    const row = await getPrisma().setting.findUnique({
      where: { key: KNOWLEDGE_SEEDER_AUDIT_SETTING_KEY },
    });
    if (!row?.valueJson || typeof row.valueJson !== 'object') return [];
    const entries = (row.valueJson as { entries?: SeederAuditEntry[] }).entries ?? [];
    return entries.slice(-limit);
  }

  async exportReport(filter?: { importRunId?: string }): Promise<{
    exportedAt: string;
    entries: SeederAuditEntry[];
    importRunAudit?: unknown[];
  }> {
    const entries = await this.listEntries(200);

    let importRunAudit: unknown[] | undefined;
    if (filter?.importRunId) {
      importRunAudit = await getKnowledgeImportAuditRepository().listForImportRun(
        filter.importRunId,
      );
    }

    await this.record({
      eventType: 'SEEDER_AUDIT_EXPORT',
      detail: {
        ...(filter?.importRunId ? { importRunId: filter.importRunId } : {}),
        entryCount: entries.length,
      },
    });

    return {
      exportedAt: new Date().toISOString(),
      entries,
      ...(importRunAudit ? { importRunAudit } : {}),
    };
  }
}

let service: SeederAuditService | null = null;

export function getSeederAuditService(): SeederAuditService {
  if (!service) service = new SeederAuditService();
  return service;
}

export function resetSeederAuditServiceForTests(): void {
  service = null;
}
