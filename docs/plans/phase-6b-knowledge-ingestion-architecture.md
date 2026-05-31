# Phase 6B — Knowledge Ingestion Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary Knowledge Engineer  
**Date:** 2026-05-31  
**Status:** Phase 6B.0–6B.7 implemented — 2026-05-31  
**Version:** 1.1.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL entity model, workflows, evidence, retrieval contract)
- `docs/plans/ai-core-platform-phase-1-foundation.md`
- `docs/plans/ai-phase-4-router-engine.md`
- `docs/ai/AI_ECOSYSTEM_MASTER_PLAN.md`

---

## Implementation progress

| Sub-phase | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **6B.0** | Source Registry + Import Run ledger | **Done** | `AiKnowledgeSource*`, `AiKnowledgeImportRun` |
| **6B.1** | CSV/JSON row import adapter (`csv-generic-v1`) | **Done** | `KnowledgeImportPipelineService.runImport` |
| **6B.2** | Normalization + dedup keys | **Done** | `knowledge-normalizer.ts` |
| **6B.3** | Evidence + confidence engines | **Done** | Provisional cap 0.65 |
| **6B.4** | Chunk + citation pipeline | **Done** | STAGING chunks; RAG via published chunks |
| **6B.5** | Editorial + vet + publish workflows | **Done** | Extends `AiKnowledgeEntry` status enum |
| **6B.6** | Admin API routes | **Done** | sources, imports, review/vet queues |
| **6B.7** | Unit tests + AI typecheck gate | **Done** | `knowledge-ingestion.test.ts` |
| **6B.8** | PDF/HTML adapters, BullMQ workers | **Pending** | Phase 6B follow-up |
| **6C.0** | Embedding index on publish | **Pending** | See `docs/plans/phase-6c-rag-architecture.md` |

### Delivered artifacts

**Migration:** `20260611120000_ai_phase6b_knowledge_ingestion`

**Module:** `src/modules/ai/knowledge-ingestion/`

```
knowledge-ingestion/
├── registry/source-registry.service.ts
├── pipeline/import-pipeline.service.ts
├── chunking/chunk-pipeline.service.ts
├── citation/citation.service.ts
├── scoring/evidence-level.engine.ts
├── scoring/confidence.engine.ts
├── normalization/knowledge-normalizer.ts
├── workflow/editorial-workflow.service.ts
├── workflow/vet-approval-workflow.service.ts
└── workflow/publish-workflow.service.ts
```

**Admin API (legacy compat):**

| Method | Path |
|--------|------|
| GET/POST | `/api/admin/ai-ops/knowledge/sources` |
| GET/POST | `/api/admin/ai-ops/knowledge/imports` |
| GET | `/api/admin/ai-ops/knowledge/review-queue` |
| GET | `/api/admin/ai-ops/knowledge/vet-queue` |
| POST | `/api/admin/ai-ops/knowledge/[id]/review` |
| POST | `/api/admin/ai-ops/knowledge/[id]/vet-approve` |
| POST | `/api/admin/ai-ops/knowledge/[id]/publish` | (existing — now uses publish workflow)

**Integration:**

- `AiKnowledgeService.publish()` → `KnowledgePublishWorkflowService` (promotes STAGING → PUBLISHED chunks)
- `AiKnowledgeService.retrieveForRag()` prefers published chunks with inline citations (AiRouterEngine / chat v2 compatible)
- `AiModule` registers all ingestion services

**Verification:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — 272 tests passed  
**QA report:** `docs/reports/phase-6b-knowledge-verification.md` — PASS WITH CONDITIONS (2026-05-31)

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Ingestion pipeline, source registry, normalization, queues, chunk staging, workers |
| `pranidoctor-web` | Ingestion Control Center — upload, batch monitor, review/approval queues, source catalog |
| `pranidoctor_user` | No direct ingestion; consumes published VKL only |

**Phase numbering alignment:**

| Phase | Scope |
|-------|--------|
| **6A** | Veterinary Knowledge Layer — entity model, graph, retrieval profiles |
| **6B** | **This document** — ingestion from external sources into VKL draft/review state |
| **6C** | Post-publish embedding index + hybrid RAG (triggered by ingestion publish events; defined in 6A § RAG) |

---

## Executive summary

Phase 6A defines **what** curated knowledge looks like inside the VKL (entities, evidence, workflows, chunks). Phase 6B defines **how** authoritative veterinary material enters the VKL from textbooks, protocols, association guidelines, government bulletins, and structured reference datasets — safely, traceably, and without bypassing human editorial and veterinary gates.

The **Knowledge Ingestion System (KIS)** is a multi-stage pipeline:

1. **Register** every upstream document in a canonical **Source Registry**.
2. **Import** raw artifacts (PDF, DOCX, CSV, HTML, API feeds) through typed **Import Adapters**.
3. **Normalize** extracted content into VKL **entity envelope drafts** with domain JSON Schema validation.
4. **Deduplicate** against the published corpus and in-flight batches.
5. **Version** as new drafts or superseding versions of existing entities.
6. **Queue** for **Editorial Review** then **Vet Approval** per Phase 6A rules.
7. **Chunk** and attach **citations** at ingest time (boundaries stable for Phase 6C embedding).
8. **Assign evidence levels and confidence scores** (provisional at ingest; finalized at publish).

**No content reaches `PUBLISHED` status through ingestion alone.** Ingestion terminates at validated, attributed, scored **drafts** entering human queues — or at **auto-staged reference rows** for LOW-risk farm-management facts pending expedited review.

This document is **architecture only**. No workers, schemas, or UI are implemented here.

---

## Strategic intent

