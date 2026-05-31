-- Phase 4: Router Engine — default OpenAI → Gemini → OpenRouter platform route

INSERT INTO "ai_routes" (
  "id", "scopeKey", "routeKey", "name", "taskType", "description",
  "enabled", "priority", "primaryProviderId", "primaryModelId",
  "providerChainJson", "maxRetries", "timeoutMs", "fallbackToRules",
  "version", "createdAt", "updatedAt"
)
SELECT
  'clrt4generalchat',
  'platform',
  'platform_general_chat',
  'Platform General Chat',
  'GENERAL_CHAT',
  'Default OpenAI → Gemini → OpenRouter failover chain',
  true,
  10,
  openai_p.id,
  openai_m.id,
  jsonb_build_array(
    jsonb_build_object('order', 0, 'providerKey', 'openai', 'providerId', openai_p.id, 'modelId', openai_m.id),
    jsonb_build_object('order', 1, 'providerKey', 'gemini', 'providerId', gemini_p.id, 'modelId', gemini_m.id),
    jsonb_build_object('order', 2, 'providerKey', 'openrouter', 'providerId', or_p.id, 'modelId', or_m.id)
  ),
  2,
  30000,
  true,
  1,
  NOW(),
  NOW()
FROM "ai_providers" openai_p
JOIN "ai_models" openai_m ON openai_m."providerId" = openai_p.id AND openai_m."modelKey" = 'gpt-4o-mini' AND openai_m."deletedAt" IS NULL
JOIN "ai_providers" gemini_p ON gemini_p."scopeKey" = 'platform' AND gemini_p."providerKey" = 'gemini' AND gemini_p."deletedAt" IS NULL
JOIN "ai_models" gemini_m ON gemini_m."providerId" = gemini_p.id AND gemini_m."modelKey" = 'gemini-1.5-flash' AND gemini_m."deletedAt" IS NULL
JOIN "ai_providers" or_p ON or_p."scopeKey" = 'platform' AND or_p."providerKey" = 'openrouter' AND or_p."deletedAt" IS NULL
JOIN "ai_models" or_m ON or_m."providerId" = or_p.id AND or_m."modelKey" = 'openai/gpt-4o-mini' AND or_m."deletedAt" IS NULL
WHERE openai_p."scopeKey" = 'platform' AND openai_p."providerKey" = 'openai' AND openai_p."deletedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ai_routes" r
    WHERE r."scopeKey" = 'platform' AND r."routeKey" = 'platform_general_chat' AND r."deletedAt" IS NULL
  );

INSERT INTO "ai_failover_rules" (
  "id", "scopeKey", "routeId", "name", "enabled", "priority",
  "triggerType", "action", "version", "createdAt", "updatedAt"
)
SELECT
  'clfr4' || v.suffix,
  'platform',
  'clrt4generalchat',
  v.name,
  true,
  v.priority,
  v.trigger::"AiFailoverTriggerType",
  v.action::"AiFailoverActionType",
  1,
  NOW(),
  NOW()
FROM (VALUES
  ('429next', 'Rate limit → next provider', 10, 'HTTP_429', 'NEXT_PROVIDER'),
  ('5xxretry', '5xx retry same hop', 20, 'HTTP_5XX', 'RETRY_SAME'),
  ('timeoutnext', 'Timeout → next provider', 30, 'TIMEOUT', 'NEXT_PROVIDER')
) AS v(suffix, name, priority, trigger, action)
WHERE EXISTS (SELECT 1 FROM "ai_routes" r WHERE r.id = 'clrt4generalchat')
  AND NOT EXISTS (
    SELECT 1 FROM "ai_failover_rules" f WHERE f.id = 'clfr4' || v.suffix
  );
