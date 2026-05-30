# AI Database Foundation (AIMS)

**Migration:** `20260603120000_ai_management_foundation`  
**Status:** Schema + seeds only — runtime services not wired yet  
**Related:** [AI_ECOSYSTEM_MASTER_PLAN.md](./AI_ECOSYSTEM_MASTER_PLAN.md)

---

## Overview

This foundation introduces eight PostgreSQL tables for the **AI Management System (AIMS)**. They live alongside — but do not replace — existing runtime AI tables (`AiUsageRecord`, `AiPromptTemplate`, `AiGovernanceState`, etc.).

| Prisma model | Table | Purpose |
|--------------|-------|---------|
| `AiProvider` | `ai_providers` | LLM provider registry |
| `AiModel` | `ai_models` | Model catalog + cost rates |
| `AiApiKey` | `ai_api_keys` | Encrypted credentials |
| `AiRoute` | `ai_routes` | Task-type routing rules |
| `AiPrompt` | `ai_prompts` | Versioned prompt registry |
| `AiUsageLog` | `ai_usage_logs` | Per-request AIMS usage log |
| `AiFailoverRule` | `ai_failover_rules` | Failover trigger → action rules |
| `AiSettings` | `ai_settings` | Scoped platform settings |

---

## Multi-Tenant & Branch Scoping

Every configurable entity includes:

| Field | Description |
|-------|-------------|
| `scopeKey` | Canonical scope identifier |
| `tenantId` | Optional organization/tenant id |
| `branchId` | Optional branch/deployment id |

### Scope key conventions

| Scope | `scopeKey` | `tenantId` | `branchId` |
|-------|------------|------------|------------|
| Platform default | `platform` | `null` | `null` |
| Tenant override | `tenant:{tenantId}` | set | `null` |
| Branch override | `tenant:{tenantId}:branch:{branchId}` | set | set |

Helper: `buildScopeKey()` in `prisma/seeds/ai_management_foundation.seed.ts`.

**Resolution order (future service layer):** branch → tenant → platform.

---

## Soft Delete

Configurable entities support soft delete:

- `deletedAt` — set on delete
- `deletedByUserId` — actor audit

Partial unique indexes enforce uniqueness **only for active rows**:

```sql
CREATE UNIQUE INDEX ai_providers_scopeKey_providerKey_active_key
  ON ai_providers("scopeKey", "providerKey") WHERE "deletedAt" IS NULL;
```

Same pattern for `ai_routes` and `ai_settings`. After soft delete, the same natural key may be re-created.

`AiUsageLog` is append-only — no soft delete.

---

## Audit Fields

| Field | Usage |
|-------|-------|
| `createdAt` / `updatedAt` | Row lifecycle |
| `createdByUserId` | Creator (admin/user id) |
| `updatedByUserId` | Last editor |
| `deletedByUserId` | Soft-delete actor |
| `version` | Optimistic concurrency (providers, models, routes, prompts, settings, keys, failover rules) |

Usage logs additionally store `requestId` and `correlationId` for distributed tracing.

---

## Encryption Ready

### `AiApiKey`

| Field | Purpose |
|-------|---------|
| `encryptedSecret` | Ciphertext only — **never plaintext** |
| `encryptionKeyId` | KMS/vault key reference (e.g. `env:v1`, `aws:sm:prod/openai`) |
| `encryptionAlgorithm` | Default `aes-256-gcm` |
| `secretHint` | Last 4 chars for admin UI |

Seed placeholder: `ENC:SEED:v1:AES256GCM:placeholder-not-a-real-api-key`

### `AiSettings`

| Field | Purpose |
|-------|---------|
| `settingsJson` | Non-sensitive config |
| `encryptedSettings` | Optional encrypted blob for sensitive values |
| `encryptionKeyId` | Key reference when encrypted blob is used |

**Phase 1 runtime:** keys are managed by [AI_SECRET_VAULT.md](./AI_SECRET_VAULT.md) — `EncryptionService` + `AiSecretService`.

---

## Enums