| Without KIS | With KIS (Phase 6B) |
|-------------|---------------------|
| Manual copy-paste into admin CMS | Batch import from registered sources with audit trail |
| Inconsistent citations | **Locator-preserving** citations (page, section, table, row) |
| Duplicate disease/drug entries | **Deterministic dedup** keys + merge proposals |
| AI-extracted facts without provenance | Every extracted field linked to **source span** |
| Chunk boundaries ad hoc at embed time | **Chunking at ingest** aligned to `chunkPolicyId` |
| Evidence/confidence assigned ad hoc at publish | **Provisional scoring at ingest**, finalized after review |
| No import observability | **Ingestion run ledger** with per-record outcomes |

---

## Design principles

| Principle | Ingestion interpretation |
|-----------|-------------------------|
| **Source before content** | No import without `VkSourceDocument` registration and license check |
| **Extract, don’t invent** | Pipeline outputs only text/fields traceable to source spans; gaps remain empty |
| **Human gate for clinical action** | HIGH/CRITICAL entities always enter review queues — never auto-publish |
| **Immutable import artifacts** | Raw files stored append-only; re-import creates new `importRunId` |
| **Idempotent batches** | Same source + edition + checksum → no duplicate draft explosion |
| **Locale pipeline** | EN extraction first for textbooks; BN translation is a separate staged step with reviewer gate |
| **Fail partial, report all** | Batch continues on row failure; failed rows quarantined with reason |
| **Router isolation** | LLM used in ingestion routes through `DOCUMENT_ANALYSIS` only — no farmer PII |
| **Regulatory sensitivity** | BD government and medicine sources flagged for **Regulatory Editor** path |
| **Chunk once** | Chunk boundaries computed at ingest on approved content; re-chunk only on `chunkPolicyId` change |

---

## Ingestion system overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                    KNOWLEDGE INGESTION SYSTEM (KIS)                                   │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│  EXTERNAL SOURCES                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────┐│
│  │ Textbooks  │ │ Protocols  │ │ BPA/WPA    │ │ Govt DLS   │ │ Structured refs    ││
│  │ (PDF)      │ │ (PDF/DOCX) │ │ guidelines │ │ bulletins  │ │ (CSV/JSON/API)     ││
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────────┬──────────┘│
│        └──────────────┴──────────────┴──────────────┴────────────────────┘            │
│                                    │                                                  │
│                                    ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                        SOURCE REGISTRY                                       │    │
│  │  VkKnowledgeSource (catalog) + VkSourceDocument (artifact) + LicenseRecord   │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                  │
│                                    ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐    │
│  │                     KNOWLEDGE IMPORT PIPELINE                                │    │
│  │  Intake → Parse → Extract → Normalize → Dedup → Version → Score → Chunk    │    │
│  └─────────────────────────────────────────────────────────────────────────────┘    │
│                                    │                                                  │
│              ┌─────────────────────┼─────────────────────┐                           │
│              ▼                     ▼                     ▼                           │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐               │
│  │ Editorial Review  │  │  Vet Approval     │  │  Quarantine       │               │
│  │ Queue             │  │  Queue            │  │  (failed rows)    │               │
│  └─────────┬─────────┘  └─────────┬─────────┘  └───────────────────┘               │
│            │                      │                                                  │
│            └──────────┬───────────┘                                                  │
│                       ▼                                                              │
│              ┌─────────────────┐                                                       │
│              │ VKL PUBLISHED   │ ──event──► Phase 6C Embedding Index                 │
│              └─────────────────┘                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Backend module placement (conceptual)

```
src/modules/ai/knowledge-ingestion/
├── registry/           # Source + document catalog, licenses
├── adapters/           # Per-source-type import adapters
├── pipeline/           # Orchestrator, stage contracts
├── extractors/         # PDF, table, schedule parsers
├── normalization/      # Domain mappers, unit/species normalization
├── deduplication/      # Keys, fuzzy match, merge proposals
├── versioning/         # Draft fork, supersede detection
├── scoring/            # Provisional evidence + confidence
├── chunking/           # Chunk policy executors, citation spans
├── queues/             # Editorial + vet queue writers
└── audit/              # Import run ledger, lineage
```

Workers use existing BullMQ scaffold (`ai:embedding` extended with `knowledge:import`, `knowledge:normalize`, `knowledge:chunk`).

---

## Source catalog — upstream source types

### Authoritative source classes

| Source class | Examples | Primary VKL domain(s) | Default evidence ceiling |
|--------------|----------|----------------------|--------------------------|
| **Veterinary textbooks** | Radostits, Blood & Studdert, local BVSc curricula | DISEASE, MEDICINE, CLINICAL_PROTOCOL | L3 (textbook) → assign L2 until vet confirms |
| **Clinical protocols** | Hospital SOPs, university teaching hospital pathways | CLINICAL_PROTOCOL, EMERGENCY | L2–L3 |
| **BPA guidelines** | Bangladesh Poultry Association biosecurity, vaccination guides | DISEASE, VACCINE, FARM_MGMT | L2 |
| **WPA guidelines** | World Poultry Association welfare, disease control summaries | DISEASE, VACCINE | L3–L4 |
| **Government livestock guidelines** | DLS extension manuals, NDCC advisories, DoF circulars | FARM_MGMT, REGULATORY_BD, VACCINE | L2 (govt extension) |
| **Vaccine schedules** | Manufacturer PI, DLS national schedule, NGO calendars | VACCINE | L5 if registered label; L2 if extension calendar |
| **Medicine references** | BNFDA/DGD lists, formulary compendia, WHO vet essential meds | MEDICINE, REGULATORY_BD | L5 (registration) / L3 (formulary) |
| **Feed references** | NRC requirements, BAU feed composition tables, FAO Feedipedia | FEED | L3–L4 |
| **Breed references** | DLS breed monographs, FAO breed profiles, performance handbooks | BREED | L2–L3 |
| **Emergency protocols** | Field emergency manuals, FAO flock health emergency, CVQ-approved SOPs | EMERGENCY | L2; L1 only after vet review for farmer-facing |

