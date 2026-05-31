-- AI Core Platform Phase 1 — session trace + default model constraint

ALTER TABLE "ai_usage_logs" ADD COLUMN IF NOT EXISTS "sessionId" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "ai_usage_logs_sessionId_createdAt_idx"
  ON "ai_usage_logs"("sessionId", "createdAt");

-- At most one default chat model per provider per scope (active rows only)
CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_scope_provider_default_active_key"
  ON "ai_models"("scopeKey", "providerId")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;
