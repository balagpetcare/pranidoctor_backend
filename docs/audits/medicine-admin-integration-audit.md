# Medicine Intelligence — Admin Integration Audit

**Date:** 2026-06-01  
**Auditor:** Principal QA Architect / Release Manager  
**Scope:** Medicine Commercial Intelligence Ecosystem (M1–M7) vs Prani Doctor Admin Panel  
**Repos:** `pranidoctor-backend`, `pranidoctor-web`, `pranidoctor_user` (mobile runtime only)

**Related docs:** `docs/plans/medicine-intelligence-audit.md` (runtime/M1–M7 readiness), `docs/plans/feed-admin-control-center.md` (reference admin pattern)

---

## Executive Summary

**Medicine Commercial Intelligence (M1–M7)** is **substantially implemented in the backend**: Prisma models, domain services under `src/modules/ai/medicine/`, **24 legacy admin HTTP routes** at `/api/admin/ai-ops/medicine/*`, and mobile/runtime prescription APIs at `/api/ai/prescription/*`.

**Admin Panel integration in `pranidoctor-web` is absent:** no pages, menus, API BFF proxies, `ai.medicine.*` web permissions, or governance/analytics screens. Operators cannot manage companies, generics, brands, contracts, or medicine analytics without direct API/DB access.

**Final conclusion:** **MEDICINE ADMIN PARTIAL**

| Layer | Medicine Intelligence (M1–M7) |
|--------|-------------------------------|
| Backend services | ✅ Implemented (`src/modules/ai/medicine/`) |
| Prisma / migration | ✅ `20260621120000_medicine_commercial_intelligence_m1` |
| Admin HTTP APIs | ✅ 24 legacy routes under `ai-ops/medicine/*` |
| Admin UI (`pranidoctor-web`) | ❌ Missing |
| Web BFF proxies | ❌ Missing |
| Web permissions (`ai.medicine.*`) | ❌ Missing |
| UVKG sync (internal ops) | ✅ `POST /api/internal-admin-ai-ops/uvkg/sync/medicine` (not cookie BFF) |

**Score (medicine admin coverage):** ~42/100 — backend APIs and capability matrix exist; operator UI and web permission parity are zero. Company CRUD is **broken at runtime** until `ai.medicine.company.manage` is added to `AiAdminCapability` / `ROLE_MATRIX`.

**Release implication:** Commercial ops, vet knowledge stewards, and support cannot run medicine intelligence from the admin panel. Prescription AI remains available to mobile users; **commercial contract and registry control requires API clients or engineering**.

**Next step (planning only):** `docs/plans/medicine-admin-control-center.md`

---

## Methodology

For each Medicine Intelligence capability we verified:

1. **Backend** — service/module + Prisma models  
2. **API** — admin, internal-ops, or customer/AI routes  
3. **Admin UI** — Next.js pages, components, proxies under `pranidoctor-web`  
4. **Permission** — `ai-permissions.ts` (backend) and `permissions-core.ts` (web)  
5. **Status** — `Admin Integrated` | `Partial` | `Backend Only` | `Missing`

Sources: `pranidoctor-backend/src/modules/ai/medicine/`, `src/legacy/web/routes/admin/ai-ops/medicine/`, `pranidoctor-web/src/app/admin`, `admin-nav.tsx`, feed-intelligence reference implementation.

---

## 1. Medicine Knowledge Architecture (M1)

### Backend

| Component | Location | Status |
|-----------|----------|--------|
| Prisma models | `VetCompany`, `MedicineGeneric`, `MedicineBrand`, `VkMedicineKnowledgeGraphEdge`, contract/analytics tables | ✅ |
| Registry services | `company-registry`, `generic-registry`, `brand-registry` | ✅ |
| Knowledge service / repo | `medicine-knowledge.service.ts`, `medicine-knowledge.repository.ts` | ✅ |
| Therapeutic classification | `therapeutic-classification.service.ts` | ✅ |
| VKL link | `MedicineGeneric.knowledgeEntryId` → `AiKnowledgeEntry` | ✅ |
| Seeds | `scripts/knowledge/medicine/bd-company-seed.ts`, `import-existing-medicines.ts` | Scripts only |

### Admin APIs

