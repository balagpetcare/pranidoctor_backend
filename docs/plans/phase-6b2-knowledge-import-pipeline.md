# Phase 6B.2 — Knowledge Import Pipeline Architecture

**Project:** Prani Doctor  
**Role:** Principal Knowledge Ingestion Architect  
**Date:** 2026-05-31  
**Status:** Phase 6B.2.0–6B.2.7 implemented (backend CSV path) — 2026-05-31  
**Version:** 1.0.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL domain model, evidence, retrieval profiles)
- `docs/plans/phase-6b-knowledge-ingestion-architecture.md` (legacy KIS — row import on `AiKnowledgeEntry`)
- `docs/plans/phase-6b1-knowledge-foundation.md` (VKF — entity, version, citation, review, approval)
- `docs/plans/phase-6c-rag-architecture.md` (post-publish embedding index)
- `docs/plans/ai-phase-4-router-engine.md` (DOCUMENT_ANALYSIS route for extraction assist)

---

## Phase numbering disambiguation

| Document | Meaning |
|----------|---------|
| **Phase 6B** (`phase-6b-knowledge-ingestion-architecture.md`) | Original **Knowledge Ingestion System (KIS)** — CSV/JSON row import, legacy entry model; sub-phases 6B.0–6B.8 |
| **Phase 6B.1** | **Veterinary Knowledge Foundation (VKF)** — version-scoped persistence, workflows, audit |
| **Phase 6B.2** (this document) | **VKF-aligned Import Pipeline** — multi-queue orchestration from registered sources → normalized drafts → dedup/change → `VkKnowledgeVersion` → approval routing |
| **Phase 6C** | RAG — reads published versions only |

Phase 6B.2 **does not replace** Phase 6B overnight. It defines the **target pipeline** that dual-writes (6B.1.4) and eventually retires legacy entry import. Existing `KnowledgeImportPipelineService.runImport` is the seed implementation; 6B.2 specifies production-grade queues, validation gates, and VKF version creation.

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Source registry extensions, import/validation queues, pipeline workers, VKF writers, audit |
| `pranidoctor-web` | Ingestion Control Center — upload, batch monitor, validation triage, merge proposals |
| `pranidoctor_user` | No direct ingestion; consumes published VKL only |

---

## Executive summary

Phase 6B.1 established **immutable version-scoped knowledge** (`VkKnowledgeEntity`, `VkKnowledgeVersion`, citations, reviews, approvals). Phase 6B.2 defines **how authoritative veterinary material enters VKF** through a governed, observable import pipeline.

The **Knowledge Import Pipeline (KIP)** orchestrates seven supported upstream source families:

| # | Source family | Primary VKF domains |
|---|---------------|---------------------|
| 1 | **Veterinary Books** | DISEASE, MEDICINE, CLINICAL_PROTOCOL |
| 2 | **Clinical Guidelines** | CLINICAL_PROTOCOL, EMERGENCY |
| 3 | **BPA/WPA Documents** | DISEASE, VACCINE, FARM_MGMT |
| 4 | **Government Livestock Manuals** | FARM_MGMT, REGULATORY_BD, VACCINE |
| 5 | **Medicine References** | MEDICINE, REGULATORY_BD |
| 6 | **Vaccine References** | VACCINE |
| 7 | **Feed References** | FEED |

Every import traverses:

1. **Source Registry** — licensed, trust-tiered catalog + document lineage  
2. **Import Queue** — async intake, parse, extract  
3. **Validation Queue** — license, schema, locale, clinical completeness  
4. **Normalization Pipeline** — lexical → semantic → domain envelope  
5. **Duplicate Detection** — intra-batch, corpus, cross-source  
6. **Change Detection** — document edition diffs, supersede proposals  
7. **Version Creation** — VKF draft versions with citations  
8. **Approval Routing** — editorial → vet (by risk) → publish-ready handoff  

**No imported content auto-publishes.** Ingestion terminates at validated `VkKnowledgeVersion` rows in `DRAFT` or `IN_REVIEW`, with full provenance and audit trail.

**This document is architecture only.** No code, migrations, workers, or UI are in scope.

---

## Strategic intent

| Legacy KIS (Phase 6B as-built) | Target KIP (Phase 6B.2) |
|--------------------------------|---------------------------|
| Writes `AiKnowledgeEntry` mutable rows | Writes **`VkKnowledgeVersion`** drafts on stable entities |
| Single `sourceId` per entry | **Many citations** per version with span locators |
| Inline CSV import only | **Multi-format adapters** (PDF, DOCX, CSV, HTML) + workers |
| Dedup keys in normalizer | **Dedicated dedup + merge proposal** service with human triage |
| No document edition diff | **Change detection** on re-import triggers version fork |
| Shared review on entry id | **Version-scoped** review/approval via VKF |
| Limited queue observability | **Import + Validation queues** with SLA metrics |

---

## Design principles

