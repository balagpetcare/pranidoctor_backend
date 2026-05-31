# Phase 6B.2 — Knowledge Import Pipeline Verification Report

**Project:** Prani Doctor  
**Role:** Principal Data Quality Auditor  
**Date:** 2026-05-31  
**Scope:** `src/modules/ai/knowledge-import/`, Prisma KIP models, migration `20260614120000_ai_phase6b2_knowledge_import_pipeline`, admin Express routes  
**Reference plan:** `docs/plans/phase-6b2-knowledge-import-pipeline.md`  
**Depends on:** Phase 6B.1 VKF (`docs/reports/phase-6b1-knowledge-foundation-verification.md`)

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **PASS WITH CONDITIONS** |
| **Production readiness (CSV sync import path)** | **Yes** — controlled admin rollout via internal token |
| **Production readiness (full async multi-format pipeline)** | **No** — BullMQ workers, PDF/HTML adapters, web UI pending |
| **TypeScript (`npm run typecheck:ai`)** | **0 errors** |
| **Unit tests (`npx vitest run src/modules/ai`)** | **321 passed** (47 files) |
| **Import module tests** | **12 passed** (4 files) |

Phase 6B.2 delivers a queue-aware, auditable Knowledge Import Pipeline (KIP) that ingests CSV reference rows through validation, normalization, deduplication, VKF version creation, and approval routing. Core data-quality gates (license, locale, domain, clinical completeness, dose-conflict quarantine) are enforced. Sync mode runs the full pipeline inline for admin API calls; async worker consumption remains a follow-up.

**Weighted readiness score: 3.9 / 5** — suitable for controlled CSV pilot imports into VKF drafts; not yet the production-scale multi-format ingestion platform described in the architecture plan.

---

## Methodology

1. **Import path audit** — Source registry → extract → validate → normalize → dedup → version → route  
2. **Deduplication matrix** — Intra-batch, slug collision, supersede, merge, conflict quarantine  
3. **Versioning integrity** — VKF entity/version/citation writes, dry-run semantics, immutability handoff  
4. **Retry & failure analysis** — Job repository, exponential backoff, run terminal states, error capture  
5. **Audit completeness** — All 11 `KIP_AUDIT_EVENTS` emission and persistence  
6. **Automated verification** — `npm run typecheck:ai`, `npx vitest run src/modules/ai`  
7. **Safe remediation** — Non-breaking fixes applied during this audit (see § Remediation applied)

---

## Validation matrix

| Domain | Status | Score | Evidence |
|--------|--------|-------|----------|
| Imports (CSV sync path) | **PASS** | 4/5 | Registry profiles, CSV adapter, orchestrator stages, run stats |
| Deduplication | **PASS** | 4/5 | Intra-batch skip, slug lookup, dose-conflict quarantine, supersede |
| Versioning | **PASS** | 4/5 | CREATE_NEW + SUPERSEDE/MERGE → new VKF draft; citations attached |
| Retry behavior | **PASS WITH CONDITIONS** | 3/5 | Exponential backoff + audit on retry; workers not wired to orchestrator |
| Failure handling | **PASS** | 4/5 | Validation quarantine, PARTIAL/FAILED run status, pipeline error capture |
| Audit logs | **PASS** | 4/5 | All KIP events persisted; VKF dual-write for version/routing events |

---

## 1. Imports

### Source registry

| Check | Result |
|-------|--------|
| Seven source family profiles defined | ✅ |
| Profile resolves from `AiKnowledgeSource.sourceClass` | ✅ |
| License gate blocks expired/denied sources | ✅ |
| Document lineage optional (`documentId`) | ✅ |
| Change detection skips unchanged sections on re-import | ✅ |

### Pipeline stages

```
INTAKE → EXTRACTING → EXTRACT_COMPLETE → VALIDATING → NORMALIZING
  → DEDUPING → VERSIONING → ROUTING → COMPLETED
```

