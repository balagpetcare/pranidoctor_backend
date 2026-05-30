-- AI Marketplace extension framework

CREATE TYPE "AiModelSource" AS ENUM ('BUILTIN', 'MARKETPLACE', 'EXTERNAL', 'VETERINARY', 'SELF_HOSTED');
CREATE TYPE "AiExtensionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DEPRECATED', 'DISABLED');

ALTER TABLE "ai_models"
  ADD COLUMN "source" "AiModelSource" NOT NULL DEFAULT 'BUILTIN',
  ADD COLUMN "externalModelId" VARCHAR(256),
  ADD COLUMN "modelCategory" VARCHAR(64) NOT NULL DEFAULT 'general_chat',
  ADD COLUMN "extensionId" TEXT;

CREATE INDEX "ai_models_source_modelCategory_idx" ON "ai_models"("source", "modelCategory");
CREATE INDEX "ai_models_extensionId_idx" ON "ai_models"("extensionId");

CREATE TABLE "ai_marketplace_extensions" (
  "id" TEXT NOT NULL,
  "scopeKey" VARCHAR(128) NOT NULL DEFAULT 'platform',
  "tenantId" VARCHAR(64),
  "branchId" VARCHAR(64),
  "extensionKey" VARCHAR(64) NOT NULL,
  "name" TEXT NOT NULL,
  "version" VARCHAR(32) NOT NULL,
  "publisher" VARCHAR(128),
  "description" TEXT,
  "adapterType" VARCHAR(32) NOT NULL,
  "providerKey" VARCHAR(64),
  "manifestJson" JSONB NOT NULL,
  "status" "AiExtensionStatus" NOT NULL DEFAULT 'DRAFT',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "signature" VARCHAR(128),
  "installedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "deletedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_marketplace_extensions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_marketplace_extensions_scopeKey_extensionKey_version_key"
  ON "ai_marketplace_extensions"("scopeKey", "extensionKey", "version");
CREATE INDEX "ai_marketplace_extensions_scopeKey_status_enabled_idx"
  ON "ai_marketplace_extensions"("scopeKey", "status", "enabled");
CREATE INDEX "ai_marketplace_extensions_adapterType_idx"
  ON "ai_marketplace_extensions"("adapterType");
CREATE INDEX "ai_marketplace_extensions_providerKey_idx"
  ON "ai_marketplace_extensions"("providerKey");
CREATE INDEX "ai_marketplace_extensions_deletedAt_idx"
  ON "ai_marketplace_extensions"("deletedAt");

ALTER TABLE "ai_models"
  ADD CONSTRAINT "ai_models_extensionId_fkey"
  FOREIGN KEY ("extensionId") REFERENCES "ai_marketplace_extensions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
