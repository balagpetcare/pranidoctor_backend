-- Phase 3: Model Registry — family taxonomy, economics versioning, capability metadata

CREATE TYPE "AiModelFamily" AS ENUM (
  'gpt', 'gemini', 'claude', 'deepseek', 'qwen', 'llama', 'grok'
);

DO $$ BEGIN
  ALTER TYPE "AiModelSource" ADD VALUE 'ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "AiModelSource" ADD VALUE 'SYNC';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "modelFamily" "AiModelFamily";
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "rateVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "cachedInputCostPerToken" DECIMAL(16,12);
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "batchInputCostPerToken" DECIMAL(16,12);
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "batchOutputCostPerToken" DECIMAL(16,12);
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(8) NOT NULL DEFAULT 'USD';
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "maxInputTokens" INTEGER;
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "contextWindowSource" VARCHAR(32) NOT NULL DEFAULT 'ADVERTISED';
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "deprecatedAt" TIMESTAMP(3);
ALTER TABLE "ai_models" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);

ALTER TABLE "ai_models" ALTER COLUMN "enabled" SET DEFAULT false;

CREATE INDEX IF NOT EXISTS "ai_models_modelFamily_enabled_idx"
  ON "ai_models" ("modelFamily", "enabled");

-- Phase 1 allowed one default per provider; Phase 3 scopes default to modelType.
DROP INDEX IF EXISTS "ai_models_scope_provider_default_active_key";

CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_one_default_per_type"
  ON "ai_models" ("scopeKey", "providerId", "modelType")
  WHERE "isDefault" = true AND "deletedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "ai_model_rate_history" (
  "id" TEXT NOT NULL,
  "modelId" TEXT NOT NULL,
  "rateVersion" INTEGER NOT NULL,
  "inputCostPerToken" DECIMAL(16,12) NOT NULL,
  "outputCostPerToken" DECIMAL(16,12) NOT NULL,
  "cachedInputCostPerToken" DECIMAL(16,12),
  "batchInputCostPerToken" DECIMAL(16,12),
  "batchOutputCostPerToken" DECIMAL(16,12),
  "currency" VARCHAR(8) NOT NULL DEFAULT 'USD',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "changedByUserId" TEXT,
  "changeReason" VARCHAR(500),
  "source" VARCHAR(32) NOT NULL DEFAULT 'admin',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_model_rate_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ai_model_rate_history_modelId_rateVersion_idx"
  ON "ai_model_rate_history" ("modelId", "rateVersion");
CREATE INDEX IF NOT EXISTS "ai_model_rate_history_modelId_effectiveFrom_idx"
  ON "ai_model_rate_history" ("modelId", "effectiveFrom");

ALTER TABLE "ai_model_rate_history"
  ADD CONSTRAINT "ai_model_rate_history_modelId_fkey"
  FOREIGN KEY ("modelId") REFERENCES "ai_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed xAI Grok provider (disabled until configured)
INSERT INTO "ai_providers" (
  "id", "scopeKey", "providerKey", "displayName", "description",
  "enabled", "priority", "adapterType", "baseUrl", "capabilitiesJson", "version", "createdAt", "updatedAt"
)
SELECT
  'clp2seedgrok',
  'platform',
  'grok',
  'xAI Grok',
  'Grok models via xAI API',
  false,
  70,
  'openai_compatible',
  'https://api.x.ai/v1',
  '["chat","vision"]'::jsonb,
  1,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "ai_providers" p
  WHERE p."scopeKey" = 'platform' AND p."providerKey" = 'grok' AND p."deletedAt" IS NULL
);

-- Backfill modelFamily from modelKey heuristics
UPDATE "ai_models" SET "modelFamily" = 'gpt'
WHERE "modelFamily" IS NULL AND (
  "modelKey" ILIKE '%gpt%' OR "modelKey" ILIKE 'openai/%' OR "modelKey" ILIKE 'o1%' OR "modelKey" ILIKE 'o3%'
);

UPDATE "ai_models" SET "modelFamily" = 'gemini'
WHERE "modelFamily" IS NULL AND ("modelKey" ILIKE '%gemini%' OR "modelKey" ILIKE 'google/%');

UPDATE "ai_models" SET "modelFamily" = 'claude'
WHERE "modelFamily" IS NULL AND ("modelKey" ILIKE '%claude%' OR "modelKey" ILIKE 'anthropic/%');

UPDATE "ai_models" SET "modelFamily" = 'deepseek'
WHERE "modelFamily" IS NULL AND "modelKey" ILIKE '%deepseek%';

UPDATE "ai_models" SET "modelFamily" = 'qwen'
WHERE "modelFamily" IS NULL AND "modelKey" ILIKE '%qwen%';

UPDATE "ai_models" SET "modelFamily" = 'llama'
WHERE "modelFamily" IS NULL AND ("modelKey" ILIKE '%llama%' OR "modelKey" ILIKE 'meta-llama/%');

UPDATE "ai_models" SET "modelFamily" = 'grok'
WHERE "modelFamily" IS NULL AND "modelKey" ILIKE '%grok%';

