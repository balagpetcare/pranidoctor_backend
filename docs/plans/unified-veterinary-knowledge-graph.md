# Unified Veterinary Knowledge Graph (UVKG) — Master Plan

**Project:** Prani Doctor  
**Role:** Principal Veterinary Knowledge Architect  
**Date:** 2026-06-01  
**Status:** Planning only — no implementation  
**Version:** 1.0.0  

**Repositories in scope:**

| Repo | Role |
|------|------|
| `pranidoctor-backend` | UVKG schema, `GraphSyncService`, traversal APIs, retrieval integration |
| `pranidoctor-web` | Knowledge Graph Control Center (edge editor, sync health, conflict queue) |
| `pranidoctor_user` | Consumer — indirect via AI Doctor, Feed Advisor, Prescription flows |

**Depends on (existing):**

| Document / module | Relevance |
|-------------------|-----------|
| `phase-6a-veterinary-knowledge-architecture.md` | Original `VkKnowledgeLink` concept, domain model |
| `phase-6b1-knowledge-foundation.md` | `VkKnowledgeEntity` / `VkKnowledgeVersion` |
| `phase-6b4-editorial-governance.md` | Version lifecycle — UVKG edges mirror this |
| `phase-6c-rag-engine-architecture.md` | VRE retrieval contract |
| `feed-intelligence-ecosystem.md` | F1 feed graph + VKL binding |
| `medicine-intelligence-audit.md` | M1 medicine graph + commercial layer |
| `disease-intelligence-master-plan.md` | D2 clinical graph + registry |
| `phase-6e-knowledge-population.md` | Cross-domain edge population targets |

**Explicit constraint:** This document does **not** authorize schema migrations, service code, or production configuration changes.

---

## Executive summary

Prani Doctor operates **four parallel knowledge representations**:

1. **Veterinary Knowledge Layer (VKL)** — versioned entities (`VkKnowledgeEntity`, `VkKnowledgeVersion`) across ten domains, consumed by VRE for hybrid retrieval.
2. **Feed Intelligence graph** — slug-keyed edges in `vk_feed_knowledge_graph_edges`.
3. **Medicine Intelligence graph** — slug-keyed edges in `vk_medicine_knowledge_graph_edges` (clinical + commercial adjacency).
4. **Disease Intelligence graph** — node/edge model in `di_graph_nodes` / `di_graph_edges` with governance status and evidence.

Additionally, a **legacy symptom bridge** (`AiSymptomNode`, `AiSymptomDiseaseLink`) still powers VRE graph expansion for AI Doctor.

The **Unified Veterinary Knowledge Graph (UVKG)** introduces **`VkKnowledgeLink`** as the single governed, cross-domain edge store. Domain graphs remain **write adapters** during migration; UVKG becomes the **read authority** for traversal, retrieval expansion, and safety checks.

**North-star invariant (unchanged):**

> Clinical claims exposed to farmers or paravets MUST traverse **VKL (published versions) → VRE → AI Router**. UVKG supplies **structured relationships** that deterministic engines and retrieval use before and after LLM — never as a substitute for published, attributable content.

---

## Part 1 — Current state analysis

### 1.1 Platform knowledge stack (as-built)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONSUMER PRODUCTS                                    │
│  AI Doctor │ Prescription Assistant │ Feed Advisor │ Vaccine │ Symptom API  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         ┌──────────────────────┐        ┌──────────────────────┐
         │   AI Router /        │        │  Domain intelligence │
         │   AiOrchestrator     │        │  (DIE / MIE / FIE)   │
         │   AiFoundationService│        │  deterministic engines│
         └──────────┬───────────┘        └──────────┬───────────┘
                    │                               │
                    │         ┌─────────────────────┘
                    ▼         ▼
         ┌──────────────────────────────────────────────┐
         │  VRE — KnowledgeRetrievalService              │
         │  lexical + semantic + graph expansion (legacy)  │
         │  → KnowledgeContextPack → AiUsageLog metadata   │
         └──────────────────────┬─────────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
   VkKnowledgeVersion    AiKnowledgeEntry         3 domain graphs
   (10 domains)          (legacy RAG rows)        + legacy symptom links
