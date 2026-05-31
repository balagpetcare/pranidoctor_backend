# Disease Intelligence Ecosystem — Production Readiness Audit

**Project:** Prani Doctor  
**Date:** 2026-06-01  
**Auditor role:** Principal QA / Security / RAG / Release  
**Scope:** Disease Intelligence Ecosystem (D1–D10)  
**Plan reference:** `docs/plans/disease-intelligence-master-plan.md` v2.0.0  
**Implementation report:** `docs/reports/disease-intelligence-implementation-report.md`  

---

## Executive summary

The Disease Intelligence Ecosystem (DIE) is **architecturally sound** and aligns with the established VKL → VRE → AI Router stack used by AI Doctor, Feed Intelligence, and Prescription Assistant. Core safety prohibitions (no autonomous diagnosis, prescription, or treatment plans) are **encoded in policy and enforced** by `ClinicalSafetyEngine` on the AI Doctor path.

**Production readiness score: 68 / 100 — BETA READY, NOT GA**

| Verdict | Recommendation |
|---------|----------------|
| **Staging / limited beta** | Approved after `migrate-legacy` + smoke tests |
| **General availability** | Blocked until corpus, vet RBAC, audit integration, and GSE gates |

**Fixes applied during this audit:**

- Vet APIs secured with `authenticateMobileCustomer` + IDOR guard (vetId must match session user).
- TypeScript `exactOptionalPropertyTypes` fixes across DIE Prisma writes (29 unit/regression tests still pass).
- DIE module: **0 TypeScript errors** in `modules/ai/disease-intelligence` (verified).
- **A1 / P0 #4:** Removed duplicate differential compute in `DiseaseReasoningOrchestratorService.analyze()` (AI Doctor owns VRE fusion).
- **A2 / P0 #5:** Added `DISEASE_REASONING` to `AI_GOVERNANCE_FEATURES` with kill-switch enforcement on analyze + graph-only differential when disabled.

---

## Verification matrix (automated)

| Check | Command | DIE-specific result | Monorepo gate |
|-------|---------|---------------------|---------------|
| Type check (AI) | `npm run typecheck:ai` | **0 DIE errors** | **FAIL** — pre-existing `medicine/*` TS errors (~40+) |
| Lint | `npx eslint src/modules/ai/disease-intelligence` | **FAIL** — 161 style/rule violations (mostly `explicit-function-return-type`, import order) | Non-blocking for runtime |
| Build | `npm run build` | **FAIL** — blocked by medicine + auth TS errors | Monorepo gate |
| Tests | `vitest run src/modules/ai/disease-intelligence src/modules/ai/ai-doctor` | **PASS** — 29 tests (3 files) | DIE + AI Doctor regression OK |

---

## Module verification (D1–D10)

| Module | Implemented | Production-ready | Notes |
|--------|-------------|------------------|-------|
| **D1 Disease Registry** | Yes | Partial | CRUD + search; `ACTIVE` requires `vkEntityId`; corpus likely empty until seed/migrate |
| **D2 Knowledge Graph** | Yes | Partial | `DiGraphNode` / `DiGraphEdge`; legacy migration script; no publish webhook from VKL |
| **D3 Symptom Intelligence** | Yes | Partial | `DiSymptomTaxonomy` + colloquial; falls back to `AiSymptomNode` if empty |
| **D4 Differential Diagnosis** | Yes | Partial | Graph + `differential-v1` VRE fusion; audit run persistence; respects `DISEASE_REASONING` kill switch |
| **D5 Species Intelligence** | Yes | Partial | Prevalence table; sparse data expected |
| **D6 Outbreak Intelligence** | Yes | Partial | Signals + subscriptions; legacy sync; no alert dispatcher job |
| **D7 Clinical Safety Engine** | Yes | Good | `die-v1` policy seeded; pre/post-LLM; treatment/Px/diagnosis language blocks |
| **D8 AI Disease Reasoning** | Yes | Partial | Wraps AI Doctor; case turns logged; safety pre-block skips LLM |
| **D9 Disease Analytics** | Yes | Partial | Event ingest + admin overview; no daily rollup cron wired |
| **D10 Vet Assist** | Yes | Partial | Queue/validate APIs; **no dedicated vet role RBAC** (mobile auth only) |

---

## 1. Architecture audit

### Strengths

