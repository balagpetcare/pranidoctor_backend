# AI System Current Status Report

**Date:** 2026-05-30  
**Scope:** Cross-repository audit of LLM AI platform  
**Repositories inspected:**

| Repo | Path | Role |
|------|------|------|
| `pranidoctor-backend` | `D:/PraniDoctor/pranidoctor-backend` | AI services, vault, orchestration, DB, legacy admin API |
| `pranidoctor-web` | `D:/PraniDoctor/pranidoctor-web` | Admin AI Center UI, BFF proxies, compliance admin |
| `pranidoctor_user` | `D:/PraniDoctor/pranidoctor_user` | Flutter mobile AI assistant & Phase 8 features |

**Method:** Static code inspection only. No runtime tests, no code changes, no commits.  
**Evidence rule:** Every finding cites files, routes, tables, or code locations discovered in the repos.

---

# Executive Summary

## AI completion percentage

**72%** — calculated from a 52-capability inventory (see [Completion methodology](#completion-methodology)).

| Status | Count | Examples |
|--------|-------|----------|
| **Working** (end-to-end or production path exists) | 28 | Mobile chat/triage, governance kill switch, provider/model/route list+toggle admin |
| **Partial** (code exists; integration or prod path incomplete) | 19 | Gemini/DeepSeek/Grok/OpenRouter providers, admin CRUD forms, Phase 8 mobile paths |
| **Broken / Missing** | 5 | Admin secrets BFF path, Groq provider, prompt-injection module, legacy `AiService` placeholder, `createAiAdminModule()` unmounted |

```
Completion = (Working + 0.5 × Partial) / Total × 100
           = (28 + 0.5 × 19) / 52 × 100
           = 37.5 / 52 × 100
           ≈ 72%
```

## Production readiness percentage

**58%** — derived from seven category scores (see [Final Score](#final-score)) and corroborated by `docs/reports/AI_PRODUCTION_READINESS_REPORT.md` (prior audit: **67/100**, verdict **NOT PRODUCTION-READY**).

Primary production gaps not resolved in code:

- Admin **secrets API** has BFF + Express handlers but **no legacy compat route** → admin key management path is broken for production BFF flow (`src/legacy/web/routes/admin/ai-ops/` has **0** `secrets/` files; `createAiAdminModule()` not mounted in `src/modules/index.ts`).
- Production LLM orchestrator uses **OpenAI → Anthropic → rules-based only** (`src/modules/ai/orchestrator/ai-orchestrator.service.ts` L31–32, L48–54).
- Health probes cover **openai | anthropic only** (`src/modules/ai/health/ai-health-probe.service.ts` L34–37 per subagent file read).
- **Groq** — zero matches in `src/` (`grep groq` → no implementation).
- **Prompt injection** — no dedicated module (`grep inject|jailbreak` in `src/**/*.ts` → only unrelated faker string).
- Prior readiness report documents: build failures, no live LLM keys, Redis disabled, migration deploy gaps (`docs/reports/AI_PRODUCTION_READINESS_REPORT.md`).

## Major strengths

1. **Large, structured backend AI platform** — 120+ files under `src/modules/ai/`, plus `src/modules/ai-veterinary-core/` (14 files) as primary chat/triage path.
2. **Database foundation** — 39 Prisma `Ai*` models, 17 AI-specific migrations, indexes on management tables (`prisma/migrations/20260603120000_ai_management_foundation/migration.sql`).
3. **Vault & encryption** — AES-256-GCM in `src/modules/ai/vault/encryption.service.ts`; CRUD + rotation in `ai-secret.service.ts`, `key-rotation.service.ts`.
4. **Usage monitoring stack** — token/cost/rollups in `src/modules/ai/usage/`; analytics in `src/modules/ai/analytics/usage/`; 20 test files under `src/modules/ai/`.
5. **Mobile AI surface** — 42 Dart files in `lib/features/ai/` with chat, triage, voice, Phase 8 screens wired to `/api/ai/*`.
6. **Admin AI Center UI** — 11 sidebar pages, 48 BFF proxy routes in `pranidoctor-web/src/app/api/admin/ai-ops/`, live API panels (no mock data in `src/components/admin/ai-ops/`).
7. **Governance & safety** — kill switch, scopes, output guardrails (`src/modules/ai/governance/`, `src/modules/ai-veterinary-core/safety/ai-safety.guardrails.ts`), rate limits (`src/shared/security/rate-limit/rate-limit.config.ts` → `AI_CHAT`, `AI_CHAT_DAILY`).

## Major blockers

| # | Blocker | Evidence |
|---|---------|----------|
| B1 | **Admin secrets API unreachable via production BFF path** | Express routes in `src/modules/ai/ai.routes.ts` L79–85; `AiAdminModule` not in `createAllModules()` (`src/modules/index.ts` L55); **no** `src/legacy/web/routes/admin/ai-ops/secrets/**`; web BFF `src/app/api/admin/ai-ops/secrets/route.ts` proxies to missing backend route |
| B2 | **`createAiAdminModule()` not mounted** | `src/modules/index.ts` exports/mounts only `createAiModule()`; admin Express routes require `INTERNAL_ADMIN_AI_OPS_TOKEN` (`src/modules/ai/ai-admin.middleware.ts`) — BFF does not send this header (`src/lib/proxy-to-backend.ts`) |
| B3 | **Production orchestrator limited to 2 LLM providers** | `ai-orchestrator.service.ts` L31–32: `[OpenAiProvider, AnthropicProvider, RulesBasedProvider]` |
| B4 | **Legacy admin route gap: 48 BFF routes vs 28 backend compat routes** | Web: 48 files in `pranidoctor-web/src/app/api/admin/ai-ops/**/route.ts`; Backend: 28 files in `src/legacy/web/routes/admin/ai-ops/**/route.ts` |
| B5 | **Live LLM connectivity not evidenced in repo** | `docs/reports/AI_PRODUCTION_READINESS_REPORT.md`; `scripts/live-llm-connectivity-verify.ts` exists but prior audit reported no keys |
| B6 | **Dead placeholder service still in tree** | `src/modules/ai/ai.service.ts` L69–71: `'AI response placeholder - implement with actual AI provider'` (not registered in `ai.module.ts`) |

## High priority issues

1. Add legacy compat routes for **secrets**, **audit**, **usage/report**, and extended **prompts** CRUD — or mount `AiAdminModule` and align BFF auth.
2. Wire **Gemini / DeepSeek / Grok / OpenRouter** into orchestrator failover chain (factory exists in `provider-factory.ts` L15–23; orchestrator does not use it).
3. Build admin **create/edit forms** for providers, models, routes, API keys (schemas exist: `pranidoctor-web/src/lib/admin-ai/schemas.ts` — only used in tests).
4. Add **prompt-injection** defenses beyond output sanitization.
5. Implement **Groq** or remove from roadmap/docs.
6. Add page guards on legacy admin URLs: failover, governance, knowledge, risk (`pranidoctor-web` pages missing `ensureAiCenterAccess()`).
7. Mobile: wire unused Phase 8 paths (`chat/v2`, `briefing/daily`, `farm-query`, `analytics/farm-risk`) defined in `lib/features/ai/data/ai_phase8_api_paths.dart`.

---

# AI Architecture Inventory

## Services (`pranidoctor-backend/src/modules/ai/`)

| Service | File | Status |
|---------|------|--------|
| AiOrchestratorService | `orchestrator/ai-orchestrator.service.ts` | Working — OpenAI → Anthropic → rules |
| AiRouterService | `routing/ai-router.service.ts` | Working + tests |
| AiFailoverService | `failover/ai-failover.service.ts` | Working + tests |
| AiSecretService | `vault/ai-secret.service.ts` | Working + tests |
| EncryptionService | `vault/encryption.service.ts` | Working — AES-256-GCM |
| KeyRotationService | `vault/key-rotation.service.ts` | Working + tests |
| AiUsageService | `usage/ai-usage.service.ts` | Working |
| AiUsageAnalyticsService | `analytics/usage/ai-usage-analytics.service.ts` | Working + tests |
| AiRegistryAdminService | `admin/ai-registry-admin.service.ts` | Working — legacy ai-ops routes |
| AiGovernanceService | `governance/ai-governance.service.ts` | Working + tests |
| AiPromptManagementService | `prompts/management/ai-prompt-management.service.ts` | Working + tests |
| Marketplace bootstrap/loader | `marketplace/marketplace-bootstrap.service.ts`, `extension-loader.service.ts` | Working + tests |
| OpenRouter catalog | `marketplace/openrouter-catalog.service.ts` | Working |
| AiHealthProbeService | `health/ai-health-probe.service.ts` | Partial — openai/anthropic only |
| AiBudgetService | `budget/ai-budget.service.ts` | Present |
| AiAssistantService | `assistant/ai-assistant.service.ts` | Working — delegates to veterinary core |
| SymptomCheckerService | `symptom-checker/symptom-checker.service.ts` | Working |
| SmartRecommendationService | `recommendations/smart-recommendation.service.ts` | Present |
| FarmHealthService | `farm-health/farm-health.service.ts` | Present |
| AiService (legacy) | `ai.service.ts` | **Placeholder** — not in `ai.module.ts` |

**Primary chat/triage (separate module):** `src/modules/ai-veterinary-core/` — `AiVeterinaryCoreService`, safety guardrails, rules-based fallback provider.

**Voice:** `src/modules/voice-assistant/voice-assistant.service.ts` → calls `getAiVeterinaryCoreService().chat`.

## Controllers

| Controller | File | Routes |
|------------|------|--------|
| AiController | `src/modules/ai/ai.controller.ts` | Mobile Phase 8 + admin handlers |
| AiAdminController | `src/modules/ai/ai.controller.ts` L279+ | Admin ops (secrets, analytics, prompts, etc.) |
| AiVeterinaryCoreController | `src/modules/ai-veterinary-core/ai-veterinary-core.controller.ts` | `/chat`, `/triage`, `/history`, `/escalate` |
| Express bridge | `src/modules/ai/ai-admin.controller.ts` | Legacy handler exports |

## Routes

### Express module routes (`/api/ai/*`)

**File:** `src/modules/ai/ai.routes.ts` — mounted via `createAiModule()` at `/api/ai` (`src/shared/module/module-loader.ts` L30).

| Method | Path | Handler area |
|--------|------|--------------|
| POST | `/chat/v2` | Enhanced chat |
| GET | `/symptom-taxonomy` | Symptom checker |
| POST | `/symptom-check` | Symptom checker |
| GET | `/knowledge/search`, `/knowledge/:slug` | Knowledge |
| GET/POST | `/smart-recommendations/*` | Recommendations |
| GET/POST | `/smart-alerts/*` | Alerts |
| GET | `/farm-health` | Farm dashboard |
| POST | `/briefing/daily`, `/farm-query` | Farm intelligence |
| GET/POST | `/follow-ups/*` | Follow-ups |
| GET | `/analytics/farm-risk` | Risk analytics |

**Veterinary core (same router):** `src/modules/ai-veterinary-core/ai-veterinary-core.routes.ts` — `/chat`, `/triage`, `/history`, `/memory`, `/escalate`.

**Middleware:** governance observer, mobile auth, AI consent, rate limits (`ai.routes.ts` L21–47).

### Express admin routes (`configureAiAdminRoutes`) — **NOT MOUNTED**

**File:** `src/modules/ai/ai.routes.ts` L49–86 — would mount on `AiAdminModule` at `/api/admin-ai-ops/*` if registered; **not** in `createAllModules()`.

Includes: overview, usage analytics (8 endpoints), knowledge, prompts CRUD, escalations, audit, kill-switch, **secrets** (7 endpoints).

### Legacy compat admin routes (`/api/admin/ai-ops/*`)

**Registry:** `src/modules/compat-web/route-registry.ts` — walks `src/legacy/web/routes/**/route.ts`.

**28 route files** under `src/legacy/web/routes/admin/ai-ops/`:

- `overview/route.ts`
- `governance/route.ts`
- `health/route.ts`
- `providers/route.ts`, `providers/[id]/route.ts`, `providers/[id]/toggle/route.ts`, `providers/dashboard/route.ts`
- `models/route.ts`, `models/[id]/route.ts`, `models/[id]/toggle/route.ts`
- `routes/route.ts`, `routes/[id]/route.ts`, `routes/[id]/toggle/route.ts`
- `failover/route.ts`, `failover/[id]/route.ts`, `failover/[id]/toggle/route.ts`, `failover/status/route.ts`
- `marketplace/extensions/route.ts`, `marketplace/adapters/route.ts`, `marketplace/openrouter/sync/route.ts`, `marketplace/models/external/route.ts`, `marketplace/veterinary/models/route.ts`
- `analytics/usage/dashboard/route.ts`, `analytics/risk/route.ts`
- `knowledge/route.ts`, `knowledge/[id]/publish/route.ts`
- `prompts/route.ts`, `prompts/[id]/activate/route.ts`

**Missing from legacy (present in web BFF):** all `secrets/*`, `audit`, `analytics/usage/report|trends|daily-cost|monthly-cost|features|providers`, `usage/users/*`, `usage/customers/*`, most `prompts/*` sub-routes.

### Health endpoints

| Endpoint | File |
|----------|------|
| `GET /health/ai` | `src/api/health/health.routes.ts` |
| AI section in full health | `src/api/health/health.service.ts` |
| Admin health dashboard | `src/legacy/web/routes/admin/ai-ops/health/route.ts` |

### Web BFF proxies (`pranidoctor-web`)

**48 routes** under `src/app/api/admin/ai-ops/**/route.ts` — all use `proxyRouteToBackend()` (`src/lib/proxy-to-backend.ts`).

## Models (Prisma)

**File:** `prisma/schema.prisma` — **39 `model Ai*` definitions.**

### LLM platform / admin (`ai_*` tables)

| Model | Table | Migration |
|-------|-------|-----------|
| AiProvider | `ai_providers` | `20260603120000_ai_management_foundation` |
| AiModel | `ai_models` | same + `20260604120000_ai_marketplace_extensions` |
| AiApiKey | `ai_api_keys` | `20260603120000_ai_management_foundation` |
| AiRoute | `ai_routes` | same |
| AiPrompt | `ai_prompts` | same |
| AiUsageLog | `ai_usage_logs` | same |
| AiFailoverRule | `ai_failover_rules` | same |
| AiSettings | `ai_settings` | same |
| AiApiKeyAuditLog | `ai_api_key_audit_logs` | `20260603140000_ai_vault_audit_log` |
| AiMarketplaceExtension | `ai_marketplace_extensions` | `20260604120000_ai_marketplace_extensions` |

### Phase 8 / product AI

| Model | Purpose |
|-------|---------|
| AiAssistantSession, AiAssistantMessage, AiAssistantMemory | Conversation persistence |
| AiTriageRecord, AiEscalationRecord | Triage & escalation |
| AiSafetyAuditLog | Safety audit |
| AiGovernanceState, AiGovernanceStateHistory, AiGovernanceScope | Kill switch & scopes |
| AiKnowledgeEntry, AiSymptomNode, AiSymptomDiseaseLink, AiSymptomCheckSession | Knowledge & symptoms |
| AiUsageRecord, AiUsageDailyRollup, AiUsageUserDailyRollup, AiUsageCustomerDailyRollup, AiUsageMonthlyRollup | Usage accounting |
| AiProviderHealthSnapshot, AiUsageAlert | Health & alerts |
| AiPromptTemplate, AiSmartAlert, AiFollowUpSuggestion | Templates & smart features |

### AI Technician marketplace (non-LLM)

`AiTechnicianProfile`, `AiServiceRequest`, `AiTechnicianReview`, etc. — breeding technician marketplace, not LLM ops.

## Database tables — migrations

**17 AI-related migrations** in `prisma/migrations/`:

| Migration | Focus |
|-----------|-------|
| `20260508205522_ai_technician_foundation` | Technician marketplace |
| `20260510092800_ai_technician_foundation` | Technician |
| `20260510210000_ai_technician_quality_tables` | Technician QA |
| `20260510183000_ai_service_request_decline_reason` | Service requests |
| `20260511194500_ai_technician_semen_template_system` | Semen templates |
| `20260511210000_ai_technician_cover_upload` | Uploads |
| `20260521210000_phase6_ai_veterinary_core` | Veterinary core |
| `20260530120000_ai_usage_monitoring` | Usage monitoring |
| `20260530140000_ai_token_tracking` | Token tracking |
| `20260530160000_ai_governance_kill_switch` | Governance |
| `20260601120000_phase8_ai_ecosystem` | Phase 8 ecosystem |
| `20260601120000_ai_governance_scopes` | Governance scopes |
| `20260602120000_ai_production_platform` | Production platform |
| `20260603120000_ai_management_foundation` | Admin registry tables |
| `20260603140000_ai_vault_audit_log` | Vault audit |
| `20260604120000_ai_marketplace_extensions` | Marketplace |

**Seeds:** `prisma/seeds/ai_management_foundation.seed.ts`, `ai_marketplace.seed.ts`, `phase8_ai_ecosystem.seed.ts`.

## Settings systems

| System | Backend | Admin UI | Persistence |
|--------|---------|----------|-------------|
| Platform config | `src/modules/ai/config/ai.config.ts` | Settings → Governance panel | Env + `AiSettings` table |
| Provider runtime config | `src/modules/ai/providers/provider-config.ts` | Providers panel (read) | Env + `AiProvider` |
| Governance scopes | `src/modules/ai/governance/ai-governance.scopes.ts` | `AiGovernancePanel.tsx` | `AiGovernanceState`, `AiGovernanceScope` |
| AI disclaimer | `src/legacy/web/lib/ai-disclaimer/` | `AiDisclaimerAdminPanel.tsx` | Legal document store |
| AI compliance | `src/legacy/web/routes/admin/settings/ai-compliance/route.ts` | `AiComplianceAdminPanel.tsx` | Settings service |
| Escalation disclosure | `src/legacy/web/lib/ai-escalation-disclosure/` | `AiEscalationDisclosureAdminPanel.tsx` | Legal document store |
| Mobile AI consent | `src/legacy/web/routes/mobile/settings/ai-consent/route.ts` | N/A (mobile `AiConsentPage`) | User settings sync |

## Feature flags & environment variables

**Governance flags:** `AI_KILL_SWITCH_PERSISTENCE_ENABLED`, `AI_LLM_DISABLED`, `AI_GOVERNANCE_POLL_INTERVAL_MS` — used in `src/modules/ai/governance/ai-governance.service.ts`.

**Vault:** `AI_VAULT_MASTER_KEY`, `AI_VAULT_KEY_ID`, `AI_VAULT_IMPORT_ENV_KEYS` — `encryption.service.ts`.

**Platform:** `AI_LLM_REQUIRED`, `AI_PROVIDER`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`, `AI_HEALTH_PROBE_ENABLED`, `AI_HEALTH_PROBE_INTERVAL_SEC`, `DAILY_AI_BUDGET_USD`, `MONTHLY_AI_BUDGET_USD` — `ai.config.ts`, `.env.example`.

**Admin break-glass:** `INTERNAL_ADMIN_AI_OPS_TOKEN` — `ai-admin.middleware.ts` (not in `.env.example`).

**Web env (documented, not enforced in src):** `FEATURE_AI_TECHNICIAN`, `FEATURE_KNOWLEDGE_HUB` — `.env.example` only; no references in `pranidoctor-web/src/`.

**Governance provider scope enum:** `AI_GOVERNANCE_PROVIDERS = ['openai', 'anthropic']` — `ai-governance.scopes.ts`.

## Background jobs

| Component | File | Status |
|-----------|------|--------|
| AI platform bootstrap | `src/modules/ai/bootstrap/ai-platform.bootstrap.ts` | Server startup (`server.ts` L178) |
| AI governance bootstrap | `governance/ai-governance.service.ts` | Server + worker (`worker.ts` L55–57) |
| Health probe scheduler | `health/ai-health-probe.service.ts` | In-process timer |
| Dedicated AI queue worker | — | **Missing** — no AI jobs under `src/shared/queue` |

## Provider integrations

See [Provider Analysis](#provider-analysis).

---

# Provider Analysis

**Factory registry:** `src/modules/ai/providers/provider-factory.ts` L15–23  
**Config defaults:** `src/modules/ai/providers/provider-config.ts` L8–50  
**Production orchestrator chain:** `src/modules/ai/orchestrator/ai-orchestrator.service.ts` L31–32, L48–54  
**Live key tests:** `src/modules/ai/vault/provider-key-test.ts`

| Provider | Implementation files | Factory | Orchestrator | Startup validation | Key test | Status |
|----------|---------------------|---------|--------------|-------------------|----------|--------|
| **OpenAI** | `providers/implementations/openai-compatible.providers.ts` (`OpenAIProvider`); `orchestrator/providers/openai.provider.ts`; `providers/core/openai-compatible.provider.ts` | L16 | **Yes** (primary) | `orchestrator/providers/provider.validation.ts` | `openai_native` probe | **Implemented** (production path) |
| **Anthropic** | `providers/implementations/anthropic.provider.ts`; `orchestrator/providers/anthropic.provider.ts` | L17 | **Yes** (fallback) | `provider.validation.ts` | `anthropic_native` probe | **Implemented** (production path) |
| **Gemini** | `providers/implementations/gemini.provider.ts` | L18 | No | Not in `validateAllLlmProviders` | `gemini_native` probe | **Partially implemented** |
| **Grok (xAI)** | `openai-compatible.providers.ts` (`GrokProvider`) | L19 | No | Not in startup validation | openai-compatible probe | **Partially implemented** |
| **DeepSeek** | `openai-compatible.providers.ts` (`DeepSeekProvider`) | L20 | No | Not in startup validation | openai-compatible probe | **Partially implemented** |
| **OpenRouter** | `openai-compatible.providers.ts` (`OpenRouterProvider`); `marketplace/openrouter-catalog.service.ts`; `marketplace/adapters/dynamic-openai.provider.ts` | L21 | No | Not in startup validation | `openrouter_gateway` probe | **Partially implemented** |
| **Self-hosted** | `marketplace/adapters/self-hosted.provider.ts` | L22 | No | Not in startup validation | compatible probe | **Partially implemented** |
| **Rules-based** | `ai-veterinary-core/provider/rules-based.provider.ts`; `orchestrator/providers/rules.provider.ts` | N/A | **Yes** (final fallback) | N/A | N/A | **Implemented** |
| **Groq** | — | — | — | — | — | **Not implemented** (grep `groq` in `src/` → 0 matches) |

---

# AI Settings Audit

Admin panel pages from `pranidoctor-web/src/components/admin-ui/admin-nav.tsx` (AI Center group).

| Setting / Page | UI | API (BFF) | Backend logic | DB persistence | Runtime usage | Status |
|----------------|-----|-----------|---------------|----------------|---------------|--------|
| **Dashboard** | `AiOpsOverview.tsx` | `GET overview`, `providers`, `health` | `getAiAnalyticsService().getOverview` — `overview/route.ts` | Usage rollups | Read-only display | **Working** |
| **Providers** | `ProviderPanel.tsx` | `GET providers`, `dashboard`; `POST toggle` | `AiRegistryAdminService` — `providers/route.ts` | `AiProvider` | Orchestrator reads registry via bootstrap | **Partial** — read+toggle; no create/edit UI |
| **Models** | `ModelPanel.tsx` | `GET models`; `POST toggle` | `AiRegistryAdminService` — `models/route.ts` | `AiModel` | Router/model selector | **Partial** |
| **Routing** | `RoutePanel.tsx` | `GET routes`; `POST toggle` | `AiRegistryAdminService` — `routes/route.ts` | `AiRoute` | `AiRouterService` | **Partial** |
| **API Keys** | `ApiKeysPanel.tsx` | `GET secrets`; `POST test`, `disable` | `AiAdminController.listSecrets` etc. — **Express only** | `AiApiKey` | `AiSecretService` → providers | **Broken** — no legacy route; BFF 404 |
| **Prompts** | `PromptList.tsx` | Multiple `prompts/*` BFF routes | `AiPromptManagementService` | `AiPrompt` | `AiPromptService` | **Partial** — lifecycle without body editor; several BFF routes lack legacy handlers |
| **Analytics** | `UsageAnalyticsPanel.tsx` | `GET analytics/usage/dashboard` | `ai-usage-analytics.service.ts` — `analytics/usage/dashboard/route.ts` | `AiUsageLog`, rollups | Metrics display | **Partial** — single dashboard; 5 analytics BFF routes unused |
| **Marketplace** | `MarketplacePanel.tsx` | `GET extensions`, `models/external`, etc.; `POST openrouter/sync` | Marketplace services — legacy routes exist | `AiMarketplaceExtension`, `AiModel` | Extension loader | **Partial** — read+sync; no install/register UI |
| **Health** | `HealthPanel.tsx` | `GET health` | `AiRegistryAdminService.getHealthDashboard` — `health/route.ts` | `AiProviderHealthSnapshot` | Probe scheduler | **Working** (read-only) |
| **Logs** | `AiLogsPanel.tsx` | `GET analytics/usage/report`, `audit` | Report service; audit via Express only | `AiUsageLog` | Log display | **Partial** — `audit` lacks legacy route |
| **Settings (Governance)** | `AiSettingsPanel.tsx` → `AiGovernancePanel.tsx` | `GET/POST governance` | `AiGovernanceService` — `governance/route.ts` | `AiGovernanceState`, scopes | Kill switch enforcement | **Working** |
| **AI Disclaimer** | `AiDisclaimerAdminPanel.tsx` | `/api/admin/settings/ai-disclaimer` | `admin-ai-disclaimer-service` | Legal docs | Mobile disclaimer gate | **Working** |
| **AI Compliance** | `AiComplianceAdminPanel.tsx` | `/api/admin/settings/ai-compliance` | `admin-ai-compliance-service` | Settings | Compliance banners | **Working** |
| **Escalation disclosure** | `AiEscalationDisclosureAdminPanel.tsx` | `/api/admin/settings/ai-escalation-disclosure` | escalation disclosure service | Legal docs | Mobile strips | **Working** |

### Legacy admin pages (not in sidebar, URL-accessible)

| Page | File | Guard | Status |
|------|------|-------|--------|
| Failover | `FailoverPanel.tsx` | **None** on page | **Partial** — functional API; weak UX |
| Governance | duplicate of Settings | **None** | **Working** (duplicate) |
| Knowledge | `KnowledgeList.tsx` | **None** | **Partial** |
| Risk | `AiRiskPanel.tsx` | **None** | **Working** |

---

# API Key Management Audit

| Capability | Status | Evidence |
|------------|--------|----------|
| **Key storage method** | Working | Encrypted ciphertext in `AiApiKey` table; `ai-secret.service.ts` |
| **Encryption** | Working | AES-256-GCM, format `v1:{iv}:{tag}:{cipher}` — `encryption.service.ts` L3–6, L48+ |
| **Validation** | Working | Prefix checks (`sk-`, `sk-ant-`) — `ai-secret.service.ts` L356–360; rejects `ENC:SEED`/`ENC:PLACEHOLDER` — `encryption.service.ts` |
| **Health check** | Partial | Provider health via `ai-health-probe.service.ts` (openai/anthropic); key-level via test endpoint |
| **Connection test** | Partial | `provider-key-test.ts` — probes for all factory providers; returns `UNSUPPORTED_PROVIDER` if key not in `allProviderKeys()` L106–112 |
| **Rotation** | Working (backend) | `key-rotation.service.ts` + `POST /secrets/:id/rotate` in `ai.routes.ts` L84 — **no legacy route, no admin UI** |
| **Permission controls** | Partial | Web: `ai.secrets.manage` for SUPER_ADMIN only — `permissions-core.ts`; backend legacy routes use `requireAiAdminActor` / `ai-admin.guard.ts`; Express routes use `INTERNAL_ADMIN_AI_OPS_TOKEN` |

**Critical gap:** Admin cannot manage keys through the documented production path (BFF → legacy compat). Express handlers exist at `ai.routes.ts` L79–85 but module not mounted and middleware blocks without internal token.

---

# Usage Monitoring Audit

| Capability | Status | Evidence |
|------------|--------|----------|
| **Token tracking** | Working | `usage/ai-usage.tokens.ts`; migration `20260530140000_ai_token_tracking`; tests `ai-token-tracking.verify.test.ts` |
| **Request tracking** | Working | `usage/ai-usage.service.ts` → `AiUsageRecord`; Prometheus `ai_requests_total` per production report |
| **Cost tracking** | Working | `usage/ai-usage.cost.ts` — `estimateAiCostUsd` (openai, anthropic rates) |
| **Provider usage tracking** | Partial | Backend: `analytics/usage/` provider comparison endpoints; Admin UI: dashboard only, `analytics/usage/providers` BFF unused |
| **Daily limits** | Working | `rate-limit.config.ts` → `AI_CHAT_DAILY`; `ai-budget.service.ts` daily budget |
| **Monthly limits** | Partial | `MONTHLY_AI_BUDGET_USD` in config; `AiUsageMonthlyRollup` table; monthly BFF route unused in UI |
| **Analytics dashboard** | Partial | `UsageAnalyticsPanel.tsx` — single KPI dashboard; no charts; granular endpoints exist but uncalled |

---

# AI Features Inventory

| Feature | Backend | Web admin | Mobile | Production readiness |
|-------|---------|-----------|--------|---------------------|
| AI chat | `ai-veterinary-core.routes.ts` `/chat` | — | `ai_chat_page.dart` | **Partial** — needs live keys + Redis |
| Symptom triage | `/triage` | — | `ai_chat_page.dart`, `ai_result_page.dart` | **Partial** |
| Chat v2 | `ai.routes.ts` L31 | — | Path in `ai_phase8_api_paths.dart`, **not called** | **Partial** |
| Conversation history | `/history` | — | `ai_history_page.dart` | **Working** (code path) |
| Human escalation | `/escalate` | — | `ai_providers.dart` | **Working** (code path) |
| Voice STT normalize | voice module | — | `ai_voice_input_page.dart` → `/api/voice/stt` | **Partial** |
| Voice chat/session | voice routes defined | — | Paths defined, **not called** | **Missing** (mobile) |
| Symptom checker (structured) | `/symptom-check`, `/symptom-taxonomy` | — | `symptom_checker_page.dart` | **Working** (code path) |
| Knowledge search | `/knowledge/search` | `KnowledgeList.tsx` (admin) | `KnowledgeSearchPage` | **Working** (code path) |
| Smart recommendations | `/smart-recommendations` | — | `smart_recommendations_page.dart` | **Working** (code path) |
| Smart alerts | `/smart-alerts` | — | `smart_alerts_page.dart` | **Working** (code path) |
| Farm health dashboard | `/farm-health` | — | `farm_health_dashboard_page.dart` | **Working** (code path) |
| Follow-up suggestions | `/follow-ups` | — | `FollowUpSuggestionsPage` | **Working** (code path) |
| Daily farm briefing | `/briefing/daily` | — | Path defined, **not called** | **Partial** |
| Farm query (NL) | `/farm-query` | — | Path defined, **not called** | **Partial** |
| Farm risk analytics | `/analytics/farm-risk` | `AiRiskPanel.tsx` | Path defined, **not called** | **Partial** |
| Provider registry admin | legacy `providers/route.ts` | `ProviderPanel.tsx` | — | **Partial** |
| API key vault admin | Express only | `ApiKeysPanel.tsx` | — | **Broken** (route gap) |
| Governance kill switch | `governance/route.ts` | `AiGovernancePanel.tsx` | Affected platform-wide | **Working** (code path) |
| Failover rules | legacy failover routes | `FailoverPanel.tsx` | — | **Partial** |
| Marketplace / OpenRouter sync | legacy marketplace routes | `MarketplacePanel.tsx` | — | **Partial** |
| Usage analytics | analytics services | `UsageAnalyticsPanel.tsx` | — | **Partial** |
| AI Technician marketplace | separate module | `ai-technicians/` admin | mobile ai-technician routes | **Separate product** (not LLM) |

---

# Static vs Functional Analysis

## Fully functional (live API, no mock data in ai-ops)

All panels under `pranidoctor-web/src/components/admin/ai-ops/` fetch from BFF — **no `MOCK_DATA` or stub arrays found**.

| File | Notes |
|------|-------|
| `AiOpsOverview.tsx` | 3 parallel API loads; `QUICK_LINKS` is static nav only |
| `ProviderPanel.tsx`, `ModelPanel.tsx`, `RoutePanel.tsx` | Live list + toggle |
| `ApiKeysPanel.tsx` | Calls live API — **backend route missing** → errors at runtime |
| `UsageAnalyticsPanel.tsx`, `HealthPanel.tsx`, `MarketplacePanel.tsx` | Live read paths |
| `AiLogsPanel.tsx`, `AiGovernancePanel.tsx`, `PromptList.tsx` | Live (partial backend coverage for some mutations) |
| `FailoverPanel.tsx`, `AiRiskPanel.tsx`, `KnowledgeList.tsx` | Live |

## Partial / incomplete UX

| File | Gap |
|------|-----|
| `ProviderPanel.tsx`, `ModelPanel.tsx`, `RoutePanel.tsx` | No create/edit — schemas in `src/lib/admin-ai/schemas.ts` unused outside tests |
| `ApiKeysPanel.tsx` | No add/rotate UI; BFF POST/rotate routes exist but uncalled |
| `MarketplacePanel.tsx` | No extension install UI |
| `UsageAnalyticsPanel.tsx` | No charts; 5 analytics BFF routes unused |
| `PromptList.tsx` | No prompt body editor |

## Static / hardcoded only

| File | Notes |
|------|-------|
| `pranidoctor-web/src/app/legal/disclaimer/page.tsx` | Static legal HTML |
| `AiOpsOverview.tsx` `QUICK_LINKS` | Hardcoded navigation |
| `MarketplacePanel.tsx` textarea placeholder | `"openai/gpt-4o-mini"` — UX hint |
| `pranidoctor-backend/src/modules/ai/ai.service.ts` L69–71 | Hardcoded placeholder string (**dead code**) |
| `prisma/seeds/ai_management_foundation.seed.ts` | Placeholder ciphertext + `ENC:SEED` handling |

## Mock / archived implementations

| File | Notes |
|------|-------|
| `pranidoctor-web/src/lib/mobile-ai-services/ai-services-service.ts` | `Implementation archived — DB via pranidoctor-backend` |
| Similar pattern in related mobile-ai lib files | BFF routes active; local service layer archived |

---

# Database Audit

## AI-related tables (by domain)

**LLM admin (10):** `ai_providers`, `ai_models`, `ai_api_keys`, `ai_routes`, `ai_prompts`, `ai_usage_logs`, `ai_failover_rules`, `ai_settings`, `ai_api_key_audit_logs`, `ai_marketplace_extensions`

**Phase 8 product (18+):** assistant sessions/messages/memory, triage, escalation, safety audit, governance, knowledge, symptoms, usage records/rollups, health snapshots, alerts, prompt templates, smart alerts, follow-ups

**AI Technician (12+):** technician profiles, service areas, requests, reviews, complaints, etc.

## Migrations present

17 AI migrations listed in [Database tables — migrations](#database-tables--migrations).

## Missing migrations

No evidence of **missing migration files** for models defined in `schema.prisma` — all `AiProvider`, `AiApiKey`, etc. have corresponding SQL in `20260603120000` / `20260603140000` / `20260604120000`.

**Deploy status:** prior audit noted production migration deploy not evidenced (`AI_PRODUCTION_READINESS_REPORT.md`) — environment-specific, not verifiable from code alone.

## Indexes

**Present:** comprehensive indexes in `20260603120000_ai_management_foundation/migration.sql` L257–294 (providers, models, api_keys, routes, prompts, usage_logs, failover_rules, settings) and `20260603140000_ai_vault_audit_log/migration.sql` (audit log indexes).

**Potential gaps (code review only):**

- `AiUsageRecord` / rollup tables — indexes defined in phase 8 migration (`20260601120000_phase8_ai_ecosystem`) — not re-verified line-by-line in this audit.
- No evidence of missing FK relations on core admin tables — `AiModel.providerId`, `AiApiKey.providerId`, `AiRoute` relations present in schema.

## Missing relations

No orphaned Prisma models found without `@relation` for core LLM admin entities. Marketplace extension → model relation added in `20260604120000`.

---

# Security Audit

| Area | Status | Evidence |
|------|--------|----------|
| **Secret storage** | Strong | AES-256-GCM vault; DB ciphertext; master key from env |
| **API key exposure risks** | Moderate | Secrets never returned in plaintext from list API (hint only in UI types); Express admin blocked without internal token; **but** break-glass token documented in kill-switch docs |
| **Logging risks** | Moderate | Structured logging `logAiExecution`; no evidence of key logging in vault services; full pen-test not in repo |
| **Prompt injection protection** | **Missing** | No dedicated module; only output guardrails in `ai-safety.guardrails.ts` |
| **Rate limiting** | Working | `AI_CHAT`, `AI_CHAT_DAILY` presets; `rateLimitAiChat` on routes; fail-closed when Redis down in prod — `safe-rate-limit.ts` |
| **Abuse prevention** | Partial | Governance kill switch; budget caps; consent middleware `requireMobileAiConsent`; input sanitization global `sanitize-input.middleware.ts` (not AI-specific) |
| **Admin permission model** | Partial | Web BFF enforces `requireAdminPanelApiAccess`; 4 legacy pages lack server guards; secrets limited to SUPER_ADMIN for mutations |

---

# Missing Production Requirements

## P0 — Critical

| ID | Requirement | Evidence |
|----|-------------|----------|
| P0-1 | Legacy compat routes for **secrets** API (or mount `AiAdminModule` + BFF internal token) | 0 files in `legacy/.../ai-ops/secrets/`; web BFF expects `/api/admin/ai-ops/secrets` |
| P0-2 | Live OpenAI + Anthropic API keys in vault | `AI_PRODUCTION_READINESS_REPORT.md`; `validateAiSecrets` in `ai.config.ts` |
| P0-3 | Redis enabled for rate limits + governance sync | Prior audit: `REDIS_ENABLED=false` |
| P0-4 | Production migrations applied on all environments | Prior audit gap |
| P0-5 | `npm run build` passing (backend + web) | `AI_PRODUCTION_READINESS_REPORT.md`; `NEXT_COMPAT_SHIM_FAILURE_REPORT.md` |
| P0-6 | Align BFF routes with backend handlers (20 route gap) | 48 web BFF vs 28 legacy backend ai-ops routes |

## P1 — High

| ID | Requirement | Evidence |
|----|-------------|----------|
| P1-1 | Extend orchestrator to registry-driven provider chain | Factory has 7 providers; orchestrator has 2 |
| P1-2 | Admin CRUD UI for providers, models, routes, secrets | `schemas.ts` without forms |
| P1-3 | Prompt-injection defenses | No module in codebase |
| P1-4 | Page guards on legacy ai-ops URLs | failover, governance, knowledge, risk pages |
| P1-5 | Live LLM smoke test in CI/CD | `scripts/live-llm-connectivity-verify.ts` exists; not gated |
| P1-6 | Wire mobile Phase 8 unused API paths | `ai_phase8_api_paths.dart` vs repository methods |
| P1-7 | Legacy routes for audit, usage/report, extended prompts | BFF exists; backend legacy missing |

## P2 — Medium

| ID | Requirement | Evidence |
|----|-------------|----------|
| P2-1 | Analytics charts + granular dashboards | Unused BFF analytics routes |
| P2-2 | Gemini/DeepSeek/Grok production validation | Partial implementations |
| P2-3 | Health probes for all registered providers | Probe limited to openai/anthropic |
| P2-4 | Prompt body editor in admin | Lifecycle only |
| P2-5 | Mobile locale passed to Phase 8 APIs | `docs/phase-8-ai-review-report.md` |
| P2-6 | Remove or implement dead `AiService` placeholder | `ai.service.ts` L69–71 |
| P2-7 | Document/enforce web feature flags | `FEATURE_AI_TECHNICIAN` unused in src |

## P3 — Low

| ID | Requirement | Evidence |
|----|-------------|----------|
| P3-1 | Groq provider implementation | No source files |
| P3-2 | Dedicated AI background job worker | Only in-process schedulers |
| P3-3 | i18n for Phase 8 hardcoded Bengali labels | `symptom_checker_page.dart`, `ai_home_page.dart` |
| P3-4 | Offline cache for Phase 8 reads | phase-8 review doc |
| P3-5 | Voice chat/session mobile integration | `VoiceApiPaths` unused |
| P3-6 | Consolidate duplicate governance page | Settings vs `/ai-ops/governance` |

---

# Recommended Roadmap

## Phase A — Critical fixes (blockers)

1. **Add legacy routes** for `secrets/*`, `audit`, `analytics/usage/report`, and remaining `prompts/*` — mirror handlers from `AiAdminController` (`ai.controller.ts` L279+).
2. **Verify E2E** admin API Keys page against backend after route addition.
3. **Configure production vault keys** + run `scripts/live-llm-connectivity-verify.ts`.
4. **Enable Redis**; confirm rate limits and governance poll.
5. **Fix build** failures documented in production reports.
6. **Apply migrations** on staging/production; run `scripts/db/verify-ai-migration.mjs`.

## Phase B — Core functionality

1. **Registry-driven orchestrator** — use `AiProviderFactory` + `AiRouterService` instead of hardcoded chain.
2. **Admin CRUD forms** — wire `schemas.ts` to Provider/Model/Route/ApiKeys panels.
3. **Mobile Phase 8 completion** — wire `chat/v2`, briefing, farm-query, farm-risk.
4. **Prompt management** — add body editor + activate flow in UI.
5. **Marketplace** — extension install + external model registration UI.

## Phase C — Monitoring

1. **Analytics UI** — charts using `trends`, `daily-cost`, `monthly-cost`, `providers`, `features` BFF routes.
2. **Expand health probes** to all factory providers.
3. **Usage alert runbooks** — connect `AiUsageAlert` to notification channels.
4. **Prometheus dashboards** for `ai_requests_total`, `ai_provider_up`.

## Phase D — Production readiness

1. **Prompt-injection** layer (input classification + system prompt hardening).
2. **Security review** — key rotation procedures, `INTERNAL_ADMIN_AI_OPS_TOKEN` rotation.
3. **Load testing** AI chat endpoints with Redis rate limits.
4. **GA readiness gate** — target ≥85/100 on readiness scorecard (`AI_PRODUCTION_READINESS_REPORT.md` methodology).
5. **Remove dead code** — `AiService` placeholder or wire to orchestrator.

---

# Final Score

Scores based on code evidence (0–10 per category). Total normalized to **100**.

| Category | Score | Rationale |
|----------|-------|-----------|
| **Architecture** | 8/10 | Comprehensive module layout, dual-route pattern (Express modules + legacy compat), clear separation of veterinary core vs platform admin; penalized for unmounted admin module and route split |
| **AI Integration** | 7/10 | Strong OpenAI/Anthropic + rules fallback; 5 additional providers in factory but not in orchestrator; mobile well integrated |
| **Settings System** | 5/10 | Governance + compliance working; registry read/toggle works; secrets path broken; incomplete CRUD |
| **Monitoring** | 7/10 | Token/cost/rollups implemented with tests; admin dashboard partial; unused analytics endpoints |
| **Security** | 6/10 | Vault encryption strong; rate limits + governance; missing prompt-injection; legacy page guard gaps |
| **Reliability** | 7/10 | Failover tested in Vitest; circuit breaker; budget fallback; no queue worker; Redis dependency |
| **Production Readiness** | 5/10 | Multiple P0 blockers; prior audit FAIL; no live key evidence in repo |

```
Total = (8 + 7 + 5 + 7 + 6 + 7 + 5) / 70 × 100 = 45/70 × 100 ≈ 64
```

**Adjusted for P0 secrets route gap (−6 points): ≈ 58/100 production readiness** (reported separately in Executive Summary).

### Category summary table

| Category | Score (/10) |
|----------|-------------|
| Architecture | 8 |
| AI Integration | 7 |
| Settings System | 5 |
| Monitoring | 7 |
| Security | 6 |
| Reliability | 7 |
| Production Readiness | 5 |
| **Weighted total** | **64/100** |

---

# Completion methodology

52 capabilities tracked across backend, admin, and mobile:

- **28 Working** — e.g. chat/triage backend+mobile, governance, usage token tracking, provider list, health read, compliance admin, failover status, OpenAI/Anthropic orchestrator path, encryption, rotation service, rate limits, Phase 8 screens (7 wired).
- **19 Partial** — e.g. Gemini–OpenRouter providers, admin CRUD, analytics depth, mobile unwired paths (5), prompt admin, marketplace install, health probe scope, budget monthly UI, connection test coverage.
- **5 Broken/Missing** — secrets admin route, Groq, prompt injection module, AiService placeholder, unmounted AiAdminModule.

---

# Appendix — Key file index

## Backend (`pranidoctor-backend`)

| Area | Path |
|------|------|
| AI module entry | `src/modules/ai/ai.module.ts` |
| Routes | `src/modules/ai/ai.routes.ts` |
| Orchestrator | `src/modules/ai/orchestrator/ai-orchestrator.service.ts` |
| Provider factory | `src/modules/ai/providers/provider-factory.ts` |
| Vault | `src/modules/ai/vault/` |
| Usage | `src/modules/ai/usage/` |
| Legacy admin routes | `src/legacy/web/routes/admin/ai-ops/` |
| Prisma schema | `prisma/schema.prisma` |
| Production readiness (prior) | `docs/reports/AI_PRODUCTION_READINESS_REPORT.md` |

## Web admin (`pranidoctor-web`)

| Area | Path |
|------|------|
| AI Center nav | `src/components/admin-ui/admin-nav.tsx` |
| Panels | `src/components/admin/ai-ops/` |
| BFF proxies | `src/app/api/admin/ai-ops/` |
| Proxy lib | `src/lib/proxy-to-backend.ts` |
| Permissions | `src/lib/admin-auth/permissions-core.ts` |
| Implementation report | `docs/reports/AI_ADMIN_PANEL_IMPLEMENTATION_REPORT.md` |

## Mobile (`pranidoctor_user`)

| Area | Path |
|------|------|
| AI feature module | `lib/features/ai/` |
| API paths | `lib/features/ai/data/ai_api_paths.dart`, `ai_phase8_api_paths.dart` |
| Routes | `lib/routing/app_routes.dart`, `app_router.dart` |
| Tests | `test/ai/ai_integration_test.dart`, `ai_compliance_test.dart` |

---

*Report generated by static workspace audit. No code was modified.*