| Stage | Implementation | Status |
|-------|----------------|--------|
| Extract | `parseCsvReferenceRows` | ✅ CSV only |
| Validate | `ValidationPipelineService` | ✅ |
| Normalize | `NormalizationEngine` | ✅ BN-first locale flags |
| Dedup | `DuplicateDetectionService` | ✅ |
| Version | `VersionEngineService` → VKF | ✅ |
| Route | `ApprovalRoutingService` | ✅ |

### Import run model

| Field | Purpose | Status |
|-------|---------|--------|
| `pipelineStage` | Stage tracker | ✅ |
| `status` | RUNNING / COMPLETED / PARTIAL / FAILED | ✅ |
| `statsJson` | Extract/validate/version counts | ✅ |
| `validationSummaryJson` | Pass/quarantine summary | ✅ |
| `errorSummary` | Pipeline exception message | ✅ (fixed) |
| `dryRun` | No VKF writes | ✅ |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| PDF/HTML/DOCX adapters not implemented | Medium | Open — 6B.2.8 |
| Async `sync: false` enqueues jobs but no worker drives pipeline | Medium | Open |
| `documentChecksum` passed to dedup but not used for idempotent skip | Low | Open |
| Import controller lacks per-route RBAC capabilities (foundation parity) | Medium | Open |

---

## 2. Deduplication

### Decision matrix

| Decision | Trigger | Pipeline action |
|----------|---------|-----------------|
| `SKIP_DUPLICATE` | Same `dedupKey` in batch | Skip extract |
| `CREATE_NEW` | No existing entity slug | New entity + v1 draft |
| `SUPERSEDE` | Published entity, no dose conflict | New version on entity |
| `MERGE_FIELDS` | Existing draft on entity | New version (supersede draft pointer) |
| `QUARANTINE_CONFLICT` | HIGH/CRITICAL dose mismatch vs published | Quarantine record |

### Verified behaviors

| Check | Result |
|-------|--------|
| Intra-batch dedup via `seenKeys` Set | ✅ |
| Slug-level corpus lookup (`vkKnowledgeEntity`) | ✅ |
| Dose conflict regex for mg/ml/mcg on HIGH/CRITICAL | ✅ |
| Quarantine record + audit on conflict | ✅ (fixed) |

### Gaps

| Gap | Severity | Notes |
|-----|----------|-------|
| `MERGE_FIELDS` does not patch existing draft in-place | Low | Creates new version number; acceptable for pilot, merge UI deferred |
| Cross-source fuzzy matching not implemented | Medium | Plan item for 6B.2.5+ |
| `documentChecksum` idempotent re-import skip | Low | Change detection uses section hashes when document present |

---

## 3. Versioning

### VKF writes

| Path | Behavior | Status |
|------|----------|--------|
| `CREATE_NEW` | Entity + v1 DRAFT + citation + draft pointer | ✅ |
| `SUPERSEDE` / `MERGE_FIELDS` | Increment versionNumber, set draft pointer, citation | ✅ |
| `dryRun: true` | Returns synthetic IDs, no `$transaction` | ✅ |
| `importRunId` on version | Provenance link | ✅ |

### Immutability handoff

Imported versions remain `DRAFT` or transition to `IN_REVIEW` / `VET_APPROVAL` via routing — **no auto-publish**. Aligns with 6B.1 governance.

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Vet route did not set `VET_APPROVAL` status | **High** | **Fixed** |
| Single active draft enforced via entity pointer update | ✅ | Verified in version engine transaction |

---

## 4. Retry behavior

### Job model (`AiKnowledgeImportJob`)

| Field | Purpose |
|-------|---------|
| `attemptCount` / `maxAttempts` | Retry budget (default 3) |
| `scheduledAt` | Backoff scheduling |
| `status` | QUEUED → PROCESSING → COMPLETED / RETRY_SCHEDULED / FAILED |

### Backoff formula