### Source Registry architecture

Phase 6A defines **`VkKnowledgeSource`** (bibliographic catalog entry). Phase 6B adds **`VkSourceDocument`** (importable artifact) and **`VkSourceLicense`**.

#### `VkKnowledgeSource` (catalog entry — extends 6A)

| Field | Description |
|-------|-------------|
| `sourceId` | Stable UUID |
| `sourceKey` | Unique slug e.g. `dls-poultry-vaccination-2024` |
| `sourceClass` | Enum — see source classes above |
| `sourceType` | Maps to 6A: `TEXTBOOK`, `GOVT_EXTENSION`, `PEER_REVIEWED`, etc. |
| `titleBn`, `titleEn` | Display titles |
| `publisher`, `publishYear`, `edition` | Bibliographic |
| `jurisdiction` | `BD`, `GLOBAL`, `SAARC`, etc. |
| `trustTier` | 1–4 (ingestion never elevates above registry default without admin) |
| `defaultEvidenceLevel` | Suggested L1–L5 for entities sourced primarily here |
| `allowedDomains[]` | Which VKL domains this source may populate |
| `licenseId` | FK → `VkSourceLicense` |
| `refreshPolicyDays` | Re-import cadence |
| `status` | `ACTIVE`, `DEPRECATED`, `RETIRED` |

#### `VkSourceDocument` (artifact instance)

| Field | Description |
|-------|-------------|
| `documentId` | Stable UUID |
| `sourceId` | FK → catalog |
| `documentVersion` | Edition / revision label |
| `mediaType` | `PDF`, `DOCX`, `CSV`, `JSON`, `HTML`, `API_SNAPSHOT` |
| `storageUri` | Object storage path (immutable) |
| `checksumSha256` | Dedup imports |
| `pageCount`, `languagePrimary` | Parse hints |
| `ingestedAt`, `supersedesDocumentId` | Lineage |
| `parseProfileId` | Which extractor config to use |
| `rightsNote` | Internal rights documentation |

#### `VkSourceLicense`

| Field | Description |
|-------|-------------|
| `licenseId` | UUID |
| `licenseType` | `PUBLIC_DOMAIN`, `GOVT_OPEN`, `PURCHASED`, `SUBSCRIPTION`, `PARTNER_MO`, `INTERNAL` |
| `allowsAiExtraction` | Boolean — gate for LLM-assisted extract |
| `allowsFarmerDistribution` | Boolean |
| `allowsVerbatimQuote` | Boolean |
| `expiryDate` | Subscription end |
| `attributionTemplateBn`, `attributionTemplateEn` | Required citation boilerplate |

**Rule:** Import adapter refuses to run if `allowsAiExtraction=false` and adapter requires LLM extraction.

---

## Knowledge Import Pipeline

### Pipeline stages

```
INTAKE → VALIDATE → PARSE → EXTRACT → NORMALIZE → DEDUP → VERSION
  → ASSIGN_EVIDENCE → ASSIGN_CONFIDENCE → CHUNK → CITATE → QUEUE → (human) → PUBLISH
```

| Stage | Input | Output | Failure mode |
|-------|-------|--------|--------------|
| **INTAKE** | Upload / URL / API pull | `VkImportRun` + staged blob | Reject unsupported media |
| **VALIDATE** | Blob + manifest | License + checksum OK | Quarantine |
| **PARSE** | Raw document | `ParsedDocument` (blocks, tables, pages) | Partial parse + warning |
| **EXTRACT** | Parsed blocks | `RawExtract[]` with spans | Row-level quarantine |
| **NORMALIZE** | Raw extracts | `VkEntityDraft[]` | Schema validation errors |
| **DEDUP** | Drafts | Draft + `DedupDecision` | Merge queue |
| **VERSION** | Deduped drafts | `versionId` or new `entityId` | Conflict freeze |
| **ASSIGN_EVIDENCE** | Drafts | `provisionalEvidenceLevel` | Default to source ceiling |
| **ASSIGN_CONFIDENCE** | Drafts | `provisionalConfidenceScore` | Cap until review |
| **CHUNK** | Draft body + structure | `VkIngestChunk[]` (staging) | Policy violation |
| **CITATE** | Chunks + spans | `citationAnchors[]` | Missing locator warning |
| **QUEUE** | Valid drafts | Editorial or Vet queue item | — |

### Import run ledger (`VkImportRun`)

| Field | Purpose |
|-------|---------|
| `importRunId` | Batch correlation |
| `sourceId`, `documentId` | Lineage |
| `adapterId`, `pipelineVersion` | Reproducibility |
| `startedAt`, `completedAt`, `status` | `RUNNING`, `COMPLETED`, `PARTIAL`, `FAILED` |
| `statsJson` | `{ total, created, updated, merged, quarantined, skipped }` |
| `triggeredByUserId` | Admin audit |
| `errorSummary` | Top failures |

Every draft records `provenanceJson.importRunId` for traceability.

### Import adapters

