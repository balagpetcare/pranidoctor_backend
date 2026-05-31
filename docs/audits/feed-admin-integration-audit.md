# Feed Intelligence — Admin Integration Audit

**Date:** 2026-06-01  
**Auditor:** Principal QA Architect / Release Manager  
**Scope:** Feed Intelligence Ecosystem (F1–F6) vs Prani Doctor Admin Panel  
**Repos:** `pranidoctor-backend`, `pranidoctor-web`  

---

## Executive Summary

The **Feed Intelligence Ecosystem (F1–F6)** is implemented primarily as **backend services, Prisma models, and CLI seed scripts**. It is **not** fully controllable from the Admin Panel.

A separate, mature admin surface exists for **Phase 4 Livestock Feed Ecosystem** (`/admin/feed-ecosystem/*`) — operational catalog, vendors, inventory, and platform analytics. That surface must **not** be confused with Feed Intelligence admin.

**Final conclusion:** **ADMIN INTEGRATION PARTIAL**

| Layer | Feed Intelligence (F1–F6) | Phase 4 Feed Ecosystem |
|--------|---------------------------|-------------------------|
| Backend services | ✅ Implemented | ✅ Implemented |
| Admin HTTP APIs | ❌ Missing (VKL/AI) | ✅ Implemented |
| Admin UI | ❌ Missing (VKL/AI) | ✅ Implemented |
| Permissions | ❌ No `ai.feed.*` | ⚠️ Generic admin role only |
| Data ops | Scripts only | Admin seed + CRUD |

**Release implication:** Operators cannot create, review, publish, or monitor VKL feed knowledge, formulation runs, or advisor sessions without database/scripts access. Beta can proceed with engineering-run seeds; production editorial control requires admin integration (see implementation plan).

---

## Methodology

For each Feed Intelligence capability we verified:

1. **Backend** — service/module + Prisma models  
2. **API** — admin or mobile/AI routes exposed over HTTP  
3. **Admin UI** — Next.js pages, tables, forms under `/admin`  
4. **Permission** — dedicated capability in `ai-permissions` / web `ROLE_MATRIX`  
5. **Status** — `Backend Only` | `Admin Integrated` | `Partially Integrated` | `Missing`  

Sources: `pranidoctor-backend/src/modules/ai/feed-*`, legacy admin routes, `pranidoctor-web/src/app/admin`, `admin-nav.tsx`, `ai-ops/*`.

---

## 1. Admin Routes

### Phase 4 Feed Ecosystem (operational) — integrated

| Route (web proxy → backend) | Purpose |
|---------------------------|---------|
| `/api/admin/feed-items` | FeedItem CRUD |
| `/api/admin/feed-catalog` | Legacy Bangladesh catalog |
| `/api/admin/feed-categories` | Category meta (BN/EN labels) |
| `/api/admin/feed-nutrition` | FeedItem nutrition rows (read list) |
| `/api/admin/feed-inventory` | Farm inventory monitor |
| `/api/admin/feed-analytics` | Platform feed analytics |
| `/api/admin/vendors` | Feed vendors |
| `/api/admin/livestock-statistics` | Livestock stats |
| `/api/admin/recommendation-rules` | Rule-based recommendations |
| `/api/admin/feed-ecosystem/seed` | Phase 4 seed (items/vendors) |
| `/api/admin/feed-ecosystem/moderation` | FeedItem approval queue |

**Pages:** `/admin/feed-ecosystem/*`, `/admin/feed-catalog/*` (legacy redirects from `/admin/feed-items`).

### Feed Intelligence (F1–F6) — not integrated

| Planned (master plan) | Actual |
|----------------------|--------|
| `/api/admin/ai-ops/knowledge/feed/ingredients` | ❌ Not found |
| `/api/admin/ai-ops/knowledge/feed/nutrient-requirements` | ❌ Not found |
| `/api/admin/ai-ops/knowledge/feed/toxic-alerts` | ❌ Not found |
| `/api/admin/ai-ops/knowledge/feed/ration-templates` | ❌ Not found |
| `/api/admin/ai-ops/knowledge/feed/seasonal-calendar` | ❌ Not found |
| `/api/admin/ai/feed/sessions` | ❌ Not found (runtime only via `ai.controller`) |
| `/api/admin/ai/feed/formulation` | ❌ Not found |

**Finding:** No legacy or modular admin routes bind to `FeedKnowledgeService`, `FeedKnowledgeGovernanceService`, `FormulationEngineService`, or `FeedAdvisorVreOrchestratorService`.