| Principle | KIP interpretation |
|-----------|-------------------|
| **Source before content** | No pipeline run without active `AiKnowledgeSource` + registered document artifact |
| **Registry is canonical** | Source family, trust tier, allowed domains, and license gates are admin-curated — adapters cannot override |
| **Extract, don’t invent** | Normalization outputs only fields traceable to source spans; gaps remain empty |
| **Queue separation** | Import (I/O heavy) ≠ Validation (rule heavy) ≠ Approval (human) |
| **Fail partial, report all** | Batch continues on row failure; quarantine with reason code |
| **Idempotent batches** | Same source + document checksum + dedup key → skip or supersede, never duplicate explosion |
| **Version is the write target** | All successful imports create or update **`VkKnowledgeVersion`**, never mutate published versions |
| **BN-first downstream** | EN extracted first for textbooks; BN translation is a staged locale gate before farmer publish |
| **Clinical fail-closed** | HIGH/CRITICAL imports always route to vet queue; dose conflicts → quarantine |
| **Router isolation** | LLM extraction uses `DOCUMENT_ANALYSIS` only — no farmer PII in ingest jobs |
| **Audit everything** | Every stage transition emits `VkKnowledgeAuditEvent` + import run ledger row |

---

## System overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE IMPORT PIPELINE (KIP) — Phase 6B.2                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  SUPPORTED SOURCES (7 families)                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Vet Books│ │ Clinical │ │ BPA/WPA  │ │ Govt DLS │ │ Medicine │ │ Vaccine  │ Feed  │
│  │  (PDF)   │ │ Guidelines│ │  (HTML)  │ │ Manuals  │ │   Refs   │ │   Refs   │ Refs  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       └────────────┴────────────┴────────────┴──────────────┴────────────┴────────────┘│
│                                         │                                               │
│                                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐      │
│  │                         SOURCE REGISTRY (extended)                            │      │
│  │  AiKnowledgeSource + AiKnowledgeSourceDocument + AiKnowledgeSourceLicense     │      │
│  │  SourceFamily profile · adapter binding · trust tier · allowedDomains[]       │      │
│  └──────────────────────────────────────────────────────────────────────────────┘      │
│                                         │                                               │
│                                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐      │
│  │                            IMPORT QUEUE                                       │      │
│  │  INTAKE → PARSE → EXTRACT → (raw extracts + span refs)                       │      │
│  └──────────────────────────────────────────────────────────────────────────────┘      │
│                                         │                                               │
│                                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐      │
│  │                          VALIDATION QUEUE                                     │      │
│  │  LICENSE · MANIFEST · SCHEMA · LOCALE · CLINICAL COMPLETENESS                │      │
│  └──────────────────────────────────────────────────────────────────────────────┘      │
│                                         │                                               │
│                                         ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐      │
│  │                      NORMALIZATION PIPELINE                                   │      │
│  │  L1 Structural → L2 Lexical → L3 Semantic → L4 Graph hints → L5 Locale       │      │
│  └──────────────────────────────────────────────────────────────────────────────┘      │
│                                         │                                               │
│                    ┌────────────────────┼────────────────────┐                         │
│                    ▼                    ▼                    ▼                         │
│           ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                    │
│           │  DUPLICATE   │    │   CHANGE     │    │  QUARANTINE  │                    │
│           │  DETECTION   │    │  DETECTION   │    │   (failed)   │                    │
│           └──────┬───────┘    └──────┬───────┘    └──────────────┘                    │
│                  └──────────┬────────┘                                                 │
│                             ▼                                                           │
│                  ┌─────────────────────┐                                                 │
│                  │  VERSION CREATION   │  → VkKnowledgeEntity + VkKnowledgeVersion      │
│                  │  + CITATIONS        │  → VkKnowledgeCitation[]                       │
│                  └──────────┬──────────┘                                                 │
│                             ▼                                                           │
│                  ┌─────────────────────┐                                                 │
│                  │  APPROVAL ROUTING   │  → Editorial → Vet → VKF publish handoff       │
│                  └─────────────────────┘                                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Backend module placement (conceptual)

```
src/modules/ai/knowledge-import/          # Phase 6B.2 target module (new)
├── registry/                             # Source family profiles, adapter bindings
├── queues/
│   ├── import-queue.service.ts           # Intake / parse / extract job producer
│   └── validation-queue.service.ts       # Post-extract rule validation
├── pipeline/
│   ├── import-orchestrator.service.ts    # Stage coordinator
│   └── stage-contracts.ts                # Typed handoffs between stages
├── adapters/                             # Per source-family parsers
├── normalization/                        # Extends 6B knowledge-normalizer
├── deduplication/                        # Keys, fuzzy match, merge proposals
├── change-detection/                     # Document diff, supersede logic
├── versioning/                           # VKF version writer facade
├── routing/                              # Approval queue assignment
└── audit/                                # Import run + VkKnowledgeAuditEvent bridge

# Existing (evolve, do not duplicate):
src/modules/ai/knowledge-ingestion/       # Legacy row import — dual-write period
src/modules/ai/knowledge-foundation/      # VKF CRUD + workflows (6B.1)
```

Workers extend BullMQ: `knowledge:import`, `knowledge:validate`, `knowledge:normalize`, `knowledge:dedup`, `knowledge:version`.

---

## 1. Source Registry