| adapterId | Source classes | Input | Extract strategy |
|-----------|----------------|-------|------------------|
| `pdf-textbook-v1` | Textbooks, protocols | PDF | Layout-aware parse + heading hierarchy; optional LLM table struct (DOCUMENT_ANALYSIS) |
| `pdf-govt-bulletin-v1` | DLS guidelines | PDF | Two-column BN/EN detect; section codes |
| `docx-protocol-v1` | Clinical protocols | DOCX | Step-numbered SOP extraction |
| `csv-medicine-v1` | Medicine references | CSV | Row → `Drug` / `Formulation` |
| `csv-vaccine-schedule-v1` | Vaccine schedules | CSV | Row → `VaccinationSchedule` |
| `csv-feed-composition-v1` | Feed references | CSV | Row → `FeedIngredient` |
| `csv-breed-v1` | Breed references | CSV | Row → `Breed` + `BreedStandard` |
| `json-emergency-v1` | Emergency protocols | JSON | Pre-structured `EmergencyCondition` + steps |
| `html-bpa-wpa-v1` | BPA/WPA web guidelines | HTML | Readability extract + manual review flag |
| `api-regulatory-snapshot-v1` | DGD lists (future) | JSON/API | Registration rows → `DrugRegistration` |

Adapters declare: `outputDomains[]`, `defaultChunkPolicyId`, `requiresVetApproval`, `dedupKeyFields[]`.

### Orchestration

- **Sync path:** Small CSV (<500 rows) — inline admin upload.
- **Async path:** PDF textbooks, large batches — BullMQ `knowledge:import` job chain.
- **Re-import:** New `documentId` or checksum change → supersede detection; never overwrite published versions.
- **Dry-run mode:** Full pipeline through DEDUP; no queue write — returns preview report.

---

## Knowledge Normalization

Normalization maps **`RawExtract` → `VkEntityDraft`** conforming to Phase 6A envelope + domain `structuredJson` schema.

### Normalization layers

```
┌─────────────────────────────────────────────────────────────┐
│ L1 — Structural   │ headings → entity boundaries            │
│ L2 — Lexical      │ units, species codes, drug names        │
│ L3 — Semantic     │ entityType classification (rules + LLM) │
│ L4 — Graph        │ suggested links (TREATED_WITH, etc.)    │
│ L5 — Locale       │ BN summary generation (optional stage)  │
└─────────────────────────────────────────────────────────────┘
```

### L2 — Lexical normalization rules

| Dimension | Canonical form | Examples |
|-----------|----------------|----------|
| **Species** | `LivestockSpecies` enum | “cattle” → `COW`, “murgi” → `CHICKEN` |
| **Weight / dose** | SI + per-kg | “mg/kg BW”, ml → numeric |
| **Temperature** | Celsius | F → C conversion flagged |
| **Drug names** | INN generic primary | Brand → generic map table |
| **Disease names** | `diseaseCode` if known | Alias table BD colloquial → code |
| **Region** | `regionScope` | Default `BD` for DLS sources |
| **Dates** | ISO 8601 | Schedule ages in days/weeks |

### L3 — Semantic classification

| Method | When used |
|--------|-----------|
| Rule-based | CSV adapters with fixed mapping |
| Pattern | Section title regex (“Treatment”, “Dosage”, “Withdrawal”) |
| LLM assist | Ambiguous textbook paragraphs — **span-bound** extraction only via `DOCUMENT_ANALYSIS` with schema-constrained JSON output |

**LLM guardrails:** Input = single section text + source metadata; output must include `sourceSpanRef`; no free generation of numeric doses without span match.

### Domain mapping from source class

| Source class | Default entity types produced |
|--------------|------------------------------|
| Textbooks | `Disease`, `Drug`, `TreatmentPathway` |
| Clinical protocols | `SOP`, `DiagnosticWorkup`, `TreatmentPathway` |
| BPA/WPA | `BiosecurityMeasure`, `VaccinationSchedule`, `Disease` |
| Govt guidelines | `HerdHealthProgram`, `SeasonalCalendar`, `DrugRegistration` |
| Vaccine schedules | `VaccinationSchedule`, `Vaccine` |
| Medicine refs | `Drug`, `Formulation`, `WithdrawalRule` |
| Feed refs | `FeedIngredient`, `NutrientRequirement` |
| Breed refs | `Breed`, `BreedStandard`, `PerformanceBenchmark` |
| Emergency protocols | `EmergencyCondition`, `FirstAidStep`, `TriageRule` |

### Normalization validation

- JSON Schema validation per `entityType` — hard fail → quarantine.
- **Clinical completeness checklist** per type (e.g. `Drug` requires dose OR explicit “see formulation”).
- **Locale gate:** EN required at normalize; BN may be `null` → flagged `BN_PENDING` for translation queue.

---

## Deduplication

### Dedup scope

| Scope | Question |
|-------|----------|
| **Intra-batch** | Duplicate rows within same `importRunId` |
| **Corpus** | Match against published + in-review drafts |
| **Cross-source** | Same fact from textbook vs govt bulletin |

### Dedup key hierarchy

**Primary keys (exact match → auto-merge proposal):**

| entityType | dedupKey components |
|------------|---------------------|
| `Disease` | `diseaseCode` OR normalized(`titleEn`) + species |
| `Drug` | normalized INN + `formulation.strength` + `form` |
| `Vaccine` | normalized antigen + manufacturer |
| `FeedIngredient` | `ingredientCode` OR normalized name |
| `Breed` | `breedCode` OR normalized name + species |
| `VaccinationSchedule` | species + vaccine antigen + ageWindow |
| `EmergencyCondition` | normalized title + species |
| `DrugRegistration` | `registrationNo` + authority |

**Secondary keys (fuzzy → review merge queue):**

- Trigram similarity on `titleEn` / `titleBn` ≥ 0.92
- Embedding similarity ≥ 0.95 (Phase 6C optional assist — not required for 6B)

