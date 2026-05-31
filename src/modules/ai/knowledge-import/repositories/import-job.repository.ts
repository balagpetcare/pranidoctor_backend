import type { AiKnowledgeImportJobStage, AiKnowledgeImportJobStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson } from '../../../../shared/database/prisma-json.js';

export class ImportJobRepository {
  async create(params: {
    importRunId: string;
    jobStage: AiKnowledgeImportJobStage;
    payloadJson: Record<string, unknown>;
    maxAttempts?: number;
  }) {
    return getPrisma().aiKnowledgeImportJob.create({
      data: {
        importRunId: params.importRunId,
        jobStage: params.jobStage,
        payloadJson: toInputJson(params.payloadJson),
        maxAttempts: params.maxAttempts ?? 3,
      },
    });
  }

  async claimNext(importRunId: string) {
    const job = await getPrisma().aiKnowledgeImportJob.findFirst({
      where: {
        importRunId,
        status: { in: ['QUEUED', 'RETRY_SCHEDULED'] },
        scheduledAt: { lte: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    if (!job) return null;

    return getPrisma().aiKnowledgeImportJob.update({
      where: { id: job.id },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
        startedAt: new Date(),
      },
    });
  }

  async complete(id: string, resultJson?: Record<string, unknown>) {
    return getPrisma().aiKnowledgeImportJob.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...(resultJson ? { resultJson: toInputJson(resultJson) } : {}),
      },
    });
  }

  async fail(id: string, error: string, maxAttempts: number, currentAttempts: number) {
    const willRetry = currentAttempts < maxAttempts;
    const retryDelayMs = Math.min(60_000, 1000 * 2 ** currentAttempts);

    return {
      willRetry,
      job: await getPrisma().aiKnowledgeImportJob.update({
        where: { id },
        data: {
          status: (willRetry ? 'RETRY_SCHEDULED' : 'FAILED') as AiKnowledgeImportJobStatus,
          lastError: error,
          ...(willRetry ? { scheduledAt: new Date(Date.now() + retryDelayMs) } : { completedAt: new Date() }),
        },
      }),
    };
  }

  async completeQueuedJobs(importRunId: string) {
    return getPrisma().aiKnowledgeImportJob.updateMany({
      where: {
        importRunId,
        status: { in: ['QUEUED', 'RETRY_SCHEDULED', 'PROCESSING'] },
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
  }
}

let repo: ImportJobRepository | null = null;

export function getImportJobRepository(): ImportJobRepository {
  if (!repo) repo = new ImportJobRepository();
  return repo;
}

export function resetImportJobRepositoryForTests(): void {
  repo = null;
}
