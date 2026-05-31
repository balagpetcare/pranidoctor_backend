import type { AiKnowledgeImportJobStage } from '../../../../generated/prisma/index.js';
import { getKnowledgeImportAuditService } from '../audit/knowledge-import-audit.service.js';
import { getImportJobRepository } from '../repositories/import-job.repository.js';
import type { ImportJobPayload } from '../knowledge-import.types.js';

export class KnowledgeImportQueueService {
  readonly name = 'KnowledgeImportQueueService';

  async enqueueStage(
    importRunId: string,
    jobStage: AiKnowledgeImportJobStage,
    payload: Record<string, unknown> = {},
  ) {
    return getImportJobRepository().create({
      importRunId,
      jobStage,
      payloadJson: { importRunId, stage: jobStage, ...payload },
    });
  }

  async enqueuePipeline(importRunId: string) {
    const stages: AiKnowledgeImportJobStage[] = [
      'IMPORT',
      'VALIDATE',
      'NORMALIZE',
      'DEDUP',
      'VERSION',
      'ROUTE',
    ];
    const jobs = [];
    for (const stage of stages) {
      jobs.push(await this.enqueueStage(importRunId, stage));
    }
    return jobs;
  }

  async processNextJob(
    importRunId: string,
    processor: (payload: ImportJobPayload & Record<string, unknown>, jobId: string) => Promise<Record<string, unknown>>,
  ): Promise<boolean> {
    const repo = getImportJobRepository();
    const job = await repo.claimNext(importRunId);
    if (!job) return false;

    try {
      const payload = job.payloadJson as ImportJobPayload & Record<string, unknown>;
      const result = await processor(payload, job.id);
      await repo.complete(job.id, result);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { willRetry } = await repo.fail(job.id, message, job.maxAttempts, job.attemptCount);
      if (willRetry) {
        await getKnowledgeImportAuditService().record({
          eventType: 'IMPORT_JOB_RETRY',
          importRunId,
          detail: { jobId: job.id, attempt: job.attemptCount, error: message },
        });
      }
      throw error;
    }
  }

  async finalizeJobs(importRunId: string) {
    return getImportJobRepository().completeQueuedJobs(importRunId);
  }
}

let service: KnowledgeImportQueueService | null = null;

export function getKnowledgeImportQueueService(): KnowledgeImportQueueService {
  if (!service) service = new KnowledgeImportQueueService();
  return service;
}

export function resetKnowledgeImportQueueForTests(): void {
  service = null;
}