```
retryDelayMs = min(60_000, 1000 * 2^attemptCount)
```

| Check | Result |
|-------|--------|
| `claimNext` respects `scheduledAt` | ✅ |
| `fail()` returns `willRetry` flag | ✅ |
| `IMPORT_JOB_RETRY` audit on retry schedule | ✅ (fixed) |
| Sync pipeline marks queued jobs COMPLETED via `finalizeJobs` | ✅ (fixed) |
| BullMQ queue names registered (`knowledge:import`, `knowledge:validate`) | ✅ |
| Worker processor invokes full orchestrator per stage | ⚠️ Not wired |

---

## 5. Failure handling

### Validation failures

| Mechanism | Status |
|-----------|--------|
| `AiKnowledgeValidationItem` per extract | ✅ |
| Status `PASSED` / `FAILED` after validation | ✅ (fixed) |
| `AiKnowledgeQuarantineRecord` with reason codes | ✅ |
| Extract excluded from normalization on fail | ✅ |

### Run terminal states

| Condition | Status |
|-----------|--------|
| All quarantined, zero versions | `FAILED` |
| Mixed quarantine + versions | `PARTIAL` |
| Clean run | `COMPLETED` |
| Uncaught pipeline exception | `FAILED` + `errorSummary` | ✅ (fixed) |

### Validation rules enforced

| Code | Rule |
|------|------|
| `LICENSE_EXPIRED` | License date check |
| `AI_EXTRACTION_DENIED` | License flag |
| `EN_REQUIRED` | English title + body |
| `DOMAIN_NOT_ALLOWED` | Profile domain allowlist |
| `INCOMPLETE_CLINICAL` | Medicine dose/generic reference |

BN missing generates warning (`BN_PENDING`) but does not fail — aligns with BN-first pilot policy.

---

## 6. Audit logs

### Event catalog (`KIP_AUDIT_EVENTS`)

| Event | Trigger | Persisted | VKF dual-write |
|-------|---------|:---------:|:--------------:|
| `IMPORT_RUN_STARTED` | `startImport` | ✅ | — |
| `IMPORT_EXTRACT_COMPLETE` | After extract/change detection | ✅ | — |
| `IMPORT_VALIDATION_PASSED` | Per extract pass | ✅ | — |
| `IMPORT_VALIDATION_FAILED` | Per extract fail | ✅ | — |
| `IMPORT_QUARANTINED` | Validation or dedup quarantine | ✅ | — |
| `IMPORT_VERSION_CREATED` | Version engine success | ✅ | `ENTITY_CREATED` |
| `IMPORT_ROUTED_EDITORIAL` | Editorial submit | ✅ | `REVIEW_OPENED` |
| `IMPORT_ROUTED_VET` | Vet queue open | ✅ | `REVIEW_OPENED` |
| `IMPORT_RUN_COMPLETED` | Successful terminal | ✅ | — |
| `IMPORT_RUN_FAILED` | Failed terminal / exception | ✅ | — |
| `IMPORT_JOB_RETRY` | Job retry scheduled | ✅ | — |

### Store

- **Primary:** `VkKnowledgeAuditEvent` with KIP `eventType` string and `detailJson.importRunId`
- **Secondary:** VKF audit bridge for version lifecycle events (entity + version scoped)
- **Repository:** `KnowledgeImportAuditRepository` — append-only, queryable by import run

### Prior gaps (remediated)

| Gap | Severity | Status |
|-----|----------|--------|
| Only 3 of 11 KIP events persisted | **High** | **Fixed** |
| `IMPORT_QUARANTINED` never emitted | Medium | **Fixed** |
| `IMPORT_JOB_RETRY` never emitted | Medium | **Fixed** |

---

## 7. API surface

