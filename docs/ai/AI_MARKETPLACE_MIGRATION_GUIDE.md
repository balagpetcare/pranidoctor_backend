# AI Marketplace Migration Guide

**Version:** 1.0.0  
**Last Updated:** 2026-05-30  
**Audience:** Backend engineers, platform admins

---

## Summary

This guide walks through migrating from the **closed built-in provider set** to the **marketplace extension framework** with plugin adapters, external model registration, OpenRouter, and self-hosted LLM support.

---

## Prerequisites

- Prani Doctor backend `pranidoctor-backend` on branch with marketplace migration
- PostgreSQL access
- Admin panel access (`SUPER_ADMIN` or `ADMIN`)
- Optional: OpenRouter API key, local Ollama/vLLM instance

---

## Step 1 — Apply Database Migration

```bash
cd pranidoctor-backend
npx prisma migrate deploy
npx prisma generate
```

Migration file: `prisma/migrations/20260604120000_ai_marketplace_extensions/migration.sql`

**Adds:**

- Enums: `AiModelSource`, `AiExtensionStatus`
- Table: `ai_marketplace_extensions`
- Columns on `ai_models`: `source`, `externalModelId`, `modelCategory`, `extensionId`

**Verify:**

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'ai_models' AND column_name IN ('source', 'externalModelId', 'modelCategory');

SELECT COUNT(*) FROM ai_marketplace_extensions;
```

---

## Step 2 — Seed Marketplace Extensions

```bash
npm run db:seed
# or targeted:
npx tsx prisma/seeds/ai_marketplace.seed.ts
```

This installs:

| Extension | Provider key | Purpose |
|-----------|--------------|---------|
| `openrouter_gateway` | `openrouter` | Multi-model gateway |
| `self_hosted_llm` | `self_hosted` | Local Ollama/vLLM |
| `prani_vet_models` | `self_hosted` | Veterinary model slots |

Also creates `self_hosted` provider row if missing.

---

## Step 3 — Restart Backend

Marketplace extensions load at startup via `bootstrapAiPlatform()`:

```bash
npm run dev
# Check logs for: "AI marketplace extensions loaded"
```

Expected log fields: `builtinProviders`, `extensionsLoaded`, `registryKeys`.

---

## Step 4 — Configure Secrets

### OpenRouter

1. Admin → **AI Administration** → **API Keys**
2. Add key for provider `openrouter` (SUPER_ADMIN)
3. Or set env: `OPENROUTER_API_KEY=sk-or-...`

Enable provider:

```http
POST /api/admin/ai-ops/providers/{openrouterId}/toggle
{ "enabled": true }
```

### Self-hosted (Ollama example)

```bash
ollama serve
ollama pull llama3.2
```

Env:

```env
SELF_HOSTED_LLM_BASE_URL=http://localhost:11434/v1
SELF_HOSTED_LLM_MODEL=llama3.2
```

Optional vault key named `self_hosted` (many local endpoints accept any bearer token).

Enable provider via admin panel or API toggle.

---

## Step 5 — Register External Models

### Option A — Extension manifest (recommended)

POST full manifest with `models[]` array to:

```http
POST /api/admin/ai-ops/marketplace/extensions
```

Models are auto-registered when `providerKey` matches an existing `ai_providers` row.

### Option B — Single model registration

```http
POST /api/admin/ai-ops/marketplace/models/external
Content-Type: application/json

{
  "providerId": "<uuid from ai_providers>",
  "modelKey": "openai_gpt_4o_mini",
  "displayName": "GPT-4o Mini (OpenRouter)",
  "externalModelId": "openai/gpt-4o-mini",
  "source": "EXTERNAL",
  "modelCategory": "general_chat"
}
```

### Option C — OpenRouter catalog sync

```http
POST /api/admin/ai-ops/marketplace/openrouter/sync
Content-Type: application/json

