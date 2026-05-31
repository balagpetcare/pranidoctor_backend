import type { Job } from 'bullmq';

import type { AppConfig } from '../../../../shared/config/index.js';
import {
  createQueue,
  createWorker,
  scheduleRepeatingJob,
} from '../../../../infra/queue/queue.service.js';
import { QueueNames } from '../../../../infra/queue/queue.types.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import {
  runKnowledgeEmbeddingRefreshJob,
  runEmbeddingVersionDriftJob,
  runFullCorpusEmbedJob,
  runPgvectorBackfillJob,
} from './embedding-refresh.job.js';
import { getKnowledgeEmbeddingPipelineService } from './embedding-pipeline.service.js';
import {
  KNOWLEDGE_EMBEDDING_JOB_NAMES,
  isKnowledgeEmbeddingCronEnabled,
  type KnowledgeEmbedEntryPayload,
  type KnowledgeEmbedRefreshPayload,
  type KnowledgeEmbedVersionDriftPayload,
  type KnowledgeEmbedPgvectorBackfillPayload,
} from './knowledge-embedding-job.types.js';

export async function processKnowledgeEmbeddingJob(
  job: Job<
    | KnowledgeEmbedEntryPayload
    | KnowledgeEmbedRefreshPayload
    | KnowledgeEmbedVersionDriftPayload
    | KnowledgeEmbedPgvectorBackfillPayload
  >,
): Promise<unknown> {
  switch (job.name) {
    case KNOWLEDGE_EMBEDDING_JOB_NAMES.EMBED_ENTRY: {
      const payload = job.data as KnowledgeEmbedEntryPayload;
      return getKnowledgeEmbeddingPipelineService().embedEntry(payload.knowledgeEntryId);
    }
    case KNOWLEDGE_EMBEDDING_JOB_NAMES.REFRESH_STALE: {
      const payload = job.data as KnowledgeEmbedRefreshPayload;
      return runKnowledgeEmbeddingRefreshJob(payload.maxEntries ?? 200);
    }
    case KNOWLEDGE_EMBEDDING_JOB_NAMES.VERSION_DRIFT: {
      const payload = job.data as KnowledgeEmbedVersionDriftPayload;
      return runEmbeddingVersionDriftJob(payload.maxEntries ?? 100);
    }
    case KNOWLEDGE_EMBEDDING_JOB_NAMES.PGVECTOR_BACKFILL: {
      const payload = job.data as KnowledgeEmbedPgvectorBackfillPayload;
      return runPgvectorBackfillJob(payload.maxRows ?? 500);
    }
    case KNOWLEDGE_EMBEDDING_JOB_NAMES.FULL_CORPUS: {
      return runFullCorpusEmbedJob();
    }
    default:
      throw new Error(`Unknown knowledge embedding job: ${job.name}`);
  }
}

export async function bootstrapKnowledgeEmbeddingWorkers(_config: AppConfig): Promise<void> {
  createQueue(QueueNames.KNOWLEDGE_EMBEDDING);
  createWorker(QueueNames.KNOWLEDGE_EMBEDDING, processKnowledgeEmbeddingJob);
  getLogger().info({
    msg: 'Knowledge embedding worker registered',
    queue: QueueNames.KNOWLEDGE_EMBEDDING,
  });

  if (!isKnowledgeEmbeddingCronEnabled()) {
    getLogger().warn({
      msg: 'Knowledge embedding refresh cron skipped — KNOWLEDGE_EMBEDDING_CRON_ENABLED=false',
    });
    return;
  }

  await scheduleRepeatingJob(
    QueueNames.KNOWLEDGE_EMBEDDING,
    KNOWLEDGE_EMBEDDING_JOB_NAMES.REFRESH_STALE,
    { maxEntries: 200, source: 'cron' },
    '0 */6 * * *',
    { jobId: 'knowledge-embedding-refresh-stale' },
  );

  await scheduleRepeatingJob(
    QueueNames.KNOWLEDGE_EMBEDDING,
    KNOWLEDGE_EMBEDDING_JOB_NAMES.VERSION_DRIFT,
    { maxEntries: 100, source: 'cron' },
    '0 2 * * *',
    { jobId: 'knowledge-embedding-version-drift' },
  );

  getLogger().info({ msg: 'Knowledge embedding refresh cron registered' });
}
