export const KNOWLEDGE_EMBEDDING_JOB_NAMES = {
  EMBED_ENTRY: 'embed-entry',
  REFRESH_STALE: 'refresh-stale',
  VERSION_DRIFT: 'version-drift',
  PGVECTOR_BACKFILL: 'pgvector-backfill',
  FULL_CORPUS: 'full-corpus-embed',
} as const;

export type KnowledgeEmbedEntryPayload = {
  knowledgeEntryId: string;
  source?: 'publish' | 'refresh' | 'manual';
};

export type KnowledgeEmbedRefreshPayload = {
  maxEntries?: number;
  source?: 'cron' | 'manual';
};

export type KnowledgeEmbedVersionDriftPayload = {
  maxEntries?: number;
  source?: 'cron' | 'manual';
};

export type KnowledgeEmbedPgvectorBackfillPayload = {
  maxRows?: number;
  source?: 'cron' | 'manual';
};

export function isKnowledgeEmbeddingCronEnabled(): boolean {
  return process.env.KNOWLEDGE_EMBEDDING_CRON_ENABLED !== 'false';
}
