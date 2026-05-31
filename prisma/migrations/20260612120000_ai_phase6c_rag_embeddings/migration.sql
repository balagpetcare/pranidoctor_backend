-- Phase 6C: knowledge chunk embeddings for RAG semantic search

CREATE TABLE "AiKnowledgeEmbeddingChunk" (
    "id" TEXT NOT NULL,
    "knowledgeEntryId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "entryVersion" INTEGER NOT NULL,
    "providerKey" VARCHAR(32) NOT NULL,
    "modelKey" VARCHAR(128) NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "vectorJson" JSONB NOT NULL,
    "embeddingTextHash" VARCHAR(64) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "embeddedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiKnowledgeEmbeddingChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiKnowledgeEmbeddingChunk_knowledgeEntryId_chunkIndex_entryVersion_key" ON "AiKnowledgeEmbeddingChunk"("knowledgeEntryId", "chunkIndex", "entryVersion");
CREATE INDEX "AiKnowledgeEmbeddingChunk_knowledgeEntryId_active_idx" ON "AiKnowledgeEmbeddingChunk"("knowledgeEntryId", "active");
CREATE INDEX "AiKnowledgeEmbeddingChunk_active_embeddedAt_idx" ON "AiKnowledgeEmbeddingChunk"("active", "embeddedAt");

ALTER TABLE "AiKnowledgeEmbeddingChunk" ADD CONSTRAINT "AiKnowledgeEmbeddingChunk_knowledgeEntryId_fkey" FOREIGN KEY ("knowledgeEntryId") REFERENCES "AiKnowledgeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
