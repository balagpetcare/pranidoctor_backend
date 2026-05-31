# Feed Intelligence Admin Control Center — Master Implementation Plan

**Project:** Prani Doctor  
**Product:** Feed Intelligence Admin Control Center (FICC)  
**Role:** Principal Platform Architect  
**Date:** 2026-06-01  
**Status:** Phase 0–1 **implemented** + **GA blockers remediated** (2026-06-01)  
**API reference:** `docs/api/feed-admin-api.md`  
**GA remediation audit:** `docs/audits/feed-admin-ga-blocker-remediation.md`  
**Supersedes:** `docs/plans/feed-admin-integration-plan.md` (tactical checklist; this document is authoritative)  
**Depends on:**  
- `docs/audits/feed-admin-integration-audit.md`  
- `docs/plans/feed-intelligence-ecosystem.md` (F1–F6 runtime)  
- `docs/audits/feed-intelligence-production-audit.md`  

---

## 1. Mission & success criteria

### Mission

Deliver a dedicated **Feed Intelligence Admin Control Center** so that **every Feed Intelligence capability (F1–F6)** is **creatable, reviewable, publishable, configurable, observable, and auditable** from the Admin Panel — without shell access, raw SQL, or deploy-only configuration.

### Explicit non-goals

- Replacing **Phase 4 Feed & Livestock Ecosystem** admin (`/admin/feed-ecosystem/*`)  
- Rewriting formulation, VRE, or LP engines  
- Farmer/mobile UX (runtime APIs remain separate)  

### Success criteria (definition of “complete”)

| # | Criterion |
|---|-----------|
| 1 | All 7 VKL feed entity types manageable via admin (draft → publish → retire) |
| 2 | Toxic / antinutrient alerts require vet approval through admin UI |
| 3 | Nutrient requirement matrix editable with uniqueness validation |
| 4 | `FeedFormulationRequest` and `AiFeedAdvisorSession` visible for support/debug |
| 5 | Advisor prompt, retrieval profile knobs, and safety thresholds configurable without code deploy |
| 6 | VKL corpus seed/import runnable from admin with audit trail |
| 7 | Feed-specific analytics distinct from Phase 4 platform feed analytics |
| 8 | `ai.feed.*` capabilities enforced on every FICC route (backend + web) |
| 9 | All governance actions written to `VkKnowledgeAuditEvent` + admin-visible timeline |
| 10 | Zero breaking changes to existing Phase 4 routes and menus |

---

## 2. Architecture analysis (existing platform)

### 2.1 Admin architecture (web)

| Pattern | Location | FICC reuse |
|---------|----------|------------|
| App router pages | `pranidoctor-web/src/app/admin/(dashboard)/*` | New `/admin/feed-intelligence/*` tree |
| API BFF proxies | `pranidoctor-web/src/app/api/admin/**/route.ts` | Mirror `api/admin/ai-ops/feed/**` |
| Shared shell | `FeedEcosystemShell`, `AdminPageHeader`, tables | New `FeedIntelligenceShell` |
| Navigation | `admin-nav.tsx` section groups + `capability` gates | New `feed-intelligence` group |
| Auth guards | `ensureAdminCapability`, `ensureAiCenterAccess` | New `ensureFeedIntelligenceAccess(cap)` |
| Types | `src/types/feed-ecosystem.ts` | New `src/types/feed-intelligence-admin.ts` |

**Lesson from audit:** Phase 4 labels (“Feed nutrition”, “Feed analytics”, “Feed seed”) must not overlap FICC labels — use **“AI feed knowledge”**, **“Formulation ops”**, **“VKL corpus”**.

### 2.2 AI Ops architecture (backend + web)

| Layer | Responsibility | FICC placement |
|-------|----------------|----------------|
| `src/modules/ai/admin/` | `requireAiAdminActor`, `ai-permissions`, registry | Extend `AiAdminCapability` + feed matrix |
| `src/legacy/web/routes/admin/ai-ops/*` | Thin HTTP → module services | New `ai-ops/feed/*` subtree |
| `src/modules/ai/feed-*` | Runtime intelligence | New `src/modules/ai/feed/admin/*` facades |
| AI Control Center UI | `/admin/ai-ops/*` | FICC **sibling** under own nav (not buried in generic knowledge list) |

**Reference implementation:** Medicine Commercial Intelligence  
- Routes: `src/legacy/web/routes/admin/ai-ops/medicine/*`  
- Service: `MedicineAdminService` → registry services  
- Capabilities: `ai.medicine.knowledge.write`, `ai.medicine.company.manage` (used in routes; matrix extension required — same fix applies to feed)

### 2.3 Feed ecosystem modules (Phase 4) — boundary