```

### 1.2 Veterinary Knowledge Layer (VKL)

**Location:** `prisma/schema.prisma` — `VkKnowledgeEntity`, `VkKnowledgeVersion`, supporting tables.

| Concept | Implementation | Notes |
|---------|----------------|-------|
| Stable identity | `VkKnowledgeEntity.id`, `slug`, `domain`, `entityType` | Ten domains in `VkKnowledgeDomain` |
| Versioning | `VkKnowledgeVersion` with `versionNumber`, `status` (`VkVersionStatus`) | Immutable publish chain |
| Structured domain rows | `VkFeedIngredient`, `VkNutrientRequirement`, `MedicineGeneric`, etc. | FK → `versionId` |
| Chunks / embeddings | `VkKnowledgeChunk`, `embeddingStatus` | RAG source of truth |
| Governance | `VkKnowledgeReview`, `VkKnowledgeApproval`, `VkKnowledgeAuditEvent` | Version-scoped |
| Legacy bridge | `legacyEntryId` on entity; `AiKnowledgeEntry` still used by VRE fusion | Dual-read period |

**Domains (`VkKnowledgeDomain`):** `DISEASE`, `MEDICINE`, `VACCINE`, `FEED`, `BREED`, `REPRODUCTION`, `EMERGENCY`, `CLINICAL_PROTOCOL`, `REGULATORY_BD`, `FARM_MGMT`.

**Entity–version relationships:**

- One entity → many versions; pointers `currentPublishedVersionId`, `currentDraftVersionId`.
- Domain registries (e.g. `DiDiseaseRegistry.vkEntityId`, `MedicineGeneric.versionId`) anchor operational intelligence to VKL.

**Gap:** Phase 6A specified `VkKnowledgeLink` for cross-domain edges — **not present in schema**.

### 1.3 Feed Intelligence graph

**Table:** `vk_feed_knowledge_graph_edges`  
**Model:** `VkFeedKnowledgeGraphEdge`  
**Service:** `feed-knowledge.repository.ts` — `createGraphEdge`, `traverseGraph`.

| Property | Value |
|----------|-------|
| Node reference | `fromEntitySlug`, `toEntitySlug` (VKL slugs) |
| Edge identity | Unique on `(edgeType, fromEntitySlug, toEntitySlug)` |
| Governance | **None on edges** — immediate upsert |
| Weight / labels | `weight`, `labelBn`, `labelEn`, `metadataJson` |

**Edge types (`FeedGraphEdgeType`):**

| Edge type | Typical from → to | Purpose |
|-----------|-------------------|---------|
| `NUTRIENT_FOR` | Nutrient requirement → species/stage entity | Formulation grounding |
| `CONTAINS` | Ration template → ingredient | Formulation composition |
| `TOXICITY_OF` | Toxic alert → ingredient | Safety fail-closed |
| `ANTINUTRIENT_IN` | Ingredient → antinutrient profile | Inclusion limits |
| `SEASONAL_AVAILABILITY` | Ingredient → calendar | BD seasonality |
| `SUBSTITUTES_FOR` | Ingredient ↔ ingredient | Substitution |
| `RESTRICTED_FOR` | Ingredient → species/condition | Restriction |

**VKL bindings:** Feed entities (`VkFeedIngredient`, `VkNutrientRequirement`, `VkRationTemplate`, `VkToxicFeedAlert`, `VkSeasonalFeedCalendar`) reference `VkKnowledgeVersion`.

**Retrieval:** `feed-advisor-v1` profile; `FeedAdvisorVreOrchestratorService` → `KnowledgeRetrievalService`.

### 1.4 Medicine Intelligence graph

**Table:** `vk_medicine_knowledge_graph_edges`  
**Model:** `VkMedicineKnowledgeGraphEdge`  
**Service:** `medicine-knowledge.repository.ts`.

| Property | Value |
|----------|-------|
| Node reference | Slugs (generic/brand/company codes as slugs) |
| Governance | **None on edges** — immediate upsert |
| Commercial edges | `SPONSORED_BY` — must not flow to UVKG without `edgeClass=COMMERCIAL` gate |

**Edge types (`MedicineGraphEdgeType`):**

| Edge type | From → to | Purpose |
|-----------|-----------|---------|
| `BRAND_OF_GENERIC` | Brand → generic | Catalog structure |
| `MANUFACTURED_BY` | Brand → company | Commercial registry |
| `SPONSORED_BY` | Brand/generic → contract | **Commercial only** — excluded from clinical UVKG reads |
| `SUBSTITUTES_FOR` | Generic ↔ generic | Therapeutic alternatives |
| `CONTRAINDICATED_WITH` | Generic → disease/condition slug | Safety |
| `INTERACTS_WITH` | Generic ↔ generic | Interaction checking |
| `SAME_THERAPEUTIC_CLASS` | Generic ↔ generic | Clustering |
| `SAME_DRUG_CLASS` | Generic ↔ generic | Clustering |

**VKL bindings:** `MedicineGeneric.versionId` → `VkKnowledgeVersion`; optional `knowledgeEntryId` → legacy entry.

**Retrieval:** `MedicineKnowledgeRetrievalService` → `prescription-v1`; `MedicineAiRouterService` routes to MIE + VRE.

### 1.5 Disease Intelligence graph

**Tables:** `di_graph_nodes`, `di_graph_edges`, `di_graph_edge_evidence`  
**Services:** `DiseaseGraphService`, `DiseaseIntelligenceRepository`.

| Property | Value |
|----------|-------|
| Node model | `DiGraphNode` — `nodeKind`, `refId`, optional `registryId`, `legacySymptomNodeId` |
| Edge model | `DiGraphEdge` — `fromNodeId`, `toNodeId`, `edgeType`, `weight`, `species[]`, `evidenceLevel`, `status` |
| Governance | `DiGraphEdgeStatus`: `DRAFT`, `PUBLISHED`, `DEPRECATED` |
| Evidence | `DiGraphEdgeEvidence` — source, span, confidence |

**Node kinds (`DiGraphNodeKind`):** `DISEASE`, `SYMPTOM`, `PROTOCOL`, `MEDICINE_GENERIC`, `VACCINE`, `EMERGENCY`.

**Edge types (implemented constants + plan):**

| Edge type | From → to | Consumer |
|-----------|-----------|----------|
| `HAS_SYMPTOM` | Disease → Symptom | D3, D4 priors, AI Doctor |
| `DIFFERENTIAL_OF` | Disease ↔ Disease | D4 ranking |
| `SUGGESTS_PROTOCOL` | Disease → Protocol | Workup |
| `CONTRAINDICATES_MEDICINE` | Disease → Medicine generic | D7, Prescription handoff |
| `REQUIRES_VACCINE` | Disease → Vaccine | D6 campaigns |
| `ESCALATES_TO_EMERGENCY` | Disease → Emergency | D7 triage |

**Registry:** `DiDiseaseRegistry` — `vkEntityId`, `slug`, `status` (`DiDiseaseStatus`: DRAFT, ACTIVE, DEPRECATED, MERGED).

**Planned but not fully populated:** `COMORBID_WITH`, feed contraindication cross-links (documented in DIE master plan).

### 1.6 Legacy symptom graph (pre-UVKG bridge)

| Artifact | Role |
|----------|------|
| `AiSymptomNode` | Taxonomy nodes (`code`, species, `redFlag`) |
| `AiSymptomDiseaseLink` | `(symptomNodeId, knowledgeEntryId, edgeWeight)` |
| `DiSymptomTaxonomy` + `DiSymptomColloquial` | DIE D3 — parallel to legacy nodes |

**VRE usage:** `GraphExpansionService` reads `AiSymptomDiseaseLink` → boosts disease slugs in hybrid fusion (`graph-expansion.service.ts`). This is the **only cross-product graph expansion in production retrieval today**.

### 1.7 VRE retrieval layer

**Module:** `src/modules/ai/knowledge-retrieval/`

| Stage | Component | Graph involvement |
|-------|-----------|-------------------|
| Normalize | Query normalizer | — |
| Lexical | `KeywordSearchService` | — |
| Semantic | `SemanticSearchService` | pgvector on chunks |
| Graph expand | `GraphExpansionService` | **Legacy** `AiSymptomDiseaseLink` only |
| Fuse | `HybridFusionService` | `slugBoosts` from graph |
| Gate | Confidence / evidence / vet-approved | Per profile |
| Pack | `ContextPackBuilder` | `graphHints[]` in pack |

**Retrieval profiles (subset):**

| Profile | taskType | Primary domains |
|---------|----------|-----------------|
| `ai-doctor-v1` | `DISEASE_ANALYSIS` | DISEASE, EMERGENCY, MEDICINE |
| `differential-v1` | `DISEASE_ANALYSIS` | DISEASE, CLINICAL_PROTOCOL |
| `prescription-v1` | `PRESCRIPTION_ANALYSIS` | MEDICINE, EMERGENCY |
| `feed-advisor-v1` | `FEED_FORMULATION` | FEED, FARM_MGMT |
| `disease-v1` / `outbreak-v1` | `DISEASE_ANALYSIS` | DISEASE, EMERGENCY |

### 1.8 AI Router

**Flow:** Feature orchestrator → (optional) VRE `retrieve()` → `AiFoundationService.executePromptTask()` → `AiOrchestratorService` → provider.

**Usage metadata:** `retrievalMetadataJson` on `AiUsageLog` — chunk counts, excluded reasons, profile id.

**UVKG touchpoint (future):** Router does not traverse graphs directly; orchestrators pass `graphContext` from UVKG into retrieval request or pre-router enrichment.

### 1.9 AI Doctor

**Module:** `ai-doctor/`, `disease-intelligence/reasoning/`

| Step | Source |
|------|--------|
| Symptom intake | `symptom-intake.engine`, `DiSymptomTaxonomy` |
| Graph priors | `DiseaseGraphService.loadDifferentialPriors` — `di_graph_edges` PUBLISHED |
| Retrieval | `differential-v1` / `ai-doctor-v1` via DIE |
| Fusion | `DifferentialDiagnosisService` — weights: graph 0.35, retrieval 0.4, prevalence 0.15, outbreak 0.1 |
| Safety | `ClinicalSafetyEngine` (D7) |
| LLM | `AiDoctorOrchestratorService` → `executePromptTask` |

**Wrapper:** `DiseaseReasoningOrchestratorService` (D8).

### 1.10 Prescription Assistant

**Module:** `ai-prescription/`, `medicine/`

| Step | Source |
|------|--------|
| Drug lookup | `medicine-lookup.engine` + `MedicineKnowledgeRetrievalService` |
| Interactions | `VkMedicineKnowledgeGraphEdge` (`INTERACTS_WITH`, `CONTRAINDICATED_WITH`) — **not** unified |
| Safety | `ComprehensiveSafetyEngine`, `PharmacologySafetyEngine` |
| Commercial | `VetRecommendationService` — **must not** override safety edges |
| LLM | `AiPrescriptionOrchestratorService` + `prescription-v1` |

**Known gap (documented in 6H verification):** Interaction graph metadata-only until `VkKnowledgeLink` exists.

### 1.11 Current-state summary matrix

| Layer | Graph store | Governed? | Node ID style | Used by VRE? | Used by domain engines? |
|-------|-------------|-----------|---------------|--------------|-------------------------|
| VKL | *(links missing)* | N/A | `entityId` / `slug` | Via chunks | Indirect |
| Feed | `vk_feed_knowledge_graph_edges` | No | Slug | No | Feed formulation |
| Medicine | `vk_medicine_knowledge_graph_edges` | No | Slug | No | Prescription, MIE |
| Disease | `di_graph_edges` | Partial (`DRAFT`/`PUBLISHED`) | `DiGraphNode.id` | No | DIE, AI Doctor |
| Legacy symptom | `AiSymptomDiseaseLink` | No | Entry id | **Yes** | Symptom checker |

---

## Part 2 — Target UVKG design

### 2.1 Definition

The **Unified Veterinary Knowledge Graph (UVKG)** is the governed, queryable **relationship plane** of Prani Doctor veterinary knowledge. It does not replace:

- **VKL** — canonical content and versions.
- **Domain registries** — `DiDiseaseRegistry`, `MedicineGeneric`, `VkFeedIngredient` operational fields.
- **Commercial intelligence** — contracts, sponsorship (separate edge class).

UVKG **unifies clinical and nutritional relationships** that are today fragmented across three edge tables and one legacy link table.

### 2.2 Core primitives

| Primitive | Canonical model | UVKG role |
|-----------|-----------------|-----------|
| Entity | `VkKnowledgeEntity` | Edge endpoints (required for publish) |
| Version | `VkKnowledgeVersion` | Provenance anchor (`vkVersionId` on edge) |
| Link | **`VkKnowledgeLink`** (new) | Typed, governed, evidence-backed edge |
| Endpoint resolver | `UvkgNodeRef` (logical) | Maps domain refs → `entityId` |

### 2.3 Supported entity classes (UVKG node taxonomy)

UVKG endpoints resolve to `VkKnowledgeEntity` where possible; operational-only nodes use **stable external refs** until VKL entity exists.

| UVKG node class | Maps to | Domain | Registry / table |
|-----------------|---------|--------|------------------|
| Disease | `VkKnowledgeEntity` | `DISEASE` | `DiDiseaseRegistry` |
| Symptom | `DiSymptomTaxonomy.code` or VKL entity | `DISEASE` / taxonomy | `DiSymptomTaxonomy`, `AiSymptomNode` |
| Medicine Generic | `VkKnowledgeEntity` + `MedicineGeneric` | `MEDICINE` | `MedicineGeneric.genericCode` |
| Medicine Brand | `MedicineBrand` → optional VKL | `MEDICINE` | `MedicineBrand.brandCode` |
| Feed Ingredient | `VkFeedIngredient` | `FEED` | `ingredientCode` |
| Feed Formula | `VkRationTemplate` | `FEED` | ration slug |
| Nutrient | `VkNutrientRequirement` | `FEED` | species-stage slug |
| Species | Enum + optional VKL `FARM_MGMT` | Scoped filter | `LivestockSpecies` |
| Breed | VKL `BREED` | `BREED` | breed slug |
| Vaccine | VKL `VACCINE` | `VACCINE` | vaccine slug |
| Condition | VKL `DISEASE` / syndrome type | `DISEASE` | condition slug |
| Risk Factor | VKL / structured JSON | Multi | metadata |
| Outbreak | `DiOutbreakSignal` | Operational | signal id → region |
| Region | `regionScope` / `Area` tree | Overlay | `BD`, district codes |

**Rule:** Published UVKG edges where `edgeClass = CLINICAL` MUST have both endpoints resolvable to **ACTIVE** registry rows or **PUBLISHED** VKL entities.

### 2.4 `VkKnowledgeLink` — proposed logical schema

*Planning artifact — not migrated.*

```
VkKnowledgeLink
├── id                    cuid
├── linkKey               stable business key (optional, for idempotent sync)
├── edgeType              VkKnowledgeEdgeType (enum)
├── edgeClass             CLINICAL | NUTRITIONAL | REGULATORY | COMMERCIAL | METADATA
├── fromEntityId          FK VkKnowledgeEntity (nullable if external ref)
├── fromRefType           UVKG_NODE_CLASS
├── fromRefId             slug | code | node id
├── toEntityId            FK VkKnowledgeEntity (nullable)
├── toRefType             UVKG_NODE_CLASS
├── toRefId               slug | code | node id
├── direction             DIRECTED | UNDIRECTED
├── weight                float 0–1
├── lineOrder             int? (therapy ordering)
├── species               LivestockSpecies[]
├── regionScope           string[] (default ["BD"])
├── evidenceLevel         L1 | L2 | L3 | L4
├── confidenceScore       float
├── clinicalRiskTier      LOW | MEDIUM | HIGH
├── status                VkKnowledgeLinkStatus (governance)
├── vkVersionId           FK — provenance from publishing version
├── sourceEdgeId          lineage: feed|medicine|disease legacy id
├── sourceSystem          FEED_GRAPH | MEDICINE_GRAPH | DISEASE_GRAPH | EDITORIAL | IMPORT
├── effectiveFrom         datetime
├── effectiveTo           datetime?
├── metadataJson          domain-specific (dose line, withdrawal days, etc.)
├── createdById / updatedById
├── publishedAt / deprecatedAt
├── reviewId / approvalId  FK to edge-level governance (see §4)
└── citations[]           VkKnowledgeCitation or link-level citation rows
```

**Uniqueness:** `(edgeType, fromRefType, fromRefId, toRefType, toRefId, regionScope, species hash)` for ACTIVE/PUBLISHED links.

### 2.5 Edge type catalog

Normative edge types for UVKG. Domain-specific names in legacy tables map via **sync mapping table** (§5).

#### Clinical — disease & symptom

| Edge type | Direction | From → to | Clinical use |
|-----------|-----------|-----------|--------------|
| `HAS_SYMPTOM` | → | Disease → Symptom | DDx priors, intake |
| `CAUSES` | → | Disease → Condition | Etiology (careful: farmer language) |
| `ASSOCIATED_WITH` | ↔ | Disease ↔ Disease | Co-occurrence (non-DDx) |
| `DIFFERENTIAL_OF` | ↔ | Disease ↔ Disease | Competing diagnoses |
| `COMORBID_WITH` | ↔ | Disease ↔ Disease | Risk stacking |
| `ESCALATES_TO` | → | Disease / Symptom → Emergency | Triage |

#### Clinical — treatment & prevention

| Edge type | Direction | From → to | Clinical use |
|-----------|-----------|-----------|--------------|
| `TREATED_WITH` | → | Disease → Medicine Generic | Line of therapy (educational) |
| `CONTRAINDICATES` | → | Disease / Condition → Medicine Generic | Safety block |
| `PREVENTS` | → | Vaccine → Disease | Prevention |
| `REQUIRES_VACCINE` | → | Disease → Vaccine | Campaign / schedule |
| `SUGGESTS_PROTOCOL` | → | Disease → Clinical Protocol | Workup |

#### Pharmacology

| Edge type | Direction | From → to | Clinical use |
|-----------|-----------|-----------|--------------|
| `INTERACTS_WITH` | ↔ | Medicine Generic ↔ Medicine Generic | Prescription safety |
| `SUBSTITUTES_FOR` | ↔ | Medicine Generic ↔ Medicine Generic | Alternatives |
| `BRAND_OF` | → | Medicine Brand → Medicine Generic | Catalog (structural) |
| `WITHDRAWAL_FOR` | → | Medicine Generic → Regulatory rule | Meat/milk withhold |

#### Nutrition & feed

| Edge type | Direction | From → to | Clinical use |
|-----------|-----------|-----------|--------------|
| `NUTRIENT_FOR` | → | Nutrient → Species/Stage | Requirements |
| `CONTAINS` | → | Ration / Formula → Ingredient | Formulation |
| `DEFICIENT_IN` | → | Condition / Disease → Nutrient | Deficiency link |
| `TOXIC_TO` | → | Ingredient → Species/Condition | Fail-closed |
| `SAFE_FOR` | → | Ingredient → Species/Condition | Inclusion allow |
| `RESTRICTED_FOR` | → | Ingredient → Species/Condition | Limits |
| `SUBSTITUTES_INGREDIENT` | ↔ | Ingredient ↔ Ingredient | Feed substitution |

#### Cross-domain (UVKG value)

| Edge type | Direction | From → to | Clinical use |
|-----------|-----------|-----------|--------------|
| `CONTRAINDICATES_FEED` | → | Disease → Ingredient | DIE ↔ Feed safety |
| `AGGRAVATED_BY` | → | Disease → Risk Factor | Context |
| `PREVALENT_IN` | → | Disease → Region | Outbreak / geo |
| `OUTBREAK_IN` | → | Outbreak signal → Disease | D6 |

#### Meta & provenance

| Edge type | Direction | From → to | Use |
|-----------|-----------|-----------|-----|
| `RELATED_TO` | ↔ | Any ↔ Any | Weak association (low weight cap) |
| `SUPPORTED_BY` | → | Link/Entity → Knowledge Source | Provenance |
| `DERIVED_FROM` | → | Entity version → Source document | Ingestion |

#### Commercial (isolated edge class)

| Edge type | edgeClass | Notes |
|-----------|-----------|-------|
| `SPONSORED_BY` | `COMMERCIAL` | Never used in clinical/safety traversal |
| `MANUFACTURED_BY` | `METADATA` | Catalog only |

**Farmer-facing rule:** Edges with `clinicalRiskTier >= HIGH` or `edgeClass = CLINICAL` affecting dosing require `status = PUBLISHED` and linked `VkKnowledgeApproval` on governing version or edge approval record.

### 2.6 Traversal API (planned)

**Service:** `UvkgTraversalService` (wraps repository)

| Operation | Description | Limits |
|-----------|-------------|--------|
| `neighbors(ref, edgeTypes?, species?, depth=1)` | Bounded BFS | `depth ≤ 3`, `maxNodes ≤ 50` |
| `shortestPath(a, b, edgeTypes?)` | Admin/debug | `depth ≤ 5` |
| `expandForRetrieval(query, profile)` | Slug boosts + hints for VRE | Profile-specific edge allowlist |
| `checkSafety(from, to, edgeTypes)` | Prescription / feed fail-closed | Synchronous, no LLM |

**Edge allowlists by profile (examples):**

| Profile | Allowed edge types |
|---------|-------------------|
| `differential-v1` | `HAS_SYMPTOM`, `DIFFERENTIAL_OF`, `ESCALATES_TO` |
| `prescription-v1` | `CONTRAINDICATES`, `INTERACTS_WITH`, `WITHDRAWAL_FOR`, `TREATED_WITH` |
| `feed-advisor-v1` | `TOXIC_TO`, `RESTRICTED_FOR`, `NUTRIENT_FOR`, `CONTAINS`, `CONTRAINDICATES_FEED` |
| `ai-doctor-v1` | Clinical set minus `COMMERCIAL` |

---

## Part 3 — Graph governance

### 3.1 Principle

**Graph edges are first-class governed artifacts.** No edge may enter `PUBLISHED` status without passing the same editorial discipline as high-risk knowledge versions (adapted from Phase 6B.4).

Direct publication to UVKG is **forbidden**.

### 3.2 Link lifecycle states

| Status | Meaning | Visible to |
|--------|---------|------------|
| `DRAFT` | Authored, not reviewed | Editors |
| `IN_REVIEW` | Editorial queue | Editors, domain leads |
| `VET_REVIEW` | Awaiting licensed vet | Vets |
| `CHANGES_REQUESTED` | Sent back | Editors |
| `APPROVED` | Approved, not yet published | System (staging) |
| `PUBLISHED` | Live for traversal/retrieval | All clinical consumers |
| `ARCHIVED` | Retained, not traversable | Audit only |
| `DEPRECATED` | Superseded | Migration reads only |
| `REJECTED` | Invalid | Audit only |

Mapping from legacy:

| Legacy | UVKG |
|--------|------|
| Feed/Medicine immediate upsert | `DRAFT` until governance enabled; sync creates `DRAFT` |
| `DiGraphEdgeStatus.DRAFT` | `DRAFT` |
| `DiGraphEdgeStatus.PUBLISHED` | `PUBLISHED` |
| `DiGraphEdgeStatus.DEPRECATED` | `DEPRECATED` |

### 3.3 Governance workflow

```
Author (editor/import)
    → DRAFT
    → submit → IN_REVIEW (VkKnowledgeLinkReview)
    → domain lead → VET_REVIEW (if clinicalRiskTier ≥ MEDIUM or edgeType in VET_REQUIRED_SET)
    → VkKnowledgeLinkApproval (vet sign-off)
    → APPROVED
    → publish job (with parent VkKnowledgeVersion publish OR standalone edge publish)
    → PUBLISHED