The Source Registry is the **gatekeeper catalog**. Phase 6B.0 implemented core tables (`AiKnowledgeSource`, `AiKnowledgeSourceDocument`, `AiKnowledgeSourceLicense`). Phase 6B.2 adds **Source Family Profiles** — configuration bundles that bind upstream types to adapters, domains, and approval defaults.

### 1.1 Supported source families

| Source family | `sourceClass` (existing enum) | Typical media | Default `trustTier` | Default domains | Vet default |
|---------------|-------------------------------|---------------|----------------------|-----------------|-------------|
| **Veterinary Books** | `VETERINARY_TEXTBOOK` | PDF | 2 | DISEASE, MEDICINE | HIGH for dose tables |
| **Clinical Guidelines** | `CLINICAL_PROTOCOL` | PDF, DOCX | 2 | CLINICAL_PROTOCOL, EMERGENCY | HIGH |
| **BPA/WPA Documents** | `BPA_GUIDELINE`, `WPA_GUIDELINE` | HTML, PDF | 2–3 | DISEASE, VACCINE, FARM_MGMT | MEDIUM |
| **Government Livestock Manuals** | `GOVT_LIVESTOCK` | PDF, HTML | 2 | FARM_MGMT, REGULATORY_BD | MEDIUM; REGULATORY → HIGH |
| **Medicine References** | `MEDICINE_REFERENCE` | CSV, JSON, API | 1–2 | MEDICINE, REGULATORY_BD | CRITICAL for withdrawal/dose |
| **Vaccine References** | `VACCINE_SCHEDULE` | CSV, JSON | 2 | VACCINE | HIGH for farmer schedules |
| **Feed References** | `FEED_REFERENCE` | CSV, JSON | 3 | FEED | LOW–MEDIUM |

### 1.2 Registry entities (conceptual extensions)

#### `SourceFamilyProfile` (new config — not yet in schema)

| Field | Description |
|-------|-------------|
| `profileKey` | e.g. `vet-book-pdf-v1`, `medicine-csv-v1` |
| `sourceFamily` | One of seven families above |
| `adapterId` | Bound import adapter |
| `allowedMediaTypes[]` | PDF, DOCX, CSV, JSON, HTML |
| `allowedDomains[]` | Subset of `VkKnowledgeDomain` |
| `defaultChunkPolicyId` | Chunking policy for staging |
| `defaultClinicalRiskTier` | Floor for imports from this family |
| `requiresVetByDefault` | Override auto-routing |
| `dedupKeyTemplate` | Entity-type-specific key fields |
| `normalizationProfileId` | Lexical + schema rule set |
| `refreshPolicyDays` | Re-import cadence alert |

#### `AiKnowledgeSource` (existing — catalog entry)

Unchanged responsibilities: bibliographic identity, trust tier ceiling, license FK, jurisdiction (`BD` default), BN/EN titles, status lifecycle (`ACTIVE` → `DEPRECATED` → `RETIRED`).

**Registry rule:** Adapters inherit `trustTier` and `allowedDomains` from source; imports rejecting out-of-domain entities at validation.

#### `AiKnowledgeSourceDocument` (existing — artifact)

| Responsibility | Detail |
|----------------|--------|
| Immutable storage | `storageUri` + `checksumSha256` |
| Edition lineage | `documentVersion`, `supersedesDocumentId` |
| Parse binding | `parseProfileId` → adapter config |
| Re-import key | `(sourceId, checksumSha256)` uniqueness |

#### `AiKnowledgeSourceLicense` (existing)

| Gate | Effect |
|------|--------|
| `allowsAiExtraction=false` | Blocks LLM-assisted adapters |
| `allowsFarmerDistribution=false` | Blocks farmer audience without legal review |
| `expiryDate` passed | Import queue rejects with `LICENSE_EXPIRED` |

### 1.3 Source Registry operations (admin)

| Operation | Actor | Outcome |
|-----------|-------|---------|
| Register source | Knowledge admin | New `AiKnowledgeSource` |
| Upload document | Ingestion operator | New `AiKnowledgeSourceDocument` + storage blob |
| Bind profile | Super admin | Links source family → adapter |
| Deprecate source | Knowledge admin | Blocks new imports; existing versions unaffected |
| Retire document | Knowledge admin | Blocks re-import; triggers deprecation review queue |

### 1.4 Registry audit events

| Event | When |
|-------|------|
| `SOURCE_REGISTERED` | New catalog entry |
| `DOCUMENT_UPLOADED` | New artifact |
| `DOCUMENT_SUPERSEDED` | New edition replaces old |
| `SOURCE_DEPRECATED` / `SOURCE_RETIRED` | Lifecycle change |

---

## 2. Import Queue

The **Import Queue** handles I/O-bound work: file intake, parsing, and span-preserving extraction. It does **not** perform business validation beyond format and license pre-checks.

### 2.1 Queue topology

```
Admin Upload / API Trigger / Scheduled Pull
        │
        ▼
┌───────────────────┐     BullMQ: knowledge:import
│ ImportJob         │     Priority: regulatory > clinical > reference
│ (per document)    │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 ParseJob    ExtractJob(s)     ← fan-out by section/page batch
    │           │
    └─────┬─────┘
          ▼
   RawExtractBatch → Validation Queue
```

### 2.2 Import job states

