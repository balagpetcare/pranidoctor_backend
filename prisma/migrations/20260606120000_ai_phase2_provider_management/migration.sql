-- Phase 2: Provider Management — vault lifecycle, primary key, connection test metadata

-- Extend API key status enum
DO $$ BEGIN
  ALTER TYPE "AiApiKeyStatus" ADD VALUE 'PENDING_TEST';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ai_api_keys" ADD COLUMN IF NOT EXISTS "isPrimary" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "lastConnectionTestAt" TIMESTAMP(3);
ALTER TABLE "ai_providers" ADD COLUMN IF NOT EXISTS "lastConnectionTestOk" BOOLEAN;

CREATE INDEX IF NOT EXISTS "ai_api_keys_provider_id_scope_key_isPrimary_idx"
  ON "ai_api_keys" ("providerId", "scopeKey", "isPrimary");

-- One primary active key per provider per scope
CREATE UNIQUE INDEX IF NOT EXISTS "ai_api_keys_one_primary_per_provider_scope"
  ON "ai_api_keys" ("providerId", "scopeKey")
  WHERE "isPrimary" = true AND "status" = 'ACTIVE' AND "deletedAt" IS NULL;

-- Seed six first-class providers at platform scope (disabled until configured)
INSERT INTO "ai_providers" (
  "id", "scopeKey", "providerKey", "displayName", "description",
  "enabled", "priority", "adapterType", "baseUrl", "capabilitiesJson", "version", "createdAt", "updatedAt"
)
SELECT
  'clp2seed' || v.provider_key,
  'platform',
  v.provider_key,
  v.display_name,
  v.description,
  false,
  v.priority,
  v.adapter_type,
  v.base_url,
  v.capabilities::jsonb,
  1,
  NOW(),
  NOW()
FROM (VALUES
  ('openai', 'OpenAI', 'OpenAI chat, vision, and embeddings', 10, 'openai_native', 'https://api.openai.com/v1', '["chat","vision","embeddings"]'),
  ('anthropic', 'Anthropic', 'Claude models via native API', 20, 'anthropic_native', 'https://api.anthropic.com/v1', '["chat","vision"]'),
  ('gemini', 'Google Gemini', 'Gemini models via Generative Language API', 30, 'gemini_native', 'https://generativelanguage.googleapis.com/v1beta', '["chat","vision","embeddings"]'),
  ('groq', 'Groq', 'Groq LPU inference (OpenAI-compatible)', 40, 'openai_compatible', 'https://api.groq.com/openai/v1', '["chat"]'),
  ('deepseek', 'DeepSeek', 'DeepSeek chat and embeddings', 50, 'openai_compatible', 'https://api.deepseek.com/v1', '["chat","embeddings"]'),
  ('openrouter', 'OpenRouter', 'Multi-model gateway', 60, 'openrouter_gateway', 'https://openrouter.ai/api/v1', '["chat","vision","embeddings"]')
) AS v(provider_key, display_name, description, priority, adapter_type, base_url, capabilities)
WHERE NOT EXISTS (
  SELECT 1 FROM "ai_providers" p
  WHERE p."scopeKey" = 'platform' AND p."providerKey" = v.provider_key AND p."deletedAt" IS NULL
);

-- Mark highest-version active key as primary where none set
UPDATE "ai_api_keys" k
SET "isPrimary" = true
FROM (
  SELECT DISTINCT ON ("providerId", "scopeKey") id
  FROM "ai_api_keys"
  WHERE "status" = 'ACTIVE' AND "deletedAt" IS NULL AND "isPrimary" = false
  ORDER BY "providerId", "scopeKey", "version" DESC, "createdAt" DESC
) pick
WHERE k.id = pick.id
  AND NOT EXISTS (
    SELECT 1 FROM "ai_api_keys" x
    WHERE x."providerId" = k."providerId"
      AND x."scopeKey" = k."scopeKey"
      AND x."isPrimary" = true
      AND x."status" = 'ACTIVE'
      AND x."deletedAt" IS NULL
  );