---

## 2. Admin Menus

**File:** `pranidoctor-web/src/components/admin-ui/admin-nav.tsx`

| Menu group | Includes Feed Intelligence? |
|------------|----------------------------|
| `feed-ecosystem` | Phase 4 only (hub, items, vendors, analytics, moderation, legacy catalog) |
| `ai-ops` | Generic AI Control Center — no Feed Intelligence subsection |
| Knowledge / governance under AI | Legacy `AiKnowledgeEntry` — not VKL feed entities |

**Sub-nav:** `FEED_ECOSYSTEM_NAV` in `feed-ecosystem/options.ts` lists 11 Phase 4 sections — none for VKL ingredients, toxic alerts, or advisor ops.

**Finding:** No menu item for “Feed Intelligence”, “VKL Feed Knowledge”, or “Feed Advisor Ops”.

---

## 3. Admin Pages

### Present (Phase 4)

| Page | Component | Feed Intelligence? |
|------|-----------|-------------------|
| `/admin/feed-ecosystem` | `FeedEcosystemOverview` | No |
| `/admin/feed-ecosystem/items` | `FeedItemList`, `FeedItemForm` | No — `FeedItem` table |
| `/admin/feed-ecosystem/nutrition` | `FeedNutritionList` | **Partially** — operational nutrition, not `VkNutrientRequirement` |
| `/admin/feed-ecosystem/analytics` | `FeedAnalyticsPanel` | **Partially** — consumption/catalog stats, not AI feed metrics |
| `/admin/feed-ecosystem/seed` | `SeedManagementPanel` | **Partially** — Phase 4 seed only |
| `/admin/feed-ecosystem/moderation` | `ModerationQueuePanel` | No — `FeedItem` moderation, not VKL governance |
| `/admin/ai-ops/knowledge` | `KnowledgeList` | **Partially** — legacy entries; description says “Disease, vaccine, emergency” |
| `/admin/ai-ops/prompts` | `PromptList` | **Partially** — can edit `feed_advisor` prompt if present in DB |
| `/admin/ai-ops/governance` | `AiGovernancePanel` | No — kill switch; `feed_advisor` not in `AI_GOVERNANCE_FEATURES` |
| `/admin/settings` (vet disclaimer) | `VetDisclaimerAdminPanel` | **Partially** — `feedRation` disclaimer text only |

### Missing (Feed Intelligence)

- VKL feed ingredient editor (composition, BD pricing, antinutrients)  
- Nutrient requirement matrix editor (species × stage × breed)  
- Toxic feed alert editor + vet approval queue  
- Ration template editor  
- Seasonal feed calendar editor  
- Feed knowledge graph edge manager  
- Feed formulation request monitor  
- AI feed advisor session monitor / escalation inbox  
- Feed optimization performance dashboard  
- VKL feed corpus seed/import UI (BD ingredient + nutrient scripts)  
- Retrieval profile `feed-advisor-v1` tuning UI  
- Formulation engine limits UI (max ingredients, confidence thresholds)  

---

## 4. Admin Tables & 5. Admin Forms

| Entity / capability | Admin table | Admin form | Notes |
|---------------------|------------|------------|-------|
| `FeedItem` | ✅ `FeedItemList` | ✅ `FeedItemForm` | Phase 4 |
| `FeedCatalog` | ✅ `FeedCatalogList` | ✅ `FeedCatalogForm` | Legacy catalog |
| `FeedVendor` | ✅ `VendorList` | ✅ `VendorForm` | Phase 4 |
| `VkFeedIngredient` | ❌ | ❌ | F1/F2 |
| `VkNutrientRequirement` | ❌ | ❌ | F1/F3 |
| `VkToxicFeedAlert` | ❌ | ❌ | F1 |
| `VkRationTemplate` | ❌ | ❌ | F1/F4 |
| `VkSeasonalFeedCalendar` | ❌ | ❌ | F1 |
| `VkFeedKnowledgeGraphEdge` | ❌ | ❌ | F1 |
| `FeedFormulationRequest` | ❌ | ❌ | F4 |
| `AiFeedAdvisorSession` | ❌ | ❌ | F5 |
| `FeedKnowledgeGovernance` workflow | ❌ | ❌ | Service exists, no HTTP/UI |

---

## 6. Admin APIs (backend)

### Feed Intelligence — backend modules without admin routes