| State | Meaning |
|-------|---------|
| `QUEUED` | Accepted, awaiting worker |
| `INTAKE` | Blob verified, checksum recorded |
| `PARSING` | Adapter producing `ParsedDocument` |
| `EXTRACTING` | Span-bound `RawExtract[]` |
| `EXTRACT_COMPLETE` | Handoff to validation queue |
| `FAILED` | Unrecoverable parse/extract error |
| `CANCELLED` | Admin abort |

### 2.3 Import run ledger (`AiKnowledgeImportRun` — extend)

| Field | Purpose |
|-------|---------|
| `importRunId` | Batch correlation (existing) |
| `sourceId`, `documentId` | Lineage (existing) |
| `pipelineVersion` | KIP semver for reproducibility |
| `adapterId`, `profileKey` | Adapter + family profile |
| `mode` | `LIVE` \| `DRY_RUN` \| `REIMPORT_DIFF` |
| `status` | `RUNNING` \| `EXTRACT_COMPLETE` \| `VALIDATING` \| `COMPLETED` \| `PARTIAL` \| `FAILED` |
| `statsJson` | Per-stage counters |
| `validationSummaryJson` | Aggregated validation outcomes |

### 2.4 Adapter binding by source family

| Source family | `adapterId` | Extract strategy |
|---------------|-------------|------------------|
| Veterinary Books | `pdf-textbook-v2` | Layout-aware headings; table struct via DOCUMENT_ANALYSIS |
| Clinical Guidelines | `docx-protocol-v2` | Numbered steps, decision trees |
| BPA/WPA Documents | `html-guideline-v1` | Readability + section codes; manual review flag |
| Govt Livestock Manuals | `pdf-govt-bn-en-v1` | Two-column BN/EN detection |
| Medicine References | `csv-medicine-v2` | Row → drug entity envelope |
| Vaccine References | `csv-vaccine-schedule-v2` | Row → schedule matrix |
| Feed References | `csv-feed-composition-v2` | Row → nutrient / ingredient |

### 2.5 Import queue SLAs (targets)

| Metric | Target |
|--------|--------|
| CSV row batch (≤500 rows) | Inline ≤ 30s |
| PDF textbook (≤400 pages) | Async ≤ 20 min p95 |
| Extract failure rate | < 5% per run (excluding corrupt uploads) |
| Worker retry | 3 attempts, exponential backoff |

---

## 3. Validation Queue

The **Validation Queue** performs rule-heavy checks on `RawExtractBatch` **before** normalization mutates content into VKF-shaped drafts. Separating validation from import prevents expensive normalize/dedup work on known-bad data.

### 3.1 Validation stages

```
RawExtractBatch
      │
      ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ V0 License  │ → │ V1 Manifest │ → │ V2 Schema   │ → │ V3 Locale   │
└─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘
      │                                                       │
      └───────────────────────────┬───────────────────────────┘
                                  ▼
                          ┌─────────────┐
                          │ V4 Clinical │
                          │ Completeness│
                          └──────┬──────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
             PASS → Normalize          FAIL → Quarantine
```

### 3.2 Validation rules matrix

| Stage | Rule | Failure code | Severity |
|-------|------|--------------|----------|
| **V0 License** | License active; AI extraction allowed if adapter needs LLM | `LICENSE_EXPIRED`, `AI_EXTRACTION_DENIED` | Block |
| **V1 Manifest** | Row/section count within adapter limits; checksum match | `MANIFEST_MISMATCH` | Block |
| **V2 Schema** | Raw extract shape matches adapter output schema | `SCHEMA_VIOLATION` | Quarantine row |
| **V3 Locale** | EN title/body present; BN flagged `BN_PENDING` if absent | `EN_REQUIRED`, `BN_PENDING` | Warn / flag |
| **V4 Clinical** | Domain checklist (e.g. Drug has dose OR explicit deferral) | `INCOMPLETE_CLINICAL` | Quarantine or review flag |

### 3.3 Validation queue item (`ValidationQueueItem` — conceptual)

| Field | Description |
|-------|-------------|
| `validationItemId` | UUID |
| `importRunId`, `extractIndex` | Lineage |
| `rawExtractRef` | Pointer to staged extract blob |
| `status` | `PENDING` \| `PASSED` \| `FAILED` \| `WAIVED` |
| `failureCodes[]` | Structured reasons |
| `waivedByUserId` | Admin override with audit |
| `assignedTo` | Optional triage owner |

### 3.4 Quarantine store (`ImportQuarantineRecord` — conceptual)

| Field | Description |
|-------|-------------|
| `quarantineId` | UUID |
| `importRunId` | Batch |
| `reasonCode` | From validation or later stages |
| `rawSnapshotJson` | Immutable failed payload |
| `resolution` | `FIXED` \| `DISCARDED` \| `MERGED` \| null |
| `resolvedAt` | Timestamp |

### 3.5 Validation queue operations

| Operation | Result |
|-----------|--------|
| Auto-pass | Proceeds to normalization pipeline |
| Auto-fail | Quarantine + import run stat increment |
| Admin waive | Audit + proceed with `WAIVED` flag on version metadata |
| Bulk retry | Re-queue extracts after manifest fix |