```

**VET_REQUIRED_SET (minimum):** `TREATED_WITH`, `CONTRAINDICATES`, `INTERACTS_WITH`, `TOXIC_TO`, `WITHDRAWAL_FOR`, `CONTRAINDICATES_FEED`, `REQUIRES_VACCINE`.

**Bundled publish:** When a `VkKnowledgeVersion` is published, **candidate links** attached to that version auto-transition `APPROVED → PUBLISHED` in the same transaction.

**Edge-only publish:** Admin API for graph fixes without content version change — still requires `APPROVED` + audit event.

### 3.4 Governance artifacts (new, planned)

| Table | Purpose |
|-------|---------|
| `VkKnowledgeLinkReview` | Editorial review of a link draft |
| `VkKnowledgeLinkApproval` | Vet approval with `validUntil` |
| `VkKnowledgeLinkAuditEvent` | Append-only trail |
| `VkKnowledgeLinkChangeRequest` | Deprecation / weight change |

### 3.5 Permissions (web admin)

| Capability | Roles |
|------------|-------|
| `ai.knowledge.graph.read` | ADMIN, VET, EDITOR |
| `ai.knowledge.graph.draft` | EDITOR, DOMAIN_LEAD |
| `ai.knowledge.graph.review` | DOMAIN_LEAD, EDITOR |
| `ai.knowledge.graph.vet_approve` | VET |
| `ai.knowledge.graph.publish` | SUPER_ADMIN, VET (dual for HIGH) |
| `ai.knowledge.graph.sync` | SUPER_ADMIN (ops) |

---

## Part 4 — Sync architecture (`GraphSyncService`)

### 4.1 Purpose

`GraphSyncService` maintains **eventual consistency** between domain graphs (write adapters) and UVKG (read authority) without downtime.

### 4.2 Sync topology

```
                    ┌─────────────────────┐
                    │   VkKnowledgeLink   │
                    │   (UVKG — target)   │
                    └──────────▲──────────┘
                               │
                    ┌──────────┴──────────┐
                    │   GraphSyncService    │
                    │  - map edge types     │
                    │  - resolve endpoints  │
                    │  - conflict policy    │
                    └──────────▲──────────┘
           ┌───────────────────┼───────────────────┐
           │                   │                   │
    ┌──────┴──────┐    ┌───────┴───────┐   ┌──────┴──────┐
    │ Feed Graph  │    │ Medicine Graph│   │Disease Graph│
    │ vk_feed_*   │    │ vk_medicine_* │   │ di_graph_*  │
    └─────────────┘    └───────────────┘   └─────────────┘