-- Seed built-in family catalog (disabled by default)
INSERT INTO "ai_models" (
  "id", "scopeKey", "providerId", "modelKey", "displayName", "modelFamily",
  "modelType", "modelCategory", "contextWindow", "maxOutputTokens",
  "inputCostPerToken", "outputCostPerToken", "currency", "rateVersion",
  "enabled", "isDefault", "source", "capabilitiesJson", "createdAt", "updatedAt"
)
SELECT
  v.id,
  'platform',
  p.id,
  v.model_key,
  v.display_name,
  v.model_family::"AiModelFamily",
  v.model_type,
  v.model_category,
  v.context_window,
  v.max_output,
  v.input_cost,
  v.output_cost,
  'USD',
  1,
  false,
  (v.is_default AND NOT EXISTS (
    SELECT 1 FROM "ai_models" m2
    WHERE m2."scopeKey" = 'platform'
      AND m2."providerId" = p.id
      AND m2."modelType" = v.model_type
      AND m2."isDefault" = true
      AND m2."deletedAt" IS NULL
  )),
  'BUILTIN'::"AiModelSource",
  v.capabilities::jsonb,
  NOW(),
  NOW()
FROM (VALUES
  ('clm3gpt4omini', 'openai', 'gpt-4o-mini', 'GPT-4o Mini', 'gpt', 'chat', 'general_chat', 128000, 16384, 0.00000015, 0.0000006, true, '["chat","vision","function_calling","streaming","json_mode"]'),
  ('clm3gpt4o', 'openai', 'gpt-4o', 'GPT-4o', 'gpt', 'chat', 'general_chat', 128000, 16384, 0.0000025, 0.00001, false, '["chat","vision","function_calling","streaming","json_mode"]'),
  ('clm3or_gpt4omini', 'openrouter', 'openai/gpt-4o-mini', 'GPT-4o Mini (OpenRouter)', 'gpt', 'chat', 'general_chat', 128000, 16384, 0.00000015, 0.0000006, true, '["chat","vision","function_calling","streaming","json_mode"]'),
  ('clm3gemflash', 'gemini', 'gemini-1.5-flash', 'Gemini 1.5 Flash', 'gemini', 'chat', 'general_chat', 1000000, 8192, 0.000000075, 0.0000003, true, '["chat","vision","streaming","json_mode"]'),
  ('clm3gem20flash', 'gemini', 'gemini-2.0-flash', 'Gemini 2.0 Flash', 'gemini', 'chat', 'general_chat', 1000000, 8192, 0.0000001, 0.0000004, false, '["chat","vision","streaming","json_mode"]'),
  ('clm3claudehaiku', 'anthropic', 'claude-3-5-haiku-20241022', 'Claude 3.5 Haiku', 'claude', 'chat', 'general_chat', 200000, 8192, 0.0000008, 0.000004, true, '["chat","vision","function_calling","streaming","json_mode"]'),
  ('clm3claudesonnet', 'anthropic', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'claude', 'chat', 'reasoning', 200000, 8192, 0.000003, 0.000015, false, '["chat","vision","function_calling","streaming","json_mode","reasoning"]'),
  ('clm3deepseekchat', 'deepseek', 'deepseek-chat', 'DeepSeek Chat', 'deepseek', 'chat', 'general_chat', 64000, 8192, 0.00000014, 0.00000028, true, '["chat","streaming","json_mode"]'),
  ('clm3deepseekreason', 'deepseek', 'deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', 'chat', 'reasoning', 64000, 8192, 0.00000055, 0.00000219, false, '["chat","streaming","reasoning"]'),
  ('clm3llamagroq', 'groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq)', 'llama', 'chat', 'general_chat', 128000, 8192, 0.00000059, 0.00000079, true, '["chat","streaming"]'),
  ('clm3llamaor', 'openrouter', 'meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B (OpenRouter)', 'llama', 'chat', 'general_chat', 128000, 8192, 0.00000012, 0.00000012, false, '["chat","streaming"]'),
  ('clm3qwenor', 'openrouter', 'qwen/qwen-2.5-72b-instruct', 'Qwen 2.5 72B (OpenRouter)', 'qwen', 'chat', 'code', 128000, 8192, 0.00000035, 0.0000004, false, '["chat","streaming","code_optimized"]'),
  ('clm3grok2', 'grok', 'grok-2-1212', 'Grok 2', 'grok', 'chat', 'general_chat', 131072, 8192, 0.000002, 0.00001, true, '["chat","vision","streaming","json_mode"]'),
  ('clm3grokor', 'openrouter', 'x-ai/grok-2', 'Grok 2 (OpenRouter)', 'grok', 'chat', 'general_chat', 131072, 8192, 0.000002, 0.00001, false, '["chat","vision","streaming","json_mode"]')
) AS v(id, provider_key, model_key, display_name, model_family, model_type, model_category, context_window, max_output, input_cost, output_cost, is_default, capabilities)
JOIN "ai_providers" p ON p."scopeKey" = 'platform' AND p."providerKey" = v.provider_key AND p."deletedAt" IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM "ai_models" m
  WHERE m."scopeKey" = 'platform' AND m."providerId" = p.id AND m."modelKey" = v.model_key AND m."deletedAt" IS NULL
);

-- Initial rate history for seeded models
INSERT INTO "ai_model_rate_history" (
  "id", "modelId", "rateVersion", "inputCostPerToken", "outputCostPerToken", "currency", "source", "changeReason"
)
SELECT
  'clrh3' || m.id,
  m.id,
  m."rateVersion",
  m."inputCostPerToken",
  m."outputCostPerToken",
  m."currency",
  'seed',
  'Phase 3 initial seed'
FROM "ai_models" m
WHERE m."scopeKey" = 'platform'
  AND m.id LIKE 'clm3%'
  AND NOT EXISTS (
    SELECT 1 FROM "ai_model_rate_history" h WHERE h."modelId" = m.id
  );