---

## 4. Normalization Pipeline

Normalization transforms **validated raw extracts** into **`NormalizedEntityDraft`** records ready for dedup and VKF version creation.

### 4.1 Pipeline layers

```
┌────────────────────────────────────────────────────────────────────────┐
│ L1 — STRUCTURAL     │ Section boundaries → candidate entities          │
│ L2 — LEXICAL        │ Species, units, INN, disease codes, dates        │
│ L3 — SEMANTIC       │ entityType + VkKnowledgeDomain assignment        │
│ L4 — GRAPH HINTS    │ Suggested relations (non-persisted proposals)    │
│ L5 — LOCALE         │ BN summary generation queue (optional async)     │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Lexical normalization (L2)

| Dimension | Canonical form |
|-----------|----------------|
| Species | `LivestockSpecies` enum (`murgi` → `CHICKEN`) |
| Drug names | INN generic; brand → generic lookup table |
| Dose / weight | mg/kg, ml/kg numeric |
| Temperature | Celsius |
| Region | `regionScope` default `BD` for govt/BPA sources |
| Schedule ages | days/weeks ISO-friendly |

### 4.3 Semantic classification (L3)

| Method | When |
|--------|------|
| Rule-based | CSV medicine/vaccine/feed adapters |
| Pattern | Section title regex (“Dosage”, “Withdrawal”, “Biosecurity”) |
| LLM assist | Ambiguous textbook paragraphs — span-bound JSON only |

**LLM guardrails:** Single section input; output must include `sourceSpanRefs[]`; numeric doses require matching span text.

### 4.4 Normalized draft envelope (`NormalizedEntityDraft` — conceptual)

| Field | Maps to VKF |
|-------|-------------|
| `entityType` | `VkKnowledgeEntity.entityType` |
| `domain` | `VkKnowledgeDomain` |
| `slugCandidate` | Entity slug (dedup may adjust) |
| `titleBn`, `titleEn` | Version titles |
| `bodyBn`, `bodyEn` | Version bodies |
| `structuredJson` | Domain schema payload |
| `species[]`, `audience`, `regionScope` | Version fields |
| `clinicalRiskTier` | Computed from content + source family |
| `sourceSpanRefs[]` | Citation locator seeds |
| `provenanceJson` | importRunId, documentId, adapterId, extractorVersion |
| `localeFlags[]` | `BN_PENDING`, etc. |

### 4.5 Domain mapping by source family

| Source family | Primary entity types |
|---------------|---------------------|
| Veterinary Books | `Disease`, `Drug`, `TreatmentPathway` |
| Clinical Guidelines | `SOP`, `DiagnosticWorkup`, `TreatmentPathway` |
| BPA/WPA | `BiosecurityMeasure`, `VaccinationSchedule`, `Disease` |
| Govt Livestock Manuals | `HerdHealthProgram`, `SeasonalCalendar`, `RegulatoryNotice` |
| Medicine References | `Drug`, `Formulation`, `WithdrawalRule` |
| Vaccine References | `Vaccine`, `VaccinationSchedule` |
| Feed References | `FeedIngredient`, `NutrientRequirement` |

### 4.6 Normalization output contract

Each draft carries:

- `normalizationVersion` — semver of rule set  
- `validationPassRef` — link to validation queue item  
- `confidenceHints` — inputs for provisional scoring (Phase 6B.1.2 evidence/confidence)  

---

## 5. Duplicate Detection

Duplicate detection runs **after normalization** when entity identity fields are stable.

### 5.1 Detection scopes

| Scope | Question | Action |
|-------|----------|--------|
| **Intra-batch** | Duplicate rows in same `importRunId`? | Collapse before version write |
| **Corpus exact** | Same dedup key as published or in-review version? | `SUPERSEDE` or `SKIP` |
| **Cross-source** | Same fact, different authoritative source? | `MERGE_FIELDS` or conflict quarantine |
| **Fuzzy** | High similarity, uncertain identity? | Merge proposal queue |

### 5.2 Dedup key hierarchy

**Primary keys (exact match):**

| entityType | Key components |
|------------|----------------|
| `Disease` | `diseaseCode` OR norm(`titleEn`) + species |
| `Drug` | INN + strength + form |
| `Vaccine` | antigen + manufacturer |
| `VaccinationSchedule` | species + antigen + ageWindow |
| `FeedIngredient` | ingredientCode OR norm(name) |
| `RegulatoryNotice` | legalReference + effectiveFrom |

**Secondary keys (fuzzy → human merge queue):**

- Trigram similarity on `titleEn` / `titleBn` ≥ 0.92  
- Optional embedding similarity ≥ 0.95 (Phase 6C assist — not required for 6B.2 launch)

### 5.3 Dedup decisions

| Decision | Version creation behavior |
|----------|---------------------------|
| `CREATE_NEW` | New `VkKnowledgeEntity` + v1 draft |
| `SUPERSEDE` | New version on existing entity; `supersedesVersionId` set |
| `MERGE_FIELDS` | Patch empty fields on existing **draft**; conflicts → merge UI |
| `SKIP_DUPLICATE` | Same document checksum + key already ingested |
| `QUARANTINE_CONFLICT` | Irreconcilable dose / withdrawal conflict |

**Clinical conflict rule:** Conflicting dose or withdrawal between sources → `QUARANTINE_CONFLICT`; never silent overwrite.

### 5.4 Merge proposal artifact (`DedupMergeProposal` — conceptual)

| Field | Description |
|-------|-------------|
| `proposalId` | UUID |
| `leftVersionId`, `rightDraftRef` | Comparison pair |
| `conflictingFields[]` | Structured diff |
| `suggestedResolution` | Rule-based hint |
| `status` | `OPEN` \| `ACCEPTED` \| `REJECTED` |
| `reviewerId` | Human resolver |

---

## 6. Change Detection

Change detection handles **document edition updates** and **re-import diffs** — distinct from duplicate entity matching.

### 6.1 Triggers

| Trigger | Detection input |
|---------|-----------------|
| New `AiKnowledgeSourceDocument` edition | `supersedesDocumentId` link |
| Same document, new checksum | Byte-level or extract-level diff |
| Scheduled refresh | `refreshPolicyDays` exceeded |

### 6.2 Change detection pipeline

```
Prior Import Snapshot (extract hashes per section)
        │
        ▼
