# Feed Intelligence — Admin Integration Implementation Plan

> **Superseded by:** [`feed-admin-control-center.md`](./feed-admin-control-center.md) — authoritative master plan for Feed Intelligence Admin Control Center (FICC), including route/menu/API/page/analytics/governance design and phased rollout.  
> This file remains as a condensed historical checklist.

**Date:** 2026-06-01  
**Status:** Planning only (not implemented)  
**Depends on:** `docs/audits/feed-admin-integration-audit.md`  
**Goal:** Make Feed Intelligence Ecosystem (F1–F6) fully controllable from Admin Panel without redesigning core engines.

---

## Principles

1. **Mirror medicine admin pattern** — `admin/ai-ops/medicine/*` is the reference for domain-specific VKL/commercial admin.  
2. **Reuse VKL workflows** — Wire UI to `FeedKnowledgeGovernanceService` + existing `VkKnowledgeReview` / `VkKnowledgeApproval` tables.  
3. **Separate nav from Phase 4** — New sidebar group **“Feed Intelligence (AI)”** distinct from **“Feed & Livestock Ecosystem”**.  
4. **Do not break Phase 4** — Keep `/admin/feed-ecosystem/*` unchanged; add parallel routes under `/admin/feed-intelligence/*` or `/admin/ai-ops/feed/*`.  
5. **Permissions before GA** — Introduce `ai.feed.*` capabilities before multi-user editorial access.

---

## Target Architecture

```
Admin Panel
├── Feed & Livestock Ecosystem (existing Phase 4)
│   └── FeedItem, vendors, inventory, platform analytics
└── Feed Intelligence (NEW)
    ├── Knowledge (VKL FEED domain)
    │   ├── Ingredients
    │   ├── Nutrient requirements
    │   ├── Toxic alerts (+ vet queue)
    │   ├── Ration templates
    │   └── Seasonal calendar
    ├── Governance
    │   ├── Review queue
    │   ├── Vet approval queue
    │   └── Audit log
    ├── Operations
    │   ├── Formulation requests
    │   ├── Advisor sessions
    │   └── Escalations
    ├── Datasets
    │   ├── Import / seed
    │   └── FeedItem ↔ VKL linker
    └── Configuration
        ├── Advisor (prompt, profile, thresholds)
        └── Formulation (LP limits, fallbacks)
```

---

## Phase 0 — Foundations (1 week)

### 0.1 Permissions

**Backend** (`src/modules/ai/admin/ai-permissions.ts`):

| Capability | Roles (default) |
|------------|-----------------|
| `ai.feed.knowledge.read` | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.knowledge.write` | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.toxic.publish` | SUPER_ADMIN, VET, CVQ |
| `ai.feed.governance.review` | SUPER_ADMIN, ADMIN, DOMAIN_LEAD |
| `ai.feed.governance.vet` | SUPER_ADMIN, VET, CVQ |
| `ai.feed.ops.view` | SUPER_ADMIN, ADMIN |
| `ai.feed.analytics.view` | SUPER_ADMIN, ADMIN |
| `ai.feed.config.manage` | SUPER_ADMIN |

**Web** (`src/lib/admin-auth/permissions-core.ts`): Mirror keys; gate new pages.

### 0.2 Admin module layout (backend)

```
src/modules/ai/feed/admin/
├── feed-admin.schemas.ts          # Zod for all admin DTOs
├── feed-admin.permissions.ts      # assertFeedAdminCan()
├── feed-ingredient-admin.service.ts
├── feed-nutrient-admin.service.ts
├── feed-toxic-admin.service.ts
├── feed-template-admin.service.ts
├── feed-seasonal-admin.service.ts
├── feed-governance-admin.service.ts  # wraps FeedKnowledgeGovernanceService
├── feed-ops-admin.service.ts         # sessions + formulation requests
├── feed-analytics-admin.service.ts
└── index.ts
```

### 0.3 Legacy route registration

Register under `src/legacy/web/routes/admin/ai-ops/feed/` (consistent with medicine):

