# AI Ecosystem Master Plan — Prani Doctor

**Version:** 1.0.0  
**Date:** 2026-05-30  
**Status:** Architecture & planning only — no implementation  
**Scope:** `pranidoctor-backend`, `pranidoctor-web`, `pranidoctor_user`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Ecosystem Overview](#2-ecosystem-overview)
3. [Current State Audit](#3-current-state-audit)
4. [Target Architecture](#4-target-architecture)
5. [Database Schema Design](#5-database-schema-design)
6. [API Design](#6-api-design)
7. [Admin Panel Design](#7-admin-panel-design)
8. [Migration Roadmap](#8-migration-roadmap)
9. [Appendix](#9-appendix)

---

## 1. Executive Summary

Prani Doctor operates a **dual-provider LLM stack** (OpenAI + Anthropic) with rules-based fallback, PostgreSQL-backed governance, token/cost tracking, and admin operations — all centralized in `pranidoctor-backend`. The Flutter mobile app (`pranidoctor_user`) is the primary AI consumer. The Next.js web app (`pranidoctor-web`) provides admin BFF proxies and governance UI but contains **no direct LLM integration**.

This document defines a **production-grade AI Management System (AIMS)** that extends the existing platform to support:

- **Seven external provider families** plus local models
- **Task-type-aware routing** across eight AI workloads
- **Intelligent failover** with health-weighted chains
- **Enterprise cost tracking** with budgets, alerts, and chargeback
- **Versioned prompt lifecycle** with A/B testing
- **Defense-in-depth security** for veterinary AI in Bangladesh

**Naming convention:** "AI Technician" refers to *Artificial Insemination* field services (breeding marketplace). "LLM Operations" or "AI Platform" refers to generative AI. These domains must remain visually and architecturally separated.

---

## 2. Ecosystem Overview

### 2.1 Repository Roles

| Repository | Role | AI Responsibility |
|------------|------|-------------------|
| `pranidoctor-backend` | Express API, Prisma, workers | **Canonical AI platform** — orchestrator, providers, governance, usage, prompts, knowledge |
| `pranidoctor-web` | Next.js BFF + admin UI | Admin proxies, governance/prompt/knowledge panels; no LLM keys |
| `pranidoctor_user` | Flutter mobile | AI feature client — chat, triage, symptom checker, farm intelligence |

### 2.2 High-Level Data Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────────────┐
│  Flutter Mobile │     │  Next.js Admin  │     │     pranidoctor-backend      │
│  /api/ai/*      │────▶│  /api/admin/    │────▶│  AiOrchestratorService       │
│  /api/voice/*   │     │  ai-ops/*       │     │  Governance · Usage · Prompts│
└─────────────────┘     └─────────────────┘     └──────────────┬───────────────┘
                                                                │
                    ┌───────────────────────────────────────────┼───────────────────────────┐
                    │                                           │                           │
                    ▼                                           ▼                           ▼
              ┌──────────┐                              ┌──────────────┐            ┌─────────────┐
              │ OpenAI   │                              │  Anthropic   │            │ Rules-based │
              └──────────┘                              └──────────────┘            └─────────────┘
                    │                                           │
                    └─────────────────── (future) ──────────────┘
                              Gemini · Grok · DeepSeek · OpenRouter · Local
```

### 2.3 Existing Module Map (Backend)

```
src/modules/ai/
├── orchestrator/          # Provider chain, completion
├── governance/            # Kill switch, scopes, Redis sync
├── prompts/               # AiPromptTemplate service
├── usage/                 # Token/cost recording, rollups, metrics
├── budget/                # Daily/monthly caps
├── alerts/                # Budget/spike/provider alerts
├── health/                # Live provider probes
├── assistant/             # RAG-enriched chat, farm briefing
├── symptom-checker/       # Rules graph (no LLM today)
├── knowledge/             # Keyword search CMS
├── compliance/            # Safety rules, disclaimers
└── ai-admin.controller.ts # Express admin routes (legacy; BFF preferred)
```

---

## 3. Current State Audit

### 3.1 OpenAI Usage

| Aspect | Current State |
|--------|---------------|
| **Integration** | Native `fetch` to `POST https://api.openai.com/v1/chat/completions` |
| **Adapter** | `src/modules/ai/orchestrator/providers/openai.provider.ts` |
| **Auth** | `Authorization: Bearer ${OPENAI_API_KEY}` via `getAiPlatformConfig()` |
| **Default model** | `gpt-4o-mini` (`OPENAI_MODEL`) |
| **Cost rates** | `gpt-4o`, `gpt-4o-mini` in `ai-usage.cost.ts` |
| **Chain position** | **First** in failover: OpenAI → Anthropic → rules-based |
| **SDK** | None — hand-rolled HTTP |
| **Streaming** | Not supported |
| **Tool use / structured output** | Not supported |

**LLM call sites:** farmer chat (`farmer_chat`), farm briefing/query (`farm_assistant`), health probes (`HEALTH_PROBE`).

### 3.2 Anthropic Usage

| Aspect | Current State |
|--------|---------------|
| **Integration** | Native `fetch` to `POST https://api.anthropic.com/v1/messages` |
| **Adapter** | `src/modules/ai/orchestrator/providers/anthropic.provider.ts` |
| **Auth** | `x-api-key`, `anthropic-version: 2023-06-01` |
| **Default model** | `claude-3-5-haiku-20241022` (`ANTHROPIC_MODEL`) |
| **Cost rates** | Haiku + Sonnet overrides in `ai-usage.cost.ts` |
| **Chain position** | **Second** failover |

### 3.3 Gemini Usage

**Not implemented.** `registerProviderRates('gemini', ...)` exists as a plugin hook in unit tests only. No env vars, adapter, or API calls.

### 3.4 Grok, DeepSeek, OpenRouter, Local Models

**Not implemented.** Zero code references. OpenRouter would be the fastest path to multi-model access without individual adapters.

### 3.5 AI Services Inventory

#### LLM-backed (runtime)

| Service | File | Feature tag | Prompt key |
|---------|------|-------------|------------|
| Farmer chat | `ai-veterinary-core.service.ts` | `CHAT` | `farmer_chat` |
| Chat v2 (RAG) | `assistant/ai-assistant.service.ts` | `CHAT` | enriched context |
| Farm briefing | `assistant/ai-assistant.service.ts` | `FARM_BRIEFING` | `farm_assistant` |
| Farm query | `assistant/ai-assistant.service.ts` | `FARM_QUERY` | `farm_assistant` |
| Health probes | `health/ai-health-probe.service.ts` | `HEALTH_PROBE` | minimal probe |

#### Rules / non-LLM (labeled "AI")

| Service | Mechanism |
|---------|-----------|
| Symptom checker | Symptom graph + rules (`symptom-checker.service.ts`) — orchestrator imported but **unused** |
| Smart recommendations | Rules engine (`smart-recommendation.service.ts`) |
| Farm health scores | Aggregated metrics (`farm-health.service.ts`) |
| Knowledge search | PostgreSQL keyword search (`ai-knowledge.service.ts`) |
| Voice STT/TTS | Local stub adapters; chat delegates to veterinary core |
| Feed ration | Separate module at `/api/mobile/recommendations/*` — **not** under `/api/ai/` |

#### Async infrastructure (scaffolded, not wired)

- BullMQ queues: `ai:completion`, `ai:embedding`, `ai:summary` — no producers or workers

### 3.6 AI Controllers & Routes

#### Mobile (`/api/ai`)

| Method | Path | LLM? |
|--------|------|------|
| POST | `/chat`, `/chat/v2` | Yes |
| POST | `/triage` | Safety/rules |
| GET | `/history`, `/memory` | No |
| DELETE | `/memory` | No |
| POST | `/escalate` | No |
| GET | `/symptom-taxonomy` | No |
| POST | `/symptom-check` | No |
| GET | `/knowledge/search`, `/knowledge/:slug` | No |
| GET/POST | `/smart-recommendations/*` | No |
| GET/POST | `/smart-alerts/*` | No |
| GET | `/farm-health` | No |
| POST | `/briefing/daily`, `/farm-query` | Yes |
| GET | `/follow-ups`, `/analytics/farm-risk` | No |

Guards: `authenticateMobileCustomer`, `requireMobileAiConsent`, rate limits, `aiGovernanceRouteObserver`.

#### Voice (`/api/voice`)

POST `/stt`, `/chat`, `/navigation`; GET `/session` — STT local stub; `/chat` → orchestrator.

#### Admin (legacy Express + Next BFF)

| Area | Backend legacy route | Web BFF |
|------|---------------------|---------|
| Governance | `/api/admin/ai-ops/governance` | ✅ proxied |
| Prompts | `/api/admin/ai-ops/prompts` | ✅ proxied |
| Knowledge | `/api/admin/ai-ops/knowledge` | ✅ proxied |
| Overview | `/api/admin/ai-ops/overview` | ✅ proxied |
| Usage/costs/providers/health | `/api/admin/ai/*` | ❌ **missing BFF routes** |

`AiAdminModule` exists but is **not mounted** in `createAllModules()` — admin uses legacy Next BFF.

### 3.7 Environment Variables

| Variable | Purpose | Wired? |
|----------|---------|--------|
| `OPENAI_API_KEY` | OpenAI auth | ✅ |
| `OPENAI_MODEL` | Model id (default `gpt-4o-mini`) | ✅ |
| `ANTHROPIC_API_KEY` | Anthropic auth | ✅ |
| `ANTHROPIC_MODEL` | Model id (default haiku) | ✅ |
| `AI_PROVIDER` | Preferred provider | ⚠️ **Loaded but unused** in orchestrator |
| `AI_LLM_REQUIRED` | Fail startup if no keys (prod default true) | ✅ |
| `AI_LLM_DISABLED` | Emergency rules-only | ✅ |
| `AI_KILL_SWITCH_PERSISTENCE_ENABLED` | PG+Redis persistence | ✅ |
| `AI_GOVERNANCE_POLL_INTERVAL_MS` | PG poll fallback (45000) | ✅ |
| `AI_HEALTH_PROBE_ENABLED` | Periodic probes | ✅ |
| `AI_HEALTH_PROBE_INTERVAL_SEC` | Probe interval (300) | ✅ |
| `DAILY_AI_BUDGET_USD` | Daily spend cap | ✅ |
| `MONTHLY_AI_BUDGET_USD` | Monthly spend cap | ✅ |
| `AI_USAGE_SPIKE_MULTIPLIER` | Spike alert (3×) | ✅ |
| `TENANT_ID` / `ORGANIZATION_ID` | Usage dimensions | ✅ |
| `DEPLOYMENT_BRANCH` / `BRANCH_ID` | Branch dimension | ✅ |

**Not present:** Gemini, Grok, DeepSeek, OpenRouter, local model URLs, secrets manager integration, per-tenant keys.

Validation split across `ai.config.ts`, `startup-validation.ts`, `ai-platform.bootstrap.ts` — not in central `env.validation.ts`.

### 3.8 API Key Management

| Pattern | Detail |
|---------|--------|
| Storage | Plain `process.env` only — no Vault/Secrets Manager |
| Scope | Single platform-wide keys — no per-tenant/org keys |
| Loading | `loadAiPlatformConfig()` with in-memory cache |
| Validation | Prefix checks (`sk-`, `sk-ant-`), length warnings |
| Rotation | No runtime rotation hook |
| Exposure | Keys never logged; live verify script masks output |

### 3.9 Prompt Management

| Aspect | Current State |
|--------|---------------|
| Storage | PostgreSQL `AiPromptTemplate` |
| Service | `src/modules/ai/prompts/ai-prompt.service.ts` |
| Built-in keys | `farmer_chat`, `symptom_checker` (unused), `farm_assistant` |
| Lifecycle | `DRAFT` → `ACTIVE` → `ARCHIVED`; activate archives siblings |
| i18n | `systemBn/En`, optional `userTemplateBn/En` |
| Context injection | `{{key}}` replacement in `completeWithPromptKey()` |
| **Gap** | `key` is `@unique` — only one row per key; true versioning blocked |
| Admin | Legacy BFF `admin/ai-ops/prompts/` GET/POST + activate |

### 3.10 Mobile App (`pranidoctor_user`) Audit

| Feature | Status |
|---------|--------|
| AI chat | ✅ Implemented |
| Voice STT → chat | ✅ Implemented |
| Triage | ✅ Implemented |
| Symptom checker (Phase 8) | ✅ Implemented |
| Smart recommendations, farm health, knowledge | ✅ Implemented |
| Smart alerts, follow-ups | ⚠️ Routes exist; limited nav wiring |
| Chat v2, farm briefing, farm query | ❌ API paths defined; UI not wired |
| Image analysis | ❌ Not implemented |
| Prescription AI | ❌ Manual vet records only |
| Streaming | ❌ Not implemented |
| LLM kill-switch UX | ❌ No rules-only banner |
| On-device LLM | ❌ By design — all server-side |

Config: `API_BASE_URL` only — no LLM keys on mobile.

### 3.11 Web App (`pranidoctor-web`) Audit

| Aspect | Status |
|--------|--------|
| Direct LLM SDKs | ❌ None |
| Admin AI ops UI | ✅ Overview, governance, prompts, knowledge, risk |
| AI compliance settings | ✅ Disclaimer, compliance, escalation disclosure |
| BFF for `/api/ai/*` | ❌ Mobile hits backend directly |
| BFF for `/api/admin/ai/*` | ❌ Missing (usage, costs, providers, health) |
| End-user LLM UI | ❌ Farmer chat is mobile-only |
| Design docs | `docs/ai/*.md` — aspirational; orchestrator code lives in backend |

### 3.12 Audit Gap Summary

| Gap | Severity | Target resolution |
|-----|----------|-------------------|
| `AI_PROVIDER` unused | Medium | Task-type routing engine (§4.B) |
| No Gemini/alternate providers | Medium | Provider registry (§4.A) |
| Prompt versioning vs `@unique(key)` | Medium | Schema migration (§5) |
| No image/video/document analysis | High | New task types + multimodal adapters |
| RAG is keyword-only | Medium | Embedding pipeline + vector store |
| BullMQ AI queues unimplemented | Medium | Async workers for heavy tasks |
| No secrets manager | Medium | Key vault abstraction (§4.F) |
| No streaming | Medium | SSE/WebSocket completion stream |
| Symptom checker LLM unused | Low | Wire `symptom_checker` prompt or remove |
| Admin BFF route gaps | Low | Complete proxy layer (§7) |
| Mobile Phase 8 endpoints unwired | Medium | Client adoption in roadmap |

---

## 4. Target Architecture

### 4.A AI Provider Management

#### 4.A.1 Provider Registry

Centralize all providers behind a **Provider Registry** extending the existing `AiProviderAdapter` interface in `src/modules/ai/orchestrator/provider.interface.ts`.

**Target capabilities per adapter:** `chat`, `vision`, `video`, `document`, `embedding`, `structured_output`, `streaming`.

#### 4.A.2 Provider Catalog

| Provider | Strategy | Primary use | Env vars (proposed) | Priority |
|----------|----------|-------------|---------------------|----------|
| **OpenAI** | Existing fetch adapter | General chat, vision, embeddings | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_VISION_MODEL` | P0 |
| **Anthropic** | Existing fetch adapter | Long-context, safety-critical | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | P0 |
| **Gemini** | New Google AI adapter | Multimodal, Bangla | `GEMINI_API_KEY`, `GEMINI_MODEL` | P1 |
| **Grok (xAI)** | OpenAI-compatible | Fast chat fallback | `GROK_API_KEY`, `GROK_BASE_URL`, `GROK_MODEL` | P2 |
| **DeepSeek** | OpenAI-compatible | Cost-efficient reasoning | `DEEPSEEK_API_KEY`, `DEEPSEEK_MODEL` | P2 |
| **OpenRouter** | Unified gateway | Rapid multi-model access | `OPENROUTER_API_KEY`, `OPENROUTER_DEFAULT_MODEL` | P1 |
| **Local Models** | Ollama/vLLM | Dev, air-gapped, PHI-sensitive | `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL` | P2 |
| **Rules-based** | Existing | Always-available fallback | None | P0 |

#### 4.A.3 Provider Configuration

Move from env-only to **database-backed `AiProviderConfig`** with env bootstrap override. Fields: `providerKey`, `enabled`, `priority`, `defaultModel`, `visionModel`, `capabilitiesJson`, `keySecretRef`, `healthStatus`.

#### 4.A.4 Key Management Phases

1. **Phase 1:** Env vars (current) + boot validation
2. **Phase 2:** `keySecretRef` → AWS Secrets Manager / HashiCorp Vault
3. **Phase 3:** Per-organization keys for enterprise tenants

---

### 4.B AI Routing Engine

#### 4.B.1 Task Types

| Task Type | Code | Modality | Latency SLA | Tier |
|-----------|------|----------|-------------|------|
| General Chat | `GENERAL_CHAT` | Text | < 8s | Economy |
| Disease Analysis | `DISEASE_ANALYSIS` | Text + image | < 12s | Standard |
| Feed Formulation | `FEED_FORMULATION` | Text + structured | < 10s | Economy |
| Prescription Analysis | `PRESCRIPTION_ANALYSIS` | Text + document | < 15s | Premium |
| Image Analysis | `IMAGE_ANALYSIS` | Image | < 20s | Standard |
| Video Analysis | `VIDEO_ANALYSIS` | Video | < 60s async | Standard |
| Document Analysis | `DOCUMENT_ANALYSIS` | PDF/image | < 30s async | Standard |
| Emergency Consultation | `EMERGENCY_CONSULTATION` | Text + voice | < 5s | Premium |

**Current → target mapping:** `CHAT` → `GENERAL_CHAT`; `FARM_*` → `GENERAL_CHAT` (farm context); feed recommendations API → `FEED_FORMULATION`; future symptom LLM → `DISEASE_ANALYSIS`.

#### 4.B.2 Routing Pipeline

1. **Classify** task type (rules + optional lightweight classifier)
2. **Governance gate** — kill switch, scopes, consent
3. **Budget & rate limit** — daily/monthly/per-user
4. **Route resolver** — `AiRoutingRule` → provider chain
5. **Model selector** — tier + health score
6. **Prompt resolver** — active version for task + locale
7. **Execute** — sync or async queue
8. **Post-process** — safety filter, disclaimer, audit

#### 4.B.3 Example Routing Chains

| Task | Chain | Rationale |
|------|-------|-----------|
| `EMERGENCY_CONSULTATION` | Anthropic Sonnet → OpenAI gpt-4o → rules | Safety-first |
| `GENERAL_CHAT` | OpenAI mini → DeepSeek → Anthropic haiku → rules | Cost-optimized |
| `IMAGE_ANALYSIS` | Gemini Vision → OpenAI gpt-4o → rules | Multimodal |
| `FEED_FORMULATION` | DeepSeek → OpenAI mini → rules | Structured math |
| `VIDEO_ANALYSIS` | Gemini → OpenAI frames → async queue | Long-running |
| `DOCUMENT_ANALYSIS` | Anthropic → OpenAI → async queue | Long context |

`AI_PROVIDER` env applies as global primary for `GENERAL_CHAT` only; other tasks use `AiRoutingRule` table.

#### 4.B.4 Sync vs Async

- **Sync:** General chat, emergency, disease (text), small images
- **Async:** Large images, video, documents → BullMQ `ai:completion`, `ai:vision`, `ai:document`
- **Polling:** `GET /api/ai/jobs/:id`

---

### 4.C AI Failover Strategy

**Layers:** (1) Provider failover → (2) Model downgrade → (3) Rules-based → (4) Cached/degraded response → (5) Human escalation (`AiEscalationRecord`).

**Triggers:** HTTP 429/5xx/timeout, budget exceeded, governance block, health probe failure (3×), content policy refusal, confidence < 0.4.

**Health-weighted routing:** `healthScore = successRate×0.5 + latencyScore×0.3 + recency×0.2`; demote if < 0.5.

**Circuit breaker (Redis):** Open after 5 failures/60s; skip 120s; half-open probe.

---

### 4.D AI Cost Tracking

**Keep:** `AiUsageRecord`, daily/monthly rollups, `AiUsageAlert`, Prometheus metrics, `registerProviderRates()`.

**Add:** `AiProviderRate` DB table; `taskType` on usage records; per-org budgets; chargeback CSV export; OpenRouter passthrough cost parsing.

| Task type | Max cost/request (target) |
|-----------|---------------------------|
| General Chat | $0.002 |
| Disease Analysis | $0.015 |
| Feed Formulation | $0.005 |
| Prescription Analysis | $0.025 |
| Image Analysis | $0.020 |
| Video Analysis | $0.050 |
| Document Analysis | $0.030 |
| Emergency Consultation | $0.030 (alert only, no block) |

---

### 4.E AI Prompt Management

**Lifecycle:** DRAFT → REVIEW → ACTIVE → DEPRECATED → ARCHIVED (with A/B traffic split).

**Schema fix:** Replace `@unique(key)` with `@@unique([key, version])`; add `taskType`, `trafficPercent`, `variablesSchemaJson`, `testCasesJson`.

**Registry keys:** `general_chat_v*`, `disease_analysis_v*`, `feed_formulation_v*`, `prescription_review_v*`, `image_analysis_v*`, `video_analysis_v*`, `document_analysis_v*`, `emergency_triage_v*`.

**Admin test runs:** Dry-run mode → `AiPromptTestRun` table with token/cost, no user session.

---

### 4.F AI Security Model

**Layers:** Auth + consent → input sanitization → governance → rate limits → prompt injection defense → output safety filter → audit trail → data retention → escalation.

**PII redaction pre-LLM:** Phone, NID, exact GPS → tokens.

**Output policy:** Block definitive diagnosis without disclaimer; refuse drug dosages without vet context; force escalation on emergency red flags.

**Roles:** SUPER_ADMIN (full), ADMIN (draft prompts), OPS (dashboards), VET_REVIEWER (escalations + prompt approve).

---

## 5. Database Schema Design

### 5.1 Existing Models (Retain)

| Model | Purpose |
|-------|---------|
| `AiAssistantSession`, `AiAssistantMessage`, `AiAssistantMemory` | Chat sessions |
| `AiTriageRecord`, `AiEscalationRecord`, `AiSafetyAuditLog` | Safety/triage |
| `AiGovernanceState`, `AiGovernanceStateHistory`, `AiGovernanceScope` | Kill switch |
| `AiKnowledgeEntry`, `AiSymptomNode`, `AiSymptomDiseaseLink`, `AiSymptomCheckSession` | Knowledge + symptom graph |
| `AiUsageRecord`, `AiUsageDailyRollup`, `AiUsageUserDailyRollup`, `AiUsageCustomerDailyRollup`, `AiUsageMonthlyRollup` | Usage/cost |
| `AiProviderHealthSnapshot`, `AiUsageAlert` | Ops |
| `AiPromptTemplate` | Prompts (schema migration required) |
| `AiSmartAlert`, `AiFollowUpSuggestion`, `FarmRiskSnapshot` | Intelligence |
| `VoiceSession`, `VoiceTranscript` | Voice |

### 5.2 Schema Changes (Migrate Existing)

#### `AiPromptTemplate` — versioning fix

```prisma
model AiPromptTemplate {
  id               String         @id @default(cuid())
  key              String         // remove @unique
  version          Int            @default(1)
  taskType         String?        @db.VarChar(64)
  name             String
  description      String?
  systemBn         String         @db.Text
  systemEn         String         @db.Text
  userTemplateBn   String?        @db.Text
  userTemplateEn   String?        @db.Text
  status           AiPromptStatus @default(DRAFT)
  trafficPercent   Int            @default(100)
  parentVersionId  String?
  variablesSchemaJson Json?
  testCasesJson    Json?
  approvedByUserId String?
  approvedAt       DateTime?
  metadataJson     Json?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@unique([key, version])
  @@index([key, status])
  @@index([taskType, status])
}
```

#### `AiUsageRecord` — add task type

```prisma
// Add columns:
taskType     String?  @db.VarChar(64)
routingRuleId String? @db.VarChar(64)
asyncJobId   String?  @db.VarChar(64)
```

#### `AiGovernanceScope` — extend scope IDs

Add task types to feature scopes: `DISEASE_ANALYSIS`, `FEED_FORMULATION`, `PRESCRIPTION_ANALYSIS`, `IMAGE_ANALYSIS`, `VIDEO_ANALYSIS`, `DOCUMENT_ANALYSIS`, `EMERGENCY_CONSULTATION`.

Add provider scopes: `gemini`, `grok`, `deepseek`, `openrouter`, `local`.

### 5.3 New Models

#### `AiProviderConfig`

```prisma
model AiProviderConfig {
  id                String   @id @default(cuid())
  providerKey       String   @unique @db.VarChar(32)
  displayName       String
  enabled           Boolean  @default(true)
  priority          Int      @default(100)
  defaultModel      String
  visionModel       String?
  embeddingModel    String?
  endpointOverride  String?
  keySecretRef      String?  @db.VarChar(256)
  capabilitiesJson  Json
  maxTokensDefault  Int      @default(800)
  temperatureDefault Float   @default(0.4)
  rateLimitRpm      Int?
  rateLimitTpm      Int?
  costTier          String   @default("standard") @db.VarChar(16)
  healthScore       Float    @default(1.0)
  lastHealthCheckAt DateTime?
  metadataJson      Json?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

#### `AiRoutingRule`

```prisma
model AiRoutingRule {
  id              String   @id @default(cuid())
  taskType        String   @db.VarChar(64)
  name            String
  priority        Int      @default(100)
  enabled         Boolean  @default(true)
  conditionsJson  Json?
  providerChain   Json     // string[] ordered
  modelOverrides  Json?    // Record<provider, model>
  maxRetries      Int      @default(2)
  timeoutMs       Int      @default(30000)
  asyncRequired   Boolean  @default(false)
  fallbackToRules Boolean  @default(true)
  maxCostUsd      Decimal? @db.Decimal(10, 6)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([taskType, enabled, priority])
}
```

#### `AiProviderRate`

```prisma
model AiProviderRate {
  id              String   @id @default(cuid())
  providerKey     String   @db.VarChar(32)
  modelId         String   @db.VarChar(128)
  inputPerToken   Decimal  @db.Decimal(16, 12)
  outputPerToken  Decimal  @db.Decimal(16, 12)
  effectiveFrom   DateTime @db.Date
  effectiveTo     DateTime? @db.Date
  rateVersion     String   @db.VarChar(32)
  createdAt       DateTime @default(now())

  @@unique([providerKey, modelId, effectiveFrom])
  @@index([providerKey, modelId])
}
```

#### `AiAsyncJob`

```prisma
enum AiAsyncJobStatus {
  QUEUED
  PROCESSING
  COMPLETED
  FAILED
  CANCELLED
}

model AiAsyncJob {
  id            String           @id @default(cuid())
  userId        String
  customerId    String?
  taskType      String           @db.VarChar(64)
  status        AiAsyncJobStatus @default(QUEUED)
  inputJson     Json
  outputJson    Json?
  provider      String?
  model         String?
  errorCode     String?
  progressPct   Int              @default(0)
  usageRecordId String?
  createdAt     DateTime         @default(now())
  startedAt     DateTime?
  completedAt   DateTime?

  @@index([userId, status])
  @@index([status, createdAt])
}
```

#### `AiMediaAnalysis`

```prisma
model AiMediaAnalysis {
  id              String   @id @default(cuid())
  userId          String
  livestockId     String?
  taskType        String   @db.VarChar(64)
  mediaType       String   @db.VarChar(16) // image | video | document
  storageKey      String
  mimeType        String
  sizeBytes       Int
  analysisJson    Json?
  confidence      Float?
  provider        String?
  model           String?
  asyncJobId      String?
  retentionUntil  DateTime?
  createdAt       DateTime @default(now())

  @@index([userId, createdAt])
  @@index([livestockId])
}
```

#### `AiPromptTestRun`

```prisma
model AiPromptTestRun {
  id              String   @id @default(cuid())
  promptTemplateId String
  runByUserId     String
  inputJson       Json
  outputText      String   @db.Text
  provider        String
  model           String
  inputTokens     Int
  outputTokens    Int
  costUsd         Decimal? @db.Decimal(10, 6)
  latencyMs       Int
  passed          Boolean?
  createdAt       DateTime @default(now())

  @@index([promptTemplateId, createdAt])
}
```

#### `AiEmbeddingChunk` (RAG — Phase 2)

```prisma
model AiEmbeddingChunk {
  id              String   @id @default(cuid())
  sourceType      String   @db.VarChar(32) // knowledge | document | custom
  sourceId        String
  chunkIndex      Int
  contentText     String   @db.Text
  embedding       Unsupported("vector")? // pgvector
  locale          String   @default("bn")
  metadataJson    Json?
  createdAt       DateTime @default(now())

  @@index([sourceType, sourceId])
}
```

### 5.4 Entity Relationship (Target)

```
AiRoutingRule ──▶ taskType ──▶ AiPromptTemplate (key + version)
       │
       ▼
AiProviderConfig ──▶ providerChain
       │
       ▼
AiOrchestrator ──▶ AiUsageRecord ──▶ AiProviderRate
       │
       ├──▶ AiAsyncJob ──▶ AiMediaAnalysis
       └──▶ AiPromptTestRun
```

### 5.5 Indexing Strategy

- Usage queries: `(createdAt, taskType, provider)` composite
- Rollup jobs: nightly cron on `AiUsageRecord` → existing rollup tables + new `taskType` dimension
- Media retention: TTL job on `AiMediaAnalysis.retentionUntil`

---

## 6. API Design

### 6.1 API Surface Overview

| Surface | Base path | Auth | Consumer |
|---------|-----------|------|----------|
| Mobile AI | `/api/ai` | Mobile JWT + AI consent | Flutter app |
| Mobile AI async | `/api/ai/jobs` | Mobile JWT + AI consent | Flutter app |
| Mobile AI media | `/api/ai/analyze` | Mobile JWT + AI consent + media consent | Flutter app |
| Voice | `/api/voice` | Mobile JWT | Flutter app |
| Admin AI Ops | `/api/admin/ai-ops` | Admin session | Web admin |
| Admin AI Platform | `/api/admin/ai` | Admin session | Web admin |
| Health | `/api/health/ai` | Public/internal | Monitoring |

Web BFF mirrors all admin routes under `src/app/api/admin/`.

### 6.2 Mobile AI Endpoints

#### Existing (retain, extend with `taskType`)

| Method | Path | Change |
|--------|------|--------|
| POST | `/api/ai/chat` | Add optional `taskType`; default `GENERAL_CHAT` |
| POST | `/api/ai/chat/v2` | RAG + streaming support (SSE) |
| POST | `/api/ai/triage` | Map to `EMERGENCY_CONSULTATION` or `DISEASE_ANALYSIS` |
| POST | `/api/ai/symptom-check` | Optional LLM enrichment flag |
| POST | `/api/ai/briefing/daily` | Unchanged |
| POST | `/api/ai/farm-query` | Unchanged |

#### New endpoints

```
POST   /api/ai/analyze/image
POST   /api/ai/analyze/video
POST   /api/ai/analyze/document
POST   /api/ai/analyze/prescription
POST   /api/ai/feed/formulate          # migrate from /api/mobile/recommendations
GET    /api/ai/jobs/:id                # async job status
DELETE /api/ai/jobs/:id                # cancel queued job
GET    /api/ai/jobs/:id/result         # completed output
GET    /api/ai/media/:id               # analysis metadata (not raw file)
POST   /api/ai/chat/stream             # SSE streaming completion
GET    /api/ai/status                  # platform status (rules-only banner data)
```

#### Request: `POST /api/ai/analyze/image`

```json
{
  "taskType": "IMAGE_ANALYSIS",
  "locale": "bn",
  "livestockId": "clx...",
  "imageRef": "upload://abc123",
  "context": {
    "species": "cattle",
    "symptoms": ["skin lesion", "hair loss"],
    "question": "What could this lesion indicate?"
  }
}
```

#### Response (sync)

```json
{
  "analysisId": "clx...",
  "taskType": "IMAGE_ANALYSIS",
  "provider": "gemini",
  "model": "gemini-1.5-pro",
  "confidence": 0.72,
  "summary": "...",
  "observations": ["...", "..."],
  "differentials": [{ "condition": "...", "likelihood": "moderate" }],
  "disclaimer": "...",
  "escalationRecommended": false,
  "usage": { "inputTokens": 1200, "outputTokens": 450, "latencyMs": 4200 }
}
```

#### Response (async — video/document)

```json
{
  "jobId": "clx...",
  "status": "QUEUED",
  "pollUrl": "/api/ai/jobs/clx...",
  "estimatedSeconds": 45
}
```

#### Request: `POST /api/ai/chat/stream`

Same body as `/chat`; response `Content-Type: text/event-stream`:

```
event: token
data: {"delta": "আপনার"}

event: done
data: {"usage": {...}, "provider": "openai", "confidence": 0.85}
```

#### Request: `GET /api/ai/status`

```json
{
  "llmAvailable": true,
  "rulesOnlyMode": false,
  "degradedProviders": ["anthropic"],
  "message": { "bn": "...", "en": "..." }
}
```

### 6.3 Admin AI Ops Endpoints

#### Existing (retain)

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/admin/ai-ops/governance` | Kill switch + scopes |
| GET/POST | `/api/admin/ai-ops/prompts` | Prompt CRUD |
| POST | `/api/admin/ai-ops/prompts/:id/activate` | Activate version |
| GET/POST | `/api/admin/ai-ops/knowledge` | Knowledge CMS |
| POST | `/api/admin/ai-ops/knowledge/:id/publish` | Publish entry |
| GET | `/api/admin/ai-ops/overview` | Dashboard metrics |
| GET | `/api/admin/ai-ops/analytics/risk` | Risk monitoring |
| GET | `/api/admin/ai-ops/usage/users/:userId` | Per-user usage |
| GET | `/api/admin/ai-ops/usage/customers/:customerId` | Per-customer usage |

#### New endpoints

```
# Provider management
GET    /api/admin/ai/providers
GET    /api/admin/ai/providers/:key
PUT    /api/admin/ai/providers/:key
POST   /api/admin/ai/providers/:key/health-check
POST   /api/admin/ai/providers/:key/enable
POST   /api/admin/ai/providers/:key/disable

# Routing rules
GET    /api/admin/ai/routing-rules
POST   /api/admin/ai/routing-rules
PUT    /api/admin/ai/routing-rules/:id
DELETE /api/admin/ai/routing-rules/:id
POST   /api/admin/ai/routing-rules/:id/test

# Usage & cost (wire existing Express routes + BFF)
GET    /api/admin/ai/usage?from=&to=&taskType=&provider=
GET    /api/admin/ai/costs?from=&to=&dimension=
GET    /api/admin/ai/health
GET    /api/admin/ai/alerts
POST   /api/admin/ai/alerts/:id/acknowledge

# Rates
GET    /api/admin/ai/rates
POST   /api/admin/ai/rates
PUT    /api/admin/ai/rates/:id

# Prompt testing
POST   /api/admin/ai-ops/prompts/:id/test
GET    /api/admin/ai-ops/prompts/:id/test-runs

# Async job admin
GET    /api/admin/ai/jobs?status=&taskType=
GET    /api/admin/ai/jobs/:id

# Escalation queue
GET    /api/admin/ai/escalations?status=PENDING_REVIEW
PUT    /api/admin/ai/escalations/:id
```

### 6.4 Error Contract

Extend existing error codes:

| Code | HTTP | Meaning |
|------|------|---------|
| `AI_LLM_DISABLED` | 503 | Global kill switch |
| `AI_FEATURE_DISABLED` | 503 | Feature scope blocked |
| `AI_BUDGET_EXCEEDED` | 429 | Budget cap hit |
| `AI_DAILY_LIMIT` | 429 | Per-user quota (existing) |
| `AI_CONSENT_REQUIRED` | 403 | Missing AI consent |
| `AI_MEDIA_CONSENT_REQUIRED` | 403 | Image/video without consent |
| `AI_PROVIDER_UNAVAILABLE` | 503 | All providers failed |
| `AI_ASYNC_REQUIRED` | 202 | Payload too large — use async |
| `AI_JOB_NOT_FOUND` | 404 | Invalid job id |
| `AI_CONTENT_POLICY` | 422 | Output blocked by safety filter |

### 6.5 OpenAPI

Update `pranidoctor-backend/openapi.json` with all new endpoints. Sync to `pranidoctor-web/docs/openapi.json`. Add `taskType` enum to shared schema.

### 6.6 Rate Limits (Target)

| Endpoint class | Limit |
|----------------|-------|
| Chat (sync) | 30/hour/user |
| Emergency | 10/hour/user (no daily cap block) |
| Image analysis | 20/day/user |
| Video/document | 5/day/user |
| Admin test runs | 50/day/admin |

---

## 7. Admin Panel Design

### 7.1 Information Architecture

Separate **LLM Operations** from **AI Technician (breeding)** in navigation:

```
Admin Panel
├── LLM Operations          ← rename from "AI Ops" where ambiguous
│   ├── Dashboard           /admin/ai-ops
│   ├── Providers           /admin/ai-ops/providers        [NEW]
│   ├── Routing Rules       /admin/ai-ops/routing          [NEW]
│   ├── Prompts             /admin/ai-ops/prompts          [EXTEND]
│   ├── Knowledge Base      /admin/ai-ops/knowledge         [EXISTING]
│   ├── Usage & Costs       /admin/ai-ops/usage            [NEW]
│   ├── Health & Alerts     /admin/ai-ops/health            [NEW]
│   ├── Governance          /admin/ai-ops/governance       [EXISTING]
│   ├── Escalations         /admin/ai-ops/escalations       [NEW]
│   ├── Async Jobs          /admin/ai-ops/jobs              [NEW]
│   └── Risk Analytics      /admin/ai-ops/risk              [EXISTING]
├── Settings
│   ├── AI Disclaimer       /admin/settings/ai-disclaimer   [EXISTING]
│   ├── AI Compliance       /admin/settings/ai-compliance   [EXISTING]
│   └── AI Escalation       /admin/settings/ai-escalation-disclosure [EXISTING]
└── AI Technician (breeding)  /admin/ai-technicians          [UNCHANGED — separate domain]
```

### 7.2 Page Specifications

#### 7.2.1 Dashboard (`AiOpsOverview` — extend existing)

**Metrics cards:**
- Requests (24h / 7d) by task type — stacked bar
- Cost USD (24h / 7d / MTD) with budget progress bars
- Success rate + fallback rate
- Active sessions, open escalations
- Provider health summary (green/yellow/red)

**Charts:**
- Cost trend (14 days) by provider
- Token volume by task type
- Latency p50/p95 by provider

**Alerts panel:** Unacknowledged `AiUsageAlert` with one-click acknowledge.

#### 7.2.2 Providers (`AiProviderPanel` — new)

**List view:** Provider name, status badge, health score, default model, cost tier, last probe.

**Detail/edit drawer:**
- Enable/disable toggle (triggers governance scope sync)
- Model selectors (chat, vision, embedding)
- Priority slider (failover order)
- Endpoint override (local/OpenRouter)
- Key status indicator (configured/missing — never show key value)
- "Run health check" button → live probe result
- Capabilities checklist (read-only from adapter)

#### 7.2.3 Routing Rules (`AiRoutingPanel` — new)

**List view:** Task type, rule name, priority, provider chain (chip sequence), enabled toggle.

**Editor:**
- Task type dropdown
- Condition builder (locale, species, urgency, tenant tier)
- Provider chain drag-and-drop ordering
- Model override per provider
- Timeout, max retries, async flag
- Max cost per request
- "Test rule" → dry-run with sample input

#### 7.2.4 Prompts (`PromptList` — extend existing)

**Add:**
- Version column + history timeline
- Task type filter
- Status workflow badges (DRAFT/REVIEW/ACTIVE)
- Side-by-side bn/en editor with variable preview
- "Test prompt" modal with live LLM dry-run
- A/B traffic split slider (when two ACTIVE versions)
- Diff view between versions
- Approve button (VET_REVIEWER+)

#### 7.2.5 Usage & Costs (`AiUsagePanel` — new)

**Tabs:**
- Overview — rollups from `AiUsageDailyRollup`
- By user — searchable table → drill-down to `usage/users/:id`
- By customer — farmer chargeback view
- By task type — cost breakdown pie
- By provider — model-level table
- Export CSV (date range, dimensions)

**Filters:** Date range, task type, provider, success/failure, billable only.

#### 7.2.6 Health & Alerts (`AiHealthPanel` — new)

**Provider health timeline:** Sparklines from `AiProviderHealthSnapshot`.

**Circuit breaker status:** Per-provider open/closed/half-open.

**Alert inbox:** Filter by type (budget, spike, provider), severity, acknowledged.

**Budget config:** Edit daily/monthly caps inline (writes env override to DB config).

#### 7.2.7 Governance (`AiGovernancePanel` — extend existing)

**Add:**
- Task-type scope toggles (8 task types)
- New provider scope toggles (gemini, grok, deepseek, openrouter, local)
- Scheduled maintenance window (auto-enable rules-only mode)
- Rollback button on governance history entries

#### 7.2.8 Escalations (`AiEscalationPanel` — new)

**Queue:** PENDING_REVIEW escalations with session context, triage data, user farm info.

**Actions:** Assign to vet, resolve, add handoff note.

**Filters:** Reason, urgency, date, assigned vet.

#### 7.2.9 Async Jobs (`AiJobsPanel` — new)

**Monitor:** Queued/processing/failed jobs with progress, task type, user, duration.

**Actions:** Cancel queued, retry failed, view input/output JSON.

### 7.3 Web BFF Routes to Add

Mirror in `pranidoctor-web/src/app/api/admin/`:

```
ai/providers/route.ts
ai/providers/[key]/route.ts
ai/routing-rules/route.ts
ai/routing-rules/[id]/route.ts
ai/usage/route.ts
ai/costs/route.ts
ai/health/route.ts
ai/alerts/route.ts
ai/alerts/[id]/acknowledge/route.ts
ai/rates/route.ts
ai/jobs/route.ts
ai/jobs/[id]/route.ts
ai/escalations/route.ts
ai/escalations/[id]/route.ts
ai-ops/prompts/[id]/test/route.ts
```

### 7.4 Mobile UX (Cross-Repo)

| Feature | Screen | Priority |
|---------|--------|----------|
| Rules-only banner | `AiChatPage`, `AiHomePage` | P1 — reads `/api/ai/status` |
| Image analysis upload | New `AiImageAnalysisPage` | P1 |
| Chat v2 / streaming | Extend `AiChatPage` | P2 |
| Farm briefing/query | Wire existing routes | P2 |
| Prescription scan | New flow in treatment module | P2 |
| Async job polling UI | Shared `AiJobStatusWidget` | P2 |
| Alerts/follow-ups nav | Fix `AiHomePage` links | P3 |

### 7.5 Component Library (Web)

New components under `src/components/admin/ai-ops/`:

| Component | Purpose |
|-----------|---------|
| `AiProviderPanel.tsx` | Provider CRUD + health |
| `AiRoutingPanel.tsx` | Routing rules editor |
| `AiUsagePanel.tsx` | Usage/cost dashboards |
| `AiHealthPanel.tsx` | Health + alerts |
| `AiEscalationPanel.tsx` | Escalation queue |
| `AiJobsPanel.tsx` | Async job monitor |
| `ProviderChainEditor.tsx` | Drag-drop chain builder |
| `PromptTestModal.tsx` | Dry-run prompt tester |
| `CostTrendChart.tsx` | Shared chart component |

Reuse existing: `AiOpsOverview`, `AiGovernancePanel`, `AiRiskPanel`, `PromptList`, `KnowledgeList`.

---

## 8. Migration Roadmap

### Phase 0 — Foundation (Weeks 1–2)

**Goal:** Fix gaps in existing platform without new providers.

| Item | Repo | Effort |
|------|------|--------|
| Wire `AI_PROVIDER` into orchestrator | backend | S |
| Fix prompt versioning schema migration | backend | M |
| Add `/api/ai/status` endpoint | backend | S |
| Add missing admin BFF routes (usage, costs, health, providers) | web | M |
| Mobile rules-only banner | mobile | S |
| Wire chat v2, farm briefing, farm query UI | mobile | M |
| Document OpenAPI sync | backend + web | S |

### Phase 1 — Routing Engine (Weeks 3–5)

**Goal:** Task-type-aware routing with DB rules.

| Item | Repo | Effort |
|------|------|--------|
| `AiRoutingRule` + `AiProviderConfig` tables | backend | M |
| Routing resolver service | backend | L |
| Extend governance scopes for 8 task types | backend | M |
| Admin routing rules UI | web | L |
| Admin providers UI | web | M |
| Migrate feed recommendations under AI router | backend | M |

### Phase 2 — Provider Expansion (Weeks 6–8)

**Goal:** Gemini + OpenRouter + DeepSeek.

| Item | Repo | Effort |
|------|------|--------|
| Gemini adapter (vision + chat) | backend | L |
| OpenRouter adapter | backend | M |
| DeepSeek adapter (OpenAI-compatible) | backend | S |
| `AiProviderRate` DB table + admin UI | backend + web | M |
| Circuit breaker implementation | backend | M |
| Health-weighted chain reordering | backend | M |

### Phase 3 — Multimodal (Weeks 9–12)

**Goal:** Image, document, prescription analysis.

| Item | Repo | Effort |
|------|------|--------|
| `POST /api/ai/analyze/image` | backend | L |
| `POST /api/ai/analyze/document` | backend | L |
| `POST /api/ai/analyze/prescription` | backend | M |
| BullMQ workers for async jobs | backend | L |
| `AiAsyncJob` + `AiMediaAnalysis` tables | backend | M |
| Mobile image analysis screen | mobile | L |
| Async job polling widget | mobile | M |
| Admin jobs monitor | web | M |

### Phase 4 — Advanced (Weeks 13–16)

**Goal:** Streaming, RAG, video, secrets manager.

| Item | Repo | Effort |
|------|------|--------|
| SSE streaming `/api/ai/chat/stream` | backend + mobile | L |
| pgvector + embedding pipeline | backend | XL |
| Video analysis (frame extraction) | backend | L |
| Grok + local model adapters | backend | M |
| Secrets manager integration | backend | M |
| Prompt A/B testing | backend + web | M |
| Chargeback CSV export | backend + web | S |

### Effort Key

S = 1–3 days, M = 1 week, L = 2 weeks, XL = 3+ weeks

### Success Criteria

| Metric | Target |
|--------|--------|
| Provider uptime (any LLM available) | > 99.5% |
| P95 chat latency | < 8s |
| Fallback rate | < 5% of requests |
| Cost per chat (median) | < $0.002 |
| Emergency response time | < 5s |
| Zero API key exposure incidents | 0 |
| Admin can disable any provider in < 30s | ✅ |

---

## 9. Appendix

### 9.1 Environment Variable Reference (Target)

| Variable | Required | Default | Phase |
|----------|----------|---------|-------|
| `OPENAI_API_KEY` | Prod: one of OpenAI/Anthropic | — | 0 |
| `OPENAI_MODEL` | No | `gpt-4o-mini` | 0 |
| `OPENAI_VISION_MODEL` | No | `gpt-4o` | 3 |
| `ANTHROPIC_API_KEY` | Prod: one of OpenAI/Anthropic | — | 0 |
| `ANTHROPIC_MODEL` | No | `claude-3-5-haiku-20241022` | 0 |
| `AI_PROVIDER` | No | `openai` | 0 |
| `GEMINI_API_KEY` | No | — | 2 |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | 2 |
| `OPENROUTER_API_KEY` | No | — | 2 |
| `OPENROUTER_DEFAULT_MODEL` | No | — | 2 |
| `DEEPSEEK_API_KEY` | No | — | 2 |
| `DEEPSEEK_MODEL` | No | `deepseek-chat` | 2 |
| `GROK_API_KEY` | No | — | 4 |
| `GROK_BASE_URL` | No | `https://api.x.ai/v1` | 4 |
| `LOCAL_LLM_BASE_URL` | No | — | 4 |
| `LOCAL_LLM_MODEL` | No | — | 4 |
| `AI_LLM_REQUIRED` | No | `true` (prod) | 0 |
| `AI_LLM_DISABLED` | No | `false` | 0 |
| `DAILY_AI_BUDGET_USD` | No | — | 0 |
| `MONTHLY_AI_BUDGET_USD` | No | — | 0 |
| `AI_HEALTH_PROBE_ENABLED` | No | `true` (prod) | 0 |
| `AI_ROUTING_DB_ENABLED` | No | `false` → `true` | 1 |
| `AI_SECRETS_PROVIDER` | No | `env` → `aws`/`vault` | 4 |
| `AI_EMBEDDING_ENABLED` | No | `false` | 4 |

### 9.2 Related Documentation

| Document | Location | Status |
|----------|----------|--------|
| AI Orchestrator (aspirational) | `pranidoctor-web/docs/ai/AI_ORCHESTRATOR.md` | Superseded by this plan for backend |
| Prompt System | `pranidoctor-web/docs/ai/PROMPT_SYSTEM.md` | Reference |
| Cost Optimization | `pranidoctor-web/docs/ai/COST_OPTIMIZATION.md` | Reference |
| Emergency Engine | `pranidoctor-web/docs/ai/EMERGENCY_ENGINE.md` | Reference |
| AI Production Readiness | `pranidoctor-backend/docs/reports/AI_PRODUCTION_READINESS_REPORT.md` | Current state |
| Kill Switch Runbook | `pranidoctor-backend/docs/production/ai/ai-kill-switch-operations.md` | Operational |
| Phase 8 Mobile Plan | `pranidoctor_user/docs/phase-8-ai-smart-ecosystem-master-plan.md` | Mobile roadmap |

### 9.3 Glossary

| Term | Definition |
|------|------------|
| AIMS | AI Management System (this architecture) |
| LLM Operations | Generative AI platform (chat, analysis, routing) |
| AI Technician | Artificial Insemination field service marketplace |
| Rules-based | Deterministic fallback provider — always available |
| Task type | Classification driving routing, prompts, and cost tiers |
| Fail-closed | When governance state unknown, disable LLM (current behavior) |

### 9.4 Decision Log

| Decision | Rationale | Alternatives rejected |
|----------|-----------|----------------------|
| Backend owns all LLM logic | Single source of truth, key security | Web-side orchestrator (docs/ai/) |
| DB-driven routing rules | Change chains without deploy | Hardcoded chains (current) |
| OpenRouter as P1 gateway | Fast multi-model access | Individual adapters only |
| Async for video/document | Provider latency + size limits | Sync with long timeout |
| pgvector for RAG Phase 4 | Postgres already primary DB | Pinecone/Weaviate |
| Keep rules-based as final fallback | 100% availability guarantee | Error-only fallback |
| Separate AI Technician nav | Prevent domain confusion | Single "AI" nav group |

---

**Document owner:** Platform Engineering  
**Review cycle:** Quarterly or on major provider addition  
**Next review:** 2026-08-30