| Module | HTTP admin exposure |
|--------|---------------------|
| `feed-knowledge.service` | ❌ Internal / tests only |
| `feed-knowledge.repository` | ❌ |
| `feed-knowledge-governance.service` | ❌ |
| `nutritional-intelligence.service` | ❌ |
| `formulation-engine.service` | ❌ |
| `feed-advisor-orchestrator.service` | ❌ |
| `feed-advisor-vre-orchestrator.service` | ❌ |
| `feed-optimization.service` | ❌ In-memory maps; no persistence admin |

### Runtime (non-admin) APIs

| Endpoint area | Exposure |
|---------------|----------|
| `ai.controller` → `feedAdvisor` | Mobile/runtime via veterinary assistant registry (`feed_advisor` feature) |
| `KnowledgeRetrievalService` + `feed-advisor-v1` | Internal; profile in code registry only |

### Comparable pattern (medicine — integrated)

Medicine commercial intelligence has **dedicated** admin routes:

- `src/legacy/web/routes/admin/ai-ops/medicine/*` (generics, brands, companies, search, stats)  
- Capabilities: `ai.medicine.knowledge.write` (referenced in routes; note: not in slim `ai-permissions.ts` matrix — medicine routes use `assertAiAdminCan`)

**Feed Intelligence has no analogous `admin/ai-ops/feed/*` route tree.**

---

## 7. Admin Permissions

### Web (`permissions-core.ts`)

Capabilities: `ai.view`, `ai.manage`, `ai.secrets.manage`, `ai.analytics.export` — **no feed-specific keys**.

### Backend AI admin (`ai-permissions.ts`)

Capabilities: `ai.ops.view`, `ai.registry.manage`, `ai.settings.manage`, `ai.secrets.manage`, `ai.analytics.view`, `ai.analytics.export`, `ai.foundation.manage` — **no `ai.feed.*`**.

### Master plan (not implemented)

| Planned capability | Status |
|--------------------|--------|
| `ai.feed.knowledge.read` | ❌ Missing |
| `ai.feed.knowledge.write` | ❌ Missing |
| `ai.feed.toxic.publish` | ❌ Missing |
| `ai.feed.formulation.optimize` | ❌ Missing |
| `ai.feed.advisor.use` | ❌ Missing (customer runtime only) |
| `ai.feed.analytics.view` | ❌ Missing |

**Finding:** Feed Intelligence uses generic `ADMIN` / `ai.manage` where AI ops pages exist; no granular feed editorial or vet-toxic permissions.

---

## 8. Governance Screens

| Capability | Status | Detail |
|------------|--------|--------|
| VKL draft → submit → review → publish for feed entities | **Backend Only** | `FeedKnowledgeGovernanceService` |
| Editorial review queue (feed domain) | **Missing** | AI ops has `knowledge/review-queue` for **legacy** pipeline, not `VkKnowledgeVersion` feed types |
| Vet approval queue for toxic alerts | **Missing** | AI ops `knowledge/vet-queue` not wired to `VkToxicFeedAlert` |
| Feed-specific audit trail UI | **Missing** | `VkKnowledgeAuditEvent` not surfaced |
| Phase 4 FeedItem moderation | **Admin Integrated** | `/admin/feed-ecosystem/moderation` — different domain |

---

## 9. Analytics Screens

| Analytics type | Admin UI | API | Feed Intelligence? |
|----------------|----------|-----|-------------------|
| Platform feed consumption / catalog | ✅ `FeedAnalyticsPanel` | `GET /api/admin/feed-analytics` | No — operational |
| AI usage by feature (incl. feed?) | ✅ AI Ops analytics | `ai-ops/analytics/usage/*` | **Partially** — may include `feed_advisor` in usage logs if logged; no feed-specific dashboard |
| Formulation success rate | ❌ | ❌ | F4 metric from plan |
| Toxic alert recall / advisor CSAT | ❌ | ❌ | F5/F6 |
| Optimization performance (F6) | ❌ | ❌ | In-memory service only |

---

## 10. Dataset Management Screens

| Dataset | Management today | Admin UI |
|---------|------------------|----------|
| BD feed ingredients (F2) | `scripts/knowledge/feed/bd-feed-ingredient-seed.ts` | ❌ |
| BD nutrient requirements (F3) | `scripts/knowledge/feed/bd-nutrient-requirement-seed.ts` | ❌ |
| Phase 4 FeedItem seed | `adminRunPhase4FeedSeed` | ✅ `/admin/feed-ecosystem/seed` |
| Knowledge import (FEED_REFERENCE) | `knowledge-import` pipeline | **Partially** — AI ops imports exist; no feed-specific import wizard |
| Wave1 feed bundle (`feed.json`) | Scripts / wave1 deploy | ❌ |
| Link `FeedItem` ↔ `VkFeedIngredient` | Schema `feedItemId` | ❌ No admin linker UI |