- Clear module boundaries under `src/modules/ai/disease-intelligence/` mirroring Feed/Medicine patterns.
- **Three-layer constraint preserved:** VKL content → VRE (`disease-v1`, `differential-v1`, `outbreak-v1`) → `AiFoundationService` / router via AI Doctor.
- AI Doctor routes delegate to `DiseaseReasoningOrchestratorService` without breaking existing mobile paths.
- Legacy coexistence: `AiSymptomNode`, `RegionalOutbreakSignal`, and `AiAssistantMemory` cases remain readable.

### Concerns

| ID | Finding | Severity |
|----|---------|----------|
| A1 | **Duplicate differential computation** on analyze path | **Fixed** — D8 delegates to AI Doctor only | — |
| A2 | **No dedicated DIE kill switch** | **Fixed** — `DISEASE_REASONING` in governance + enforcement | — |
| A3 | `DiseaseKnowledgeGovernanceService` is minimal — no VKL editorial queue integration | Medium |
| A4 | Graph edge direction migration assumes Disease→Symptom; must match `loadGraphDifferentialsBySymptomCodes` query | Low |

**Architecture score: 82 / 100**

---

## 2. Security audit

### Strengths

- Mobile disease APIs use `authenticateMobileCustomer` + `requireMobileAiConsent` + rate limits (`rateLimitStrict`, `rateLimitAiChat`, `rateLimitSearch`).
- Admin routes use `requireInternalAdminAiOps`.
- `ClinicalSafetyEngine` blocks treatment intent, prescription-adjacent queries, autonomous diagnosis phrasing, and autonomous treatment patterns in post-LLM output.
- Case access scoped by `userId` in `getCaseSession`.

### Critical / high (mitigated or open)

| ID | Finding | Status | Severity |
|----|---------|--------|----------|
| S1 | Vet routes had **no authentication** | **Fixed** — mobile auth + vetId = session user | Was Critical |
| S2 | Vet IDOR via query `vetId` | **Fixed** — `vetId` must match authenticated user | Was High |
| S3 | `POST /disease/safety/evaluate` exposes safety engine without extra policy — could aid probing | Open | Low |
| S4 | `POST /disease/differential/compute` returns ranked differentials without case context — abuse for scraping | Open | Medium |
| S5 | No `AiAuditService` integration on DIE operations (unlike Feed Advisor) | Open | Medium |
| S6 | Admin `migrate-legacy` is powerful — acceptable behind admin token but must be ops-controlled | Open | Low |

**Security score: 78 / 100** (post S1/S2 fix; was ~55 pre-audit)

---

## 3. Governance audit

### Strengths

- Registry `ACTIVE` status requires `vkEntityId` binding (schema + service validation).
- Safety policies versioned in `di_safety_policies` with evaluation logs.

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| G1 | Registry create admin API can insert `DRAFT` without VKL workflow | High |
| G2 | Graph edges can be `PUBLISHED` without vet approval path | High |
| G3 | No integration with `KnowledgeGovernanceOrchestratorService` (6B.4) for disease entities | High |
| G4 | Auto-created registry rows during legacy migration lack VKL citations | Medium |
| G5 | No `VkKnowledgeAuditEvent` on registry merge/deprecate | Medium |

**Governance score: 52 / 100**

---

## 4. Knowledge quality audit

### Current state

- DIE depends on **Wave 1 MVC** + `POST /api/admin/disease/migrate-legacy` to populate registry/graph from `AiSymptomNode` / `AiKnowledgeEntry`.
- Without migration, `DiSymptomTaxonomy` may be empty → symptom API falls back to legacy graph.
- Registry search returns only `ACTIVE` rows — likely **low count** on fresh DB.

### Risks

| ID | Finding | Severity |
|----|---------|----------|
| K1 | Empty or thin corpus → VRE `corpusUnavailable` / low grounding (GSE gate failure) | Blocker for GA |
| K2 | Legacy migration creates registry from published entries without evidence metadata on graph edges | Medium |
| K3 | Alias / colloquial BN tables empty unless seeded | Medium |

**Knowledge quality score: 48 / 100** (data-dependent; architecture OK)

---

## 5. RAG quality audit

### Strengths

- Profiles registered in `retrieval-profile.registry.ts`:
  - `differential-v1` — **failClosed: true**, L2, strict grounding
  - `disease-v1` — moderate grounding for education
  - `outbreak-v1` — emergency/disease domains