```
admin/ai-ops/feed/
├── ingredients/route.ts + [id]/route.ts + [id]/submit|publish|reject
├── nutrient-requirements/route.ts + [id]/...
├── toxic-alerts/route.ts + [id]/...
├── ration-templates/route.ts + [id]/...
├── seasonal-calendars/route.ts + [id]/...
├── graph-edges/route.ts
├── governance/review-queue/route.ts
├── governance/vet-queue/route.ts
├── governance/audit/route.ts
├── operations/formulations/route.ts + [id]/route.ts
├── operations/sessions/route.ts + [id]/route.ts
├── datasets/seed/route.ts
├── datasets/import/route.ts
├── config/advisor/route.ts
├── config/formulation/route.ts
└── analytics/overview/route.ts
```

### 0.4 Web proxy routes

Mirror each backend route under `pranidoctor-web/src/app/api/admin/ai-ops/feed/**` (auto-proxy pattern used elsewhere).

---

## Phase 1 — Knowledge CRUD (P0, 2–3 weeks)

### 1.1 Feed ingredients admin

| Layer | Deliverable |
|-------|-------------|
| API | `GET/POST /api/admin/ai-ops/feed/ingredients`, `GET/PATCH /api/admin/ai-ops/feed/ingredients/:id` |
| Service | List/filter by code, availability, publish status; create draft via governance service |
| UI | Table: code, names, CP/TDN, price, availability, version status |
| Form | Composition grid, antinutrients JSON editor, max inclusion, species restrictions, source attributions |
| Permission | `ai.feed.knowledge.write` |

**Acceptance:** Admin can create draft ingredient, submit for review, publish without running seed script.

### 1.2 Nutrient requirements admin

| Layer | Deliverable |
|-------|-------------|
| API | CRUD + lookup by species/stage/breed |
| UI | Matrix-style filter; form for min/max CP, TDN, ME, Ca, P, DM intake |
| Validation | Unique `(species, productionStage, breedCategory)` enforced in UI |

### 1.3 Toxic feed alerts admin (vet-gated)

| Layer | Deliverable |
|-------|-------------|
| API | CRUD; `POST .../vet-approve` requires `ai.feed.toxic.publish` |
| UI | High-risk badge; mandatory vet approval button |
| Integration | Surfaces in vet queue (Phase 2) |

### 1.4 Ration templates & seasonal calendar

| Layer | Deliverable |
|-------|-------------|
| API | CRUD for templates + monthly seasonal rows |
| UI | Template ingredient builder; seasonal ingredient pickers |

### 1.5 Graph edges (optional P0.5)

| API | `GET/POST/DELETE .../graph-edges` |
| UI | Simple edge table: type, from, to, weight |

---

## Phase 2 — Governance screens (P0, 1–2 weeks)

### 2.1 Review queue

- **API:** `GET /api/admin/ai-ops/feed/governance/review-queue` — wraps `getEntitiesPendingReview('FEED_INGREDIENT' | ...)`
- **UI:** `/admin/feed-intelligence/governance/review` — table with actions: open, approve, reject with reason
- **Reuse:** Same UX patterns as `ai-ops/knowledge/review-queue` but filtered to `VkKnowledgeDomain.FEED`

### 2.2 Vet approval queue

- **API:** Filter `clinicalRiskTier = HIGH` + `TOXIC_FEED_ALERT` / `ANTINUTRIENT_LIMIT`
- **UI:** `/admin/feed-intelligence/governance/vet` — vet role only
- **Backend:** Call `FeedKnowledgeGovernanceService.approveAndPublish` with vet credential check

### 2.3 Audit log

- **API:** `GET .../governance/audit?entityId=&versionId=`
- **UI:** Read-only timeline from `VkKnowledgeAuditEvent`

### 2.4 Publish / reject actions

Wire existing governance service methods to HTTP with actor ID from admin session.

---

## Phase 3 — Dataset management (P1, 1–2 weeks)

### 3.1 VKL seed panel