---

## 11. Feed Advisor Configuration Screens

| Config item | Location | Admin UI |
|-------------|----------|----------|
| Prompt `feed_advisor` | `ai-prompt.service` default + DB | **Partially** — generic `/admin/ai-ops/prompts` |
| Retrieval profile `feed-advisor-v1` | `retrieval-profile.registry.ts` (code) | ❌ |
| Confidence calibration | `medical-confidence.calibration.ts` | ❌ |
| Assistant registry entry | `assistant-registry.ts` | ❌ |
| Feature kill switch | `AI_GOVERNANCE_FEATURES` | ❌ `feed_advisor` not listed |
| Safety thresholds (orchestrator) | Hardcoded in services | ❌ |
| BN disclaimers | `feed-knowledge.constants` + resolver | **Partially** — vet disclaimer panel for `feedRation` only |

---

## 12. Feed Formulation Configuration Screens

| Config item | Admin UI |
|-------------|----------|
| LP solver / max ingredients | ❌ Code: `FEED_FORMULATION_MAX_INGREDIENTS` |
| Nutrient constraint defaults | ❌ |
| Budget / cost basis rules | ❌ |
| Template fallback policy | ❌ |
| `FeedFormulationRequest` monitoring | ❌ |
| Formulation status / infeasible diagnostics | ❌ |

---

## Feature Matrix

| Feature | Backend | API | Admin UI | Permission | Status |
|---------|---------|-----|----------|------------|--------|
| **F1 — VKL feed entity schema** | ✅ Prisma + migration | ❌ Admin | ❌ | ❌ | Backend Only |
| **F1 — Feed knowledge graph edges** | ✅ `VkFeedKnowledgeGraphEdge` | ❌ | ❌ | ❌ | Backend Only |
| **F1 — Feed knowledge read service** | ✅ `FeedKnowledgeService` | ⚠️ Runtime/internal | ❌ | ❌ | Backend Only |
| **F1 — Feed knowledge governance** | ✅ `FeedKnowledgeGovernanceService` | ❌ | ❌ | ❌ | Backend Only |
| **F1 — Retrieval profile `feed-advisor-v1`** | ✅ Registry | ❌ Config API | ❌ | ❌ | Backend Only |
| **F1 — Structured fact types** | ✅ Constants | ❌ | ❌ | ❌ | Backend Only |
| **F2 — BD ingredient corpus** | ✅ Seed script | ❌ Admin | ❌ | ❌ | Backend Only |
| **F2 — Ingredient search (farmer)** | ✅ Service methods | ⚠️ Mobile/runtime | ❌ | ❌ | Backend Only |
| **F2 — FeedItem ↔ VKL link** | ✅ `feedItemId` FK | ❌ | ❌ | ❌ | Backend Only |
| **F3 — Nutrient requirements** | ✅ `NutritionalIntelligenceService` | ❌ | ❌ | ❌ | Backend Only |
| **F3 — Species/stage inference** | ✅ Service | ❌ | ❌ | ❌ | Backend Only |
| **F4 — LP formulation engine** | ✅ `FormulationEngineService` | ⚠️ No public admin API | ❌ | ❌ | Backend Only |
| **F4 — Formulation requests (DB)** | ✅ `FeedFormulationRequest` | ❌ | ❌ | ❌ | Backend Only |
| **F5 — AI feed advisor (standalone)** | ✅ Orchestrator | ⚠️ `ai.controller` | ❌ | ❌ | Backend Only |
| **F5 — AI feed advisor (VRE)** | ✅ VRE orchestrator | ⚠️ Not wired as default route | ❌ | ❌ | Backend Only |
| **F5 — Advisor sessions (DB)** | ✅ `AiFeedAdvisorSession` | ❌ | ❌ | ❌ | Backend Only |
| **F5 — Intent classification** | ✅ Service | ❌ | ❌ | ❌ | Backend Only |
| **F5 — Toxic check / escalation** | ✅ Service logic | ⚠️ Runtime | ❌ | ❌ | Backend Only |
| **F5 — Prompt `feed_advisor`** | ✅ | ✅ AI ops prompts | ✅ PromptList | ⚠️ `ai.manage` | **Partially Integrated** |
| **F6 — Optimization engine** | ✅ In-memory | ❌ | ❌ | ❌ | Backend Only |
| **F6 — Performance analytics** | ✅ Service | ❌ | ❌ | ❌ | Backend Only |
| **Cross — AI usage analytics** | ✅ `AiUsageLog` | ✅ AI ops | ✅ Generic panels | `ai.analytics.view` | **Partially Integrated** |
| **Cross — Knowledge import (FEED)** | ✅ Pipeline | ✅ `ai-ops/knowledge/imports` | ⚠️ No feed filter UI | `ai.manage` | **Partially Integrated** |
| **Cross — Legacy knowledge list** | ✅ `AiKnowledgeEntry` | ✅ | ✅ KnowledgeList | Admin role | **Partially Integrated** (not VKL feed tables) |
| **Cross — Vet disclaimer (feed ration)** | ✅ | ✅ settings | ✅ VetDisclaimerAdminPanel | Admin | **Partially Integrated** |
| **Phase 4 — FeedItem CRUD** | ✅ | ✅ | ✅ feed-ecosystem | Admin | **Admin Integrated** |
| **Phase 4 — Feed catalog** | ✅ | ✅ | ✅ feed-catalog | Admin | **Admin Integrated** |
| **Phase 4 — Vendors / inventory** | ✅ | ✅ | ✅ | Admin | **Admin Integrated** |
| **Phase 4 — Platform feed analytics** | ✅ | ✅ | ✅ | Admin | **Admin Integrated** |
| **Phase 4 — Seed / moderation** | ✅ | ✅ | ✅ | Admin | **Admin Integrated** |
| **Phase 4 — Operational nutrition list** | ✅ | ✅ | ✅ nutrition page | Admin | **Admin Integrated** (not F3 VKL) |