Current Extract Snapshot
        │
        ▼
┌───────────────────────────────────────────┐
│ Section-level hash diff                    │
│ ADDED │ MODIFIED │ REMOVED │ UNCHANGED     │
└───────────────────┬───────────────────────┘
                    ▼
         ChangeSet[] → Version / Deprecation proposals
```

### 6.3 Change decisions

| Change type | Action |
|-------------|--------|
| **ADDED** sections | New entity drafts or new versions |
| **MODIFIED** sections | New draft version on matched entity; `changeSummary` auto-generated |
| **REMOVED** sections | Deprecation **review** item — no auto-deprecate |
| **UNCHANGED** | Skip version write |

### 6.4 Change metadata on version

```json
{
  "changeDetection": {
    "mode": "DOCUMENT_EDITION_DIFF",
    "priorDocumentId": "uuid",
    "priorImportRunId": "uuid",
    "sectionDiff": [
      { "sectionRef": "ch-4-sec-2", "change": "MODIFIED", "hashBefore": "…", "hashAfter": "…" }
    ]
  }
}
```

### 6.5 Re-import idempotency

| Condition | Behavior |
|-----------|----------|
| Same `(sourceId, documentId, checksumSha256)` | Skip entire run after intake |
| Same document, new checksum | Full change detection path |
| New document edition | Supersede document record; diff against prior edition import |

---

## 7. Version Creation

Version creation is the **handoff to VKF** — the only persistence target for successful imports.

### 7.1 Version creation flows

```
NormalizedEntityDraft + DedupDecision + ChangeSet
              │
              ▼
    ┌─────────────────────┐
    │ VersionCreationPlan │  (transaction blueprint)
    └──────────┬──────────┘
               ▼
    ┌─────────────────────┐
    │ VkKnowledgeEntity   │  create if CREATE_NEW
    │ VkKnowledgeVersion  │  always new draft row
    │ VkKnowledgeCitation │  ≥1 per version (from spans)
    │ VkKnowledgeAuditEvent│ IMPORT_VERSION_CREATED
    └─────────────────────┘
```

### 7.2 Version creation rules

| Rule | Enforcement |
|------|-------------|
| Never mutate `PUBLISHED` versions | Writer creates new draft or forks via VKF service |
| Always attach ≥1 citation | Auto-generated from `sourceSpanRefs` + registry attribution templates |
| BN-first policy | `bodyBn` may be `BN_PENDING` placeholder only with review flag — not farmer-publishable |
| Risk tier inheritance | `max(sourceFamily default, content-derived tier)` |
| Draft pointer | Update `VkKnowledgeEntity.currentDraftVersionId` |
| Provenance | `importRunId`, `documentId`, `adapterId` in version metadata / audit detail |

### 7.3 Citation materialization

For each version created from import:

| Citation field | Source |
|----------------|--------|
| `sourceId` | Import run source |
| `documentId` | Import document |
| `pageRef`, `sectionRef`, … | From extract span |
| `inlineCitationKey` | `[sourceKey\|pageRef]` |
| `humanCitationBn/En` | License template + locator |
| `contributionWeight` | Adapter default (1.0 primary) |

### 7.4 Dual-write period (6B.1.4)

During migration, version writer **also** mirrors a legacy `AiKnowledgeEntry` row for RAG compatibility until 6B.1.5 completes. Dual-write facade owns consistency; KIP calls facade, not raw entry repo.

### 7.5 Version creation outcomes

| Outcome | Version status | Next step |
|---------|----------------|-----------|
| Success | `DRAFT` | Approval routing |
| Auto-submit eligible | `IN_REVIEW` | LOW-risk farm facts only (configurable) |
| Waived validation | `DRAFT` + `validationWaived` flag | Mandatory senior review |
| Failure | No version | Quarantine record |

---

## 8. Approval Routing

Approval routing assigns each new **`VkKnowledgeVersion`** to the correct human queue using VKF workflow services (Phase 6B.1).

### 8.1 Routing decision tree

```
                    New VkKnowledgeVersion (DRAFT)
                              │
                              ▼
                    ┌─────────────────┐
                    │ clinicalRiskTier│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
      LOW/MEDIUM            HIGH              CRITICAL
         │                   │                   │
         ▼                   ▼                   ▼
   Editorial queue      Editorial →        Editorial →
   (optional auto-      Vet queue          Vet queue +
    submit flag)         (required)         dual approval
         │                   │              (future flag)
         └───────────────────┴───────────────────┘
                             │
                             ▼
              VkKnowledgeReview (version-scoped)
                             │
                             ▼
              VkKnowledgeApproval (if required)
                             │
                             ▼
              Publish handoff → VKF publishVersion()
                             │
                             ▼
              Phase 6C embed job (published only)