| Method | Path | Capability |
|--------|------|------------|
| GET | `/api/admin/ai-ops/medicine/stats` | `ai.ops.view` |
| GET | `/api/admin/ai-ops/medicine/search` | `ai.ops.view` |
| GET/POST | `/api/admin/ai-ops/medicine/companies` | GET: `ai.ops.view`; POST: `ai.medicine.company.manage` ⚠️ |
| GET/PUT | `/api/admin/ai-ops/medicine/companies/:id` | `ai.medicine.company.manage` ⚠️ |
| POST/DELETE | `/api/admin/ai-ops/medicine/companies/:id/verify` | `ai.medicine.company.manage` ⚠️ |
| GET/POST | `/api/admin/ai-ops/medicine/generics` | GET: `ai.ops.view`; POST: `ai.medicine.knowledge.write` |
| GET/PUT | `/api/admin/ai-ops/medicine/generics/:id` | read via GET `ai.ops.view`; write: `ai.medicine.knowledge.write` |
| GET/POST | `/api/admin/ai-ops/medicine/brands` | same pattern |
| GET/PUT | `/api/admin/ai-ops/medicine/brands/:id` | same pattern |
| GET | `/api/admin/ai-ops/medicine/mappings` | `ai.medicine.knowledge.read` |
| POST | `/api/admin/ai-ops/medicine/mappings/sync` | `ai.medicine.knowledge.write` |

⚠️ **`ai.medicine.company.manage` is used in route handlers but is not defined in `AiAdminCapability` or `ROLE_MATRIX`** (`src/modules/ai/admin/ai-permissions.ts`). `assertAiAdminCan` always returns 403 for company POST/PUT/verify.

### Admin UI

**None.** No list/detail editors for companies, generics, or brands.

---

## 2. Medicine Commercial Intelligence (M2–M4)

### Backend

| Component | Location |
|-----------|----------|
| Contract lifecycle | `contracts/contract.service.ts` (DRAFT → ACTIVE/PAUSED/…) |
| Contract evaluation | `contract-evaluation.engine.ts` |
| Ranking / conflict | `ranking.engine.ts`, `conflict-resolution.engine.ts` |
| Generic↔brand mapping | `mapping/generic-brand-mapping.service.ts` |
| Audit trail | `MedicineContractAudit`, `contract-audit.service.ts` |

### Admin APIs

| Method | Path | Capability |
|--------|------|------------|
| GET/POST | `/api/admin/ai-ops/medicine/contracts` | read: `ai.medicine.contracts.read`; write: `ai.medicine.contracts.write` |
| GET/PUT | `/api/admin/ai-ops/medicine/contracts/:id` | read/write |
| POST | `/api/admin/ai-ops/medicine/contracts/:id/activate` | `ai.medicine.contracts.write` |
| POST | `/api/admin/ai-ops/medicine/contracts/:id/pause` | `ai.medicine.contracts.write` |
| GET | `/api/admin/ai-ops/medicine/contracts/:id/audit` | `ai.medicine.contracts.read` |
| GET/POST | `/api/admin/ai-ops/medicine/contracts/:id/brands` | read/write |
| DELETE | `/api/admin/ai-ops/medicine/contracts/:id/brands/:brandId` | write |

**Gap:** `ContractService.approve()` exists in service layer; **no admin route** for explicit approve (only activate).

### Admin UI

**None.** No contract editor, sponsor dashboard, or brand-boost management UI.

---

## 3. Medicine Knowledge Graph

### Backend

| Layer | Detail |
|-------|--------|
| Legacy edges | `VkMedicineKnowledgeGraphEdge` — `BRAND_OF_GENERIC`, `MANUFACTURED_BY`, `SPONSORED_BY`, `SUBSTITUTES_FOR`, `CONTRAINDICATED_WITH`, `INTERACTS_WITH`, etc. |
| UVKG | `VkKnowledgeLink` with `MEDICINE_GENERIC` / `MEDICINE_BRAND`; dual-write via `uvkg-dual-write.service.ts` |
| Sync | `GraphSyncService.syncFromMedicineGraph()` |
| Wave seed | `scripts/knowledge/uvkg-wave/wave2-medicine.ts` |

### APIs