{
  "modelIds": ["openai/gpt-4o-mini", "anthropic/claude-3.5-haiku"],
  "defaultCategory": "general_chat"
}
```

---

## Step 6 — Register Veterinary Models

```http
POST /api/admin/ai-ops/marketplace/models/external
{
  "providerId": "<self_hosted provider id>",
  "modelKey": "prani_symptom_v1",
  "displayName": "Prani Symptom Analyzer v1",
  "externalModelId": "prani/symptom-analyzer-v1",
  "source": "VETERINARY",
  "modelCategory": "symptom_analysis"
}
```

List:

```http
GET /api/admin/ai-ops/marketplace/veterinary/models
```

---

## Step 7 — Add Routes (Optional)

Point routing rules at new models via admin **Routes** panel or DB:

```sql
UPDATE ai_routes
SET primary_model_id = (SELECT id FROM ai_models WHERE model_key = 'openai_gpt_4o_mini' LIMIT 1)
WHERE task_type = 'GENERAL_CHAT';
```

> **Note:** Full runtime routing through DB-selected models requires orchestrator integration (roadmap item). Until then, extensions register providers for health checks, vault tests, and upcoming router wiring.

---

## Step 8 — Verify

```bash
# Unit tests
npx vitest run src/modules/ai/marketplace/

# List extensions
curl -b admin-session.cookie http://localhost:3000/api/admin/ai-ops/marketplace/extensions

# List adapter types
curl -b admin-session.cookie http://localhost:3000/api/admin/ai-ops/marketplace/adapters
```

---

## Migrating Custom Vendor Plugins

1. **Create provider row** (admin Providers API or SQL):

   ```json
   {
     "providerKey": "my_vendor",
     "displayName": "My Vendor",
     "adapterType": "openai_compatible",
     "baseUrl": "https://api.myvendor.com/v1"
   }
   ```

2. **Add vault secret** for `my_vendor`

3. **Install extension manifest** with `providerKey: "my_vendor"` and optional `models[]`

4. **Restart backend** or call extension install API (activates immediately)

No code changes required for OpenAI-compatible vendors.

---

## Rollback

```bash
# Revert migration (destructive — backup first)
npx prisma migrate resolve --rolled-back 20260604120000_ai_marketplace_extensions

# Or manual:
DROP TABLE IF EXISTS ai_marketplace_extensions;
ALTER TABLE ai_models DROP COLUMN IF EXISTS source, DROP COLUMN IF EXISTS "externalModelId",
  DROP COLUMN IF EXISTS "modelCategory", DROP COLUMN IF EXISTS "extensionId";
DROP TYPE IF EXISTS "AiModelSource";
DROP TYPE IF EXISTS "AiExtensionStatus";
```

Disable extensions without rollback:

```sql
UPDATE ai_marketplace_extensions SET enabled = false, status = 'DISABLED';
```

---

## Breaking Changes

| Change | Impact | Mitigation |
|--------|--------|------------|
| `AiProviderKey` extended to `string` | TypeScript callers using strict union | Use string keys; builtins unchanged |
| New `self_hosted` builtin | Factory creates extra provider | Disabled by default in seed |
| Startup loads DB extensions | Slightly longer boot | Extensions cached in registry |

---

## Checklist

- [ ] Migration applied
- [ ] Prisma client regenerated
- [ ] Marketplace seed run
- [ ] Backend restarted
- [ ] OpenRouter key configured (if using)
- [ ] Self-hosted endpoint reachable (if using)
- [ ] External models registered
- [ ] Routes updated (when orchestrator wired)
- [ ] Tests passing

---

## Support

- Architecture: [AI_MARKETPLACE_ARCHITECTURE.md](./AI_MARKETPLACE_ARCHITECTURE.md)
- Admin panel: [AI_ADMIN_PANEL.md](./AI_ADMIN_PANEL.md)
- Database foundation: [AI_DATABASE_FOUNDATION.md](./AI_DATABASE_FOUNDATION.md)
