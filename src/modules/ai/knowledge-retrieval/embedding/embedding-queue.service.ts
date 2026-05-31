import { addJob } from '../../../../infra/queue/queue.service.js';
import { QueueNames } from '../../../../infra/queue/queue.types.js';
import { isRedisInitialized } from '../../../../infra/redis/redis.client.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import {
  KNOWLEDGE_EMBEDDING_JOB_NAMES,
  type KnowledgeEmbedEntryPayload,
  type KnowledgeEmbedRefreshPayload,
} from './knowledge-embedding-job.types.js';
import { getKnowledgeEmbeddingPipelineService } from './embedding-pipeline.service.js';

export class KnowledgeEmbeddingQueueService {
  readonly name = 'KnowledgeEmbeddingQueueService';

  async enqueueEmbedEntry(
    knowledgeEntryId: string,
    source: KnowledgeEmbedEntryPayload['source'] = 'publish',
  ): Promise<'queued' | 'inline'> {
    if (!isRedisInitialized()) {
      getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(knowledgeEntryId);
      return 'inline';
    }

    try {
      await addJob<KnowledgeEmbedEntryPayload>(
        QueueNames.KNOWLEDGE_EMBEDDING,
        KNOWLEDGE_EMBEDDING_JOB_NAMES.EMBED_ENTRY,
        { knowledgeEntryId, source },
        { jobId: `knowledge-embed:${knowledgeEntryId}` },
      );
      return 'queued';
    } catch (error) {
      getLogger().warn(
        {
          knowledgeEntryId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Knowledge embed queue unavailable — falling back to inline embed',
      );
      getKnowledgeEmbeddingPipelineService().scheduleEmbedEntry(knowledgeEntryId);
      return 'inline';
    }
  }

  async enqueueRefreshStale(maxEntries = 50): Promise<'queued' | 'skipped'> {
    if (!isRedisInitialized()) return 'skipped';

    try {
      await addJob<KnowledgeEmbedRefreshPayload>(
        QueueNames.KNOWLEDGE_EMBEDDING,
        KNOWLEDGE_EMBEDDING_JOB_NAMES.REFRESH_STALE,
        { maxEntries, source: 'manual' },
        { jobId: `knowledge-embed-refresh:${Date.now()}` },
      );
      return 'queued';
    } catch {
      return 'skipped';
    }
  }
}

let queueService: KnowledgeEmbeddingQueueService | null = null;

export function getKnowledgeEmbeddingQueueService(): KnowledgeEmbeddingQueueService {
  if (!queueService) queueService = new KnowledgeEmbeddingQueueService();
  return queueService;
}

export function resetKnowledgeEmbeddingQueueForTests(): void {
  queueService = null;
}