```

### 4.3 Sync modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Publish-time sync** | `VkKnowledgeVersion` published; `DiGraphEdge` → PUBLISHED; admin feed/medicine publish | Upsert UVKG link `DRAFT→APPROVED→PUBLISHED` per mapping |
| **Rebuild sync** | Ops job `uvkg:rebuild --source=all` | Truncate staging UVKG table → full import → swap |
| **Repair sync** | Drift detector finds orphan/mismatch | Re-resolve endpoints; quarantine unresolvable |
| **Incremental sync** | Cron every 15m | Compare `updatedAt` on source edges |

### 4.4 Edge type mapping (legacy → UVKG)

| Source | Legacy type | UVKG type | edgeClass |
|--------|-------------|-----------|-----------|
| Feed | `NUTRIENT_FOR` | `NUTRIENT_FOR` | NUTRITIONAL |
| Feed | `CONTAINS` | `CONTAINS` | NUTRITIONAL |
| Feed | `TOXICITY_OF` | `TOXIC_TO` | CLINICAL |
| Feed | `RESTRICTED_FOR` | `RESTRICTED_FOR` | NUTRITIONAL |
| Feed | `SUBSTITUTES_FOR` | `SUBSTITUTES_INGREDIENT` | NUTRITIONAL |
| Medicine | `INTERACTS_WITH` | `INTERACTS_WITH` | CLINICAL |
| Medicine | `CONTRAINDICATED_WITH` | `CONTRAINDICATES` | CLINICAL |
| Medicine | `BRAND_OF_GENERIC` | `BRAND_OF` | METADATA |
| Medicine | `SPONSORED_BY` | `SPONSORED_BY` | COMMERCIAL |
| Disease | `HAS_SYMPTOM` | `HAS_SYMPTOM` | CLINICAL |
| Disease | `DIFFERENTIAL_OF` | `DIFFERENTIAL_OF` | CLINICAL |
| Disease | `CONTRAINDICATES_MEDICINE` | `CONTRAINDICATES` | CLINICAL |
| Disease | `REQUIRES_VACCINE` | `REQUIRES_VACCINE` | CLINICAL |
| Disease | `ESCALATES_TO_EMERGENCY` | `ESCALATES_TO` | CLINICAL |
| Legacy symptom | `AiSymptomDiseaseLink` | `HAS_SYMPTOM` | CLINICAL |

### 4.5 Endpoint resolution

| Step | Action |
|------|--------|
| 1 | Resolve slug → `VkKnowledgeEntity.id` |
| 2 | If missing, resolve via registry (`DiDiseaseRegistry`, `MedicineGeneric`, `VkFeedIngredient`) |
| 3 | If still missing, create `SYNC_BLOCKED` queue item — **do not publish** |
| 4 | Attach `sourceEdgeId` + `sourceSystem` for lineage |

### 4.6 Conflict handling

| Conflict | Policy |
|----------|--------|
| Weight mismatch (feed 0.8 vs disease 0.5) | UVKG stores **source-priority**: Disease > Medicine > Feed; log `GraphSyncConflict` |
| Duplicate edge opposite direction | Prefer single canonical direction per `edgeType` enum |
| Disease PUBLISHED vs UVKG DRAFT | Disease wins on clinical edges; trigger repair |
| Commercial vs clinical same pair | Keep both; filter by `edgeClass` at read |
| Deleted source edge | UVKG → `DEPRECATED`, never hard delete |

**Conflict table (planned):** `uvkg_sync_conflicts` — status `OPEN | AUTO_RESOLVED | MANUAL_REQUIRED`.

### 4.7 Idempotency

- `linkKey = hash(sourceSystem, sourceEdgeId, edgeType)` ensures replay-safe upserts.
- Rebuild uses staging schema `vk_knowledge_links_staging` → atomic rename (Phase 2).

### 4.8 Feature flags

| Flag | Phase | Effect |
|------|-------|--------|
| `UVKG_SYNC_ENABLED` | 2 | Run sync jobs |
| `UVKG_READ_ENABLED` | 5 | Traversal reads UVKG |
| `UVKG_LEGACY_FALLBACK` | 5–6 | Fall back to domain graphs if UVKG miss |
| `UVKG_VRE_EXPANSION` | 5 | `GraphExpansionService` uses UVKG |

---

## Part 5 — AI integration

### 5.1 Integration pattern (all products)

```
Orchestrator
  1. Build case context (species, symptoms, intent)
  2. UvkgTraversalService.expandForRetrieval() OR domain graph (legacy)
  3. KnowledgeRetrievalService.retrieve({ graphHints, slugBoosts, allowedDomains })
  4. Domain deterministic engine (safety, formulation, commercial)
  5. AiFoundationService.executePromptTask({ contextPack })
  6. Post-LLM validation (VRE structured checks)
