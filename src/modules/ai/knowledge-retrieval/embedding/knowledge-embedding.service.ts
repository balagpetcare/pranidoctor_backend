import {
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeStatus,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { getKnowledgeEmbeddingPipelineService } from './embedding-pipeline.service.js';
import { getKnowledgeEmbeddingQueueService } from './embedding-queue.service.js';
import { runKnowledgeEmbeddingRefreshJob } from './embedding-refresh.job.js';

export class KnowledgeEmbeddingService {
  readonly name = 'KnowledgeEmbeddingService';

  async embedEntry(knowledgeEntryId: string) {
    return getKnowledgeEmbeddingPipelineService().embedEntry(knowledgeEntryId);
  }

  scheduleEmbedEntry(knowledgeEntryId: string): void {
    void getKnowledgeEmbeddingQueueService()
      .enqueueEmbedEntry(knowledgeEntryId, 'publish')
      .catch(() => {
        getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(knowledgeEntryId);
      });
  }

  scheduleRefreshStale(maxEntries = 50): void {
    void getKnowledgeEmbeddingQueueService().enqueueRefreshStale(maxEntries);
  }

  async refreshStaleEmbeddings(maxEntries = 50) {
    return runKnowledgeEmbeddingRefreshJob(maxEntries);
  }

  async getEmbeddingHealthSummary() {
    const [published, pending, failed, ready] = await Promise.all([
      getPrisma().aiKnowledgeEntry.count({ where: { status: AiKnowledgeStatus.PUBLISHED } }),
      getPrisma().aiKnowledgeEntry.count({
        where: {
          status: AiKnowledgeStatus.PUBLISHED,
          embeddingStatus: AiKnowledgeEmbeddingStatus.PENDING,
        },
      }),
      getPrisma().aiKnowledgeEntry.count({
        where: {
          status: AiKnowledgeStatus.PUBLISHED,
          embeddingStatus: AiKnowledgeEmbeddingStatus.FAILED,
        },
      }),
      getPrisma().aiKnowledgeEntry.count({
        where: {
          status: AiKnowledgeStatus.PUBLISHED,
          embeddingStatus: AiKnowledgeEmbeddingStatus.READY,
        },
      }),
    ]);

    return { published, pending, failed, ready };
  }
}

let service: KnowledgeEmbeddingService | null = null;

export function getKnowledgeEmbeddingService(): KnowledgeEmbeddingService {
  if (!service) service = new KnowledgeEmbeddingService();
  return service;
}

export function resetKnowledgeEmbeddingServiceForTests(): void {
  service = null;
}
