# Phase 6C — Veterinary RAG Engine Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary Retrieval Architect  
**Date:** 2026-05-31  
**Status:** Phase 6C VRE core implemented — 2026-05-31  
**Version:** 1.1.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL entity model, retrieval profiles, evidence gates, `KnowledgeContextPack` contract)
- `docs/plans/phase-6b-knowledge-ingestion-architecture.md` (KIS — source registry, import pipeline, publish events)
- `docs/plans/phase-6b3-chunking-citation-engine.md` (CCE — `VkKnowledgeChunk`, span citations, metadata envelope v1)
- `docs/plans/ai-phase-4-router-engine.md` (AiRouterEngine — embedding + completion routing)
- `docs/plans/ai-phase-3-model-registry.md` (embedding modality, model capabilities)
- `docs/plans/phase-6c-rag-architecture.md` (operational RAG baseline — implementation reference, not superseded)

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Veterinary RAG Engine — embed, index, hybrid search, pack assembly, grounding, confidence routing |
| `pranidoctor-web` | Retrieval Control Center — profile editor, corpus health, eval dashboards, domain coverage |
| `pranidoctor_user` | Consumer — grounded AI Doctor, Feed Advisor, chat (via backend APIs only) |

**Phase numbering alignment:**

| Phase | Scope |
|-------|--------|
| **6A** | Veterinary Knowledge Layer — entity model, graph, editorial governance, lexical retrieval contract |
| **6B / 6B.2 / 6B.3** | Ingestion + CCE — published chunks, citations, evidence, confidence, RAG metadata envelope |
| **6C** | **This document** — Veterinary RAG Engine: embedding, vector storage, hybrid retrieval, grounding |
| **6D** | Feature binding — AI Doctor, Prescription Assistant, Feed Advisor deep integration |

**Naming disambiguation:**

| Term | Meaning |
|------|---------|
| **VKL** | Veterinary Knowledge Layer — curated, versioned, attributable knowledge corpus |
| **CCE** | Chunking & Citation Engine (6B.3) — produces retrieval-ready `VkKnowledgeChunk` segments |
| **Veterinary RAG Engine (VRE)** | Phase 6C retrieval plane — embeds, searches, ranks, packs, injects, routes |
| **KnowledgeContextPack** | Standard retrieval output consumed by LLM features |
| **AIMS** | AI Management System — providers, models, routes (Phases 1–5) |

---

## Executive summary

Prani Doctor's AI stack today performs **keyword-based context injection** via `AiKnowledgeService.retrieveForRag()` — concatenating top excerpts before `AiRouterEngine` invokes a completion model. Phase 6B delivers **published, cited, evidence-scored chunks**; Phase 6B.3 defines **stable segment boundaries** (`{versionId}:{chunkIndex}`), span-mapped citations, and a **RAG metadata envelope** on every chunk.

**Phase 6C Veterinary RAG Engine (VRE)** is the **clinical retrieval plane** that transforms published VKL chunks into **grounded, attributable, confidence-gated LLM context** across seven primary knowledge bases:

| KB | Domain code | Primary consumers |
|----|-------------|-------------------|
| Disease KB | `DISEASE` | AI Doctor, symptom checker, farmer chat |
| Medicine KB | `MEDICINE` | AI Prescription Assistant, AI Doctor |
| Vaccine KB | `VACCINE` | Herd health, smart recommendations, AI Doctor |
| Feed KB | `FEED` | AI Feed Advisor, weight/nutrition features |
| Breed KB | `BREED` | Weight estimation, breeding guidance, Feed Advisor |
| Emergency KB | `EMERGENCY` | Emergency triage, red-flag routing |
| Regulatory KB | `REGULATORY_BD` | Prescription Assistant, legal withdrawal checks |

The VRE:

1. **Embeds** published chunks via registry-routed embedding models (`AiRouterEngine.executeEmbedding`).
2. **Stores** vectors in a **model-scoped vector layer** with rich metadata sidecars.
3. **Retrieves** via **hybrid search** — keyword (lexical) + semantic (vector) + structured (JSON/graph).
4. **Re-ranks** candidates with domain-aware, locale-aware, evidence-weighted fusion.
5. **Assembles** a typed **`KnowledgeContextPack`** with citation, evidence, and confidence injection.
6. **Applies** a **context window strategy** that prioritizes structured clinical facts under token budgets.
7. **Grounds** LLM calls through explicit contracts, fail-closed gates, and medical risk handling.
8. **Supports Bangla-first, English-parallel** multi-language retrieval without cross-locale hallucination.

The VRE is **orthogonal to chat provider selection**. Embedding (OpenAI, Gemini, Voyage/OpenRouter) and completion (GPT, Gemini, Claude) are coordinated by **AiRouterEngine** without hardcoded model IDs.

**This document defines architecture; Phase 6C VRE core is implemented** in `src/modules/ai/knowledge-retrieval/`.

---

## Implementation progress

| Sub-phase | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **6C.0** | Embedding layer + `KnowledgeEmbeddingService` | **Done** | Pipeline + router adapter |
| **6C.1** | Embedding queue (`ai:knowledge:embed`) | **Done** | BullMQ worker + inline fallback |
| **6C.2** | Embedding refresh jobs | **Done** | 6-hour cron + manual enqueue |
| **6C.3** | Keyword retrieval | **Done** | `KeywordSearchService` |
| **6C.4** | Semantic retrieval | **Done** | `SemanticSearchService` + cosine |
| **6C.5** | Hybrid fusion engine | **Done** | `HybridFusionService` |
| **6C.6** | Re-ranking engine | **Done** | `RerankerService` domain/locale/confidence boosts |
| **6C.7** | KnowledgeContextPack builder | **Done** | `context-pack-builder.ts` |
| **6C.8** | Citation / evidence / confidence builders | **Done** | `citation-builder`, `evidence-builder`, `confidence-builder` |
| **6C.9** | Grounding engine | **Done** | `grounding-engine.ts` strictness profiles |
| **6C.10** | Low confidence handler | **Done** | `low-confidence.handler.ts` |
| **6C.11** | Medical safety layer | **Done** | `medical-safety.service.ts` fail-closed |
| **6C.12** | AiAssistantService integration | **Done** | Grounded prompts; BLOCK without retrieval |
| **6C.13** | RAG optimization program | **Done (core)** | See `docs/plans/phase-6c13-rag-optimization.md` |

### Delivered module layout

```
knowledge-retrieval/
├── embedding/
│   ├── knowledge-embedding.service.ts
│   ├── embedding-queue.service.ts
│   ├── embedding-pipeline.service.ts
│   ├── embedding-router.adapter.ts
│   ├── embedding-refresh.job.ts
│   └── knowledge-embedding-worker.bootstrap.ts
├── search/          # keyword, semantic, hybrid fusion
├── ranking/         # reranker.service.ts
├── packs/           # citation, evidence, confidence, context-pack builders
├── grounding/       # grounding-engine, low-confidence, medical-safety
└── knowledge-retrieval.service.ts
```

---

## Strategic intent

| Today (post–6B.3 baseline) | After VRE (Phase 6C target) |
|----------------------------|----------------------------|
| Keyword `ILIKE` / entry-level search | **Hybrid chunk-level** lexical + semantic + structured |
| Flat string RAG concatenation | **`KnowledgeContextPack`** with chunks, facts, citations, routing decision |
| No vector index on VKF chunks | **Published-chunk vectors** keyed `{versionId}:{chunkIndex}` |
| Same retrieval for all tasks | **Domain-scoped retrieval profiles** per `taskType` + feature |
| Confidence enforced at ingest only | **Confidence routing at retrieval** — block/degrade/escalate before LLM |
| Citations optional in prompts | **Mandatory citation + evidence + confidence injection** |
| One-size-fits-all context | **Context window strategy** — structured facts protected, prose truncated by rank |
| BN colloquial recall poor | **Multilingual embed + locale boost + colloquial expansion** |
| Prescription can proceed ungrounded | **Fail-closed** for `PRESCRIPTION_ANALYSIS` and HIGH-risk medicine retrieval |

---

## Design principles

| Principle | VRE interpretation |
|-----------|-------------------|
| **Retrieve before route** | VRE executes **before** `AiRouterEngine.executeCompletion()`; retrieval never selects chat model |
| **Chunk is the unit of truth** | Retrieve `VkKnowledgeChunk` (PUBLISHED), not monolithic entries — precision + traceability |
| **Clinical safety first** | Dosage, withdrawal, emergency action steps require vet-approved, evidence-gated chunks |
| **Provenance always** | Every segment carries inline citation token, source attribution, evidence level |
| **Bangla-first locale** | BN canonical for farmers; EN parallel for doctors; structured numerics locale-independent |
| **Registry-first embeddings** | Embedding model from `AiModel` registry + `EMBEDDING` route — not env defaults |
| **Fail-closed where lives matter** | Prescription, banned substances, critical dosages — block LLM if pack insufficient |
| **Fail-open with disclaimer where appropriate** | General chat may proceed degraded with elevated disclaimer |
| **Evidence and confidence are first-class** | Injected into pack and prompts — not inferred by LLM |
| **Immutable published vectors** | Re-embed on content change or model migration — never mutate vectors in place |
| **Separation of concerns** | CCE writes chunks; VRE reads published chunks + index only |
| **Observability by default** | Every pack logged on `AiUsageLog.retrievalMetadataJson` |