| Module / route | Domain | FICC relationship |
|----------------|--------|-------------------|
| `admin/feed-items`, `feed-catalog` | Operational `FeedItem` / `FeedCatalog` | **Link only** (`VkFeedIngredient.feedItemId`) |
| `admin/feed-ecosystem/*` | Vendors, inventory, moderation | **No merge** — cross-link from FICC overview |
| `FeedKnowledgeService` | VKL read for AI | FICC admin **write** via governance |
| `FeedKnowledgeGovernanceService` | VKL lifecycle | FICC Phase 3 primary backend |

### 2.4 Permissions (current state)

| System | Feed-specific keys | Action |
|--------|-------------------|--------|
| `ai-permissions.ts` | None | Add `ai.feed.*` to `AiAdminCapability` |
| `permissions-core.ts` (web) | None | Add `ai.feed.*` to `ServiceInstanceAdminCapability` OR sub-guard via extended AI matrix |
| Master plan | `ai.feed.knowledge.read`, etc. | Implement as specified in §4 |

**Vet roles:** Extend `requireAiAdminActor` to allow `DOCTOR` / dedicated `VET` role where `ai.feed.toxic.publish` and `ai.feed.governance.vet` apply (mirror medicine vet-queue pattern).

### 2.5 Audit system (layered)

| Layer | Store | FICC usage |
|-------|-------|------------|
| VKL governance | `VkKnowledgeAuditEvent` | Primary editorial audit trail UI |
| AI safety | `AiSafetyAuditLog` via `AiAuditService` | Advisor toxic blocks, low-confidence escalations |
| Platform admin | `AuthAuditEvent` | Login/access (unchanged) |
| AI usage | `AiUsageLog` + rollups | Feed analytics Phase 6 |

**Standard:** Every mutating FICC API records `VkKnowledgeAuditEvent` (knowledge) or `AiSafetyAuditLog` (ops/config) with `actorId`, `action`, `detailJson`.

---

