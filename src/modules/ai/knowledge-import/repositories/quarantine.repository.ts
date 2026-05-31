import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

export class QuarantineRepository {
  async record(params: {
    importRunId: string;
    extractIndex?: number;
    reasonCode: string;
    message?: string;
    rawSnapshotJson?: Record<string, unknown>;
  }) {
    return getPrisma().aiKnowledgeQuarantineRecord.create({
      data: {
        importRunId: params.importRunId,
        extractIndex: params.extractIndex ?? null,
        reasonCode: params.reasonCode,
        message: params.message ?? null,
        ...(params.rawSnapshotJson ? { rawSnapshotJson: toInputJson(params.rawSnapshotJson) } : {}),
      },
    });
  }
}

let repo: QuarantineRepository | null = null;

export function getQuarantineRepository(): QuarantineRepository {
  if (!repo) repo = new QuarantineRepository();
  return repo;
}

export function resetQuarantineRepositoryForTests(): void {
  repo = null;
}