```

### 8.2 Routing rules by source family

| Source family | Default route | Notes |
|---------------|---------------|-------|
| Veterinary Books | Editorial → Vet if dose/contraindication | Tables with numeric dose → HIGH |
| Clinical Guidelines | Editorial → Vet | SOP steps farmer-facing → HIGH |
| BPA/WPA | Editorial | Biosecurity → MEDIUM |
| Govt Livestock Manuals | Editorial; REGULATORY_BD → Vet | Legal refs → HIGH |
| Medicine References | Vet mandatory | CRITICAL if withdrawal periods |
| Vaccine References | Vet if farmer schedule | Calendar rows → HIGH |
| Feed References | Editorial expedited | LOW default |

### 8.3 Queue integration (VKF)

| Queue | VKF mechanism | Filter |
|-------|---------------|--------|
| Editorial | `VkKnowledgeReview` stage=`EDITORIAL` + version `IN_REVIEW` | `queueSource=INGESTION` |
| Vet | `VkKnowledgeReview` stage=`VET` + version `VET_APPROVAL` | risk tier HIGH/CRITICAL |
| Merge | Admin UI on `DedupMergeProposal` | Not VKF review — pre-version or draft patch |
| Deprecation review | Custom queue on REMOVED change detection | Links to entity deprecation workflow |
| BN translation | `VkReviewStage.LANGUAGE_BN` | `BN_PENDING` flag |

### 8.4 Auto-submit policy (configurable — default off)

| Condition | Allowed auto-submit to `IN_REVIEW`? |
|-----------|--------------------------------------|
| LOW risk + FEED/FARM_MGMT + CSV adapter | Optional pilot |
| Any MEDICINE / EMERGENCY content | **Never** |
| Any validation waived row | **Never** |
| Any QUARANTINE_CONFLICT history on entity | **Never** |

### 8.5 Routing audit events

| Event | When |
|-------|------|
| `IMPORT_ROUTED_EDITORIAL` | Version enters editorial queue |
| `IMPORT_ROUTED_VET` | Version enters vet queue |
| `IMPORT_MERGE_REQUIRED` | Dedup conflict needs human merge |
| `IMPORT_DEPRECATION_REVIEW` | Section removed from source document |

---

## 9. End-to-end state machine

```
ImportRun: QUEUED → INTAKE → PARSING → EXTRACTING → EXTRACT_COMPLETE
    → VALIDATING → NORMALIZING → DEDUPING → VERSIONING → ROUTING → COMPLETED
                                                              ↘ PARTIAL (if quarantine > 0)