- `DifferentialDiagnosisService` uses `differential-v1` before LLM narrative.
- AI Doctor retains `allDifferentialsHaveCitations` gate in orchestrator.

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| R1 | No DIE-specific GSE corpus (`disease-differential-g1-v1`) | High |
| R2 | No eval runner wired (`gse:disease` script missing) | High |
| R3 | `disease-v1` not used as primary AI Doctor profile (still `ai-doctor-v1`) | Low |
| R4 | Fusion weights (`DIE_FUSION_WEIGHTS`) not calibrated against golden set | Medium |

**RAG quality score: 74 / 100**

---

## 6. AI integration audit

### Strengths

- AI Doctor `createCase`, `submitIntake`, `analyze`, `escalate` → `DiseaseReasoningOrchestratorService`.
- Pre-LLM safety block prevents analyze LLM call when `blockLlm`.
- Post-LLM safety rewrites content on policy violation.
- Treatment intent routed to block before differential LLM (via safety + existing AI Doctor gates).

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| I1 | `submitIntake` does not run DIE safety (relies on AI Doctor only) | Medium |
| I2 | Duplicate VRE retrieval on analyze path | **Fixed** (see A1) | — |
| I3 | `DISEASE_INTELLIGENCE_FEATURE` not in usage analytics feature map | Low |
| I4 | No explicit router taskType override for DIE-only endpoints | Low |

**AI integration score: 80 / 100**

---

## 7. Analytics audit

### Strengths

- `di_analytics_events` with types: registry view, symptom resolve, differential compute, case analyze, safety block, etc.
- Admin `GET /disease/analytics/overview` aggregates 30-day metrics.
- `di_corpus_gap_ticket` created on unresolved symptom phrases.

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| N1 | `di_analytics_daily` rollup not scheduled | Medium |
| N2 | No vet override / escalation funnel metrics | Medium |
| N3 | No integration with AI Control Center dashboards | Medium |
| N4 | Differential precision@k not computed in production | High |

**Analytics score: 62 / 100**

---

## 8. Performance audit

### Strengths

- Indexed: registry status/category, alias, graph edge types, case userId, analytics eventType.
- Graph queries capped (`take: 100` neighbors, differential graph load bounded).

### Risks

| ID | Finding | Severity |
|----|---------|----------|
| P1 | `migrateSymptomGraphFromLegacy` O(n×m) nested loops — admin-only but slow on large DB | Medium |
| P2 | Analyze path: multiple VRE calls (AI Doctor pack + optional DIE differential endpoint) | Low |
| P3 | Colloquial search `contains` without trigram index (plan mentioned GIN) | Low |
| P4 | No caching on registry search | Low |

**Performance score: 70 / 100**

---

## 9. Multi-tenant isolation audit

### Strengths

- `di_case_sessions` filtered by `userId` on read.
- Outbreak subscriptions store `userId` / optional `customerId`.
- Registry/graph/knowledge are **platform-shared** (correct for VKL model).

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| T1 | `di_case_sessions.customerId` not enforced on queries (only userId) | Low |
| T2 | Vet queue not scoped by organization/clinic | Medium |
| T3 | Analytics events lack `customerId` dimension | Medium |
| T4 | Differential compute API has no tenant binding | Medium |

**Multi-tenant score: 72 / 100**

---

## 10. Auditability audit

### Strengths

- `di_safety_evaluation_logs` per decision with policy version + reason codes.
- `di_differential_runs` + candidates with scores and citations JSON.
- `di_case_turns` store retrieval pack id and safety action.

### Gaps

| ID | Finding | Severity |
|----|---------|----------|
| U1 | No `AiAuditService.write()` on DIE analyze/block (Feed Advisor pattern) | High |
| U2 | Vet sign-off not linked to immutable audit chain | Medium |
| U3 | Admin registry create lacks actor attribution | Medium |
| U4 | No correlation id across D8 turn + AI Doctor session in logs | Low |

**Auditability score: 58 / 100**

---

## Risk register

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R-01 | Empty disease corpus → unsafe user trust in empty differentials | High | High | Run migrate-legacy + Wave 2 seed; fail-closed UX |
| R-02 | Wrong differential from sparse graph | Medium | High | GSE eval + vet review queue |
| R-03 | Outbreak false positive alerts | Low | High | Official-source tier + minimum signal threshold |
| R-04 | Vet API abuse with stolen mobile session | Low | Medium | Dedicated vet RBAC + doctor app token |
| R-05 | Monorepo build blocked by medicine TS errors | High | Medium | Fix medicine module or split typecheck scope |
| R-06 | Duplicate LLM/VRE cost on analyze | Low | Low | **Mitigated** — duplicate compute removed |