| Feature | Detail |
|---------|--------|
| UI | `/admin/feed-intelligence/datasets/seed` |
| Actions | Run BD ingredient seed, nutrient seed (dry-run + execute) |
| API | Wrap `bd-feed-ingredient-seed.ts` / `bd-nutrient-requirement-seed.ts` logic in admin service (not shell from UI) |
| Safety | Require `ai.feed.config.manage`; audit log each run |

### 3.2 Knowledge import wizard

- Reuse `KnowledgeImportPipelineService` with adapter `FEED_REFERENCE`
- UI: upload CSV → preview → import run status
- Link to existing `GET /api/admin/ai-ops/knowledge/imports`

### 3.3 FeedItem ↔ VKL linker

- **UI:** Search unpublished/published ingredients; assign `feedItemId` on `VkFeedIngredient`
- **API:** `PATCH .../ingredients/:id/link-feed-item`

---

## Phase 4 — Operations consoles (P1, 2 weeks)

### 4.1 Formulation request monitor

| Field | Source |
|-------|--------|
| customer, species, stage, status, cost, match score, packId | `FeedFormulationRequest` |
| Actions | View JSON formulation, citations; no re-run from admin v1 |

**UI:** `/admin/feed-intelligence/operations/formulations`

### 4.2 Advisor session monitor

| Field | Source |
|-------|--------|
| user, customer, state, toxicAlertTriggered, confidence, ingredientCodes | `AiFeedAdvisorSession` |
| Actions | View queryHistory, contextJson; link to formulation |

**UI:** `/admin/feed-intelligence/operations/sessions`

### 4.3 Escalation inbox (P1.5)

- Pull from `AiSafetyAuditLog` / advisor `escalationIds` when indexed
- Optional link to AI ops governance escalations panel

---

## Phase 5 — Configuration screens (P2, 1–2 weeks)

### 5.1 Feed advisor configuration

| Setting | Storage (proposed) |
|---------|------------------|
| Active prompt key | Existing `ai-ops/prompts` — deep link from config page |
| Retrieval profile overrides | `AiSettings` JSON or new `FeedAdvisorConfig` setting row |
| minConfidence, failClosed toxic | Editable with validation |
| Feature kill switch | Add `feed_advisor` to `AI_GOVERNANCE_FEATURES` |

**UI:** `/admin/feed-intelligence/config/advisor`

### 5.2 Formulation configuration

| Setting | Storage |
|---------|---------|
| `FEED_FORMULATION_MAX_INGREDIENTS` | Settings service |
| Default budget behavior | Settings |
| Infeasible → template fallback toggle | Settings |

**UI:** `/admin/feed-intelligence/config/formulation`

### 5.3 Read-only retrieval profile viewer

- Display effective `feed-advisor-v1` profile from registry + calibration (no code deploy to inspect)

---

## Phase 6 — Analytics screens (P2, 1 week)

### 6.1 Feed intelligence dashboard

**Metrics (from `AiUsageLog` + operational tables):**

- Formulation requests / success / infeasible rate  
- Advisor sessions by state  
- Toxic alert triggers  
- Top ingredient codes queried  
- Avg confidence score  
- Citation coverage proxy  

**API:** `GET /api/admin/ai-ops/feed/analytics/overview?periodDays=`

**UI:** `/admin/feed-intelligence/analytics` — stat cards + trends (reuse `AdminStatCard` pattern from `FeedAnalyticsPanel`)

### 6.2 Distinction from Phase 4 analytics

- Rename Phase 4 nav label to **“Platform feed analytics”**  
- New panel title **“AI feed intelligence analytics”**

---

## Phase 7 — Navigation & UX (parallel, 3 days)

### 7.1 Sidebar (`admin-nav.tsx`)

```ts
{
  id: 'feed-intelligence',
  labelEn: 'Feed Intelligence (AI)',
  labelBn: 'খাদ্য বুদ্ধিমত্তা (এআই)',
  children: [
    { href: '/admin/feed-intelligence', label: 'Overview' },
    { href: '/admin/feed-intelligence/ingredients', ... },
    { href: '/admin/feed-intelligence/nutrient-requirements', ... },
    { href: '/admin/feed-intelligence/toxic-alerts', ... },
    { href: '/admin/feed-intelligence/governance/review', ... },
    { href: '/admin/feed-intelligence/operations/formulations', ... },
    { href: '/admin/feed-intelligence/datasets/seed', ... },
    { href: '/admin/feed-intelligence/config/advisor', ... },
    { href: '/admin/feed-intelligence/analytics', ... },
  ],
}
```