### Dedup decisions

| Decision | Action |
|----------|--------|
| `CREATE_NEW` | New `entityId` + draft v1 |
| `SUPERSEDE` | New version on existing `entityId`; link new source attribution |
| `MERGE_FIELDS` | Patch empty fields on existing draft; conflicting fields → human merge UI |
| `SKIP_DUPLICATE` | Same source + checksum + entity key already ingested |
| `QUARANTINE_CONFLICT` | Irreconcilable dose/contraindication conflict |

**Clinical conflict rule:** Conflicting dose or withdrawal between sources → `QUARANTINE_CONFLICT`; never silent overwrite.

### Merge proposal artifact (`VkDedupMergeProposal`)

Contains: left/right entity snapshots, conflicting fields, suggested resolution, assigned reviewer.

---

## Version Control (ingestion perspective)

Ingestion interacts with Phase 6A version model:

| Scenario | Ingestion behavior |
|----------|-------------------|
| New entity | Create `entityId`, `versionNumber=1`, `status=DRAFT` |
| Same entity, new source evidence | New version draft; `supersedesVersionId` = current published |
| Same entity, corrected extract | New draft version; `changeSummary` = "Ingestion correction from {sourceKey}" |
| Re-import same document checksum | Idempotent skip |
| New document edition | Supersede `VkSourceDocument`; trigger diff-import job |

### Ingestion-specific version metadata

```json
{
  "origin": "INGESTION",
  "importRunId": "uuid",
  "documentId": "uuid",
  "sourceSpanRefs": ["p.142:para3", "table-4:row-2"],
  "extractorVersion": "pdf-textbook-v1.2.0",
  "aiAssisted": true,
  "previousVersionId": "uuid-or-null"
}
```

### Diff on re-import

When `documentVersion` changes:

1. Compute extract diff vs prior import.
2. Changed entities → new draft versions.
3. Unchanged → skip.
4. Removed sections → flag existing entities for **deprecation review** (not auto-deprecate).

---

## Editorial Review Queue

Ingestion writes to the same **`VkKnowledgeReview`** queue defined in Phase 6A, with ingestion-specific flags.

### Queue item enrichment

| Field | Purpose |
|-------|---------|
| `queueSource` | `INGESTION` \| `MANUAL` \| `API` |
| `importRunId` | Batch link |
| `autoGenerated` | true for LLM-assisted extracts |
| `bnPending` | true if BN translation incomplete |
| `dedupDecision` | CREATE / MERGE / CONFLICT |
| `priority` | Derived from `clinicalRiskTier` + source class |

### Priority scoring

```
priorityScore =
  (clinicalRiskTier weight) * 10
+ (CRITICAL source class: emergency) * 20
+ (conflict flag) * 15
+ (age of oldest item in hours) * 0.1
```

### Editorial checklist (ingestion-aware)

| Check | Automated | Human |
|-------|-----------|-------|
| Schema valid | ✅ | — |
| Source span present for doses | ✅ | spot check |
| BN farmer summary readable | — | ✅ if audience FARMER/BOTH |
| Dedup merge acceptable | partial | ✅ |
| Suggested graph links valid | ✅ targets exist | ✅ clinical sensibility |
| Evidence level appropriate | suggest | ✅ confirm/adjust |
| No verbatim copyright violation | length heuristic | ✅ if flagged |

### Expedited path (LOW risk only)

**Eligible:** `FARM_MGMT`, `SeasonalCalendar`, `RecordKeepingTemplate` from `GOVT_EXTENSION` with no clinical dosing.

Flow: INGESTION → automated checks → **single** domain lead approval → publish (skip vet if `clinicalRiskTier=LOW` and checklist 100%).

All other ingested content follows full **IN_REVIEW → VET_APPROVAL** path.

---

## Vet Approval Queue

Items entering vet queue when Phase 6A rules apply, plus ingestion triggers:

| Trigger | Example |
|---------|---------|
| Entity type in vet-required set | `Drug`, `WithdrawalRule`, `EmergencyCondition` |
| `clinicalRiskTier` HIGH/CRITICAL | Medicine doses from textbook |
| `autoGenerated=true` + clinical fields | Any LLM-extracted dose |
| Source class | Medicine refs, emergency protocols, vaccine schedules with off-label species |
| Dedup `QUARANTINE_CONFLICT` resolved | CVQ only |

### Vet queue presentation

- Side-by-side: **source PDF snippet** (page image crop) + normalized fields.
- Highlight: extracted doses, withdrawal days, contraindications.
- Actions: `APPROVE`, `REQUEST_CHANGES`, `REJECT`, `LOWER_EVIDENCE`, `ESCALATE_CVQ`.
- On approve: finalize `evidenceLevel`, recompute `confidenceScore`, lock `sourceAttributions`.

### Provisional → final scoring

| Field | At ingest | At vet approve |
|-------|-----------|----------------|
| `evidenceLevel` | provisional (source default capped) | final |
| `confidenceScore` | provisional (capped ≤ 0.65) | final (full formula) |
| `clinicalRiskTier` | inferred | confirmed |

**Cap rule:** Ingested drafts never exceed `confidenceScore 0.65` until vet approval.

---

## Chunking Strategy

Chunking executes **after normalization, before queue** (staging chunks) and **re-confirms on publish** (immutable `VkKnowledgeChunk`).

### Design goals

- Align with Phase 6A `chunkPolicyId` per domain.
- Preserve **citation anchors** per chunk.
- Optimize for 256–512 token targets (embedding model friendly).
- Never split structured tables mid-row.