## 3. Product topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRANI DOCTOR ADMIN PANEL                              │
├──────────────────────────────┬──────────────────────────────────────────────┤
│  Feed & Livestock Ecosystem   │  Feed Intelligence Admin Control Center      │
│  (Phase 4 — EXISTING)         │  (FICC — NEW)                                │
│  /admin/feed-ecosystem/*      │  /admin/feed-intelligence/*                  │
│                               │                                              │
│  FeedItem, vendors, inventory │  VKL FEED knowledge + AI formulation/advisor │
│  Platform consumption stats   │  Governance, datasets, ops, analytics        │
└──────────────────────────────┴──────────────────────────────────────────────┘
         │                                      │
         │         feedItemId link              │
         └──────────────────────────────────────┘
```

**API namespace:** `/api/admin/ai-ops/feed/*` (backend) — grouped under AI Ops for auth consistency with medicine.  
**UI namespace:** `/admin/feed-intelligence/*` — clear product separation for operators.

---

## 4. Permissions design

### 4.1 Capability model

Extend backend `AiAdminCapability` and web capability union with:

| Capability | Purpose | Default roles |
|------------|---------|---------------|
| `ai.feed.view` | Enter FICC, read-only lists | SUPER_ADMIN, ADMIN, SUPPORT |
| `ai.feed.knowledge.read` | View VKL feed entities | SUPER_ADMIN, ADMIN, DOMAIN_LEAD*, SUPPORT |
| `ai.feed.knowledge.write` | Create/edit drafts | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.toxic.write` | Draft toxic/antinutrient entities | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.toxic.publish` | Vet approve/publish HIGH risk | SUPER_ADMIN, DOCTOR† |
| `ai.feed.governance.review` | Editorial approve/reject | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.governance.vet` | Vet queue actions | SUPER_ADMIN, DOCTOR† |
| `ai.feed.ops.view` | Formulation + session monitors | SUPER_ADMIN, ADMIN, SUPPORT |
| `ai.feed.ops.manage` | Re-run formulation (support), session abandon | SUPER_ADMIN, ADMIN |
| `ai.feed.analytics.view` | FICC dashboards | SUPER_ADMIN, ADMIN |
| `ai.feed.analytics.export` | CSV export | SUPER_ADMIN, ADMIN |
| `ai.feed.datasets.run` | Seed/import execute | SUPER_ADMIN |
| `ai.feed.config.manage` | Advisor + formulation settings | SUPER_ADMIN |
| `ai.feed.graph.manage` | Knowledge graph edges | SUPER_ADMIN, ADMIN |

\* Introduce `DOMAIN_LEAD` in admin role mapping if not present — else map to `ADMIN`.  
† `DOCTOR` with verified `DoctorProfile` for vet-gated actions (enforced in service, not role alone).

### 4.2 Guard functions

```typescript
// src/modules/ai/feed/admin/feed-admin.permissions.ts
assertFeedAdminCan(actor, 'ai.feed.knowledge.write')
requireFeedAdminCapability('ai.feed.toxic.publish') // + doctorProfile check
```

Web:

```typescript
// src/lib/admin-auth/feed-intelligence-guard.ts
ensureFeedIntelligenceAccess('ai.feed.knowledge.read')
```

### 4.3 Navigation gating

Each `admin-nav.tsx` child under `feed-intelligence` sets `capability: 'ai.feed.view'` (minimum) or finer-grained keys for write sections.

### 4.4 Permissions admin UI

Extend `PermissionsAdminPanel` with FICC capability rows (Bangla labels) so operators understand feed vs generic `ai.manage`.

---

## 5. Route design

### 5.1 Backend routes (`pranidoctor-backend`)

Base: `src/legacy/web/routes/admin/ai-ops/feed/`

All routes: `requireAiAdminActor()` + `assertFeedAdminCan()` + Zod validation + `actorContext()` for audit.

#### Knowledge — ingredients & toxic (Phase 1)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/ingredients` | `ai.feed.knowledge.read` |
| POST | `/ingredients` | `ai.feed.knowledge.write` |
| GET | `/ingredients/:entityId` | read |
| PATCH | `/ingredients/:entityId` | write (draft only) |
| POST | `/ingredients/:entityId/submit` | write |
| POST | `/ingredients/:entityId/publish` | `ai.feed.governance.review` |
| POST | `/ingredients/:entityId/reject` | review |
| POST | `/ingredients/:entityId/deprecate` | review |
| GET | `/toxic-alerts` | read |
| POST | `/toxic-alerts` | `ai.feed.toxic.write` |
| GET/PATCH | `/toxic-alerts/:entityId` | toxic.write / read |
| POST | `/toxic-alerts/:entityId/vet-approve` | `ai.feed.toxic.publish` |
| POST | `/toxic-alerts/:entityId/submit` | toxic.write |

#### Knowledge — nutrients (Phase 2)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/nutrient-requirements` | read |
| POST | `/nutrient-requirements` | write |
| GET/PATCH | `/nutrient-requirements/:entityId` | read/write |
| GET | `/nutrient-requirements/lookup` | read — query: species, stage, breed |
| POST | `.../submit|publish|reject` | governance |

#### Knowledge — templates, seasonal, graph (Phase 1/2 extension)

| Method | Path | Capability |
|--------|------|------------|
| CRUD | `/ration-templates`, `/ration-templates/:id` | knowledge.* |
| CRUD | `/seasonal-calendars`, `/seasonal-calendars/:id` | knowledge.* |
| GET/POST/DELETE | `/graph-edges` | `ai.feed.graph.manage` |
| PATCH | `/ingredients/:id/link-feed-item` | write — set `feedItemId` |

#### Governance (Phase 3)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/governance/review-queue` | `ai.feed.governance.review` |
| GET | `/governance/vet-queue` | `ai.feed.governance.vet` |
| GET | `/governance/audit` | read — filters: entityId, versionId, date |
| POST | `/governance/bulk-approve` | review (optional P1) |

#### Operations — formulation (Phase 4)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/operations/formulations` | `ai.feed.ops.view` |
| GET | `/operations/formulations/:id` | ops.view |
| POST | `/operations/formulations/:id/retry` | ops.manage (support re-optimize) |
| GET | `/operations/formulations/:id/citations` | ops.view |

#### Operations — advisor (Phase 5)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/operations/sessions` | ops.view |
| GET | `/operations/sessions/:id` | ops.view |
| POST | `/operations/sessions/:id/escalate` | ops.manage |
| GET | `/operations/escalations` | ops.view — join `AiEscalationRecord` + feed sessions |

#### Configuration (Phase 5)

| Method | Path | Capability |
|--------|------|------------|
| GET/PATCH | `/config/advisor` | `ai.feed.config.manage` |
| GET/PATCH | `/config/formulation` | config.manage |
| GET | `/config/retrieval-profile` | read — effective `feed-advisor-v1` resolved |

#### Analytics (Phase 6)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/analytics/overview` | `ai.feed.analytics.view` |
| GET | `/analytics/formulations` | analytics.view |
| GET | `/analytics/advisor` | analytics.view |
| GET | `/analytics/safety` | analytics.view |
| GET | `/analytics/export` | `ai.feed.analytics.export` |

#### Datasets (Phase 7)

| Method | Path | Capability |
|--------|------|------------|
| GET | `/datasets/seed/preview` | datasets.run |
| POST | `/datasets/seed/run` | datasets.run |
| GET | `/datasets/import/runs` | read |
| POST | `/datasets/import` | datasets.run — multipart CSV |
| GET | `/datasets/coverage` | read — corpus stats |

### 5.2 Web proxy routes (`pranidoctor-web`)

Mirror 1:1 under `src/app/api/admin/ai-ops/feed/**` using existing auto-proxy comment pattern (forward cookies/auth to backend).

### 5.3 UI routes (`pranidoctor-web`)

Base: `/admin/feed-intelligence`

| Path | Phase | Page |
|------|-------|------|
| `/` | 0 | Overview hub |
| `/ingredients` | 1 | Ingredient list |
| `/ingredients/new` | 1 | Create ingredient |
| `/ingredients/[entityId]` | 1 | Edit + version history |
| `/toxic-alerts` | 1 | Toxic alert list |
| `/toxic-alerts/new` | 1 | Create toxic alert |
| `/toxic-alerts/[entityId]` | 1 | Edit + vet actions |
| `/nutrient-requirements` | 2 | Requirement matrix |
| `/nutrient-requirements/new` | 2 | Create requirement |
| `/nutrient-requirements/[entityId]` | 2 | Edit |
| `/ration-templates` | 2 | Template list (P1) |
| `/seasonal-calendar` | 2 | Monthly calendar (P1) |
| `/graph` | 2 | Graph edges (P1) |
| `/governance/review` | 3 | Editorial queue |
| `/governance/vet` | 3 | Vet queue |
| `/governance/audit` | 3 | Audit explorer |
| `/operations/formulations` | 4 | Formulation monitor |
| `/operations/formulations/[id]` | 4 | Detail |
| `/operations/sessions` | 5 | Advisor sessions |
| `/operations/sessions/[id]` | 5 | Session detail |
| `/operations/escalations` | 5 | Escalation inbox |
| `/config/advisor` | 5 | Advisor config |
| `/config/formulation` | 4 | Formulation config |
| `/analytics` | 6 | Analytics dashboard |
| `/datasets/seed` | 7 | VKL seed panel |
| `/datasets/import` | 7 | Import wizard |
| `/datasets/linker` | 7 | FeedItem ↔ VKL linker |

---

## 6. Menu design

### 6.1 Primary sidebar (`admin-nav.tsx`)

New top-level group **after** `ai-ops`, **before** `feed-ecosystem`:

```typescript
{
  id: 'feed-intelligence',
  labelEn: 'Feed Intelligence (AI)',
  labelBn: 'খাদ্য বুদ্ধিমত্তা (এআই)',
  titleEn: 'VKL feed knowledge, formulation & advisor ops',
  icon: Brain, // or Sparkles — distinct from Leaf (Phase 4)
  capability: 'ai.feed.view',
  children: [
    { href: '/admin/feed-intelligence', labelBn: 'সারাংশ', icon: LayoutDashboard },
    { href: '/admin/feed-intelligence/ingredients', labelBn: 'উপাদান (VKL)', capability: 'ai.feed.knowledge.read' },
    { href: '/admin/feed-intelligence/toxic-alerts', labelBn: 'বিষাক্ত সতর্কতা', capability: 'ai.feed.knowledge.read' },
    { href: '/admin/feed-intelligence/nutrient-requirements', labelBn: 'পুষ্টি চাহিদা', capability: 'ai.feed.knowledge.read' },
    { href: '/admin/feed-intelligence/governance/review', labelBn: 'সম্পাদনা অনুমোদন', capability: 'ai.feed.governance.review' },
    { href: '/admin/feed-intelligence/governance/vet', labelBn: 'ভেট অনুমোদন', capability: 'ai.feed.governance.vet' },
    { href: '/admin/feed-intelligence/operations/formulations', labelBn: 'ফর্মুলেশন', capability: 'ai.feed.ops.view' },
    { href: '/admin/feed-intelligence/operations/sessions', labelBn: 'এআই উপদেষ্টা', capability: 'ai.feed.ops.view' },
    { href: '/admin/feed-intelligence/analytics', labelBn: 'এআই অ্যানালিটিক্স', capability: 'ai.feed.analytics.view' },
    { href: '/admin/feed-intelligence/datasets/seed', labelBn: 'ডেটাসেট / সিড', capability: 'ai.feed.datasets.run' },
    { href: '/admin/feed-intelligence/config/advisor', labelBn: 'কনফিগারেশন', capability: 'ai.feed.config.manage' },
  ],
}
```

### 6.2 In-section sub-nav (`FeedIntelligenceShell`)

Mirror `FEED_ECOSYSTEM_NAV` pattern:

| Key | Route |
|-----|-------|
| Knowledge | ingredients, toxic, nutrients, templates, seasonal |
| Governance | review, vet, audit |
| Operations | formulations, sessions, escalations |
| Analytics | analytics |
| Datasets | seed, import, linker |
| Config | advisor, formulation |

### 6.3 Cross-links (reduce confusion)

| From | Link | Label |
|------|------|-------|
| FICC overview | `/admin/feed-ecosystem` | “Operational feed catalog (Phase 4)” |
| Phase 4 hub | `/admin/feed-intelligence` | “AI feed knowledge (VKL)” |
| FICC ingredient detail | `/admin/feed-ecosystem/items/[id]/edit` | If `feedItemId` linked |

### 6.4 SECTION_SPECS / visibility

Register `feed-intelligence` in any `SECTION_SPECS` / dashboard visibility maps (per `AI_CENTER_NAVIGATION_AUDIT.md`) so SUPPORT/ADMIN roles see the group when permitted.

---

## 7. API design (module layer)

### 7.1 Backend module layout

```
src/modules/ai/feed/admin/
├── feed-admin.types.ts              # DTOs shared with web types
├── feed-admin.schemas.ts            # Zod — all request/response shapes
├── feed-admin.permissions.ts
├── feed-ingredient-admin.service.ts # → FeedKnowledgeGovernanceService + repository
├── feed-toxic-admin.service.ts
├── feed-nutrient-admin.service.ts
├── feed-template-admin.service.ts   # P1
├── feed-seasonal-admin.service.ts   # P1
├── feed-graph-admin.service.ts
├── feed-governance-admin.service.ts # queues, audit pagination
├── feed-formulation-admin.service.ts
├── feed-advisor-admin.service.ts
├── feed-config-admin.service.ts     # AiSettings / governance scopes
├── feed-analytics-admin.service.ts
├── feed-dataset-admin.service.ts    # seed + import orchestration
└── index.ts
```

**Design rule:** Admin services are **thin facades** — no duplicate business logic. They call:

- `FeedKnowledgeGovernanceService` for lifecycle  
- `FeedKnowledgeRepository` / `FeedKnowledgeService` for reads  
- `FormulationEngineService` for support retry  
- `getPrisma()` for ops tables (`FeedFormulationRequest`, `AiFeedAdvisorSession`)  
- `getKnowledgeImportPipelineService` for Phase 7 imports  
- `getAiUsageService` / raw `AiUsageLog` for analytics  

### 7.2 Standard response envelopes

```typescript
// List
{ items: T[]; total: number; limit: number; offset: number }

// Entity with governance
{
  entityId: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  status: VkVersionStatus;
  clinicalRiskTier: string;
  payload: FeedIngredientAdminDto; // entity-specific
  citations?: CitationSummary[];
  auditPreview?: AuditEventSummary[];
}
```

### 7.3 Error codes

| Code | When |
|------|------|
| `FEED_ADMIN_FORBIDDEN` | Missing capability |
| `FEED_ADMIN_VET_REQUIRED` | Toxic publish without vet profile |
| `FEED_ADMIN_INVALID_STATE` | Publish non-SUBMITTED version |
| `FEED_ADMIN_CONFLICT` | Duplicate species/stage/breed or ingredientCode |
| `FEED_ADMIN_NOT_FOUND` | Unknown entity |

---

## 8. Page design

### 8.1 Component library (`pranidoctor-web`)

```
src/components/admin/feed-intelligence/
├── FeedIntelligenceShell.tsx
├── FeedIntelligenceOverview.tsx
├── ingredients/
│   ├── IngredientList.tsx
│   ├── IngredientForm.tsx          # composition, BD pricing, antinutrients
│   └── IngredientVersionPanel.tsx
├── toxic/
│   ├── ToxicAlertList.tsx
│   ├── ToxicAlertForm.tsx
│   └── VetApproveBanner.tsx
├── nutrients/
│   ├── NutrientRequirementMatrix.tsx  # filter species × stage
│   └── NutrientRequirementForm.tsx
├── governance/
│   ├── ReviewQueueTable.tsx
│   ├── VetQueueTable.tsx
│   └── AuditTimeline.tsx
├── operations/
│   ├── FormulationList.tsx
│   ├── FormulationDetail.tsx         # JSON viewer, citations, status
│   ├── AdvisorSessionList.tsx
│   └── AdvisorSessionDetail.tsx
├── config/
│   ├── AdvisorConfigForm.tsx
│   └── FormulationConfigForm.tsx
├── analytics/
│   └── FeedIntelligenceAnalytics.tsx
└── datasets/
    ├── VkSeedPanel.tsx
    ├── ImportWizard.tsx
    └── FeedItemLinker.tsx
```

### 8.2 Page patterns (per phase)

#### Phase 0 — Overview

- Stat cards: published ingredients, pending reviews, open formulations (24h), toxic alerts count, advisor sessions (24h)  
- Quick actions (capability-gated): New ingredient, Review queue, Run seed (preview only)  
- Health strip: VRE profile id, last seed run, % ingredients with embeddings  

#### Phase 1 — Ingredients

**List columns:** code, name (BN), CP%, TDN%, price BDT/kg, availability, status, updatedAt  
**Filters:** status, availability, species, search (code/colloquial)  
**Form sections:** Identity, Composition (DM basis), BD context (price/seasonality), Restrictions, Sources, VKL narrative (body BN/EN)  
**Actions:** Save draft, Submit for review, View audit  

#### Phase 1 — Toxic alerts

**List:** substance, species count, vetRequired, status, risk tier (always HIGH)  
**Form:** thresholds, clinical signs BN/EN, emergency actions, related ingredient codes  
**Vet banner:** Approve & publish disabled until `ai.feed.toxic.publish` + doctor profile  

#### Phase 2 — Nutrient requirements

**Matrix view:** species × production stage grid with CP min/max indicators  
**Form:** breed category, weight range, DM intake, nutrient mins/maxes, production targets  
**Validation:** unique `(species, productionStage, breedCategory)` with inline error  

#### Phase 3 — Governance

**Review queue:** same UX as medicine editorial — row → detail drawer → approve/reject with reason  
**Vet queue:** filtered `TOXIC_FEED_ALERT` + `ANTINUTRIENT_LIMIT`, HIGH tier only  
**Audit explorer:** searchable timeline from `VkKnowledgeAuditEvent`  

#### Phase 4 — Formulations

**List:** customerId (masked), species, stage, status, cost/day, match score, createdAt  
**Detail:** formulationJson pretty-print, citationsJson, packId link, errorMessage for INFEASIBLE  
**Action:** Retry optimization (ops.manage) — creates new attempt, audit logged  

#### Phase 5 — Advisor

**Session list:** userId, species, state, toxicAlertTriggered, confidence, locale  
**Detail:** queryHistory timeline, ingredientCodesQueried, escalationIds, linked formulation  
**Config page:** prompt key selector (deep link to `/admin/ai-ops/prompts?key=feed_advisor`), min confidence sliders, fail-closed toggle, feature kill switch (`feed_advisor` in governance scopes)  

#### Phase 6 — Analytics

See §9.

#### Phase 7 — Datasets

**Seed panel:** preview counts vs target (150 ingredients), dry-run, execute with confirmation modal  
**Import wizard:** upload CSV → map columns → pipeline run status (reuse ai-ops import UX patterns)  
**Linker:** dual search FeedItem ↔ VkFeedIngredient, PATCH link  

---

## 9. Analytics design

### 9.1 Separation from Phase 4

| Dashboard | Path | Data source | Metrics |
|-----------|------|-------------|---------|
| Platform feed analytics | `/admin/feed-ecosystem/analytics` | `FeedAnalyticsCache`, consumption | Stock, cost, catalog |
| **FICC analytics** | `/admin/feed-intelligence/analytics` | `AiUsageLog`, formulation/session tables | AI intelligence KPIs |

### 9.2 FICC metrics (Phase 6)

**Overview cards (7/30/90 day selector):**

| Metric | Source | Target (from ecosystem plan) |
|--------|--------|------------------------------|
| Formulation requests | `FeedFormulationRequest` | — |
| Formulation success rate | status = COMPLETED / total | ≥ 85% |
| Infeasible rate | status = INFEASIBLE | monitor |
| Advisor sessions | `AiFeedAdvisorSession` | — |
| Avg confidence score | sessions.confidenceScore | — |
| Toxic alert triggers | toxicAlertTriggered = true | 100% recall monitoring |
| Top ingredient codes | ingredientCodesQueried[] | — |
| LLM calls (feed_advisor) | `AiUsageLog` feature filter | cost control |
| Citation coverage proxy | formulations with citationsJson | ≥ 95% |
| Escalation count | escalationIds / AiEscalationRecord | — |

**Charts:**

- Formulation volume trend (daily)  
- Advisor sessions by state (stacked)  
- Confidence distribution histogram  
- Ingredient query frequency (bar, top 20)  

**Safety panel:**

- Toxic BLOCK count (from `AiSafetyAuditLog` actions)  
- Fail-closed VRE failures  
- Low-confidence advisor responses  

### 9.3 Export

`GET /analytics/export?report=formulations|sessions|usage&periodDays=` → CSV stream, capability `ai.feed.analytics.export`.

### 9.4 Future (post-MVP)

- Farmer CSAT linkage when feedback persisted (F6 table)  
- Golden-set eval results embed (`feed-advisor-bn-g1-v1`)  

---

## 10. Governance design

### 10.1 State machine (VKL — all feed entity types)

```
DRAFT → SUBMITTED → PUBLISHED → DEPRECATED
              ↓
           (reject) → DRAFT
```

| Transition | Actor capability | Service method |
|------------|------------------|----------------|
| Create | knowledge.write / toxic.write | `create*Draft` |
| Submit | write | `submitForReview` |
| Approve & publish (LOW/MED) | governance.review | `approveAndPublish` |
| Approve & publish (HIGH) | toxic.publish + vet profile | `approveAndPublish` |
| Reject | governance.review | `rejectVersion` |
| Deprecate | governance.review | new `deprecateVersion` (wrap VKL) |

### 10.2 Risk tier policy (from `feed-knowledge.constants.ts`)

| Entity type | Tier | Vet required |
|-------------|------|--------------|
| FEED_INGREDIENT | LOW–MEDIUM | No |
| NUTRIENT_REQUIREMENT | MEDIUM | No |
| RATION_TEMPLATE | MEDIUM | No |
| TOXIC_FEED_ALERT | HIGH | **Yes** |
| ANTINUTRIENT_LIMIT | HIGH | **Yes** |
| SEASONAL_CALENDAR | LOW | No |
| FEEDING_GUIDELINE | LOW | No |

### 10.3 Queue design

**Editorial queue (`/governance/review`):**

- Filter: entityType, submittedAt, submitter  
- Sort: HIGH risk first, then oldest  
- Bulk actions: deferred to P1  

**Vet queue (`/governance/vet`):**

- Pre-filter: `clinicalRiskTier = HIGH` AND entityType IN toxic/antinutrient  
- Show: substance, speciesAffected, threshold, submitter, waiting days  
- Single action: Vet approve & publish (records `VkKnowledgeApproval` type VET_APPROVAL)  

### 10.4 Re-review policy (admin reminders)

Surface `publishedAt` + `FEED_INGREDIENT_RE_REVIEW_INTERVALS` in list views with “due for re-review” badge (P2).

### 10.5 Embedding pipeline hook

On publish: set `embeddingStatus = PENDING` on version, enqueue chunk+embed job (existing VRE pipeline). Admin shows embedding status column.

---

## 11. Implementation phases (detailed)

### Phase 0 — Permissions & Navigation (1 week) ✅ Implemented + GA hardened

**Delivered:** `ai.feed.view|manage|publish|audit` in `ai-permissions.ts` and web `permissions-core.ts`; nav item under AI Operations; `/admin/ai-ops/feed-intelligence` shell.

**Policy A (GA):** SUPPORT may use `ai.feed.view` and `ai.feed.audit` only. Panel login + `requireFeedAdmin` admit SUPPORT; other AI Ops routes remain `requireAiAdminActor` (ADMIN/SUPER_ADMIN only).

### Phase 0 (original checklist)

| Deliverable | Owner | Acceptance |
|-------------|-------|------------|
| Extend `AiAdminCapability` + ROLE_MATRIX | Backend | All `ai.feed.*` keys resolvable |
| Web capabilities + `feed-intelligence-guard.ts` | Web | Pages 403 without cap |
| `feed-admin.permissions.ts` + tests | Backend | Vet check unit tested |
| Sidebar group + `FeedIntelligenceShell` | Web | Nav visible for ADMIN |
| Overview page (read-only stats from Prisma counts) | Web | Hub loads |
| Route stubs returning 501 with correct auth | Backend | Contract frozen |

**Exit gate:** Operator can navigate FICC; unauthorized roles blocked.

---

### Phase 1 — Ingredient & Toxic Alert Management (2–3 weeks) ✅ Implemented + GA hardened

**Delivered:** Full CRUD + governance for `VkFeedIngredient` and `VkToxicFeedAlert`; admin UI lists/editors; audit + version history for ingredients; governance service aligned to Prisma VKL schema.

**GA fixes:** Prisma list filters before pagination (`feed-admin-list.query.ts`); integration tests for CRUD/workflows/audit (`feed-admin.integration.test.ts`).

### Phase 1 (original checklist)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedIngredientAdminService` + routes | Full CRUD + submit |
| `FeedToxicAdminService` + routes | Vet-gated publish |
| Ingredient list/form UI | Create MAIZE-class ingredient E2E |
| Toxic list/form UI | Toxic alert E2E with vet approval |
| Audit events on all mutations | Visible in audit API (Phase 3 UI can follow) |
| Link to Phase 4 FeedItem | PATCH link-feed-item |

**Exit gate:** Replace `bd-feed-ingredient-seed.ts` for routine edits (seed remains for bulk).

---

### Phase 2 — Nutrient Requirement Management (1.5–2 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| Nutrient admin service + routes | CRUD + lookup |
| Matrix + form UI | Unique constraint enforced |
| Optional: ration templates + seasonal CRUD | P1 if timeboxed |
| Optional: graph edges UI | P1 |

**Exit gate:** All cattle lactation requirements editable in admin.

---

### Phase 3 — Feed Governance Workflows (1.5–2 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedGovernanceAdminService` | Wraps governance service |
| Review + vet queue APIs | Filter FEED domain only |
| Audit pagination API | Timeline per entity |
| Review/Vet/Audit UI | Approve ingredient from queue |
| Reject with reason | Returns version to DRAFT |

**Exit gate:** No publish without queue action; toxic requires vet UI path.

---

### Phase 4 — Feed Formulation Management (2 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedFormulationAdminService` | List/filter/detail |
| Formulation list + detail UI | Shows INFEASIBLE errors |
| Config page (max ingredients, fallback toggle) | Settings persisted |
| Support retry endpoint | Re-runs engine, new audit |

**Exit gate:** Support can diagnose failed formulation from admin.

---

### Phase 5 — AI Feed Advisor Management (2 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedAdvisorAdminService` | Sessions + escalations |
| Session list/detail UI | queryHistory visible |
| Advisor config UI | Prompt link, thresholds, kill switch |
| Register `feed_advisor` in `AI_GOVERNANCE_FEATURES` | Kill switch works |
| Escalation inbox | Filter feed-related escalations |

**Exit gate:** Operator can disable feed advisor without deploy.

---

### Phase 6 — Feed Analytics & Monitoring (1–1.5 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedAnalyticsAdminService` | Overview + trends |
| Analytics dashboard UI | 7/30/90 selector |
| Export CSV | analytics.export cap |
| Distinct naming vs Phase 4 | No operator confusion in UAT |

**Exit gate:** Formulation success rate visible for leadership review.

---

### Phase 7 — Feed Dataset Governance (1.5–2 weeks)

| Deliverable | Acceptance |
|-------------|------------|
| `FeedDatasetAdminService` | Seed preview/run, import |
| Seed panel UI | Dry-run + audited execute |
| Import wizard | FEED_REFERENCE adapter |
| Coverage report | Ingredient count vs 150 target |
| FeedItem linker UI | Bi-directional link |

**Exit gate:** New environment bootstrap without CLI scripts.

---

## 12. Rollout plan

### 12.1 Environment strategy

| Stage | Audience | Feature flag | Data |
|-------|----------|--------------|------|
| **Alpha** | Engineering + 1 domain lead | `FICC_ENABLED=false` internal | Staging DB |
| **Beta** | 2–3 editorial users | Per-section flags | Production read, staging write |
| **GA** | All feed editors/vets | `FICC_ENABLED=true` | Production |

**Feature flags (recommended):**

- `ficc.knowledge.enabled`  
- `ficc.ops.enabled`  
- `ficc.datasets.seed.enabled`  

### 12.2 Migration & data

1. Run existing seed scripts once in production (baseline corpus).  
2. FICC go-live: all **new** edits through admin; scripts deprecated for routine ops.  
3. Backfill: script to create `VkKnowledgeEntity` envelopes for seed-created rows if missing (one-time).  

### 12.3 Training & documentation

| Audience | Material |
|----------|----------|
| Domain leads | FICC editorial SOP (BN) |
| Vets | Toxic approval SOP |
| Support | Formulation/session debug guide |
| Engineering | API contract in OpenAPI (append paths) |

### 12.4 Testing strategy

| Layer | Scope |
|-------|--------|
| Unit | Admin services, permission matrix, vet gate |
| Integration | Route round-trips with test DB |
| E2E | Playwright: create ingredient → submit → publish |
| Regression | Phase 4 feed-ecosystem smoke unchanged |
| Security | Cross-tenant isolation on formulation/session lists |

### 12.5 Timeline summary

| Phase | Duration | Cumulative |
|-------|----------|------------|
| 0 | 1 wk | 1 wk |
| 1 | 2–3 wk | 3–4 wk |
| 2 | 2 wk | 5–6 wk |
| 3 | 2 wk | 7–8 wk |
| 4 | 2 wk | 9–10 wk |
| 5 | 2 wk | 11–12 wk |
| 6 | 1.5 wk | 12–13 wk |
| 7 | 2 wk | 14–15 wk |

**Total:** ~14–15 weeks with 1 full-stack squad; **MVP (0–3 + 1–2):** ~6–7 weeks for editorial control.

### 12.6 Rollout checklist (GA)

- [ ] All `ai.feed.*` in permissions UI  
- [ ] UAT sign-off: toxic vet path  
- [ ] UAT sign-off: distinct analytics labels  
- [ ] Runbook: disable advisor via config  
- [ ] On-call: FICC error codes documented  
- [ ] OpenAPI / admin API docs published  

---

## 13. Dependencies & risks

| Risk | Mitigation |
|------|------------|
| Confusion with Phase 4 admin | Separate nav, labels, cross-links only |
| Medicine permission drift (`ai.medicine.*` not in matrix) | Fix medicine + feed in same permissions PR |
| `requireAiAdminActor` excludes DOCTOR | Add `requireFeedVetActor` for vet routes |
| Embedding lag after publish | Show status; async job id in UI |
| F6 optimization in-memory | Phase 6 analytics omits performance until persisted (Phase 8 optional) |
| Large ingredient CSV import | Chunked import + progress polling |

---

## 14. References

| Document / code | Purpose |
|-----------------|---------|
| `docs/audits/feed-admin-integration-audit.md` | Gap analysis |
| `docs/plans/feed-intelligence-ecosystem.md` | F1–F6 runtime |
| `src/modules/ai/feed-knowledge/feed-knowledge-governance.service.ts` | Governance backend |
| `src/legacy/web/routes/admin/ai-ops/medicine/*` | Route pattern reference |
| `src/components/admin/feed-ecosystem/*` | UI pattern reference |
| `src/modules/ai/knowledge-retrieval/profiles/retrieval-profile.registry.ts` | `feed-advisor-v1` |

---

**Document owner:** Principal Platform Architect  
**Next action:** Kick off Phase 2 (nutrient requirements, formulation ops) per roadmap below.  
**Implementation status:** Not started