| Method | Path | Admin BFF? |
|--------|------|------------|
| POST | `/api/internal-admin-ai-ops/uvkg/sync/medicine` | Internal token only |
| POST | `/api/internal-admin-ai-ops/uvkg/sync` | All domains |
| POST | `/api/internal-admin-ai-ops/uvkg/populate` | Includes medicine contraindications |
| GET | `/api/internal-admin-ai-ops/uvkg/drift` | `medicineLegacyCount` |
| GET | `/api/internal-admin-ai-ops/uvkg/neighbors` | Medicine anchors in phase-5 validation |

**No** `/api/admin/ai-ops/medicine/graph/*` routes. Graph ops are internal-ops or scripts.

### Admin UI

**None.** No edge browser, sync trigger, or drift dashboard in web admin (UVKG may be reachable only via generic AI foundation tools if any).

---

## 4. Medicine RAG Integration

### Backend

| Component | Status |
|-----------|--------|
| Shared RAG domain `MEDICINE` | ✅ `knowledge-retrieval.types.ts` |
| Profile `prescription-v1` | ✅ `domainPriority` includes `MEDICINE` |
| `MedicineKnowledgeRetrievalService` | ✅ Wraps RAG + M1 registry enrichment |
| Prescription lookup engine | ✅ `medicine-lookup.engine.ts` — lexical `AiKnowledgeEntry` `contentType: MEDICINE` |
| M1 entities in vector index | ⚠️ Partial — relies on VKL corpus/chunking; M1 rows not a separate admin-indexed corpus |
| `MedicineAiRouterService` | ⚠️ **Backend Only** — not bound to HTTP |
| `getEnhancedMedicineRecommendation` | ⚠️ Defined on orchestrator; limited HTTP exposure |

### Admin APIs

**No** medicine-specific RAG admin. Generic knowledge admin: `/api/admin/ai-ops/knowledge` (legacy `AiKnowledgeEntry`, not M1 CRUD).

### Admin UI

**Partial (generic only):** `/admin/ai-ops/knowledge` — legacy knowledge list, not medicine registry or retrieval profile knobs.

---

## 5. Medicine AI Advisor

### Backend (runtime)

| Surface | Path | Notes |
|---------|------|-------|
| Prescription sessions | `POST/GET /api/ai/prescription/sessions*` | Mobile/customer |
| Analyze / lookup / interactions / withdrawal | `/api/ai/prescription/sessions/:id/*` | |
| Assistant alias | `POST /api/ai/assistants/prescription` | |
| M1 integration | `prescription-integration.service.ts` → orchestrator | ✅ Wired |
| Vet recommendations | `vet-recommendation.service.ts` | Safety-first ranking |
| Admin preview | `POST /api/admin/ai-ops/medicine/recommendations/preview` | `ai.medicine.recommendations.view` |

**No** `/api/ai/medicine/*` domain API (contrast: `/api/ai/disease/*`).

### Admin UI

**None** for recommendation preview, session ops, or prescription assistant config. Generic `/admin/ai-ops/prompts` may edit prescription prompts if keys exist in DB (**Partial**).

`/admin/prescriptions` is a **stub** (`AdminModuleUnavailable`) — clinical prescriptions module, not Medicine Intelligence.

---

## 6. Medicine Analytics

### Backend

| Service | Data |
|---------|------|
| `RecommendationAnalyticsService` | `MedicineRecommendationLog` |
| `ContractAnalyticsService` | Contract spend, brand effectiveness |

### Admin APIs

| Method | Path |
|--------|------|
| GET | `/api/admin/ai-ops/medicine/analytics/summary` |
| GET | `/api/admin/ai-ops/medicine/analytics/recommendations` |
| GET | `/api/admin/ai-ops/medicine/analytics/contracts` |
| GET | `/api/admin/ai-ops/medicine/analytics/contracts/:id` |
| GET | `/api/admin/ai-ops/medicine/analytics/sponsor/:companyId` |

All require `ai.medicine.analytics.view`.

**No** medicine feature slice in platform `ai-ops/analytics/usage/*` (generic AI cost/usage only).

### Admin UI

**None.** No sponsor dashboard, recommendation funnel charts, or contract performance panels.

---