---

## Production blockers (release gate)

| # | Blocker | Owner |
|---|---------|-------|
| B1 | **Knowledge corpus** — &lt;80 ACTIVE registry diseases with published VKL chunks | Knowledge ops |
| B2 | **GSE / golden set** — no `disease-differential-g1-v1` eval; grounding gate unverified | AI platform |
| B3 | **Monorepo typecheck:ai** fails (medicine module, not DIE) | Backend |
| B4 | **Vet RBAC** — mobile farmer auth used for vet endpoints | Product + backend |
| B5 | **AiAuditService** not wired for compliance parity | Backend |
| B6 | **Governance** — graph/registry publish without editorial workflow | Knowledge ops |

---

## Recommendations (prioritized)

### P0 — Before beta (1–2 weeks)

1. Run `POST /api/admin/disease/migrate-legacy` on staging; verify registry/graph counts.
2. Populate ≥80 ACTIVE diseases with VKL published versions (Wave 2 plan).
3. Add `AiAuditService` hooks on analyze, safety block, and escalation.
4. ~~Remove duplicate differential compute in `DiseaseReasoningOrchestratorService.analyze()`~~ **Done.**
5. ~~Add `DISEASE_REASONING` to `AI_GOVERNANCE_FEATURES` kill switch~~ **Done.**

### P1 — Before GA (3–6 weeks)

6. Implement proper **vet authentication** (doctor app JWT + `LICENSED_VET` scope).
7. Wire registry/graph publish to **6B.4 editorial governance**.
8. Add GSE corpus + `npm run gse:disease` with grounding ≥90 gate.
9. Schedule `DiAnalyticsDaily` rollup job.
10. Implement outbreak alert dispatcher (subscription → notification).
11. Fix medicine module TypeScript errors to unblock `npm run build`.

### P2 — Hardening

12. E2E tests: symptom → differential → analyze → block treatment query.
13. Trigram index on `di_disease_aliases.alias` and `di_symptom_colloquial.phrase`.
14. Disease Control Center web UI.
15. Calibrate `DIE_FUSION_WEIGHTS` from vet-confirmed outcomes.

---

## Production readiness scorecard

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Architecture | 15% | 82 | 12.3 |
| Security | 20% | 78 | 15.6 |
| Governance | 10% | 52 | 5.2 |
| Knowledge quality | 15% | 48 | 7.2 |
| RAG quality | 15% | 74 | 11.1 |
| AI integration | 10% | 80 | 8.0 |
| Analytics | 5% | 62 | 3.1 |
| Performance | 5% | 70 | 3.5 |
| Multi-tenant | 5% | 72 | 3.6 |
| Auditability | 5% | 58 | 2.9 |
| **Total** | **100%** | | **68.5 → 68** |

---

## Final deployment recommendation

### Staging

**Proceed.** Deploy backend with migration applied; run smoke tests:

- `GET /api/ai/disease/registry?species=CATTLE`
- `POST /api/ai/disease/differential/compute` with known symptom codes
- AI Doctor case create → intake → analyze with treatment query (expect block)
- `GET /api/admin/disease/analytics/overview`

### Limited beta (50–200 farmers)

**Proceed with conditions:**

- Feature flag or regional rollout only.
- Mandatory disclaimer on all DIE responses.
- Vet escalation staffed for escalated cases.
- Monitor `SAFETY_BLOCK` rate and corpus gap tickets daily.

### General availability

**Do not deploy** until blockers B1–B6 are resolved and GSE grounding ≥90 on disease corpora.

---

## Appendix — Files reviewed

| Area | Path |
|------|------|
| Module root | `src/modules/ai/disease-intelligence/` |
| Routes | `disease-intelligence.routes.ts` |
| AI Doctor integration | `ai-doctor-orchestrator.service.ts`, `ai.controller.ts` |
| VRE profiles | `knowledge-retrieval/profiles/retrieval-profile.registry.ts` |
| Schema | `prisma/schema.prisma` (DIE models) |
| Migration | `prisma/migrations/20260622120000_disease_intelligence_ecosystem/` |
| Tests | `disease-intelligence.test.ts`, `ai-doctor/*.test.ts` |

---

## Document control

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-06-01 | Initial production audit; vet auth fix; TS fixes |
| 1.0.1 | 2026-06-01 | Post-audit: duplicate VRE fix; `DISEASE_REASONING` kill switch |