| Method | Route | Guard |
|--------|-------|-------|
| GET | `/import/profiles` | `requireInternalAdminAiOps` |
| POST | `/import/runs` | `requireInternalAdminAiOps` |
| GET | `/import/runs/:importRunId` | `requireInternalAdminAiOps` |
| GET | `/import/runs` | `requireInternalAdminAiOps` |

Wired in `AiAdminModule.configureRoutes()` via `configureKnowledgeImportAdminRoutes()`.

**Gap:** No `ai.knowledge.import.*` capability checks (unlike `/foundation/*` RBAC). Acceptable for internal-token-only pilot; add before web BFF exposure.

---

## 8. Test coverage

| File | Tests | Focus |
|------|------:|-------|
| `knowledge-import.test.ts` | 7 | Registry, normalization, dedup, validation |
| `knowledge-import.pipeline.test.ts` | 1 | Dry-run orchestrator |
| `knowledge-import.queue.test.ts` | 2 | Job retry + complete |
| `knowledge-import.audit.test.ts` | 2 | KIP persistence + VKF dual-write |

### Recommended follow-up tests

- Integration test with test DB (full LIVE import → VKF draft)
- Vet routing status assertion (`VET_APPROVAL`)
- Validation item status after mixed pass/fail batch
- Async worker end-to-end with BullMQ test harness
- MERGE_FIELDS vs SUPERSEDE version behavior

---

## Remediation applied (this audit)

| Issue | Fix |
|-------|-----|
| KIP audit events not persisted (only VKF bridge for 3 events) | Added `KnowledgeImportAuditRepository`; all events append to `VkKnowledgeAuditEvent` |
| Validation items stuck at `PENDING` | `markByExtractIndex()` called on pass/fail in orchestrator |
| Import jobs never marked COMPLETED in sync mode | `finalizeJobs()` / `completeQueuedJobs()` at pipeline end |
| `IMPORT_QUARANTINED` defined but never emitted | Emit on validation fail and dedup conflict |
| `IMPORT_JOB_RETRY` not emitted on backoff | Audit in `KnowledgeImportQueueService.processNextJob` |
| Vet routing skipped `VET_APPROVAL` status | `updateStatus(versionId, 'VET_APPROVAL')` in approval router |
| Uncaught pipeline errors left run in `RUNNING` | try/catch in `startImport` → `FAILED` + `errorSummary` + audit |
| Invalid `pipelineStage: 'FAILED'` enum usage | Use `errorSummary` on run; valid stage enum only |

---

## Open items (non-blocking for CSV pilot)

| Item | Phase | Priority |
|------|-------|----------|
| PDF/HTML/DOCX adapters | 6B.2.8 | High |
| Web Ingestion Control Center | 6B.2.9 | High |
| BullMQ worker wiring to orchestrator stages | 6B.2 | High |
| Import route RBAC capabilities | Hardening | Medium |
| `documentChecksum` idempotent skip | Hardening | Low |
| MERGE_FIELDS in-place draft patch UI | 6B.2.5+ | Medium |
| Cross-source fuzzy dedup | 6B.2.5+ | Medium |
| KIS → VKF dual-write convergence | 6B.1.4 | High |

---

## Verification commands

```bash
npm run typecheck:ai
npx vitest run src/modules/ai
npx vitest run src/modules/ai/knowledge-import
```

**Results at report time:**

```
AI module: 0 TypeScript errors
Test Files  47 passed (47)
Tests       321 passed (321)
```

---

## Sign-off

| Role | Assessment |
|------|------------|
| **Data Quality Auditor** | Phase 6B.2 CSV sync import path **approved for controlled admin pilot** |
| **Blockers for production-scale ingestion** | Async workers, multi-format adapters, web admin UI, RBAC on import routes |
| **Next verification** | After 6B.2.8 adapter implementation or first production CSV corpus import |

**Document owner:** Principal Data Quality Auditor  
**Related:** `docs/plans/phase-6b2-knowledge-import-pipeline.md`, `docs/reports/phase-6b1-knowledge-foundation-verification.md`