```

### 5.2 AI Doctor

| Capability | Current | Target |
|------------|---------|--------|
| Symptom → disease priors | `DiseaseGraphService` + legacy links | `UvkgTraversalService` `HAS_SYMPTOM` |
| DDx fusion | DIE weights | Same weights; UVKG feeds priors |
| Emergency | Hardcoded slugs + `ESCALATES_TO` | UVKG `ESCALATES_TO` edges |
| Retrieval | `ai-doctor-v1` | Add `graphExpansionSource: 'uvkg'` |

### 5.3 Disease Intelligence

| Module | UVKG usage |
|--------|------------|
| D2 Graph | Write adapter → sync → UVKG read |
| D4 Differential | Load priors from UVKG with species filter |
| D7 Safety | Traverse `CONTRAINDICATES`, `ESCALATES_TO` |
| D6 Outbreak | `OUTBREAK_IN`, `PREVALENT_IN` edges |

### 5.4 Medicine Intelligence

| Module | UVKG usage |
|--------|------------|
| Prescription safety | `INTERACTS_WITH`, `CONTRAINDICATES` from UVKG |
| Recommendations | Commercial edges **excluded** from UVKG clinical reads |
| Knowledge retrieval | `MedicineKnowledgeRetrievalService` passes UVKG hints to VRE |

### 5.5 Feed Intelligence

| Module | UVKG usage |
|--------|------------|
| Toxic detection | `TOXIC_TO`, `RESTRICTED_FOR` |
| Formulation | `CONTAINS`, `NUTRIENT_FOR` |
| Disease cross | `CONTRAINDICATES_FEED` (new population) |

### 5.6 Prescription Assistant

| Step | UVKG |
|------|------|
| Pre-LLM | Traverse interactions/contraindications — fail-closed on PUBLISHED edges |
| Retrieval | `prescription-v1` + graph hints |
| Post-LLM | Validate no unsupported drug claims |

### 5.7 Graph-enhanced retrieval (VRE upgrade)

**Replace** legacy-only `GraphExpansionService` path:

| Step | Description |
|------|-------------|
| 1 | Detect symptom tokens / colloquial BN (`DiSymptomColloquial`) |
| 2 | Query UVKG `HAS_SYMPTOM` → disease entity slugs |
| 3 | Optional 2-hop: `DIFFERENTIAL_OF`, `COMORBID_WITH` with decay |
| 4 | Build `slugBoosts` + `graphHints` (same contract as today) |
| 5 | Profile filter excludes `COMMERCIAL` edgeClass |

**Backward compatibility:** `UVKG_LEGACY_FALLBACK=true` keeps `AiSymptomDiseaseLink` path until Phase 6.

### 5.8 Observability

| Metric | Purpose |
|--------|---------|
| `uvkg.traversal.latency` | Performance |
| `uvkg.sync.drift_count` | Ops health |
| `uvkg.retrieval.hints_count` | Retrieval quality |
| `uvkg.safety.block_count` | Safety engine |

---

## Part 6 — Migration strategy (zero downtime)

### Phase 1 — UVKG introduction (4 weeks)

| Deliverable | Detail |
|-------------|--------|
| Schema | `VkKnowledgeLink`, staging table, enums, indexes |
| Governance tables | Link review/approval/audit |
| Read API | `UvkgTraversalService` behind `UVKG_READ_ENABLED=false` |
| Admin UI | Read-only graph explorer |

**Production impact:** None — tables empty, flag off.

### Phase 2 — Parallel graph operation (3 weeks)

| Deliverable | Detail |
|-------------|--------|
| `GraphSyncService` | Publish-time + incremental sync |
| Drift detector | Compare counts per edge type |
| Staging rebuild | `vk_knowledge_links_staging` |

**Production impact:** None — sync writes UVKG; consumers still use legacy.

### Phase 3 — Dual-write (3 weeks)

| Deliverable | Detail |
|-------------|--------|
| Domain services | On edge create/update, write legacy **and** UVKG `DRAFT` |
| Admin | Edge editor writes UVKG primary |

**Production impact:** Low — dual write with legacy as fallback.

### Phase 4 — Migration (4 weeks)

| Deliverable | Detail |
|-------------|--------|
| Backfill job | Historical edges → UVKG |
| Symptom migration | `AiSymptomDiseaseLink` → `HAS_SYMPTOM` |
| Corpus wave | 6E cross-domain targets (400+ edges) |
| GSE eval | Regression on `ai-doctor-g1`, prescription corpora |

**Production impact:** Medium — ops monitoring; no read switch.

### Phase 5 — Unified reads (3 weeks)

| Deliverable | Detail |
|-------------|--------|
| Flip `UVKG_READ_ENABLED` | 10% → 50% → 100% canary |
| VRE | `GraphExpansionService` → UVKG |
| DIE/MIE/FIE | Read from UVKG; legacy fallback |

**Production impact:** Controlled — instant rollback via flag.

### Phase 6 — Legacy graph retirement (4 weeks)

| Deliverable | Detail |
|-------------|--------|
| Stop dual-write to `vk_feed_*`, `vk_medicine_*` | Read-only legacy tables |
| `di_graph_edges` | Archive; DIE uses UVKG only |
| Remove `AiSymptomDiseaseLink` writes | Keep read-only 1 release |
| Drop legacy tables | **Major version** — backup required |

**Production impact:** Schema deprecation window; 90-day read-only retention.

### Migration timeline (Gantt summary)

| Phase | Weeks | Cumulative |
|-------|-------|------------|
| 1 Introduction | 4 | 4 |
| 2 Parallel | 3 | 7 |
| 3 Dual-write | 3 | 10 |
| 4 Migration | 4 | 14 |
| 5 Unified reads | 3 | 17 |
| 6 Retirement | 4 | 21 |

**Total:** ~21 weeks (5 months) with overlap possible between phases 2–3.

---

## Part 7 — Validation

### 7.1 Implementation roadmap

| ID | Workstream | Owner | Phase | Exit criteria |
|----|------------|-------|-------|---------------|
| W1 | Schema + migrations | Backend | 1 | Prisma validated; staging deploy |
| W2 | Governance services | Backend | 1 | Link publish blocked without approval |
| W3 | GraphSyncService | Backend | 2–3 | <0.1% drift on HAS_SYMPTOM |
| W4 | UvkgTraversalService | Backend | 1, 5 | p95 < 50ms @ depth 2 |
| W5 | VRE integration | Backend | 5 | GSE recall +5% on BN colloquial |
| W6 | Admin Graph Control Center | Web | 2–4 | Edge CRUD + conflict queue |
| W7 | DIE adapter | Backend | 3–5 | D4 priors match legacy ±5% |
| W8 | MIE/Prescription adapter | Backend | 5 | Interaction checks UVKG-backed |
| W9 | FIE adapter | Backend | 5 | Toxic rules unchanged in eval |
| W10 | Corpus population | Content/Ops | 4 | MVC edge counts per 6E |
| W11 | Eval + monitoring | QA | 4–5 | GSE/VRE golden pass |

### 7.2 Risk assessment

| ID | Risk | Likelihood | Impact | Mitigation |
|----|------|------------|--------|------------|
| R1 | Endpoint resolution failures during sync | High | Medium | `SYNC_BLOCKED` queue; no silent publish |
| R2 | Clinical regression on DDx | Medium | High | Canary; DIE fusion A/B; GSE gates |
| R3 | Performance on traversal | Medium | Medium | Indexes; depth limits; materialized slug index |
| R4 | Commercial edge leak into safety | Low | Critical | `edgeClass` filter; security test suite |
| R5 | Governance bottleneck | High | Medium | Bundled publish; expedite LOW risk edges |
| R6 | Dual-write inconsistency | Medium | High | Idempotent `linkKey`; repair job |
| R7 | Legacy retirement too early | Medium | High | Phase 6 only after 30d stable 100% reads |
| R8 | BN colloquial symptom gaps | High | Medium | `DiSymptomColloquial` + 6E2 expansion |

### 7.3 Migration plan (checklist)

- [ ] Backup production DB before Phase 1 migration
- [ ] Deploy schema with all flags `false`
- [ ] Run initial rebuild sync in staging
- [ ] Validate edge counts vs legacy (report per edge type)
- [ ] Enable dual-write in staging; soak 7 days
- [ ] Backfill production UVKG (off-peak)
- [ ] Enable `UVKG_READ_ENABLED` at 10% traffic
- [ ] Monitor `uvkg.sync.drift_count` < threshold 24h
- [ ] GSE + prescription eval pass
- [ ] 50% → 100% canary
- [ ] Disable legacy writes (Phase 6 prep)
- [ ] 90-day archive period
- [ ] Drop legacy tables (major release)

### 7.4 Production rollout plan

| Stage | Environment | Actions | Rollback |
|-------|-------------|---------|----------|
| S0 | Dev | Full pipeline test | N/A |
| S1 | Staging | Rebuild + dual-write soak | Drop staging UVKG |
| S2 | Prod shadow | Sync on; reads off | Stop sync job |
| S3 | Prod canary 10% | `UVKG_READ_ENABLED` partial | Flag off → legacy |
| S4 | Prod 50% | Monitor SLOs | Flag off |
| S5 | Prod 100% | Legacy fallback on | Flag off |
| S6 | Prod retirement | Stop dual-write | Re-enable legacy flags |

**SLO targets (Phase 5+):**

| Metric | Target |
|--------|--------|
| UVKG traversal p95 | < 50ms |
| Sync lag | < 15 minutes |
| Drift rate | < 0.1% of published edges |
| GSE farmer BN pass rate | No regression vs baseline |
| Safety false negative | 0 tolerated |

### 7.5 Success criteria (program complete)

| Criterion | Measure |
|-----------|---------|
| Single read path | 100% clinical traversals use UVKG |
| Governed edges | 0 `PUBLISHED` edges without approval trail |
| Cross-domain | ≥ 400 `PUBLISHED` clinical edges (6E MVC) |
| Legacy retired | No production reads from `vk_feed_*`, `vk_medicine_*`, `di_graph_edges` |
| VRE | `GraphExpansionService` uses UVKG; legacy symptom table archived |
| Products | AI Doctor, Prescription, Feed Advisor evals pass |

---

## Appendix A — Entity relationship diagram (target)

```mermaid
erDiagram
  VkKnowledgeEntity ||--o{ VkKnowledgeVersion : versions
  VkKnowledgeEntity ||--o{ VkKnowledgeLink : outbound
  VkKnowledgeLink }o--|| VkKnowledgeEntity : from
  VkKnowledgeLink }o--|| VkKnowledgeEntity : to
  VkKnowledgeVersion ||--o{ VkKnowledgeLink : provenance
  DiDiseaseRegistry ||--o| VkKnowledgeEntity : vkEntityId
  MedicineGeneric }o--|| VkKnowledgeVersion : version
  VkFeedIngredient }o--|| VkKnowledgeVersion : version
  DiGraphEdge ||..|| VkKnowledgeLink : syncs_to
  VkFeedKnowledgeGraphEdge ||..|| VkKnowledgeLink : syncs_from
  VkMedicineKnowledgeGraphEdge ||..|| VkKnowledgeLink : syncs_from
```

---

## Appendix B — Document control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-06-01 | Principal Veterinary Knowledge Architect | Initial master plan |

**Next steps (when implementation approved):**

1. ADR: `VkKnowledgeLink` schema review with clinical safety board  
2. Spike: `GraphSyncService` prototype on staging with feed + disease subset  
3. Update `phase-6e-knowledge-population.md` edge targets to reference UVKG governance  

---

*End of document — planning only.*