### Chunk policies

| chunkPolicyId | Domain / entity | Boundary rules | Target tokens |
|---------------|-----------------|----------------|---------------|
| `DISEASE_BY_HEADING` | Disease | H2/H3 sections: signs, diagnosis, treatment | 300–450 |
| `MEDICINE_BY_SECTION` | Drug | Indications, dose, contraindications, withdrawal separate chunks | 200–350 |
| `PROTOCOL_BY_STEP` | SOP, TreatmentPathway | One chunk per numbered step | 150–300 |
| `SCHEDULE_BY_ROW` | VaccinationSchedule | One chunk per species-age row + header context | 100–200 |
| `FEED_BY_INGREDIENT` | FeedIngredient | One chunk per ingredient profile | 200–400 |
| `BREED_BY_SECTION` | Breed | Standard, performance, management sections | 300–400 |
| `EMERGENCY_BY_ACTION` | Emergency | Condition summary + each first-aid step | 150–250 |
| `REGULATORY_BY_RECORD` | DrugRegistration | One chunk per registration row | 100–180 |
| `GOVT_BY_SECTION` | Farm mgmt bulletins | Section-based; preserve checklist integrity | 350–500 |

### Chunk record (`VkIngestChunk` staging → `VkKnowledgeChunk` on publish)

| Field | Description |
|-------|-------------|
| `chunkId` | Staging UUID |
| `versionId` | Parent draft version |
| `chunkIndex` | Order within version |
| `chunkPolicyId` | Policy applied |
| `contentBn`, `contentEn` | Locale text |
| `tokenEstimate` | Pre-embed budget |
| `structuredOverlay` | Optional JSON slice (dose table) |
| `sourceSpanRefs[]` | Locators covered by this chunk |
| `headingPath` | e.g. `"Chapter 4 > Mastitis > Treatment"` |

### Overlap policy

- Adjacent narrative chunks: **50-token overlap** only for `DISEASE_BY_HEADING` and `GOVT_BY_SECTION`.
- Structured chunks: **no overlap**.
- Emergency steps: **no overlap** (safety-critical clarity).

### Re-chunk triggers

| Event | Action |
|-------|--------|
| Publish | Promote staging → canonical chunks |
| `chunkPolicyId` change | New draft version + full re-chunk |
| Body edit in review | Re-chunk affected sections only |

---

## Citation Strategy

### Citation layers

| Layer | Consumer | Format |
|-------|----------|--------|
| **L0 — Span ref** | Internal lineage | `documentId:page:paragraph` |
| **L1 — Human citation** | Admin UI, mobile detail | APA-like BN/EN from `VkKnowledgeSource` |
| **L2 — Inline chunk citation** | RAG / LLM context | `[sourceKey|p.142]` |
| **L3 — Structured attribution** | `KnowledgeContextPack` | Phase 6A `sourceAttributions[]` |

### Locator model (`SourceSpanRef`)

```json
{
  "documentId": "uuid",
  "page": 142,
  "sectionId": "ch4-mastitis-treatment",
  "paragraphIndex": 3,
  "tableId": null,
  "rowIndex": null,
  "charStart": 10234,
  "charEnd": 10890,
  "quoteHash": "sha256-of-excerpt"
}
```

### Citation rules by source class

| Source class | Required locators | Verbatim quote limit |
|--------------|-------------------|----------------------|
| Textbooks | Page + section | ≤ 90 words per chunk without rights review |
| Govt bulletins | Document ref + section code | Full checklist may be quoted if `GOVT_OPEN` |
| CSV refs | Row index + column map | N/A |
| BPA/WPA web | URL snapshot date + heading | Link + summary |
| Medicine registration | Registration number | Verbatim legal text allowed |

### Citation generation pipeline

1. Extractor captures char offsets during PARSE.
2. NORMALIZE binds each field to `sourceSpanRefs[]`.
3. CHUNK aggregates spans per chunk.
4. CITATE renders `citationBn`/`citationEn` via `attributionTemplate` + locators.
5. On publish, citations become immutable on version.

---

## Source Attribution (ingestion)

Each ingested entity version carries **one primary + optional secondary attributions**:

```json
{
  "sourceAttributions": [
    {
      "sourceId": "catalog-uuid",
      "documentId": "artifact-uuid",
      "contributionWeight": 1.0,
      "pageRef": "pp. 140–143",
      "sectionRef": "Treatment of mastitis",
      "quotedFrom": false,
      "accessedAt": "2026-05-31",
      "importRunId": "uuid"
    }
  ]
}
```

### Multi-source merges

When `MERGE_FIELDS` combines textbook + govt bulletin:

- Primary = highest `trustTier` (lower number).
- Secondary attributions with `contributionWeight` proportional to fields sourced.
- Conflicting fields retain **both** attributions until vet resolves.

### Attribution completeness gates

| Gate | Rule |
|------|------|
| Queue entry | ≥1 attribution with valid `documentId` |
| Vet approval | Primary source `trustTier ≤ 2` for HIGH/CRITICAL |
| Publish | All structured dose fields have span ref |

---

## Evidence Level Assignment

### Assignment pipeline

```
Source defaultEvidenceLevel
        │
        ▼
Entity type ceiling (e.g. textbook extract max L3 until reviewed)
        │
        ▼
Field-level boosts (registration number → L5 for that field)
        │
        ▼
provisionalEvidenceLevel on draft
        │
        ▼
Human review adjust (±1 level max without CVQ)
        │
        ▼
finalEvidenceLevel on publish
```

### Source class → default evidence