---

## Gap Summary

### Critical admin gaps (block operational control)

1. **No VKL feed knowledge CRUD** — ingredients, requirements, toxic alerts, templates, seasonal data.  
2. **No governance UI** — cannot submit/review/publish/retire feed knowledge from admin.  
3. **No dataset ops UI** — BD corpus depends on `tsx` scripts.  
4. **No formulation or advisor operations** — cannot inspect `FeedFormulationRequest` / `AiFeedAdvisorSession`.  
5. **No feed-specific permissions** — cannot delegate toxic publish vs ingredient edit.  

### Partial overlaps (risk of confusion)

- **“Feed nutrition” admin** manages `FeedItem.nutritionJson`, not `VkNutrientRequirement`.  
- **“Feed analytics” admin** shows platform consumption, not formulation/advisor KPIs.  
- **“Feed seed” admin** runs Phase 4 seeds, not VKL ingredient/requirement seeds.  
- **AI Knowledge list** manages legacy entries, not `vk_feed_ingredients` rows.  

---

## Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Editorial blind spot | **High** | Toxic alerts and nutrient data changed only via DB/scripts |
| Operator error | **High** | Confusion between Phase 4 feed admin and Feed Intelligence |
| Compliance | **Medium** | Audit/governance workflow not visible to admins |
| Production support | **Medium** | Cannot debug failed formulations or advisor sessions in UI |
| Config drift | **Medium** | Retrieval profile and thresholds only in code deploys |

---

## Recommendations

1. **Treat Phase 4 and Feed Intelligence as separate admin products** — rename/nav clarity until unified.  
2. **Prioritize P0 admin:** VKL ingredient + toxic alert + governance queues (mirror medicine admin).  
3. **Add P1:** Formulation/advisor ops consoles + VKL seed/import UI.  
4. **Add P2:** Retrieval profile + formulation config screens.  
5. **Implement `ai.feed.*` capabilities** before multi-role editorial rollout.  

**Detailed implementation plan:** `docs/plans/feed-admin-integration-plan.md`

---

## Final Conclusion

# ADMIN INTEGRATION PARTIAL

- **Phase 4 Feed Ecosystem:** Admin integration is **substantially complete** for operational livestock feed management.  
- **Feed Intelligence Ecosystem (F1–F6):** Admin integration is **largely missing**; capabilities are **backend-only** with **partial** overlap through generic AI ops (prompts, usage analytics, legacy knowledge) and Phase 4 screens that do not manage VKL feed intelligence entities.

**Score (Feed Intelligence admin coverage):** ~15/100  
**Score (combined feed-related admin):** ~55/100 (Phase 4 carries most weight)

---

**Audit completed:** 2026-06-01  
**Next step:** Execute `feed-admin-integration-plan.md` (planning only; not implemented in this audit)