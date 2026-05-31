-- Phase 6C.13: pgvector ANN, metadata sidecar, retrieval telemetry

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "AiKnowledgeEmbeddingChunk"
  ADD COLUMN IF NOT EXISTS "metadataSidecarJson" JSONB;

ALTER TABLE "AiKnowledgeEmbeddingChunk"
  ADD COLUMN IF NOT EXISTS "embeddingVector" vector(1536);

ALTER TABLE "ai_usage_logs"
  ADD COLUMN IF NOT EXISTS "retrievalMetadataJson" JSONB;

CREATE INDEX IF NOT EXISTS "AiKnowledgeEmbeddingChunk_active_model_dims_idx"
  ON "AiKnowledgeEmbeddingChunk" ("active", "modelKey", "dimensions", "embeddedAt" DESC);

-- HNSW index for cosine ANN (1536-dim OpenAI-compatible embeddings)
CREATE INDEX IF NOT EXISTS "AiKnowledgeEmbeddingChunk_embedding_vector_hnsw_idx"
  ON "AiKnowledgeEmbeddingChunk"
  USING hnsw ("embeddingVector" vector_cosine_ops)
  WHERE "active" = true AND "dimensions" = 1536 AND "embeddingVector" IS NOT NULL;