### 7.2 Overview hub page

- Cards: published ingredient count, pending reviews, recent formulations, toxic alerts count  
- Links to Phase 4 ecosystem for operational feed catalog

### 7.3 SECTION_SPECS / visibility audit

- Ensure `feed-intelligence` group registered wherever `feed-ecosystem` visibility was fixed (see `AI_CENTER_NAVIGATION_AUDIT.md`)

---

## Phase 8 — F6 optimization persistence (P2, optional)

**Problem:** `FeedOptimizationService` uses in-memory `Map` — admin cannot see history.

**Options:**

1. **Minimal:** Persist `FeedPerformanceRecord` to new table `FeedPerformanceSnapshot`  
2. **Defer:** Hide optimization admin until persisted  

**If persisted:** Add admin list under `/admin/feed-intelligence/operations/performance`

---

## Implementation order & estimates

| Phase | Priority | Duration | Outcome |
|-------|----------|----------|---------|
| 0 Foundations | P0 | 1 week | Permissions, route skeleton |
| 1 Knowledge CRUD | P0 | 2–3 weeks | Ingredients + toxic + requirements editable |
| 2 Governance | P0 | 1–2 weeks | Review/vet/audit |
| 3 Datasets | P1 | 1–2 weeks | Seed/import without CLI |
| 4 Operations | P1 | 2 weeks | Formulation + session monitors |
| 5 Config | P2 | 1–2 weeks | Advisor + formulation settings |
| 6 Analytics | P2 | 1 week | Intelligence KPI dashboard |
| 7 Nav/UX | P0 | 3 days | Clear product separation |
| 8 Optimization DB | P3 | 1 week | Optional |

**Total estimate:** 8–12 weeks for full admin parity with medicine admin + plan scope.

---

## Testing strategy (when implemented)

| Test type | Scope |
|-----------|--------|
| API integration | Each admin route: auth, capability, CRUD round-trip |
| Governance | Draft → submit → reject → publish; vet-only toxic |
| UI e2e | Create ingredient → publish → appears in list |
| Regression | Phase 4 feed-ecosystem unchanged |
| Permission | DOMAIN_LEAD cannot vet-publish toxic |

---

## Success criteria

Admin integration is **COMPLETE** when:

1. ✅ All 7 VKL feed entity types manageable via admin (draft → publish)  
2. ✅ Toxic alerts require vet approval through admin UI  
3. ✅ BD corpus seed runnable from admin without SSH/scripts  
4. ✅ Formulation requests and advisor sessions visible for support  
5. ✅ `ai.feed.*` permissions enforced on all routes  
6. ✅ Dedicated nav group; no confusion with Phase 4 nutrition page  
7. ✅ Feed intelligence analytics distinct from platform feed analytics  

---

## Out of scope (this plan)

- Mobile farmer UI for feed advisor  
- Rewriting formulation or VRE engines  
- Merging Phase 4 `FeedItem` into VKL (linker only)  
- Real-time price feeds from external markets  

---

## References

- Audit: `docs/audits/feed-admin-integration-audit.md`  
- Feed Intelligence plan: `docs/plans/feed-intelligence-ecosystem.md`  
- Medicine admin routes: `src/legacy/web/routes/admin/ai-ops/medicine/`  
- Phase 4 admin report: `pranidoctor-web/docs/plans/phase-4-livestock-feed-ecosystem/ADMIN_PANEL_IMPLEMENTATION_REPORT.md`  
- Governance service: `src/modules/ai/feed-knowledge/feed-knowledge-governance.service.ts`  

---

**Document owner:** Principal Feed Intelligence Architect  
**Implementation:** Not started — awaiting product sign-off on P0 scope