## 7. Medicine Governance

### Backend

| Mechanism | Location | Admin route? |
|-----------|----------|--------------|
| Commercial bias caps | `governance/commercial-bias-prevention.service.ts` | ❌ Config API |
| Comprehensive safety | `safety/comprehensive-safety.engine.ts` | ❌ |
| Company verification | verify/unverify routes | ✅ API (broken cap — see §1) |
| Contract lifecycle | activate/pause + audit GET | ✅ API |
| VKL editorial (UVKG links) | Shared `VkKnowledgeLink` statuses | Internal UVKG only |
| Feed-style submit/publish/reject | — | **Missing** for M1 entities |

M1 uses **direct PUT** on generics/brands — no draft → vet review → publish workflow like Feed Intelligence ingredients.

### Admin UI

**None** for medicine-specific governance queues, bias thresholds, or audit timelines.

---

## 8. Admin Routes Inventory (Backend)

**Route files:** 24 under `src/legacy/web/routes/admin/ai-ops/medicine/`

**Auth:** `requireAiAdminActor()` (admin session / BFF cookie when called through web proxy — **no proxy exists today**).

**Capabilities in matrix:** `ai.medicine.knowledge.read|write`, `contracts.read|write`, `recommendations.view`, `analytics.view` — **not** `company.manage`.

---

## 9. Admin Menus (`pranidoctor-web`)

**File:** `src/components/admin-ui/admin-nav.tsx`

| Item | Medicine? |
|------|-----------|
| AI Center → Feed Intelligence | Feed only (`/admin/ai-ops/feed-intelligence`, `ai.feed.view`) |
| Medicine Intelligence | **Missing** |
| Commercial contracts | **Missing** |

**Sections:** `admin-nav-sections.ts` — no `medicine-intelligence` section.

---

## 10. Admin Pages (`pranidoctor-web`)

| Page | Route | Medicine Intelligence? |
|------|-------|------------------------|
| Feed Intelligence hub + editors | `/admin/ai-ops/feed-intelligence/*` | Reference pattern — **not replicated** |
| AI Ops knowledge / governance / analytics | `/admin/ai-ops/*` | Generic only |
| Prescriptions stub | `/admin/prescriptions` | No |
| Billing medicine cost | `/admin/billing` | Operational billing, not M1 |
| Mobile inventory proxy | `api/mobile/inventory/medicine` | Farmer inventory, not admin M1 |

**Glob `*medicine*` under `pranidoctor-web`:** 0 admin intelligence files.

---

## 11. API BFF Proxies (`pranidoctor-web`)

| Expected | Actual |
|----------|--------|
| `src/app/api/admin/ai-ops/medicine/**` | ❌ **0 files** |
| Feed reference | ✅ `src/app/api/admin/ai-ops/feed/**` |

Without BFF proxies, browser admin cannot call medicine APIs through same-origin cookies even if pages were added.

---

## 12. Permissions

### Backend (`ai-permissions.ts`)

| Capability | SUPER_ADMIN | ADMIN | SUPPORT |
|------------|-------------|-------|---------|
| `ai.medicine.knowledge.read` | ✅ | ✅ | ❌ |
| `ai.medicine.knowledge.write` | ✅ | ✅ | ❌ |
| `ai.medicine.contracts.read` | ✅ | ✅ | ❌ |
| `ai.medicine.contracts.write` | ✅ | ✅ | ❌ |
| `ai.medicine.recommendations.view` | ✅ | ✅ | ❌ |
| `ai.medicine.analytics.view` | ✅ | ✅ | ❌ |
| `ai.medicine.company.manage` | ❌ **not in type/matrix** | ❌ | ❌ |

### Web (`permissions-core.ts`)

| Capability | Defined? |
|------------|----------|
| `ai.medicine.*` | ❌ **None** |
| `ai.feed.*` | ✅ (feed admin integrated) |

**No** `medicine-intelligence-guard.ts` (feed has `feed-intelligence-guard.ts`).

---

## 13. Comparison: Feed Intelligence Admin vs Medicine