| Source class | Default provisional | Ceiling pre-review | Notes |
|--------------|--------------------|--------------------|-------|
| Veterinary textbooks | L3 | L3 | Vet may downgrade to L2 |
| Clinical protocols | L2 | L3 | Internal SOP = L2 |
| BPA/WPA guidelines | L2 | L3 | Association consensus |
| Govt livestock guidelines | L2 | L2 | Extension bulletins |
| Vaccine schedules (registered label) | L5 | L5 | If PI photograph/scrape verified |
| Vaccine schedules (DLS calendar) | L2 | L2 | |
| Medicine references (DGD) | L5 | L5 | Registration primary |
| Medicine references (formulary) | L3 | L4 | |
| Feed references (NRC/FAO) | L4 | L4 | |
| Breed references | L2 | L3 | |
| Emergency protocols | L2 | L2 | L1 only after vet for farmer text |

### Field-level overrides

| Structured field | Evidence boost |
|------------------|----------------|
| `registrationNo` valid | L5 for regulatory fields |
| RCT cited in span | L3 minimum |
| Dose from manufacturer label | L5 |
| Dose from textbook without trial cite | L2 max until vet |

### Downgrade rules

Reviewers may downgrade with mandatory reason code: `OUTDATED`, `SPECIES_MISMATCH`, `BD_CONTEXT_DIFFERS`, `WEAK_SOURCE`, `SUPERSEDED`.

---

## Confidence Assignment

### Provisional confidence at ingest

Ingest computes **upper-bounded** provisional score:

```
provisionalConfidence = min(0.65,
  clamp(
    0.40 * evidenceLevelScore(provisional)
  + 0.35 * sourceTrustScore
  + 0.15 * extractQualityScore
  + 0.10 * dedupConfidence,
  0, 0.65))
```

| Component | Ingest derivation |
|-----------|-------------------|
| `extractQualityScore` | OCR confidence, span match rate, schema completeness |
| `dedupConfidence` | 1.0 if CREATE_NEW; 0.8 if MERGE; 0.5 if fuzzy match |
| `sourceTrustScore` | From `VkKnowledgeSource.trustTier` |

### Final confidence at publish

Phase 6A full formula applies after review completes:

- `reviewCompletenessScore` from checklists.
- `graphConnectivityScore` after link approval.
- `recencyScore` from approval date.

### Confidence caps by ingest path

| Path | Max provisional | Max final without CVQ |
|------|-----------------|----------------------|
| CSV structured (medicine) | 0.55 | 0.85 |
| PDF + LLM assist | 0.50 | 0.80 |
| PDF rules-only extract | 0.60 | 0.85 |
| Govt bulletin rules | 0.65 | 0.90 |
| Conflict merge resolved | 0.45 until vet | 0.75 |

### Retrieval interaction

Until publish, ingested drafts **never** appear in farmer/doctor retrieval. Staging chunks excluded from Phase 6C index until `PUBLISHED` event.

---

## End-to-end flows by source

### Flow A — Veterinary textbook (PDF)

```
Register source → Upload PDF → pdf-textbook-v1
  → Parse chapters → Extract Disease/Drug sections
  → Normalize + dedup → provisional L3/L2
  → CHUNK (DISEASE_BY_HEADING, MEDICINE_BY_SECTION)
  → Editorial queue (BN_PENDING for farmer entities)
  → Vet approval for all Drug doses
  → Publish → embedding job (6C)
```

### Flow B — DLS government livestock guideline

```
Register GOVT_OPEN license → pdf-govt-bulletin-v1
  → BN/EN section detect → FARM_MGMT entities
  → provisional L2, confidence up to 0.65
  → Expedited editorial if LOW risk
  → Publish seasonal calendar entries
```

### Flow C — Vaccine schedule CSV

```
csv-vaccine-schedule-v1 → VaccinationSchedule rows
  → dedup by species+antigen+age
  → SCHEDULE_BY_ROW chunking
  → Vet approval (schedule changes HIGH for poultry)
  → Link PREVENTED_BY to Disease entities (suggested)
```

### Flow D — Medicine reference CSV (DGD registration)

```
csv-medicine-v1 → Drug + DrugRegistration
  → evidence L5 on registration fields
  → REGULATORY_BY_RECORD + MEDICINE_BY_SECTION chunks
  → Regulatory Editor + Vet dual approval
  → Graph link GOVERNED_BY
```

### Flow E — Emergency protocol JSON

```
json-emergency-v1 → EmergencyCondition + FirstAidStep
  → clinicalRiskTier CRITICAL
  → EMERGENCY_BY_ACTION chunks
  → Vet approval mandatory (24h SLA)
  → Integrate TriageRule → AiSymptomNode red flags (human-approved link)
```

### Flow F — BPA/WPA web guideline

```
html-bpa-wpa-v1 → snapshot stored
  → Extract biosecurity + vaccination sections
  → autoGenerated flag → full vet path for vaccination timing
  → Citation includes URL + snapshot date
```

---

## Admin & operations surface (conceptual)

| Area | Route / function |
|------|------------------|
| Source catalog CRUD | `/api/admin/ai-ops/knowledge/sources` |
| Document upload | `/api/admin/ai-ops/knowledge/imports/upload` |
| Import run monitor | `/api/admin/ai-ops/knowledge/imports/:runId` |
| Dry-run preview | `POST .../imports/dry-run` |
| Dedup merge inbox | `/api/admin/ai-ops/knowledge/merges` |
| Editorial queue | `/api/admin/ai-ops/knowledge/review-queue?source=INGESTION` |
| Vet queue | `/api/admin/ai-ops/knowledge/vet-queue` |
| Quarantine | `/api/admin/ai-ops/knowledge/quarantine` |
| Re-import diff | `POST .../sources/:id/reimport` |