| Enum | Values |
|------|--------|
| `AiApiKeyStatus` | ACTIVE, ROTATED, REVOKED, EXPIRED |
| `AiFailoverTriggerType` | HTTP_5XX, HTTP_429, TIMEOUT, RATE_LIMIT, BUDGET_EXCEEDED, HEALTH_SCORE_LOW, CONTENT_POLICY, PROVIDER_DISABLED |
| `AiFailoverActionType` | NEXT_PROVIDER, DOWNGRADE_MODEL, RULES_ONLY, RETRY_SAME, ABORT |
| `AiSettingsCategory` | ROUTING, BUDGET, SECURITY, GOVERNANCE, FEATURE_FLAGS, ENCRYPTION |

Task types (stored as `VARCHAR`, not enum): `GENERAL_CHAT`, `DISEASE_ANALYSIS`, `FEED_FORMULATION`, `PRESCRIPTION_ANALYSIS`, `IMAGE_ANALYSIS`, `VIDEO_ANALYSIS`, `DOCUMENT_ANALYSIS`, `EMERGENCY_CONSULTATION`.

---

## Entity Relationships

```
AiProvider ─┬─< AiModel
            ├─< AiApiKey
            ├─< AiUsageLog
            └─< AiFailoverRule (from/to)

AiRoute ────┬─< AiFailoverRule
            └─< AiUsageLog

AiModel ────< AiUsageLog
AiPrompt ───< AiUsageLog
AiFailoverRule ─< AiUsageLog
```

`AiRoute.providerChainJson` stores ordered `{ order, providerKey, providerId, modelId }` entries.

---

## Migration

```bash
# Apply migration (production-safe)
npm run db:migrate:deploy

# Or development
npm run db:migrate
```

Migration file: `prisma/migrations/20260603120000_ai_management_foundation/migration.sql`

Generate client after schema changes:

```bash
npm run db:generate
```

---

## Seeds

### Run standalone

```bash
npm run db:seed:ai-management
```

### Included in main seed (non-production)

```bash
npm run db:seed
```

### Seed contents

| Entity | Count | Notes |
|--------|-------|-------|
| Providers | 6 | openai, anthropic, gemini*, deepseek*, openrouter*, rules-based (*disabled) |
| Models | 6 | Default models per provider with cost rates |
| API keys | 5 | Placeholder ciphertext per external provider |
| Routes | 8 | One per task type |
| Prompts | 4 | general_chat, disease_analysis, emergency_triage, farm_assistant |
| Failover rules | 3 | Bound to general_chat route |
| Settings | 4 | routing, budget, encryption, governance |

Seeds are **idempotent** — safe to re-run.

---

## Separation from Legacy Tables

| Legacy (runtime today) | AIMS (foundation) | Integration phase |
|------------------------|-------------------|-------------------|
| `AiPromptTemplate` | `AiPrompt` | Phase 1 routing service |
| `AiUsageRecord` | `AiUsageLog` | Dual-write → migrate |
| Env `OPENAI_API_KEY` | `AiApiKey` | Key resolver service |
| Hardcoded orchestrator chain | `AiRoute` + `AiFailoverRule` | Routing engine |

**Do not modify existing AI services until integration phase.**

---

## Indexing Summary

- Tenant/branch: `(tenantId, branchId)` on providers, routes, settings
- Soft delete: `deletedAt` on all configurable entities
- Usage analytics: `(createdAt, taskType)`, `(userId, createdAt)`, `(providerId, createdAt)`
- Routing lookup: `(taskType, enabled, priority)` on routes
- Failover lookup: `(routeId, enabled, priority)` on failover rules

---

## Next Steps (Not in This PR)

1. Key resolver service — decrypt `AiApiKey` or fall back to env
2. Routing resolver — read `AiRoute` + `AiFailoverRule` at runtime
3. Dual-write usage to `AiUsageLog` from orchestrator
4. Admin CRUD APIs + panel pages
5. Migrate active prompts from `AiPromptTemplate` → `AiPrompt`

---

**Last updated:** 2026-05-30