| Feature | Feed Intelligence (web) | Medicine Intelligence |
|---------|---------------------------|------------------------|
| Admin pages | ✅ 7 pages under `ai-ops/feed-intelligence` | ❌ |
| Sidebar entry | ✅ AI Center | ❌ |
| BFF proxies | ✅ `api/admin/ai-ops/feed/*` | ❌ |
| Web capabilities | ✅ `ai.feed.view|manage|publish|audit` | ❌ |
| Backend admin routes | ✅ `ai-ops/feed/*` | ✅ `ai-ops/medicine/*` (24) |
| Editorial workflow UI | ✅ submit/publish/reject | ❌ (direct CRUD API only) |
| Governance screens | ✅ audit + workflow on entities | ❌ |

**Irony:** `feed-admin-control-center.md` cites medicine admin routes as the **reference backend pattern** — medicine backend exists, but **web was never built**.

---

## 14. Mobile App (`pranidoctor_user`)

Prescription and medicine lookup are **customer/runtime** concerns. No medicine commercial admin in Flutter app. Out of scope for admin integration except as API consumers of `/api/ai/prescription/*`.

---

## Feature Matrix

| Feature | Backend | API | Admin UI | Permission | Status |
|---------|---------|-----|----------|------------|--------|
| **M1 — Company registry (BD pharma)** | ✅ | ✅ Admin | ❌ | ⚠️ `company.manage` missing from matrix | **Partial** |
| **M1 — Generic registry** | ✅ | ✅ Admin | ❌ | ✅ `knowledge.read/write` (backend) | **Backend Only** |
| **M1 — Brand registry (MRP/availability)** | ✅ | ✅ Admin | ❌ | ✅ backend | **Backend Only** |
| **M1 — Unified search / stats** | ✅ | ✅ Admin | ❌ | `ai.ops.view` | **Backend Only** |
| **M1 — Generic↔brand mappings** | ✅ | ✅ Admin | ❌ | ✅ backend | **Backend Only** |
| **M1 — Mapping sync (VKL import)** | ✅ | ✅ POST sync | ❌ | ✅ backend | **Backend Only** |
| **M2 — Company verification workflow** | ✅ | ✅ verify routes | ❌ | ⚠️ broken cap | **Partial** |
| **M3 — Knowledge graph edges (legacy)** | ✅ | ❌ Admin graph API | ❌ | ❌ | **Backend Only** |
| **M3 — UVKG medicine sync** | ✅ | ✅ Internal ops | ❌ | `ai.foundation.manage` (typical) | **Backend Only** |
| **M4 — Commercial contracts CRUD** | ✅ | ✅ Admin | ❌ | ✅ backend | **Backend Only** |
| **M4 — Contract activate/pause** | ✅ | ✅ Admin | ❌ | ✅ backend | **Backend Only** |
| **M4 — Contract brand boosts** | ✅ | ✅ Admin | ❌ | ✅ backend | **Backend Only** |
| **M4 — Contract audit trail** | ✅ | ✅ GET audit | ❌ | ✅ backend | **Backend Only** |
| **M4 — Contract approve (service)** | ✅ | ❌ HTTP | ❌ | — | **Missing** (route) |
| **M5 — Ranking / conflict engines** | ✅ | ⚠️ preview only | ❌ | `recommendations.view` | **Backend Only** |
| **M5 — Recommendation analytics** | ✅ | ✅ Admin analytics | ❌ | `analytics.view` | **Backend Only** |
| **M6 — Conflict resolution** | ✅ | Runtime | ❌ | — | **Backend Only** |
| **M7 — Vet recommendation layer** | ✅ | preview + prescription | ❌ | partial | **Backend Only** |
| **M7 — Prescription AI (mobile)** | ✅ | ✅ `/api/ai/prescription/*` | N/A (mobile) | customer auth | **Admin Integrated** (runtime, not panel) |
| **M7 — Prescription ↔ M1 bridge** | ✅ | Runtime | ❌ | — | **Backend Only** |
| **RAG — Domain MEDICINE** | ✅ | Runtime | ❌ | — | **Backend Only** |
| **RAG — Medicine retrieval wrapper** | ✅ | Runtime | ❌ | — | **Backend Only** |
| **RAG — Medicine AI router** | ✅ | ❌ | ❌ | — | **Backend Only** |
| **RAG — Legacy AiKnowledgeEntry admin** | ✅ | ✅ | ✅ `/admin/ai-ops/knowledge` | `ai.manage` | **Partial** |
| **Governance — Commercial bias prevention** | ✅ | ❌ | ❌ | — | **Backend Only** |
| **Governance — Safety engine** | ✅ | Runtime | ❌ | — | **Backend Only** |
| **Governance — Editorial workflow (M1)** | ❌ | ❌ | ❌ | — | **Missing** |
| **Governance — UVKG link lifecycle** | ✅ | Internal ops | ❌ | foundation | **Backend Only** |
| **Analytics — Medicine summary/recs/contracts** | ✅ | ✅ Admin | ❌ | `analytics.view` | **Backend Only** |
| **Analytics — Sponsor by company** | ✅ | ✅ Admin | ❌ | `analytics.view` | **Backend Only** |
| **Analytics — Platform AI usage (medicine dim)** | ⚠️ Generic logs | ✅ AI ops usage | ✅ generic | `ai.analytics.view` | **Partial** |
| **Seeds — BD companies / import** | ✅ Scripts | ❌ Admin | ❌ | — | **Backend Only** |
| **Cross — Inventory medicine (farm)** | ✅ | Mobile | ❌ | — | **Backend Only** (different domain) |