---

## System context

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                    UPSTREAM — VKL + INGESTION + CCE (6A / 6B / 6B.3)                │
│                                                                                      │
│  Source Registry → Import Pipeline → Editorial/Vet → Publish                        │
│       │                                                                    │         │
│       └── VkKnowledgeVersion (PUBLISHED)                                   │         │
│            ├── VkKnowledgeChunk (PUBLISHED)  ← chunkIndex stable           │         │
│            ├── VkKnowledgeCitation (chunk-level spans)                     │         │
│            ├── VkKnowledgeEvidence / VkKnowledgeConfidence                 │         │
│            └── metadataJson (ChunkMetadataEnvelopeV1)                      │         │
└────────────────────────────────────────────┬────────────────────────────────────────┘
                                             │ KNOWLEDGE_CHUNK_PUBLISHED event
                                             ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│              PHASE 6C — VETERINARY RAG ENGINE (VRE)                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐   │
│  │ Embedding Layer │ →  │ Vector Storage  │ →  │ Index Health / Tombstone    │   │
│  │ (router-routed) │    │ (model-scoped)  │    │ Manager                     │   │
│  └────────┬────────┘    └────────┬────────┘    └─────────────────────────────┘   │
│           │                      │                                                  │
│           └──────────────────────┼──────────────────────────────────────────────────│
│                                  ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │ KnowledgeRetrievalService.retrieve(RetrievalRequest)                          │  │
│  │                                                                               │  │
│  │  Profile Resolver → Query Normalizer → Confidence Pre-check                   │  │
│  │         │                                                                     │  │
│  │         ├──► Keyword Search (lexical plane)                                   │  │
│  │         ├──► Semantic Search (vector plane)                                   │  │
│  │         ├──► Structured Match (JSON + graph plane)                            │  │
│  │         │                                                                     │  │
│  │         ▼                                                                     │  │
│  │  Hybrid Fusion → Domain Re-ranker → Evidence/Confidence Gates               │  │
│  │         │                                                                     │  │
│  │         ▼                                                                     │  │
│  │  Context Window Strategy → Pack Builder                                       │  │
│  │         │                                                                     │  │
│  │         ├── Citation Injection                                                │  │
│  │         ├── Evidence Injection                                                │  │
│  │         ├── Confidence Injection                                              │  │
│  │         └── Grounding Instruction Envelope                                    │  │
│  │         │                                                                     │  │
│  │         ▼                                                                     │  │
│  │  Medical Risk Handler → Confidence Router → KnowledgeContextPack             │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                  │                                                  │
└──────────────────────────────────┼──────────────────────────────────────────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  AiAssistantService         Future AI Doctor          Future AI Prescription
  (GENERAL_CHAT)             (DISEASE_ANALYSIS)        Assistant (PRESCRIPTION)
         │                         │                         │
         └─────────────────────────┴─────────────────────────┘
                                   │
                                   ▼
              AiFoundationService.executePromptTask()
                                   │
                                   ▼
              AiRouterEngine.executeCompletion()  ← chat model selection only here