Web UI: **Ingestion** tab under Knowledge Control Center — batch progress, error CSV export, source rights expiry alerts.

---

## Security, rights & compliance

| Control | Policy |
|---------|--------|
| **Copyright** | Verbatim limits enforced at CITATE; `allowsVerbatimQuote` from license |
| **PII in sources** | Strip phone/name patterns from extracts; quarantine if detected |
| **LLM data handling** | Document snippets only — no user/farm data in ingestion prompts |
| **Audit** | Every stage transition logged on `VkImportRun` + `VkKnowledgeAuditEvent` |
| **Access** | Ingestion admin role separate from vet reviewer; separation of duties |
| **Retirement** | Source `RETIRED` → block new imports; existing entities scheduled for review |

---

## Observability & success metrics

| Metric | Target |
|--------|--------|
| Import success rate (structured CSV) | ≥ 98% rows |
| Import success rate (PDF textbook) | ≥ 85% sections with valid spans |
| Quarantine rate | < 5% for curated CSV; < 15% for PDF |
| Dedup false-merge rate (manual audit) | < 1% |
| Median ingest-to-editorial-queue time | < 30 min async |
| Attribution completeness at queue | 100% |
| Vet queue SLA (HIGH) | 72h (per 6A) |
| Published entities with ingestion lineage | 100% traceable to `importRunId` |

---

## Phasing (architecture roadmap)

| Sub-phase | Scope | Dependency |
|-----------|-------|------------|
| **6B.0** | Source Registry + Import Run ledger | 6A.0 envelope |
| **6B.1** | CSV adapters (vaccine, feed, breed, medicine) | 6B.0 |
| **6B.2** | Normalization + dedup + version fork | 6A.1 |
| **6B.3** | PDF parse adapters (govt, protocol) | 6B.0 |
| **6B.4** | Textbook PDF + LLM span extract | Router DOCUMENT_ANALYSIS |
| **6B.5** | Chunking + citation pipeline | 6A chunk policies |
| **6B.6** | Editorial + vet queue integration | 6A.3 workflows |
| **6B.7** | Evidence/confidence assignment engine | 6A.2 |
| **6B.8** | BPA/WPA HTML + emergency JSON adapters | 6B.3 |
| **6C.0** | Publish → embedding index (Phase 6A RAG) | 6B.5 |

**No implementation in Phase 6B document scope.**

---

## Appendix A — Source class × adapter × domain matrix

| Source class | Adapter | VKL domains | Vet required |
|--------------|---------|-------------|--------------|
| Veterinary textbooks | `pdf-textbook-v1` | DISEASE, MEDICINE, CLINICAL_PROTOCOL | Yes (doses) |
| Clinical protocols | `docx-protocol-v1` | CLINICAL_PROTOCOL, EMERGENCY | Yes |
| BPA guidelines | `html-bpa-wpa-v1` | VACCINE, FARM_MGMT, DISEASE | Schedule: yes |
| WPA guidelines | `html-bpa-wpa-v1` | DISEASE, VACCINE | Schedule: yes |
| Govt livestock | `pdf-govt-bulletin-v1` | FARM_MGMT, REGULATORY_BD | If medicine cited |
| Vaccine schedules | `csv-vaccine-schedule-v1` | VACCINE | Yes |
| Medicine references | `csv-medicine-v1` | MEDICINE, REGULATORY_BD | Yes |
| Feed references | `csv-feed-composition-v1` | FEED | If toxic alerts |
| Breed references | `csv-breed-v1` | BREED | No |
| Emergency protocols | `json-emergency-v1` | EMERGENCY | Yes (CVQ for CRITICAL) |

---

## Appendix B — Quarantine reason codes

| Code | Meaning | Resolution |
|------|---------|------------|
| `LICENSE_BLOCKED` | Rights prevent extract | Legal review |
| `PARSE_FAILED` | Unreadable PDF | Re-OCR or manual |
| `SCHEMA_INVALID` | Normalization fail | Fix mapping |
| `SPAN_MISSING` | Dose without locator | Re-extract or manual |
| `DEDUP_CONFLICT` | Irreconcilable duplicate | Vet merge |
| `COPYRIGHT_LENGTH` | Verbatim too long | Summarize |
| `PII_DETECTED` | Personal data in source | Redact |
| `SPECIES_UNKNOWN` | Unmapped species | Taxonomy table |
| `UNIT_AMBIGUOUS` | mg vs ml unclear | Expert review |

---

## Appendix C — Ingestion event catalog

| Event | Emitted when |
|-------|--------------|
| `IMPORT_STARTED` | Run created |
| `IMPORT_COMPLETED` | Batch finished |
| `ROW_QUARANTINED` | Single extract failed |
| `DRAFT_CREATED` | New entity draft |
| `VERSION_FORKED` | Supersede draft |
| `MERGE_PROPOSED` | Dedup fuzzy match |
| `CHUNK_STAGED` | Chunks ready |
| `QUEUED_EDITORIAL` | Review item created |
| `QUEUED_VET` | Vet item created |
| `INGEST_PUBLISHED` | Human publish after ingest origin |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| KIS | Knowledge Ingestion System |
| Import adapter | Source-type-specific pipeline plugin |
| Source span | Precise locator within a source document |
| Provisional score | Pre-review evidence/confidence — capped |
| Staging chunk | Pre-publish chunk awaiting vet approval |
| Quarantine | Failed extract isolated from queues |

---

**Document owner:** Principal Veterinary Knowledge Engineer  
**Next review:** Upon Phase 6A.0 schema sign-off and 6B.0 source registry design review