---

## Gap Summary

### Critical (block operator control from admin panel)

1. **Zero `pranidoctor-web` pages** for medicine intelligence.  
2. **Zero BFF proxies** — cannot use admin cookie session from browser.  
3. **Zero `ai.medicine.*` in web `permissions-core.ts`** — nav and guards impossible without extension.  
4. **`ai.medicine.company.manage` not in backend matrix** — company write/verify APIs always 403.  

### High (functional / compliance)

5. **No governance UI** — no editorial queue, bias threshold config, or contract approval screen.  
6. **No analytics dashboards** — sponsor and recommendation metrics API-only.  
7. **No graph/sync UI** — UVKG medicine sync is internal-ops only.  
8. **No RAG/profile admin** for medicine-specific retrieval tuning.  

### Medium (parity with feed / prescription ops)

9. **No recommendation preview UI** (API exists).  
10. **No prescription session ops console** for support (contrast planned feed advisor ops).  
11. **No bulk import UI** — seeds remain CLI.  

---

## Risks

| Risk | Severity | Description |
|------|----------|-------------|
| Commercial ops blind spot | **High** | Contracts and boosts editable only via raw API/SQL |
| Permission false sense | **High** | Routes reference `company.manage` that always denies |
| Confusion with clinical prescriptions | **Medium** | `/admin/prescriptions` stub vs medicine commercial admin |
| UVKG drift | **Medium** | No admin visibility into legacy vs unified medicine graph |
| Support burden | **Medium** | Cannot preview rankings or debug prescription+M1 in panel |

---

## Recommendations

1. **Classify Medicine Intelligence as its own admin product** under AI Center (mirror Feed Intelligence).  
2. **Fix P0 backend:** add `ai.medicine.company.manage` to `AiAdminCapability` and `ROLE_MATRIX`.  
3. **Implement web:** BFF proxies + pages + `ai.medicine.*` in `permissions-core.ts` (see control center plan).  
4. **Do not merge** with farm inventory medicine (`/api/mobile/inventory/medicine`) or billing `medicineCost`.  
5. **Optional P2:** editorial workflow for generics (if regulatory need); graph/sync UI under UVKG or medicine hub.  

---

## Final Conclusion

# MEDICINE ADMIN PARTIAL

- **Backend (Medicine Commercial Intelligence):** Admin HTTP surface is **largely present** (24 routes, domain services, analytics APIs). Company management is **Partial** due to permission matrix bug.  
- **Admin Panel (`pranidoctor-web`):** **Missing** — no integrated UI, proxies, menus, or web permissions.  
- **End-to-end operator admin:** **Not complete** — status is **not** `MEDICINE ADMIN COMPLETE`.

**Score (medicine admin coverage):** ~42/100  
**Score (backend-only medicine admin API):** ~78/100  
**Score (web admin):** 0/100  

---

**Audit completed:** 2026-06-01  
**Implementation plan (not executed):** `docs/plans/medicine-admin-control-center.md`