```

### Backend module map (conceptual)

```
src/modules/ai/
├── knowledge-chunking/              # 6B.3 — write path (unchanged)
├── knowledge-retrieval/             # Phase 6C — VRE
│   ├── embedding/
│   │   ├── embedding-pipeline.service.ts
│   │   ├── embedding-router.adapter.ts      # AiRouterEngine EMBEDDING hops
│   │   ├── embedding-text.template.ts       # canonical from CCE Appendix A
│   │   └── vector-store.service.ts
│   ├── search/
│   │   ├── keyword-search.service.ts        # PostgreSQL tsvector + trigram
│   │   ├── semantic-search.service.ts       # ANN on vector store
│   │   ├── structured-match.service.ts      # JSON + graph seeds
│   │   └── hybrid-fusion.service.ts
│   ├── ranking/
│   │   ├── domain-ranker.service.ts
│   │   └── reranker.adapter.ts              # optional cross-encoder (cost-gated)
│   ├── packs/
│   │   ├── context-window.strategy.ts
│   │   ├── pack-builder.service.ts
│   │   ├── citation-injector.ts
│   │   ├── evidence-injector.ts
│   │   └── confidence-injector.ts
│   ├── grounding/
│   │   ├── grounding-contract.registry.ts
│   │   ├── hallucination-guard.service.ts
│   │   └── medical-risk.handler.ts
│   ├── routing/
│   │   └── confidence-router.service.ts     # fail-closed / degrade / escalate
│   ├── profiles/
│   │   └── retrieval-profile.registry.ts    # per-domain + per-taskType
│   └── knowledge-retrieval.service.ts       # public API
└── (existing router, orchestrator, assistant, governance)
```

---

## Knowledge base coverage

Each KB is a **scoped corpus partition** within VKL, not a separate database. Retrieval profiles select domain subsets; metadata sidecars enable filter-at-query-time.

### Domain × retrieval characteristics

| KB | Entity types (primary) | chunkPolicyId (default) | clinicalRiskTier | Min evidence (clinical use) | Structured facts in pack |
|----|--------------------------|-------------------------|------------------|----------------------------|--------------------------|
| **Disease** | `Disease`, `Syndrome`, `Differential` | `DISEASE_BY_HEADING` | MEDIUM–HIGH | L2 | signs, zoonotic flag, mortality risk |
| **Medicine** | `Drug`, `Formulation`, `WithdrawalRule` | `MEDICINE_BY_SECTION` | **HIGH** | L2 | dose matrix, routes, contraindications, withdrawal |
| **Vaccine** | `Vaccine`, `VaccinationSchedule` | `VACCINE_BY_SCHEDULE_ROW` | MEDIUM | L2 | schedule rows, storage temp, route |
| **Feed** | `FeedIngredient`, `NutrientRequirement`, `RationTemplate` | `FEED_BY_NUTRIENT_BLOCK` | MEDIUM | L2 | CP%, TDN, nutrient min/max |
| **Breed** | `Breed`, `BreedStandard`, `PerformanceBenchmark` | `BREED_BY_SECTION` | LOW–MEDIUM | L1 | weight ranges, production benchmarks |
| **Emergency** | `EmergencyCondition`, `FirstAidStep`, `TriageRule` | `EMERGENCY_BY_ACTION` | **CRITICAL** | L1 (SOP) / L2 (dosage) | action window, vet-required hours, red flags |
| **Regulatory** | `DrugRegistration`, `BannedSubstance`, `SlaughterWithdrawal` | `REGULATORY_BY_RECORD` | **HIGH** | L5 (registration) / L2 | reg numbers, effective dates, ban scope |

**Cross-KB graph expansion** (profile-controlled):

| Edge type | Retrieval use |
|-----------|---------------|
| `TREATED_WITH` | Disease query → medicine chunks |
| `PREVENTED_BY` | Disease query → vaccine chunks |
| `INTERACTS_WITH` / `CONTRAINDICATES` | Prescription → safety chunks |
| `GOVERNED_BY` | Medicine → regulatory chunks |
| `NUTRIENT_FOR` | Feed + breed stage → nutrient requirements |
| `ESCALATES_TO` | Symptom/triage → emergency chunks |

**Secondary domains** (not in primary seven, but reachable via profiles):

- `CLINICAL_PROTOCOL` — AI Doctor professional mode (`ai-doctor-v1` profile)
- `FARM_MGMT` — farm briefing, seasonal calendars (`farmer-chat-v1` domain filter)

---

## 1. Embedding layer

### 1.1 Purpose

Convert **published** `VkKnowledgeChunk` segments into dense vectors that preserve clinical semantics, bilingual content, and filter metadata — without coupling to any single embedding vendor.

### 1.2 Embed unit and identity

| Field | Rule |
|-------|------|
| **Retrieval key** | `{versionId}:{chunkIndex}` — immutable within published version |
| **Stage gate** | Only `VkKnowledgeChunk.stage = PUBLISHED` |
| **Text source** | CCE canonical template (6B.3 Appendix A) |
| **Change detection** | `metadataJson.contentHash` — skip re-embed if unchanged |
| **Model provenance** | Store `embeddingModelId`, `providerKey`, `dimensions` per vector |

### 1.3 Embedding text template (canonical — owned by CCE, consumed by VRE)

```
[domain={domain}] [entityType={entityType}] [species={species}] [risk={clinicalRiskTier}]
[evidence={evidenceLevel}] [confidence={confidenceScore}]
{headingPath optional}
---
{contentBn}
---
{contentEn}
[cite={primaryInlineToken}]
```

| Rule | Rationale |
|------|-----------|
| BN before EN in body | Bangla-first recall for farmer queries |
| Prefix tags before prose | Domain/species/risk bias in vector space |
| Inline cite at tail | Provenance signal without polluting clinical text |
| Max 8192 chars | Truncate EN first on overflow; never truncate BN dose tables |

### 1.4 Trigger events

| Event | Action |
|-------|--------|
| `KNOWLEDGE_CHUNK_PUBLISHED` (CCE handoff) | Queue `ai:knowledge:embed` for all PUBLISHED chunks in version |
| Version deprecated | Tombstone all vectors for `{versionId, *}` |
| `contentHash` change on re-publish | Delete old vectors; embed new |
| `chunkPolicyId` change | Full re-chunk (CCE) → full re-embed |
| Admin embedding model migration | Background re-embed sweep; dual-read window per model index |

### 1.5 Router integration (`AiRouterEngine.executeEmbedding`)

Embedding is a **separate modality** from chat completion.

```
AiRouterEngine.executeEmbedding({ texts[], taskHint: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' })
  → resolve AIRoute where modality = EMBEDDING
  → provider chain (platform default):
       1. OpenAI    — text-embedding-3-small
       2. Gemini    — text-embedding-004  (preferred for BN-heavy corpus)
       3. OpenRouter — openai/text-embedding-3-small
       4. Voyage    — voyage-3-lite (Anthropic path adapter)
  → batch (max 64–128 chunks per request)
  → store vectors with modelId provenance
  → log embed tokens on AiUsageLog (separate from completion)
```

**Design rule:** Chat provider (GPT/Gemini/Claude) and embedding provider **may differ** within the same user request lifecycle.

### 1.6 Provider compatibility matrix

| Provider | API | Default model | Dimensions | BN quality | Role |
|----------|-----|---------------|------------|------------|------|
| OpenAI | `/v1/embeddings` | `text-embedding-3-small` | 1536 | Good | Platform default; cost-efficient |
| Gemini | `embedContent` | `text-embedding-004` | 768 | Strong | BN-primary corpus reindex |
| OpenRouter | OpenAI-compatible | `openai/text-embedding-3-small` | 1536 | Good | Fallback billing path |
| Voyage (Claude path) | Voyage API | `voyage-3-lite` | 512 | Good | Anthropic ecosystem alignment |

### 1.7 Dimension normalization

| Strategy | When |
|----------|------|
| **Model-scoped indexes** (preferred) | Separate ANN index per `embeddingModelId` |
| **Projection layer** | Optional linear map — migration windows only |
| **Re-embed sweep** | Required before decommissioning old model index |

**Never** mix vectors from different models in the same ANN index without explicit normalization.

### 1.8 Batch, cost, and reliability controls

| Control | Value |
|---------|-------|
| Max chunks per embed job | 128 |
| Embed retry | 3× exponential via router retry engine |
| Cost gate | `AIRoute.maxCostUsd` on EMBEDDING route |
| Deduplication | Skip if `embeddingTextHash` unchanged |
| Rate limit | Router 429 coordinator → failover to next embedding provider |
| Query vs document hint | Gemini `RETRIEVAL_QUERY` / `RETRIEVAL_DOCUMENT` task types |

### 1.9 Embedding status lifecycle

| Status | Meaning |
|--------|---------|
| `NOT_APPLICABLE` | Draft / never published |
| `PENDING` | Published; embed job queued or running |
| `INDEXED` | All PUBLISHED chunks have active vectors |
| `PARTIAL` | Some chunks failed — hybrid falls back to lexical for missing |
| `FAILED` | All attempts failed — profile flag `lexicalFallbackForced: true` |

---

## 2. Vector storage

### 2.1 Purpose

Persist chunk embeddings with **rich metadata sidecars** for filtered ANN search, hybrid fusion, and audit — co-located with VKL transactional data where possible.

### 2.2 Storage model (conceptual)

```
VkKnowledgeEmbeddingVector
├── id                          // cuid
├── versionId                   // FK → VkKnowledgeVersion
├── chunkIndex                  // stable with version
├── embeddingModelId            // FK → AiModel registry
├── providerKey                 // openai | gemini | openrouter | voyage
├── dimensions                  // int
├── vector                      // pgvector column (Phase 6C.0 default)
├── embeddingTextHash           // sha256 of canonical embed input
├── active                      // false = tombstone
├── embeddedAt                  // timestamp
└── metadataSidecarJson         // denormalized filter + rank features
```

**metadataSidecarJson** mirrors CCE `ChunkMetadataEnvelopeV1` filter fields:

```typescript
type VectorMetadataSidecar = {
  entityId: string;
  slug: string;
  domain: string;               // DISEASE | MEDICINE | …
  entityType: string;
  species: string[];
  audience: string;
  regionScope: string;
  clinicalRiskTier: string;
  evidenceLevel: string;
  confidenceScore: number;
  vetApproved: boolean;
  primaryLocale: 'bn' | 'en';
  sourceKeys: string[];
  trustTierMin: number;
  publishedAt: string;
  effectiveFrom?: string;       // regulatory temporal
  effectiveTo?: string;
  structuredOverlayKeys?: string[];
};
```

### 2.2.1 Index architecture

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Primary vector index** | pgvector HNSW (cosine) | ANN search per `embeddingModelId` |
| **Lexical index** | PostgreSQL GIN tsvector on `contentBn`, `contentEn` | Keyword plane |
| **Trigram index** | `pg_trgm` on colloquial terms, trade names | Fuzzy drug/disease match |
| **Structured index** | GIN/B-tree on JSON paths | registration numbers, ingredient codes |
| **Metadata filter** | B-tree / partial indexes on `domain`, `species`, `confidenceScore` | Pre-filter before ANN |

**Phase 6C recommendation:** pgvector on PostgreSQL for operational simplicity and transactional consistency. External vector DB (Qdrant, Pinecone) deferred unless corpus exceeds ~2M chunks or isolation QPS required.

### 2.3 Tombstone and immutability

| Rule | Behavior |
|------|----------|
| Published vectors immutable | Content change → new version → new vectors |
| Deprecation | Set `active=false`; exclude from ANN; retain for audit |
| Dual-write migration | Legacy `{entryId}:{chunkIndex}` vectors coexist during VKF cutover; VRE prefers `versionId` key |

### 2.4 Index health

| Metric | Alert threshold |
|--------|-----------------|
| Publish → indexed lag | p95 > 5 min |
| `PARTIAL` entry ratio | > 5% of published corpus |
| Model index drift | > 1 active embedding model without migration plan |
| Stale vectors | Vector exists for deprecated version |

---

## 3. Hybrid search

### 3.1 Purpose

Combine **lexical precision** (drug names, registration numbers, BN colloquialisms) with **semantic recall** (informal farmer phrasing) and **structured certainty** (exact dose rows, symptom codes) into a unified candidate pool.

### 3.2 Retrieval execution pipeline

```
1. Resolve retrieval profile     → taskType + feature + audience + domain scope
2. Normalize query               → script detect, colloquial map, species hints
3. Confidence pre-check          → early fail-closed for prescription w/ missing drug context
4. Parallel search planes:
     ├── Keyword Search          → LexicalHit[]
     ├── Semantic Search         → SemanticHit[]
     └── Structured Match        → StructHit[]  (when profile.structuredMatchEnabled)
5. Union dedupe                  → key: {versionId, chunkIndex}, max 50 candidates
6. Hybrid fusion                 → fusedScore per candidate
7. Domain re-rank                → domain priority, locale, evidence, confidence boosts
8. Evidence/confidence gates     → drop below profile minimums
9. Optional cross-encoder re-rank → top-20 → top-k (cost-gated)
10. Graph expand (optional)      → 1-hop related chunks per profile
11. Context window strategy      → select final k under token budget
12. Pack assembly + injection    → KnowledgeContextPack
13. Confidence routing           → PROCEED | PROCEED_DEGRADED | BLOCK | ESCALATE_HUMAN
14. Log retrievalMetadataJson
```

### 3.3 Fusion algorithm

**Primary: weighted linear fusion**

```
fusedScore = wLex  × normalize(lexicalScore)
           + wSem  × normalize(semanticScore)
           + wStruct × structScore
           + wGraph × graphProximityScore
```

**Default weights (production hybrid):**

| Component | Weight | Notes |
|-----------|--------|-------|
| Lexical | 0.40 | Higher for medicine/regulatory (exact names) |
| Semantic | 0.45 | Higher for disease/emergency (colloquial BN) |
| Structured | 0.10 | Exact field hits — registration, dose slug |
| Graph | 0.05 | 1-hop related entities |

**RRF fallback** when a plane unavailable:

```
RRFscore(d) = Σ 1 / (k + rank_i(d))   where k = 60
```

### 3.4 Domain-tuned fusion profiles

| Profile | wLex | wSem | wStruct | Rationale |
|---------|------|------|---------|-----------|
| `prescription-v1` | 0.35 | 0.35 | **0.30** | Exact drug/regulatory match critical |
| `ai-doctor-v1` | 0.35 | **0.50** | 0.10 | Paraphrase symptom descriptions |
| `emergency-v1` | 0.30 | **0.55** | 0.10 | Colloquial emergency descriptions |
| `feed-advisor-v1` | 0.40 | 0.40 | 0.15 | Nutrient codes + informal feed questions |
| `farmer-chat-v1` | 0.40 | 0.45 | 0.10 | Balanced general chat |

### 3.5 Candidate deduplication rules

- One entry per `{versionId, chunkIndex}` — keep highest fused score
- **maxChunksPerEntity** (default 2) — prevent single disease monopolizing context
- Adjacent overlap chunks (CCE 50-token overlap): prefer higher rank; do not double-count in token budget

### 3.6 Retrieval modes

| Mode | Configuration | Use case |
|------|---------------|----------|
| **Hybrid** (default) | semantic + lexical | Production |
| **Lexical-only** | `semanticEnabled: false` | Index unavailable, zero embed cost |
| **Semantic-only** | `lexicalWeight: 0` | Eval / paraphrase tuning |
| **Structured-seeded** | graph + structured, low semantic | Prescription interaction traversal |

---

## 4. Keyword search (lexical plane)

### 4.1 Objective

High-precision matching for **canonical and colloquial terms** — INN drug names, BD trade names, disease names, registration numbers, vaccine antigens, feed ingredient codes, breed names, emergency red-flag phrases.

### 4.2 Index design

| Index | Fields | Engine |
|-------|--------|--------|
| Chunk `contentBn` | Per-chunk tsvector | GIN (Bangla config) |
| Chunk `contentEn` | Per-chunk tsvector | GIN (English config) |
| Entity `searchText` | Normalized BN+EN concat | GIN tsvector |
| `keywordsBn[]`, `keywordsEn[]` | Entity-level | GIN |
| `colloquialBn[]` | Farmer terms | `pg_trgm` |
| Structured paths | `registrationNo`, `drugClass`, `ingredientCode`, `breedCode` | B-tree / JSON path |

### 4.3 Query processing

```
User query
  → script detection (BN / EN / mixed)
  → colloquial BN expansion via VkColloquialMap
  → domain hint extraction (drug slug, symptom code from sessionContext)
  → quoted phrase detection → exact boost
  → build tsquery with locale-weighted OR
  → apply profile domain filter + species filter + confidence/evidence pre-filter
```

### 4.4 Lexical scoring

```
lexicalScore = ts_rank_cd(chunk_tsvector, query, normalization=32)
             × confidenceBoost
             × evidenceBoost
             × localeMatchBoost
             × domainPriorityBoost
```

| Boost | Formula |
|-------|---------|
| `confidenceBoost` | `0.5 + 0.5 × confidenceScore` |
| `evidenceBoost` | L1=0.80, L2=0.90, L3=0.95, L4=0.98, L5=1.00 |
| `localeMatchBoost` | 1.15 when query script matches chunk primary locale |
| `domainPriorityBoost` | Profile-ordered domain list (see §3.4) |

### 4.5 Domain-specific lexical boosts

| KB | Exact-match fields (boost ×1.5) |
|----|--------------------------------|
| Medicine | INN, `brandNamesBd[]`, formulation strength |
| Regulatory | `registrationNo`, banned substance name |
| Vaccine | antigen name, manufacturer |
| Feed | `ingredientCode`, common BN feed names |
| Breed | `breedCode`, local breed names |
| Disease | `diseaseCode`, syndrome name |
| Emergency | red-flag keyword list from `TriageRule` |

**Default top-K:** 30 chunk candidates before fusion.

---

## 5. Semantic search (vector plane)

### 5.1 Objective

Recall relevant chunks when queries use **informal BN phrasing**, symptom descriptions without canonical terminology, or cross-lingual paraphrase (BN query → EN-primary chunk content).

### 5.2 Query embedding flow

1. Normalize query (same pipeline as lexical)
2. `AiRouterEngine.executeEmbedding` with `taskHint: RETRIEVAL_QUERY`
3. ANN search on active vectors for current `embeddingModelId`
4. Pre-filters applied **before** ANN where possible (domain, species, confidence, evidence)

### 5.3 ANN parameters

| Parameter | Default | Profile override |
|-----------|---------|------------------|
| `topK` | 40 | 60 for `ai-doctor-v1` |
| Distance metric | Cosine | — |
| HNSW `ef_search` | 64 | 128 for prescription |
| Min similarity threshold | 0.72 | 0.78 for medicine dosage chunks |

### 5.4 Semantic scoring

```
semanticScore = (1 - cosineDistance(queryVector, chunkVector))
              × freshnessDecay(lastReviewedAt)
              × confidenceBoost
```

Chunks below `minSemanticSimilarity` excluded before fusion.

### 5.5 Multilingual semantic behavior

| Aspect | Policy |
|--------|--------|
| Chunk vector | Single bilingual vector (BN + EN in embed template) |
| BN query | Embedded as-is — matches BN-heavy regions of vector |
| EN doctor query | Embedded as-is — EN sections provide signal |
| Locale rank boost | Applied **after** fusion, not at ANN stage |
| Missing EN on chunk | Allowed for farmer entities; semantic still works on BN half |

---

## 6. Re-ranking

### 6.1 Purpose

Improve **precision@k** after hybrid fusion — critical for prescription and emergency profiles where false-positive chunks carry medical risk.

### 6.2 Two-stage rank architecture

```
Stage 1 — Hybrid fusion rank     → top 50 candidates
Stage 2 — Feature-weighted rank    → top 20 candidates
Stage 3 — Optional cross-encoder   → top k (profile.maxChunks)
```

### 6.3 Stage 2 rank features

| Feature | Direction | Weight (relative) |
|---------|-----------|-------------------|
| `fusedScore` | ↑ | 1.0 (base) |
| `domainPriorityIndex` | ↑ | 0.20 |
| `confidenceScore` | ↑ | 0.15 |
| `evidenceLevel` | ↑ | 0.12 |
| `speciesMatch` | ↑ | 0.10 |
| `localeAlignment` | ↑ | 0.08 |
| `vetApproved` | gate / ↑ | required for MEDICINE dosage |
| `recency` | ↑ | 0.05 |
| `chunkSpecificity` | ↑ | 0.05 — shorter heading-aligned chunks for precise Q |
| `clinicalRiskTier` | context | deprioritize CRITICAL in GENERAL_CHAT unless emergency query |

```
finalRankScore = fusedScore
               × (1 + Σ featureWeight × normalizedFeature)
               × vetApprovedGate
```

### 6.4 Optional cross-encoder re-ranker (Stage 3)

| Parameter | Value |
|-----------|-------|
| Enabled profiles | `prescription-v1` (default on), `ai-doctor-v1` (optional) |
| Input | `{query, chunkExcerpt, domain, entityType}` pairs |
| Model route | Cheap chat route via AiRouterEngine (e.g. Gemini Flash) OR dedicated rerank API |
| Cost gate | `AIRoute.maxCostUsd` — skip re-rank if budget exhausted |
| Fallback | Stage 2 order preserved |

**Re-ranker prompt contract (conceptual):**

```
Score relevance 0–10 for veterinary retrieval.
Query: {query}
Passage ({domain}/{entityType}): {excerpt}
Consider: species match, clinical relevance, evidence level.
Return JSON: { "score": number, "reason": string }
```

### 6.5 Conflict resolution at re-rank

When top chunks disagree on clinical facts:

1. Prefer higher **evidence level**
2. Then higher **confidence score**
3. Then newer **`lastReviewedAt`**
4. Then **regulatory** over textbook for BD prescription context
5. If unresolvable for `PRESCRIPTION_ANALYSIS` → confidence router **BLOCK**

---

## 7. KnowledgeContextPack

### 7.1 Purpose

Canonical **retrieval output contract** consumed by `AiAssistantService`, `AiFoundationService`, and future AI Doctor / Prescription Assistant — decoupling search internals from prompt assembly.

### 7.2 Type contract (VRE-extended)

```typescript
type KnowledgeContextPack = {
  packId: string;
  taskType: AiDbTaskType;
  locale: 'bn' | 'en';
  query: string;
  normalizedQuery: string;
  retrievedAt: string;
  retrievalProfileId: string;
  retrievalMode: 'lexical' | 'hybrid' | 'semantic' | 'structured';

  // Primary retrieval units
  chunks: RetrievedChunk[];
  entities: RetrievedEntity[];           // aggregated view by entityId
  structuredFacts: StructuredFact[];

  // Injection blocks (LLM-ready)
  citationBlock: string;
  evidenceBlock: string;                 // NEW — evidence summary for LLM
  confidenceBlock: string;               // NEW — confidence summary for LLM
  groundingInstruction: string;
  graphHints: GraphHint[];

  // Quality metadata
  filtersApplied: RetrievalFilters;
  confidenceSummary: { min: number; max: number; avg: number };
  evidenceSummary: { min: string; max: string; dominant: string };
  excludedCount: number;
  embeddingCoverage: number;             // 0–1 fraction of hits with vectors

  // Routing decision
  routingDecision: ConfidenceRoutingDecision;

  // Observability
  scores: {
    lexicalMs: number;
    semanticMs: number;
    fusionMs: number;
    rerankMs: number;
    packBuildMs: number;
    totalMs: number;
  };
};

type RetrievedChunk = {
  versionId: string;
  chunkIndex: number;
  entityId: string;
  slug: string;
  domain: string;
  entityType: string;
  title: string;
  excerpt: string;                       // locale-primary
  excerptEn?: string;
  headingPath?: string;
  evidenceLevel: string;
  confidenceScore: number;
  clinicalRiskTier: string;
  rank: number;
  fusedScore: number;
  lexicalScore?: number;
  semanticScore?: number;
  inlineCitation: string;
  sources: SourceCitation[];
  structuredFactRefs?: string[];         // factIds extracted from this chunk
};

type StructuredFact = {
  factId: string;
  domain: string;
  factType: string;                      // DOSE_MG_KG | WITHDRAWAL_DAYS | NUTRIENT_MIN | REGISTRATION | …
  species?: LivestockSpecies;
  value: number | string | boolean;
  unit?: string;
  evidenceLevel: string;
  confidenceScore: number;
  sourceCitation: string;
  effectiveFrom?: string;
  effectiveTo?: string;
};

type ConfidenceRoutingDecision = {
  action: 'PROCEED' | 'PROCEED_DEGRADED' | 'BLOCK' | 'ESCALATE_HUMAN';
  reason: string;
  failClosed: boolean;
  disclaimerLevel: 'standard' | 'elevated' | 'blocking';
  medicalRiskTier: 'NONE' | 'LOW' | 'HIGH' | 'CRITICAL';
};
```

### 7.3 Pack assembly flow

```
Ranked chunks + entity metadata
  → group by entityId
  → extract structuredFacts from structuredOverlay (CCE enricher keys)
  → apply context window strategy
  → render citationBlock, evidenceBlock, confidenceBlock
  → attach groundingInstruction from profile strictness
  → compute summaries + routingDecision input
  → emit pack
```

---

## 8. Context window strategy

### 8.1 Purpose

Maximize clinical utility within **fixed token budgets** per retrieval profile — protecting structured facts and high-confidence segments while truncating lower-ranked prose.

### 8.2 Token budget allocation (default)

| Slot | % of profile.tokenBudget | Protected | Notes |
|------|--------------------------|-----------|-------|
| **Structured facts** | 30% | **Yes** — never dropped for prescription | JSON-compact numerics |
| **Entity excerpts** | 45% | Truncated by rank | Locale-primary prose |
| **Citation block** | 10% | Required if excerpts present | Inline tokens |
| **Evidence + confidence blocks** | 5% | Required for clinical profiles | Human-readable summary |
| **Graph hints + grounding** | 10% | Grounding instruction never truncated | Follow-up navigation |

### 8.3 Profile token budgets

| profileId | tokenBudget | Structured fact reserve |
|-----------|-------------|-------------------------|
| `farmer-chat-v1` | 1,200 | 250 tokens |
| `ai-doctor-v1` | 1,800 | 400 tokens |
| `prescription-v1` | 2,000 | **600 tokens** (dose + withdrawal mandatory) |
| `feed-advisor-v1` | 1,600 | 450 tokens |
| `emergency-v1` | 1,500 | 300 tokens |

### 8.4 Truncation priority (first dropped → last kept)

1. Lowest-ranked entity excerpts (lowest `finalRankScore`)
2. Graph hints (keep at least 1 if prescription interactions present)
3. EN parallel excerpt when `locale=bn` (keep BN excerpt)
4. Long narrative chunks — trim to 280 chars before dropping entirely
5. **Never drop:** structured facts for target drug/nutrient; emergency first-aid steps; regulatory ban records

### 8.5 Multi-turn context strategy (future AI Doctor)

| Turn | Strategy |
|------|----------|
| First turn | Full profile budget |
| Follow-up | Re-retrieve with `sessionContext.previousSlugs[]` boost — 40% budget |
| Clarification | Narrow domain filter; increase structured weight |
| Prescription refinement | **Re-retrieve required** — do not accumulate unbounded context |

### 8.6 Overflow handling

When structured facts alone exceed budget (complex polypharmacy):

- Split into **primary drug facts** (session target) + **interaction facts** (graph-expanded)
- If still overflow → `routingDecision: PROCEED_DEGRADED` with explicit "partial grounding" flag
- Prescription profile → **BLOCK** if primary drug dose facts cannot fit

---

## 9. Citation injection

### 9.1 Purpose

Ensure every clinical claim traceable to **registered VKL sources** with locators sufficient for medico-legal defensibility in Bangladesh context.

### 9.2 Citation layers (from CCE — consumed by VRE)

| Layer | Consumer | Format |
|-------|----------|--------|
| **L0 — Span ref** | Audit, import lineage | `documentId:page:section:charStart-charEnd` |
| **L1 — Human citation** | Mobile "Sources" UI | APA-like BN/EN from source license template |
| **L2 — Inline chunk token** | LLM context + response parsing | `[sourceKey\|p.142\|§treatment]` |
| **L3 — Pack attribution** | `KnowledgeContextPack.sources[]` | Weighted `sourceAttributions[]` |

### 9.3 Injection points

```
┌─────────────────────────────────────────────────────────────────┐
│ System prompt slot                                               │
│   groundingInstruction                                           │
│   citationBlock + evidenceBlock + confidenceBlock                │
├─────────────────────────────────────────────────────────────────┤
│ User message enrichment (AiAssistantService legacy compat)       │
│   Reference:\n{citationBlock}\n\n{userMessage}                    │
├─────────────────────────────────────────────────────────────────┤
│ Response post-processing (6D)                                    │
│   Parse inline tokens → link to GET /api/ai/knowledge/:slug       │
└─────────────────────────────────────────────────────────────────┘
```

### 9.4 Citation block format

**Bangla (farmer — `locale=bn`):**

```
তথ্যসূত্র (শুধুমাত্র নিচের তথ্য ব্যবহার করুন):
[1] [dls-manual|p.12] গবাদি পশুর নিউমোনিয়া — ডিএলএস (২০২৪)
    "জ্বর, কাশি, নাক দিয়ে পানি পড়া..."
[2] [dgda-reg|row:1247] ওষুধ নিবন্ধন — DGDA
    ...
```

**English (doctor — `locale=en`):**

```
Sources (use ONLY the following):
[1] [dls-manual|p.12] Bovine Pneumonia — DLS (2024)
    "Fever, cough, nasal discharge..."
```

### 9.5 Citation injection rules

| Rule | Enforcement |
|------|-------------|
| Every pack chunk **must** have `inlineCitation` | Drop chunk if missing (context builder) |
| Dosage structured facts **must** include `sourceCitation` | Prescription profile gate |
| LLM instructed to append inline token after clinical claims | `groundingInstruction` |
| No citation → no clinical claim | Prompt contract |
| Multi-source chunk | Primary token in excerpt; secondaries in `sources[]` |

### 9.6 Provider-neutral injection

Citation assembly occurs **entirely in backend** before `AiRouterEngine.executeCompletion()`. GPT, Gemini, Claude, OpenRouter receive identical enriched messages.

---

## 10. Evidence injection

### 10.1 Purpose

Make **evidence quality visible to the LLM** — preventing the model from treating all retrieved text as equally authoritative.

### 10.2 Evidence block format

**Bangla:**

```
প্রমাণের স্তর (Evidence):
• [1] L2 — মাঠ পর্যায়ে যাচাইকৃত (Field validated)
• [2] L5 — নিয়ন্ত্রক নথি (Regulatory primary)
সর্বোচ্চ প্রমাণ: L5 | সর্বনিম্ন: L2 | প্রাধান্যসহ: L2
```

**English:**

```
Evidence levels:
• [1] L2 — Field validated
• [2] L5 — Regulatory primary
Max: L5 | Min: L2 | Dominant: L2
```

### 10.3 Evidence injection rules

| Rule | Behavior |
|------|----------|
| Map GRADE-inspired L1–L5 to locale labels | 6A evidence catalog |
| Per-chunk evidence in citation block footnotes | `[1] ... (L2)` |
| Pack-level `evidenceSummary` | Computed min/max/dominant |
| Prescription profile | Warn LLM when any dose fact < L2 |
| Emergency profile | Allow L1 for established SOP sources (govt extension + vet reviewed) |

### 10.4 Evidence-based conflict resolution in prompt

```
If sources conflict, prefer:
1. Higher evidence level (L5 > L4 > … > L1)
2. Regulatory source for BD legal constraints
3. Newer lastReviewedAt date
If conflict remains unresolved, state uncertainty and recommend veterinarian consultation.
```

---

## 11. Confidence injection

### 11.1 Purpose

Expose **composite confidence scores** to the LLM and routing layer — enabling calibrated language ("likely", "uncertain") and fail-closed gates.

### 11.2 Confidence block format

**Bangla:**

```
আস্থার স্কোর (Confidence 0–1):
• [1] 0.82 — উচ্চ
• [2] 0.91 — খুব উচ্চ
গড়: 0.86 | সর্বনিম্ন: 0.82
নিম্ন আস্থার তথ্য উপেক্ষা করুন (< 0.55)।
```

### 11.3 Confidence injection rules

| Score range | LLM language guidance |
|-------------|----------------------|
| ≥ 0.75 | State facts directly with citation |
| 0.55 – 0.74 | Use qualified language ("available information suggests…") |
| < 0.55 | Do not use for dosage/prescription; general context only |
| Provisional (ingest cap 0.65) | Never retrieved — blocked at gate |

### 11.4 Confidence in routing (see §15)

Confidence injection and confidence routing are **paired** — block ensures low-confidence chunks never reach injection for fail-closed profiles.

---

## 12. Grounding strategy

### 12.1 Purpose

Define the **contract between retrieved knowledge and LLM generation** — what the model may say, must say, and must not say.

### 12.2 Grounding strictness levels

| Level | Profiles | LLM constraint |
|-------|----------|----------------|
| **Strict** | `prescription-v1`, `emergency-v1` (actions) | ONLY reference material; no external clinical knowledge |
| **Moderate** | `ai-doctor-v1`, `feed-advisor-v1` | Reference for clinical/numeric facts; general husbandry allowed without citation |
| **Light** | `farmer-chat-v1` | Reference when available; conversational tone permitted |

### 12.3 Grounding instruction template (strict — prescription)

```
You are a veterinary prescription assistant for Bangladesh.

CRITICAL GROUNDING RULES:
1. Use ONLY the Reference, Structured Facts, Evidence, and Confidence sections below.
2. For dosages, withdrawal periods, and contraindications — use ONLY Structured Facts JSON.
3. If Structured Facts do not contain the required information, respond that you cannot advise and recommend a licensed veterinarian.
4. Do NOT invent drug names, doses, routes, or withdrawal periods.
5. Cite inline tokens (e.g. [dgda-reg|row:1247]) after each clinical claim.
6. Respect Evidence levels — do not treat L1 sources as regulatory fact.
7. Banned substances in Reference are absolute contraindications.

Reference:
{citationBlock}

Structured Facts:
{structuredFactsJson}

Evidence:
{evidenceBlock}

Confidence:
{confidenceBlock}
```

### 12.4 Structured facts override rule

When prose excerpt and `structuredFacts` conflict → **structured facts win**. Context builder adds explicit note in grounding instruction.

### 12.5 Negative grounding (forbidden behaviors)

| Forbidden | Applies to |
|-----------|------------|
| Inventing dose not in structured facts | All clinical profiles |
| Citing source not in pack | All profiles |
| Downplaying emergency when emergency chunks retrieved | emergency-v1 |
| Off-label species dosing without explicit chunk | prescription-v1 |
| Mixing human medicine guidance | All profiles |

---

## 13. Hallucination prevention

### 13.1 Defense-in-depth layers

```
Layer 1 — Retrieval gates           Exclude low-confidence / low-evidence chunks
Layer 2 — Domain scoping            Profile domainPriority limits corpus
Layer 3 — Confidence routing        BLOCK before LLM when pack insufficient
Layer 4 — Grounding instruction     Explicit "no external knowledge" contract
Layer 5 — Structured facts          Dosages as JSON, not prose-only
Layer 6 — Citation discipline       No citation → no clinical claim in prompt
Layer 7 — Evidence/confidence blocks Calibrated LLM language
Layer 8 — Output validation (6D)    Parse dosage mentions vs structuredFacts
Layer 9 — Disclaimer resolver       Elevated disclaimer when degraded
Layer 10 — Usage log audit          packId → slugs → sources traceability
```

### 13.2 Task-specific hallucination posture

| taskType | Posture |
|----------|---------|
| `GENERAL_CHAT` | Ground when available; no clinical claims without citation |
| `DISEASE_ANALYSIS` | Strict for diagnosis/differential; moderate for care advice |
| `PRESCRIPTION_ANALYSIS` | **Strictest** — fail-closed without structured dose facts |
| `FEED_FORMULATION` | Strict for nutrient numbers; moderate for general tips |
| `EMERGENCY_CONSULTATION` | Strict for action steps; always include vet referral |

### 13.3 Eval hooks (architecture)

| Eval set | Metric | Target |
|----------|--------|--------|
| Prescription dose extraction | Hallucinated dose rate | < 2% |
| Farmer BN paraphrase | Recall@4 | ≥ 0.85 |
| Regulatory ban compliance | False negative rate | 0% |
| Citation presence | Clinical claims with inline token | ≥ 90% |

---

## 14. Low confidence handling

### 14.1 Thresholds by profile

| profileId | minConfidence | Below-threshold behavior |
|-----------|---------------|--------------------------|
| `prescription-v1` | 0.75 | Exclude chunk; may trigger BLOCK |
| `ai-doctor-v1` | 0.55 | Exclude; degraded if avg < 0.55 |
| `emergency-v1` | 0.60 | Exclude clinical actions; keep triage SOP if ≥ 0.60 |
| `feed-advisor-v1` | 0.65 | Exclude nutrient facts; general tips OK |
| `farmer-chat-v1` | 0.40 | Exclude; browse API may still show with badge |

### 14.2 Degraded proceed conditions

`PROCEED_DEGRADED` when:

- `confidenceSummary.avg` below profile ideal but above absolute minimum
- `embeddingCoverage < 0.5` (lexical fallback)
- Partial pack after context window truncation
- Zero semantic hits but lexical hits present

Degraded response includes:

- Elevated disclaimer (`disclaimerLevel: elevated`)
- Explicit uncertainty language in grounding instruction
- `retrievalMetadataJson.degraded: true`

### 14.3 Farmer-facing low-confidence UX (via API metadata)

Pack exposes `confidenceSummary` — mobile UI may show "limited evidence" badge when `avg < 0.55`.

---

## 15. Medical risk handling

### 15.1 Clinical risk tier integration

| clinicalRiskTier | Retrieval behavior |
|------------------|-------------------|
| **CRITICAL** (emergency) | Always include `vetRequiredWithinHours` facts; never truncate first-aid steps |
| **HIGH** (medicine, regulatory) | Require vet-approved metadata; fail-closed on prescription |
| **MEDIUM** (disease, vaccine) | Standard gates |
| **LOW** (breed, farm tips) | Relaxed evidence; still require citation |

### 15.2 Medical risk handler (conceptual service)

```
INPUT: RetrievalRequest, candidate chunks, profile

1. Classify query medical risk from:
   - taskType
   - sessionContext.emergencyFlag
   - detected drug/dose intent (prescription)
   - symptom red-flag matches

2. Apply risk-specific rules:
   - CRITICAL → force emergency domain boost; include referral language template
   - HIGH + medicine → vetApproved filter; structured facts mandatory
   - Polypharmacy detected → force INTERACTS_WITH graph expand

3. Emit medicalRiskTier on routingDecision
```

### 15.3 Domain-specific medical rules

| Scenario | Rule |
|----------|------|
| Banned substance query | Always retrieve REGULATORY_BD ban chunk; BLOCK if absent |
| Withdrawal period question | Require WithdrawalRule or SlaughterWithdrawal structured fact |
| Vaccine storage temperature | Require L2+ evidence; degrade if only L1 |
| Feed toxic alert (e.g. urea poisoning) | Prioritize ToxicFeedAlert over general feed chunks |
| Off-label species dose | BLOCK prescription unless explicit chunk for species |

---

## 16. Fail-closed strategy

### 16.1 Purpose

**Block LLM invocation** when grounding is insufficient for high-stakes tasks — returning safe template responses instead of speculative clinical advice.

### 16.2 Confidence routing actions

| Action | Meaning |
|--------|---------|
| `PROCEED` | Normal LLM invocation with full pack |
| `PROCEED_DEGRADED` | Invoke with partial pack + elevated disclaimer |
| `BLOCK` | Do not invoke LLM; return safe template |
| `ESCALATE_HUMAN` | Offer vet teleconsult / clinic finder |

### 16.3 Fail-closed decision matrix

| taskType | Condition | Action |
|----------|-----------|--------|
| `PRESCRIPTION_ANALYSIS` | No structured dose for target drug | **BLOCK** |
| `PRESCRIPTION_ANALYSIS` | `confidenceSummary.avg < 0.75` | **BLOCK** |
| `PRESCRIPTION_ANALYSIS` | `topEvidence < L2` for dose facts | **BLOCK** |
| `PRESCRIPTION_ANALYSIS` | Banned substance conflict | **BLOCK** + warning template |
| `PRESCRIPTION_ANALYSIS` | Missing regulatory registration for BD | **BLOCK** |
| `EMERGENCY_CONSULTATION` | Zero chunks + emergency keywords | **PROCEED_DEGRADED** + referral template |
| `EMERGENCY_CONSULTATION` | CRITICAL chunks present | **PROCEED** (strict grounding) |
| `DISEASE_ANALYSIS` | `confidenceSummary.avg < 0.55` | **PROCEED_DEGRADED** |
| `FEED_FORMULATION` | No nutrient requirement for species/stage | **PROCEED_DEGRADED** |
| `GENERAL_CHAT` | Empty pack | **PROCEED_DEGRADED** + strong disclaimer |
| Any | Governance kill switch `knowledge.retrieval.{domain}` | **BLOCK** or empty pack |

### 16.4 Fail-closed vs fail-open profile flags

| Profile | failClosed | Behavior on gate failure |
|---------|------------|--------------------------|
| `prescription-v1` | **true** | BLOCK — no LLM call |
| `regulatory-v1` (future) | **true** | BLOCK |
| `emergency-v1` | false | Degraded + referral when empty |
| `farmer-chat-v1` | false | Degraded + disclaimer |

### 16.5 Safe template responses (BLOCK)

Returned **without** LLM invocation — localized BN/EN:

```
prescription_insufficient_grounding:
  bn: "এই ওষুধের জন্য পর্যাপ্ত যাচাইকৃত তথ্য আমাদের knowledge base-এ নেই।
       অনুগ্রহ করে একজন লাইসেন্সপ্রাপ্ত পশুচিকেত্সকের পরামর্শ নিন।"
  en: "We do not have sufficient verified information for this medication in our knowledge base.
       Please consult a licensed veterinarian."
```

### 16.6 Integration point (before AiRouterEngine)

```
KnowledgeRetrievalService.retrieve()
  → ConfidenceRouter.decide(pack, profile)
  → BLOCK → return { content: safeTemplate, pack, routingDecision }
  → PROCEED* → AiFoundationService.executePromptTask({ retrievalContext: pack })
```

Router failover is **unaffected** — retrieval routing is independent of provider failover.

---

## 17. Multi-language retrieval

### 17.1 Locale policy (from 6A — operationalized in VRE)

| Aspect | Policy |
|--------|--------|
| **Canonical authoring** | BN + EN both required before publish (farmer-facing) |
| **Farmer default** | `locale=bn`; EN fallback excerpt if BN missing (blocked at publish) |
| **Doctor default** | `locale=en` with BN parallel in pack |
| **Colloquial BN** | `colloquialBn[]` + VkColloquialMap expansion at query time |
| **Structured facts** | Locale-independent numerics |
| **Citation blocks** | Locale-rendered; sources bilingual where available |

### 17.2 Query language detection

```
detectScript(query) → 'bn' | 'en' | 'mixed'
  → set localeBoost target
  → search both tsvector indexes
  → embed query as-is (single vector)
  → render pack in request.locale
```

### 17.3 Cross-lingual retrieval

| Scenario | Behavior |
|----------|----------|
| BN query → EN-primary chunk | Semantic recall via bilingual embed template |
| EN doctor query → BN farmer chunk | Same — EN section in embed text |
| Mixed query | Both indexes searched; boost matching script |

### 17.4 Locale-specific ranking

```
localeBoost = 1.15 if chunk.primaryLocale === query.detectedScript
            × 1.05 if chunk.localeFlags includes query locale completeness
```

### 17.5 Multi-language grounding instructions

Grounding instruction template selected from registry by `{locale, strictness}` — not runtime translation of arbitrary text.

---

## 18. Retrieval profiles

### 18.1 Profile registry (domain × taskType)

| profileId | taskType | domainPriority[] | failClosed | minConf | minEvidence | rerank |
|-----------|----------|-------------------|------------|---------|-------------|--------|
| `farmer-chat-v1` | GENERAL_CHAT | FARM_MGMT, DISEASE, EMERGENCY, FEED | no | 0.40 | L1 | no |
| `ai-doctor-v1` | DISEASE_ANALYSIS | DISEASE, CLINICAL_PROTOCOL, MEDICINE, EMERGENCY | no | 0.55 | L2 | optional |
| `prescription-v1` | PRESCRIPTION_ANALYSIS | MEDICINE, REGULATORY_BD | **yes** | 0.75 | L2 | **yes** |
| `feed-advisor-v1` | FEED_FORMULATION | FEED, BREED | no | 0.65 | L2 | no |
| `emergency-v1` | EMERGENCY_CONSULTATION | EMERGENCY, DISEASE | no | 0.60 | L1 | no |
| `vaccine-advisor-v1` | GENERAL_CHAT | VACCINE, DISEASE | no | 0.55 | L2 | no |
| `breed-context-v1` | GENERAL_CHAT | BREED, FEED | no | 0.40 | L1 | no |
| `symptom-enrich-v1` | DISEASE_ANALYSIS | DISEASE | no | 0.50 | L2 | no |

### 18.2 Full profile schema

```json
{
  "profileId": "prescription-v1",
  "taskType": "PRESCRIPTION_ANALYSIS",
  "domainPriority": ["MEDICINE", "REGULATORY_BD"],
  "maxChunks": 8,
  "maxEntities": 6,
  "maxChunksPerEntity": 2,
  "minConfidence": 0.75,
  "minEvidenceLevel": "L2",
  "semanticEnabled": true,
  "fusionMethod": "weighted_linear",
  "lexicalWeight": 0.35,
  "semanticWeight": 0.35,
  "structuredWeight": 0.30,
  "graphWeight": 0.0,
  "expandGraph": true,
  "graphEdgeTypes": ["INTERACTS_WITH", "CONTRAINDICATES", "REQUIRES_WITHDRAWAL", "GOVERNED_BY"],
  "structuredMatchEnabled": true,
  "rerankerEnabled": true,
  "tokenBudget": 2000,
  "structuredFactReserve": 600,
  "failClosed": true,
  "localePreference": ["en", "bn"],
  "vetApprovedRequired": true,
  "groundingStrictness": "strict",
  "injectEvidenceBlock": true,
  "injectConfidenceBlock": true
}
```

---

## 19. Platform integration contracts

### 19.1 AiRouterEngine

| Concern | VRE integration |
|---------|-----------------|
| **Embedding** | `executeEmbedding()` — EMBEDDING route chain; separate from chat |
| **Chat completion** | Unchanged — receives enriched prompt from feature service |
| **Cost accounting** | Embed + re-rank tokens logged separately on `AiUsageLog` |
| **Failover** | Embed failover independent of chat failover |
| **Provider keys** | Vault via `AiSecretService` |
| **Re-ranker** | Optional cheap completion route for cross-encoder |

**Sequence:**

```
Feature Service
  → VRE.retrieve()                    // BEFORE router
  → ConfidenceRouter.decide()
  → [BLOCK] → safe template
  → [PROCEED] → AiFoundationService.executePromptTask()
                  → AiOrchestratorService
                  → AiRouterEngine.executeCompletion()   // chat only here
```

### 19.2 AiAssistantService

| Method | VRE usage |
|--------|-----------|
| `chat()` | `retrieve({ taskType: GENERAL_CHAT, profile: farmer-chat-v1 })` |
| `farmBriefing()` | `retrieve({ domainFilter: FARM_MGMT, feature: farm_briefing })` |
| `farmQuery()` | Profile by query intent classification |

Integration pattern:

```typescript
const pack = await getKnowledgeRetrievalService().retrieve({
  query: userMessage,
  locale,
  taskType: 'GENERAL_CHAT',
  feature: 'farmer_chat',
  species: sessionSpecies,
});

if (pack.routingDecision.action === 'BLOCK') {
  return safeResponse(pack);
}

return executePromptTask({
  taskType: 'GENERAL_CHAT',
  userMessage,
  locale,
  retrievalContext: pack,
});
```

Legacy compat: `AiKnowledgeService.retrieveForRag()` → thin wrapper returning `pack.citationBlock`.

### 19.3 Future AI Doctor

| Capability | VRE supply |
|------------|------------|
| Differential diagnosis | Disease KB + `DIFFERENTIAL_OF` graph expand |
| Treatment options | Medicine + Clinical Protocol chunks |
| Workup suggestions | `DiagnosticWorkup` structured entities |
| Escalation | Emergency KB + `ESCALATES_TO` edges |
| taskType | `DISEASE_ANALYSIS` |
| Profile | `ai-doctor-v1` |
| failClosed | false (degraded OK); strict grounding for treatment claims |
| Audience | `DOCTOR` — `locale=en` preferred |

Session context enrichment:

```typescript
sessionContext: {
  symptomCodes: string[];
  species: LivestockSpecies;
  differentialSlugs?: string[];
  previousPackId?: string;
}
```

### 19.4 Future AI Prescription Assistant

| Capability | VRE supply |
|------------|------------|
| Dose validation | Medicine KB `speciesDoseMatrix` structured facts |
| Interaction check | `INTERACTS_WITH` graph traversal |
| Contraindication | `CONTRAINDICATES` edges |
| Withdrawal | `WithdrawalRule` + Regulatory `SlaughterWithdrawal` |
| Legal | `DrugRegistration`, `BannedSubstance` |
| taskType | `PRESCRIPTION_ANALYSIS` |
| Profile | `prescription-v1` |
| failClosed | **true** — mandatory |

Required pack contents for PROCEED:

- ≥1 structured dose fact for target drug + species
- ≥1 regulatory fact when `regionScope=BD`
- `confidenceSummary.avg ≥ 0.75`
- All dose facts evidence ≥ L2

### 19.5 Future AI Feed Advisor

| Capability | VRE supply |
|------------|------------|
| Nutrient targets | Feed KB `NutrientRequirement` |
| Ingredient catalog | `FeedIngredient` composition |
| Ration templates | `RationTemplate` |
| Safety | `ToxicFeedAlert` |
| Breed context | Breed KB weight/production benchmarks |
| taskType | `FEED_FORMULATION` |
| Profile | `feed-advisor-v1` |

### 19.6 AiUsageLog metadata

```typescript
retrievalMetadataJson: {
  packId: string;
  retrievalProfileId: string;
  retrievalMode: string;
  domainsRetrieved: string[];
  chunkCount: number;
  excludedCount: number;
  confidenceSummary: { min, max, avg };
  evidenceSummary: { min, max, dominant };
  routingDecision: string;
  medicalRiskTier: string;
  embeddingCoverage: number;
  degraded: boolean;
  latencyMs: number;
  topSlugs: string[];
  topSourceKeys: string[];
}
```

---

## 20. Async embedding pipeline

```
CCE Publish Promoter
  → emit KNOWLEDGE_CHUNK_PUBLISHED
       → BullMQ: ai:knowledge:embed
            → load PUBLISHED chunks (versionId)
            → build embed text (CCE template)
            → AiRouterEngine.executeEmbedding (batched)
            → upsert VkKnowledgeEmbeddingVector
            → update version.embeddingStatus = INDEXED | PARTIAL | FAILED
```

| Queue | Concurrency | Retry |
|-------|-------------|-------|
| `ai:knowledge:embed` | 4 workers | 3× exponential |
| `ai:knowledge:reindex` | 1 (admin sweep) | manual |

**Idempotency:** `embeddingTextHash` prevents duplicate embed work.

---

## 21. Security, governance & observability

### 21.1 Security controls

| Control | Implementation |
|---------|----------------|
| Published-only retrieval | Hard filter `stage = PUBLISHED` |
| Draft leakage prevention | STAGING chunks never indexed or returned |
| PII in queries | Log hash + length — not raw text in production |
| Kill switch | Governance scope `knowledge.retrieval.{domain}` |
| Rate limit | Per-user retrieval QPS cap |
| Audit | `packId` links to slugs, sources, routing decision |

### 21.2 Admin API (conceptual)

| Route | Purpose |
|-------|---------|
| `GET /api/admin/ai-ops/knowledge/retrieval-profiles` | List/edit profiles |
| `POST /api/admin/ai-ops/knowledge/retrieval/eval` | Eval query → pack preview |
| `GET /api/admin/ai-ops/knowledge/embedding/status` | Index health by domain |
| `POST /api/admin/ai-ops/knowledge/embedding/reindex` | Trigger re-embed sweep |
| `GET /api/admin/ai-ops/knowledge/retrieval/analytics` | precision@k, block rate, latency |

### 21.3 Success metrics

| Metric | Target |
|--------|--------|
| Hybrid precision@4 (manual eval) | ≥ 0.85 |
| BN colloquial MRR@10 | ≥ 0.75 |
| Prescription true fail-closed rate | 100% when gates fail |
| Prescription false-block rate | < 5% |
| Retrieval p95 latency (excl. re-ranker) | < 400 ms |
| Embedding lag (publish → indexed) | p95 < 5 min |
| Citation coverage in clinical responses | ≥ 90% |
| Hallucinated dosage rate (eval set) | < 2% |

---

## 22. Sub-phase roadmap

| Sub-phase | Scope | Depends on |
|-----------|-------|------------|
| **6C.0** | Vector schema + embedding pipeline + EMBEDDING route | 6B.3 publish handoff |
| **6C.1** | Keyword chunk search (tsvector on VkKnowledgeChunk) | 6C.0 |
| **6C.2** | Semantic search + hybrid fusion | 6C.0, 6C.1 |
| **6C.3** | Context window strategy + KnowledgeContextPack v2 | 6C.2 |
| **6C.4** | Evidence + confidence injection blocks | 6C.3 |
| **6C.5** | Medical risk handler + confidence routing | 6C.3 |
| **6C.6** | AiAssistantService + AiRouterEngine integration | 6C.3, Phase 4 |
| **6C.7** | Optional re-ranker + graph expansion | 6C.2 |
| **6C.8** | VKF chunk key migration (`versionId`) | 6B.3.7 |
| **6C.9** | Admin eval UI + domain coverage dashboards | 6C.6 |
| **6D.0** | AI Doctor / Prescription / Feed Advisor binding | 6C.6 |

---

## Appendix A — End-to-end flow: Prescription Assistant (fail-closed)

```
1. Doctor queries (EN): "Is enrofloxacin 5 mg/kg safe for lactating cow?"
2. PrescriptionAssistant.analyze()
   → retrieve({ taskType: PRESCRIPTION_ANALYSIS, profile: prescription-v1,
                locale: 'en', species: COW,
                sessionContext: { drugSlugs: ['enrofloxacin'] } })
3. Structured match → enrofloxacin Drug entity
4. Keyword + semantic → MEDICINE_BY_SECTION dose chunk + REGULATORY_BD withdrawal chunk
5. Graph expand → INTERACTS_WITH, REQUIRES_WITHDRAWAL, GOVERNED_BY
6. Hybrid fusion → re-rank top 8
7. Gates: confidence ≥ 0.75, evidence ≥ L2, vetApproved ✓
8. Context window → structured facts: dose 5 mg/kg PO, milk withdrawal 84 days
9. Pack built with citation + evidence + confidence blocks
10. Confidence router → PROCEED
11. AiRouterEngine → completion with strict grounding instruction
12. Response cites [dgda-reg|row:891] and [bdvet-pharma|p.204]
13. Usage log: packId, routingDecision=PROCEED, domains=[MEDICINE, REGULATORY_BD]
```

**BLOCK variant:** If milk withdrawal fact missing → step 10 returns BLOCK → safe template → no LLM call.

---

## Appendix B — End-to-end flow: Farmer chat (Bangla, degraded OK)

```
1. Farmer (BN): "আমার গরu's গায়ে ফোস্কা হয়েছে, কী করব?"
2. AiAssistantService.chat()
   → retrieve({ taskType: GENERAL_CHAT, locale: 'bn', profile: farmer-chat-v1 })
3. Colloquial map: "ফোস্কা" → Lumpy Skin Disease
4. Hybrid search → Disease KB chunk (semantic 0.89, lexical 0.82)
5. Confidence router → PROCEED (avg 0.72)
6. Pack with BN citation block + moderate grounding
7. AiRouterEngine → Gemini Flash completion
8. Response includes [dls-manual|p.12] citation + vet referral for severe cases
```

---

## Appendix C — Structured fact types by KB

| KB | factType | Example value |
|----|----------|---------------|
| Medicine | `DOSE_MG_KG` | 5 mg/kg PO |
| Medicine | `WITHDRAWAL_DAYS_MILK` | 84 |
| Medicine | `CONTRAINDICATION` | pregnancy |
| Regulatory | `REGISTRATION_NO` | BD-REG-12345 |
| Regulatory | `BANNED_SUBSTANCE` | chloramphenicol |
| Feed | `NUTRIENT_CP_PERCENT_MIN` | 16 |
| Feed | `TOXIC_THRESHOLD` | urea > 2% DM |
| Vaccine | `SCHEDULE_AGE_DAYS` | 14 |
| Vaccine | `STORAGE_TEMP_C` | 2–8 |
| Breed | `ADULT_WEIGHT_KG_RANGE` | 350–450 |
| Emergency | `VET_REQUIRED_WITHIN_HOURS` | 2 |
| Disease | `ZOONOTIC_FLAG` | true |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **VRE** | Veterinary RAG Engine — Phase 6C retrieval plane |
| **KnowledgeContextPack** | Standard retrieval output for LLM features |
| **Hybrid fusion** | Combining lexical + semantic + structured scores |
| **Confidence routing** | Task-aware proceed/block/degrade before LLM |
| **Fail-closed retrieval** | Block LLM when grounding insufficient |
| **Context window strategy** | Token budget allocation across facts, excerpts, citations |
| **Evidence injection** | Explicit evidence levels in LLM context |
| **Confidence injection** | Explicit confidence scores in LLM context |
| **Chunk-first retrieval** | Rank `VkKnowledgeChunk` segments, not whole entries |
| **Embedding route** | AiRouterEngine path for embedding modality |

---

**Document owner:** Principal Veterinary Retrieval Architect  
**Next review:** Upon 6C.0 schema sign-off or AI Doctor feature binding kickoff  
**Related:** `docs/plans/phase-6c-rag-architecture.md` (implementation baseline), `docs/plans/phase-6b3-chunking-citation-engine.md` (upstream chunk contract)