Any stage: → FAILED | CANCELLED
```

| Stage | Emits audit |
|-------|-------------|
| INTAKE | `IMPORT_RUN_STARTED` |
| EXTRACT_COMPLETE | `IMPORT_EXTRACT_COMPLETE` |
| VALIDATING | `IMPORT_VALIDATION_*` per item |
| VERSIONING | `IMPORT_VERSION_CREATED` |
| ROUTING | `IMPORT_ROUTED_*` |
| COMPLETED | `IMPORT_RUN_COMPLETED` |

---

## 10. Permissions & governance

| Capability | Scope |
|------------|-------|
| `ai.ingest.upload` | Trigger import jobs |
| `ai.ingest.validate.waive` | Override validation failures |
| `ai.ingest.merge.resolve` | Accept/reject dedup merge proposals |
| `ai.knowledge.sources.manage` | Source registry (existing VKF) |
| `ai.knowledge.review` / `approve` / `publish` | VKF queues (existing) |

Regulatory sources (`REGULATORY_BD` domain) require **Regulatory Editor** role extension (future governance scope).

---

## 11. Observability & metrics

| Metric | Source |
|--------|--------|
| Import queue depth | BullMQ + `AiKnowledgeImportRun` |
| Validation pass rate | `ValidationQueueItem` stats |
| Quarantine rate by reason | `ImportQuarantineRecord` |
| Dedup merge backlog | `DedupMergeProposal` |
| Time-to-first-review | Import complete → `IN_REVIEW` timestamp |
| Versions created per source family | VKF analytics |
| Citation completeness at import | Citations per version at creation |

---

## 12. Implementation roadmap (conceptual)

| Sub-phase | Scope | Dependency | Status |
|-----------|-------|------------|--------|
| **6B.2.0** | Source family profiles + registry admin API | 6B.1.3 | **Done** — `registry/source-family.profiles.ts`, `KnowledgeImportRegistryService` |
| **6B.2.1** | Import queue + CSV adapter | 6B.2.0 | **Done** — `csv-reference-v2`, `KnowledgeImportQueueService`, BullMQ queue names |
| **6B.2.2** | Validation queue + quarantine store | 6B.2.1 | **Done** — `ValidationPipelineService`, `AiKnowledgeValidationItem`, `AiKnowledgeQuarantineRecord` |
| **6B.2.3** | Normalization pipeline v2 | 6B.2.2 | **Done** — `NormalizationEngine` |
| **6B.2.4** | Dedup + merge proposals | 6B.2.3 | **Done** — `DuplicateDetectionService` (merge UI pending) |
| **6B.2.5** | Change detection on document edition | 6B.2.4 | **Done** — `ChangeDetectionService` |
| **6B.2.6** | VKF version writer | 6B.1.4 | **Done** — `VersionEngineService` → `VkKnowledgeVersion` + citations |
| **6B.2.7** | Approval routing integration | 6B.2.6 | **Done** — `ApprovalRoutingService`, orchestrator |
| **6B.2.8** | PDF/HTML adapters | 6B.2.7 | Pending |
| **6B.2.9** | Web Ingestion Control Center | 6B.2.7 | Pending |

**Verification (2026-05-31):** `docs/reports/phase-6b2-import-pipeline-verification.md` — **PASS WITH CONDITIONS** (3.9/5); audit/remediation applied for sync CSV path.

### Delivered artifacts

**Migration:** `20260614120000_ai_phase6b2_knowledge_import_pipeline`

**Module:** `src/modules/ai/knowledge-import/`

**Admin API:**

| Method | Path |
|--------|------|
| GET | `/import/profiles` |
| POST | `/import/runs` |
| GET | `/import/runs` |
| GET | `/import/runs/:importRunId` |

**Verification:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — 319 tests passed

---

## 13. Success metrics

| Metric | Target |
|--------|--------|
| Import runs with full provenance chain | 100% |
| Validated versions with ≥1 citation at creation | 100% |
| Silent duplicate entity creation | 0 |
| Clinical dose conflict silent overwrite | 0 |
| Validation quarantine without reason code | 0 |
| HIGH/CRITICAL imports reaching vet queue | 100% |
| Document re-import idempotent skip accuracy | 99.9% |
| Dual-write consistency (migration period) | 99.9% |

---

## Appendix A — Source family → adapter quick reference

| Family | adapterId | Media | LLM |
|--------|-----------|-------|-----|
| Veterinary Books | `pdf-textbook-v2` | PDF | Optional tables |
| Clinical Guidelines | `docx-protocol-v2` | DOCX, PDF | Optional |
| BPA/WPA | `html-guideline-v1` | HTML, PDF | No |
| Govt Livestock Manuals | `pdf-govt-bn-en-v1` | PDF | No |
| Medicine References | `csv-medicine-v2` | CSV, JSON | No |
| Vaccine References | `csv-vaccine-schedule-v2` | CSV, JSON | No |
| Feed References | `csv-feed-composition-v2` | CSV, JSON | No |

---

## Appendix B — Validation reason codes

| Code | Stage | Typical resolution |
|------|-------|-------------------|
| `LICENSE_EXPIRED` | V0 | Renew license |
| `AI_EXTRACTION_DENIED` | V0 | Manual extract or different adapter |
| `MANIFEST_MISMATCH` | V1 | Re-upload corrected file |
| `SCHEMA_VIOLATION` | V2 | Fix adapter mapping |
| `EN_REQUIRED` | V3 | Re-extract or manual EN |
| `BN_PENDING` | V3 | Route to LANGUAGE_BN review |
| `INCOMPLETE_CLINICAL` | V4 | Quarantine or waive with audit |
| `CITATION_COUNT_INSUFFICIENT` | Post-normalize | Add spans manually |
| `QUARANTINE_CONFLICT` | Dedup | Merge UI |

---

## Appendix C — Relationship to legacy KIS

| Legacy (`knowledge-ingestion/`) | Phase 6B.2 target |
|--------------------------------|-------------------|
| `source-registry.service.ts` | Extend with family profiles |
| `import-pipeline.service.ts` | Split into import + validation orchestrators |
| `knowledge-normalizer.ts` | Becomes L2/L3 layers in normalization pipeline |
| `editorial-workflow.service.ts` | Replaced by VKF review routing |
| `AiKnowledgeEntry` writes | Retired after dual-write migration |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **KIP** | Knowledge Import Pipeline — Phase 6B.2 orchestration |
| **KIS** | Knowledge Ingestion System — Phase 6B legacy module |
| **VKF** | Veterinary Knowledge Foundation — Phase 6B.1 persistence |
| **RawExtract** | Span-bound intermediate between parse and normalize |
| **NormalizedEntityDraft** | Pre-VKF envelope ready for dedup |
| **Validation Queue** | Rule gate between extract and normalize |
| **Import Queue** | I/O gate for parse and extract |

---

**Document owner:** Principal Knowledge Ingestion Architect  
**Next review:** Upon 6B.1.4 dual-write design sign-off or first adapter v2 spike
