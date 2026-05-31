# Phase 6C — RAG Architecture

**Project:** Prani Doctor  
**Role:** Principal AI Retrieval Architect  
**Date:** 2026-05-31  
**Status:** Phase 6C.0–6C.6 implemented — 2026-05-31  
**Version:** 1.1.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL model, `KnowledgeContextPack`, retrieval profiles, evidence gates)
- `docs/plans/phase-6b-knowledge-ingestion-architecture.md` (chunk store, citations, publish pipeline — 6B.0–6B.7 implemented)
- `docs/reports/phase-6b-knowledge-verification.md` (ingestion QA baseline)
- `docs/plans/ai-phase-4-router-engine.md` (provider routing, failover, cost gates)
- `docs/plans/ai-phase-3-model-registry.md` (model capabilities, embedding modality)
- `docs/plans/ai-core-platform-phase-1-foundation.md`
- `docs/ai/AI_ECOSYSTEM_MASTER_PLAN.md`

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | RAG engine, embedding pipeline, hybrid search, context builder, router pre-hook |
| `pranidoctor-web` | Retrieval Control Center — profile editor, embedding health, eval dashboards |
| `pranidoctor_user` | Consumer — grounded AI Doctor, Feed Advisor, chat (via backend only) |

**Phase numbering alignment:**

| Phase | Scope |
|-------|--------|
| **6A** | Veterinary Knowledge Layer — entity model, evidence, retrieval contract |
| **6B** | Knowledge Ingestion — sources, import, chunk staging, editorial/vet/publish |
| **6C** | **This document** — embedding index, hybrid retrieval, context packs, grounding controls |
| **6D** | Feature binding — AI Doctor, Prescription Assistant, Feed Advisor deep integration (future) |

**Phase 6D plan:** `docs/plans/phase-6d-veterinary-ai-assistant.md`

**Naming disambiguation:**

| Term | Meaning |
|------|---------|
| **VKL** | Veterinary Knowledge Layer — curated knowledge corpus |
| **KIS** | Knowledge Ingestion System (Phase 6B) — populates VKL |
| **RAG Engine** | Phase 6C retrieval plane — search, rank, pack, inject |
| **KnowledgeContextPack** | Standard retrieval output for LLM grounding |
| **AIMS** | AI Management System — providers, models, routes (Phases 1–5) |

---

## Executive summary

Prani Doctor today injects knowledge into LLM calls via **`AiKnowledgeService.retrieveForRag()`** — a keyword search over published `AiKnowledgeEntry` rows that concatenates top excerpts with inline citation tokens. Phase 6B delivers **published chunks** (`AiKnowledgeChunk`, stage `PUBLISHED`), **evidence/confidence scores**, **source attributions**, and **BN-first bilingual** segment boundaries — but **no vector index**, **no hybrid fusion**, **no structured context pack**, and **no confidence-based routing**.

**Phase 6C** defines the **Retrieval-Augmented Generation (RAG) Engine** — a provider-agnostic, task-aware retrieval plane that:

1. **Embeds** published knowledge chunks on publish events using registry-routed embedding models.
2. **Retrieves** via **hybrid search** — lexical (PostgreSQL) + semantic (vector) + structured filters.
3. **Ranks** candidates with domain-aware, locale-aware, evidence-weighted fusion.
4. **Builds** a typed **`KnowledgeContextPack`** for every AI task invocation.
5. **Injects** citations and structured facts into LLM context with token budgets.
6. **Prevents hallucination** through grounding contracts, fail-closed gates, and citation discipline.
7. **Routes by confidence** — block, downgrade, or escalate based on task risk tier.

The RAG Engine is **orthogonal to chat provider selection**. Embedding and completion may use different providers (OpenAI embeddings + Gemini chat) coordinated by **`AiRouterEngine`** without hardcoded model IDs.

This document defines the RAG architecture; **Phase 6C.0–6C.6 core retrieval is implemented** in `src/modules/ai/knowledge-retrieval/`.

---

## Implementation progress

| Sub-phase | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **6C.0** | Embedding schema + pipeline + router `executeEmbedding` | **Done** | `AiKnowledgeEmbeddingChunk`, publish hook |
| **6C.1** | Keyword chunk search | **Done** | `KeywordSearchService` |
| **6C.2** | Semantic search + hybrid fusion | **Done** | In-memory cosine on stored vectors |
| **6C.3** | Context builder + `KnowledgeContextPack` | **Done** | `KnowledgeRetrievalService.retrieve` |
| **6C.4** | Confidence routing + fail-closed medical | **Done** | Blocks low-confidence MEDICINE/EMERGENCY |
| **6C.5** | Citation + grounding injection | **Done** | `citation-builder.ts`, grounding instruction |
| **6C.6** | `AiAssistantService` + `retrieveForRag` integration | **Done** | Fail-closed chat path |
| **6C.7** | Admin eval UI + embedding health dashboard | **Pending** | web BFF |
| **6C.8** | BullMQ embed workers + optional re-ranker | **Pending** | async queue |
| **6D.0** | Prescription / Feed Advisor feature binding | **Pending** | future |

### Delivered artifacts

**Migration:** `20260612120000_ai_phase6c_rag_embeddings`

**Module:** `src/modules/ai/knowledge-retrieval/`

```
knowledge-retrieval/
├── embedding/embedding-pipeline.service.ts
├── embedding/embedding-router.adapter.ts
├── search/keyword-search.service.ts
├── search/semantic-search.service.ts
├── search/hybrid-fusion.service.ts
├── routing/confidence-router.service.ts
├── packs/citation-builder.ts
├── profiles/retrieval-profile.registry.ts
└── knowledge-retrieval.service.ts
```

**Router:** `AiRouterEngine.executeEmbedding()` — registry-routed embed with provider fallback chain

**Integration:**

- `KnowledgePublishWorkflowService.publish()` → schedules embedding on publish
- `AiKnowledgeService.retrieveForRag()` → `KnowledgeRetrievalService` + `KnowledgeContextPack`
- `AiAssistantService.chat()` → full pack, fail-closed on `BLOCK`, grounding instruction injection

**Verification:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — 285 tests passed  
**QA report:** `docs/reports/phase-6c-rag-verification.md` — PASS WITH CONDITIONS (2026-05-31)

---

## Strategic intent

| Today (post–6B baseline) | After Phase 6C (target) |
|--------------------------|-------------------------|
| Keyword `ILIKE` / `searchText` only | **Hybrid** lexical + semantic + structured |
| Flat string concatenation for RAG | **`KnowledgeContextPack`** with entities, facts, citations |
| No embedding index | **Chunk-level vectors** keyed by `{entryId}:{chunkIndex}` |
| Same retrieval for all tasks | **Retrieval profiles** per `taskType` with gates |
| No confidence enforcement at retrieval | **Confidence routing** — fail-closed for prescription |
| Citations optional in prompt | **Mandatory citation injection** with inline tokens |
| Provider-agnostic in theory | **Explicit multi-provider embedding strategy** (GPT, Gemini, Claude/Voyage, OpenRouter) |
| Retrieval invisible in usage logs | **`retrievalMetadataJson`** on every `AiUsageLog` |

---

## Design principles

| Principle | Phase 6C interpretation |
|-----------|-------------------------|
| **Retrieve before route** | RAG executes **before** `AiRouterEngine.executeCompletion()`; retrieval never selects chat model |
| **Registry-first embeddings** | Embedding model resolved from `AiModel` registry + dedicated `EMBEDDING` route — not env defaults |
| **Chunk is the unit of retrieval** | Retrieve `AiKnowledgeChunk` (PUBLISHED), not whole entries — better precision, smaller context |
| **Provenance always** | Every retrieved segment carries `sourceId`, inline citation token, evidence level |
| **Bangla-first locale** | Embed and search BN primary; EN parallel index; locale boost at rank time |
| **Clinical safety** | HIGH/CRITICAL content gated by confidence + vet approval metadata |
| **Fail-closed where lives matter** | `PRESCRIPTION_ANALYSIS`, dosage-bearing retrieval — block LLM if pack insufficient |
| **Fail-open with disclaimer where appropriate** | `GENERAL_CHAT` may proceed with empty pack + boosted disclaimer |
| **Provider interchangeability** | Normalized embedding dimensions via adapter layer; store `embeddingModelId` per vector |
| **Observability by default** | Log profile, scores, excluded count, token estimate, latency breakdown |
| **Immutable published vectors** | Re-embed only on chunk content change or model migration — never mutate in place |
| **Separation of concerns** | Ingestion (6B) writes chunks; RAG (6C) reads published chunks + index only |

---

## Current state (as-built baseline)

### Existing artifacts

| Artifact | Location | Maturity |
|----------|----------|----------|
| `AiKnowledgeEntry` | `prisma/schema.prisma` | Production — evidence, confidence, clinical risk |
| `AiKnowledgeChunk` | Schema + 6B ingestion | STAGING → PUBLISHED promotion on publish |
| `citationJson` on chunks | 6B citation service | Inline `[sourceKey\|pageRef]` tokens |
| `AiKnowledgeService.retrieveForRag()` | `knowledge/ai-knowledge.service.ts` | Keyword search + published chunk excerpts |
| `AiAssistantService.chat()` | `assistant/` | Pre-router string injection |
| `computeConfidenceScore` / `meetsRetrievalGate` | 6B scoring engines | Used at ingest; **not** enforced at retrieval |
| `AiRouterEngine` | `router/` | Chat/vision routing; embedding capability exists on providers |
| Provider embedding configs | `provider-config.ts` | OpenAI, Gemini, Anthropic/Voyage, OpenRouter defaults |
| `embeddingStatus` on entries | Schema enum `PENDING` on publish | No worker consumes yet |

### Gaps Phase 6C must address

| ID | Gap | Risk |
|----|-----|------|
| G1 | No vector store / embedding table | Zero semantic recall for colloquial BN |
| G2 | No hybrid fusion | Poor ranking vs modern RAG baselines |
| G3 | Entry-level not chunk-level ranking | Context bloat, imprecise citations |
| G4 | No `KnowledgeContextPack` type | Unstructured prompts, citation drift |
| G5 | No confidence routing at retrieval | High-risk tasks may ground on weak facts |
| G6 | No embedding route in router | Ad-hoc provider selection |
| G7 | No re-ranker / cross-encoder option | Suboptimal precision@k |
| G8 | No retrieval observability | Cannot tune or audit grounding |
| G9 | No hallucination contract in prompts | LLM may invent dosages |
| G10 | `retrieveForRag` ignores taskType profiles | One-size-fits-all retrieval |

---

## Target architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         PHASE 6C — RAG ENGINE                                        │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  Feature Service (chat, triage, prescription, feed, emergency, …)                   │
│         │                                                                            │
│         ▼                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────────────┐   │
│  │ KnowledgeRetrievalService.retrieve(context)                                   │   │
│  │   1. Resolve retrieval profile (taskType + feature + audience)                │   │
│  │   2. Confidence routing pre-check (fail-closed?)                              │   │
│  │   3. Parallel retrieval planes ─────────────────────────────────────────┐    │   │
│  │   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐   │    │   │
│  │   │  │ Keyword     │  │ Semantic    │  │ Structured / Graph      │   │    │   │
│  │   │  │ Search      │  │ Search      │  │ Expansion               │   │    │   │
│  │   │  │ (lexical)   │  │ (vector)    │  │ (filters, 1-hop links)  │   │    │   │
│  │   │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘   │    │   │
│  │   └─────────┼────────────────┼─────────────────────┼─────────────────┘    │   │
│  │             └────────────────┴─────────────────────┘                          │   │
│  │                              ▼                                               │   │
│  │                    Hybrid Fusion + Ranking                                   │   │
│  │                              ▼                                               │   │
│  │                    Confidence + Evidence Gates                               │   │
│  │                              ▼                                               │   │
│  │                    Context Builder → KnowledgeContextPack                    │   │
│  │                              ▼                                               │   │
│  │                    Citation Injection + Hallucination Contract                 │   │
│  └──────────────────────────────────────────────────────────────────────────────┘   │
│         │                                                                            │
│         ├──► AiUsageLog.retrievalMetadataJson                                       │
│         │                                                                            │
│         ▼                                                                            │
│  AiFoundationService.executePromptTask() → AiRouterEngine → LLM (GPT/Gemini/…)     │
│                                                                                      │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │
│                                                                                      │
│  ASYNC: Publish Event → Embedding Worker → Vector Index (via AiRouterEngine EMBED) │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
         ▲
         │ reads PUBLISHED chunks + entry metadata
         │
┌────────┴────────┐
│  VKL (6A/6B)    │  AiKnowledgeEntry, AiKnowledgeChunk, sources, evidence
└─────────────────┘
```

### Backend module map (planned)

```
src/modules/ai/
├── knowledge/                         # EXTEND — legacy facade
├── knowledge-ingestion/               # 6B — write path (unchanged)
├── knowledge-retrieval/               # NEW — Phase 6C
│   ├── embedding/
│   │   ├── embedding-pipeline.service.ts    # publish → embed queue
│   │   ├── embedding-router.adapter.ts      # AiRouterEngine EMBEDDING hops
│   │   └── embedding-normalizer.ts          # dimension / model alignment
│   ├── search/
│   │   ├── keyword-search.service.ts        # PostgreSQL tsvector + trigram
│   │   ├── semantic-search.service.ts         # vector ANN
│   │   ├── hybrid-fusion.service.ts           # score fusion
│   │   └── structured-filter.service.ts       # domain, species, gates
│   ├── ranking/
│   │   ├── ranker.service.ts                  # feature-weighted final rank
│   │   └── reranker.adapter.ts                # optional cross-encoder (cost-gated)
│   ├── packs/
│   │   ├── context-builder.service.ts         # KnowledgeContextPack assembly
│   │   ├── citation-injector.ts               # inline + block citations
│   │   └── token-budget.engine.ts             # truncate / prioritize
│   ├── routing/
│   │   └── confidence-router.service.ts       # fail-closed / downgrade / escalate
│   ├── profiles/
│   │   └── retrieval-profile.registry.ts      # taskType → config
│   └── knowledge-retrieval.service.ts         # public API
└── (existing router, orchestrator, governance)
```

---

## Embedding strategy

### Purpose

Convert published **`AiKnowledgeChunk`** text into dense vectors for semantic recall, while preserving **model provenance** and supporting **provider migration** without re-indexing entire corpus overnight.

### Chunk embedding unit

| Field | Source | Notes |
|-------|--------|-------|
| **Text to embed** | `localePrimary: contentBn` + separator + `contentEn` | BN-first concatenation for cross-lingual recall |
| **Metadata stored alongside vector** | `knowledgeEntryId`, `chunkIndex`, `chunkPolicyId`, `contentType`, `species[]`, `evidenceLevel`, `confidenceScore`, `clinicalRiskTier`, `sourceKey`, `publishedAt` | Filter at query time |
| **Stable key** | `{knowledgeEntryId}:{chunkIndex}:v{entry.version}` | Version bump invalidates old vectors |
| **Stage gate** | Only `AiKnowledgeChunkStage.PUBLISHED` | STAGING never indexed |

### Embedding text template

```
[domain={contentType}] [species={species}] [risk={clinicalRiskTier}]
{headingPath optional}
---
{contentBn}
---
{contentEn}
```

Heading path improves section-aware retrieval for `MEDICINE_BY_SECTION`, `DISEASE_BY_HEADING` policies.

### Trigger events

| Event | Action |
|-------|--------|
| Entry `status → PUBLISHED` | Queue `ai:knowledge:embed` job for all PUBLISHED chunks |
| Entry `status → DEPRECATED` / unpublished | Tombstone vectors (`active=false`) |
| Chunk content change on re-publish | Delete old vectors for `{entryId, chunkIndex, oldVersion}`; embed new |
| `chunkPolicyId` change | Full re-chunk + full re-embed for entry |
| Embedding model migration (admin) | Background re-embed sweep with dual-read window |

### Embedding route (via AiRouterEngine)

Embedding is a **separate modality** from chat — not mixed into `GENERAL_CHAT` route chains.

```
AiRouterEngine.executeEmbedding(input)
  → resolve AIRoute where taskType = EMBEDDING (or modality = embedding)
  → provider chain (platform default):
       1. OpenAI   (text-embedding-3-small)
       2. Gemini   (text-embedding-004)
       3. OpenRouter (openai/text-embedding-3-small)
       4. Anthropic/Voyage (voyage-3-lite) — via adapter when Claude path preferred
  → batch input (max 64 chunks per request — configurable)
  → normalize output dimensions → store with modelId provenance
```

**Design rule:** Chat completion provider (GPT/Gemini/Claude/OpenRouter) and embedding provider **may differ** within the same request lifecycle.

### Provider compatibility matrix

| Provider | Embedding API | Default model (bootstrap) | Dimensions | BN quality | Notes |
|----------|---------------|---------------------------|------------|------------|-------|
| **OpenAI (GPT)** | `/v1/embeddings` | `text-embedding-3-small` | 1536 (configurable) | Good | Platform default; cost-efficient |
| **Gemini** | `embedContent` | `text-embedding-004` | 768 | Good BN | Strong multilingual; prefer for BN-heavy corpus |
| **Claude (Anthropic)** | Via **Voyage** adapter | `voyage-3-lite` | 512 | Good | Anthropic chat uses Claude; embeddings via Voyage partner API |
| **OpenRouter** | OpenAI-compatible proxy | `openai/text-embedding-3-small` | 1536 | Good | Unified billing; fallback when direct keys restricted |

### Dimension normalization strategy

When failover switches embedding models with different dimensions:

| Strategy | When |
|----------|------|
| **Model-scoped indexes** | Preferred — separate ANN index per `embeddingModelId` |
| **Projection layer** | Optional — learned linear map only during migration windows |
| **Re-embed sweep** | Required before decommissioning old model index |

**Never** mix vectors from different models in the same ANN index without normalization.

### Storage architecture (conceptual)

```
AiKnowledgeEmbeddingChunk
├── id
├── knowledgeEntryId
├── chunkIndex
├── entryVersion              // matches AiKnowledgeEntry.version at embed time
├── embeddingModelId          // AiModel registry FK
├── providerKey               // openai | gemini | openrouter | anthropic
├── dimensions
├── vector                    // pgvector column OR external store ref (Qdrant/Pinecone)
├── embeddingTextHash         // sha256 of normalized embed input — skip if unchanged
├── active                    // false = tombstone
├── embeddedAt
└── metadataJson              // species, evidenceLevel, confidence, sourceKey, …
```

**Phase 6C recommendation:** Start with **pgvector** on PostgreSQL (operational simplicity, transactional consistency with VKL). External vector DB deferred unless corpus exceeds ~2M chunks or QPS requires isolation.

### Batch & cost controls

| Control | Value |
|---------|-------|
| Max chunks per embed job | 128 |
| Embed retry | 3 with exponential backoff via router retry engine |
| Cost gate | `AIRoute.maxCostUsd` for EMBEDDING route |
| Deduplication | Skip embed if `embeddingTextHash` unchanged |
| Rate limit | Router 429 coordinator — failover to next embedding provider |

### Embedding status lifecycle (entry-level)

| `embeddingStatus` | Meaning |
|-------------------|---------|
| `NOT_APPLICABLE` | Draft / never published |
| `PENDING` | Published; embed job queued or running |
| `INDEXED` | All PUBLISHED chunks have active vectors |
| `PARTIAL` | Some chunks failed — retrieval uses lexical fallback for missing |
| `FAILED` | All embed attempts failed — lexical-only profile flag set |

---

## Retrieval strategy

### Retrieval is profile-driven

Every call specifies:

```typescript
type RetrievalRequest = {
  query: string;
  locale: 'bn' | 'en';
  taskType: AiDbTaskType;
  feature?: string;              // e.g. 'ai_doctor', 'prescription_assistant'
  audience?: 'FARMER' | 'DOCTOR' | 'BOTH';
  species?: LivestockSpecies;
  regionScope?: string;          // default 'BD'
  asOfDate?: Date;               // regulatory temporal filter
  userId?: string;
  customerId?: string;
  sessionContext?: {             // optional structured hints
    symptomCodes?: string[];
    drugSlugs?: string[];
    emergencyFlag?: boolean;
  };
  overrides?: Partial<RetrievalProfile>;  // admin/debug only
};
```

### Execution pipeline

```
1. Resolve profile     → retrievalProfileId from taskType + feature + audience
2. Normalize query     → script detect, colloquial BN map, species hint extraction
3. Confidence router   → pre-check fail-closed; may return empty pack + block flag
4. Parallel search     → keyword ∥ semantic ∥ structured (when graph enabled)
5. Candidate pool      → union dedupe by {entryId, chunkIndex}, max 50 pre-rank
6. Hybrid fusion       → weighted score merge
7. Rank                → domain priority, locale, evidence, confidence boosts
8. Gate filter         → drop below minConfidence / minEvidence
9. Optional re-rank    → cross-encoder top-20 → top-k (profile flag)
10. Graph expand       → 1-hop related chunks (profile flag)
11. Context build      → KnowledgeContextPack
12. Log metadata       → AiUsageLog.retrievalMetadataJson
13. Return pack        → caller injects into prompt
```

### Retrieval modes

| Mode | `semanticEnabled` | Use case |
|------|-------------------|----------|
| **Lexical-only** | false | Embedding index unavailable; debug; zero-cost path |
| **Hybrid** | true (default) | Production — best recall |
| **Semantic-only** | true + `lexicalWeight: 0` | Rare — pure paraphrase match eval |
| **Structured-only** | false + graph | Prescription interaction traversal seed |

### Candidate deduplication

When keyword and semantic both return chunks from the same entry:

- Keep **highest fused score** per `{entryId, chunkIndex}`
- Limit **max chunks per entry** (profile default: 2) to avoid one disease dominating context

### Temporal & regulatory filters

For `PRESCRIPTION_ANALYSIS` and `REGULATORY_BD` content:

- Filter `effectiveFrom ≤ asOfDate ≤ effectiveTo` on structured regulatory facts
- Exclude `status = DEPRECATED` and `embeddingStatus = FAILED` entries unless lexical fallback explicitly allowed

---

## Keyword search (lexical plane)

### Objective

High-precision matching for **exact terms** — drug names, disease names, BN colloquialisms, registration numbers — complementing semantic paraphrase.

### Index design

| Index | Fields | Engine |
|-------|--------|--------|
| Entry `searchText` | Normalized BN+EN concat from 6B normalizer | GIN tsvector |
| Chunk `contentBn` / `contentEn` | Per-chunk tsvector | GIN tsvector |
| Trigram | `colloquialBn[]`, drug trade names | `pg_trgm` |
| Structured | `structuredJson.registrationNo`, `drugClass` | B-tree / JSON path |

### Query processing

```
User query
    → detect script (BN / EN / mixed)
    → expand colloquial BN via VkColloquialMap (Phase 6A)
    → extract quoted phrases for exact boost
    → build tsquery with locale-weighted OR
    → optional species filter from session context
```

### Lexical scoring (BM25-like via PostgreSQL)

```
lexicalScore = ts_rank_cd(chunk_tsvector, query, normalization=32)
             × entryConfidenceBoost
             × evidenceBoost
             × localeMatchBoost
```

| Boost | Factor |
|-------|--------|
| `entryConfidenceBoost` | `0.5 + 0.5 * confidenceScore` |
| `evidenceBoost` | L1=0.8 … L5=1.0 |
| `localeMatchBoost` | 1.15 if query script matches chunk primary locale |

### Keyword search outputs

```typescript
type LexicalHit = {
  knowledgeEntryId: string;
  chunkIndex: number;
  lexicalScore: number;       // normalized 0–1
  matchHighlights: string[];  // for admin/debug
};
```

**Default top-K:** 30 chunk candidates before fusion.

---

## Semantic search (vector plane)

### Objective

Recall relevant chunks when farmers use **informal BN phrasing** or when query wording differs from canonical veterinary terminology.

### Query embedding

1. Normalize query (same colloquial expansion as lexical)
2. Call `AiRouterEngine.executeEmbedding` with **query embedding route** (same EMBEDDING chain as corpus)
3. ANN search against active vectors filtered by:
   - `species` overlap (if provided)
   - `contentType` in profile `domainPriority`
   - `confidenceScore ≥ profile.minConfidence`
   - `evidenceLevel ≥ profile.minEvidenceLevel`
   - `clinicalRiskTier` vet-approved when HIGH/CRITICAL

### ANN parameters

| Parameter | Default |
|-----------|---------|
| `topK` | 40 |
| Distance metric | Cosine |
| `ef_search` (HNSW) | 64 |
| Minimum similarity threshold | 0.72 (profile-tunable) |

### Semantic scoring

```
semanticScore = 1 - cosineDistance(queryVector, chunkVector)
              × freshnessDecay(lastReviewedAt)
```

Chunks below similarity threshold excluded before fusion.

### Multilingual behavior

- Query embedded as-is (BN or EN)
- Chunk embed text includes **both** BN and EN — single vector represents bilingual segment
- At rank time, **locale boost** favors chunks where matched locale content is richer

---

## Hybrid search

### Fusion algorithm

Phase 6C uses **weighted linear fusion** with **RRF fallback** when score scales diverge.

**Primary (weighted linear):**

```
fusedScore = wLex × normalize(lexicalScore)
           + wSem × normalize(semanticScore)
           + wStruct × structScore
           + wGraph × graphProximityScore
```

**Default weights (hybrid profile):**

| Component | Weight |
|-----------|--------|
| Lexical | 0.40 |
| Semantic | 0.45 |
| Structured (exact field match) | 0.10 |
| Graph proximity | 0.05 |

**RRF fallback** (when lexical or semantic unavailable):

```
RRFscore(d) = Σ 1 / (k + rank_i(d))   where k=60
```

### Structured match plane

Activates for profiles with `structuredMatchEnabled: true`:

| taskType | Structured signals |
|----------|-------------------|
| `PRESCRIPTION_ANALYSIS` | Drug slug, active ingredient, registration number |
| `FEED_FORMULATION` | Species + production stage → nutrient requirement entities |
| `DISEASE_ANALYSIS` | Symptom codes → disease links via graph |
| `EMERGENCY_CONSULTATION` | Red-flag keyword list → emergency entities |

`structScore = 1.0` on exact structured key hit; decays with partial match.

### Hybrid profile flags

```json
{
  "semanticEnabled": true,
  "lexicalWeight": 0.40,
  "semanticWeight": 0.45,
  "structuredWeight": 0.10,
  "graphWeight": 0.05,
  "fusionMethod": "weighted_linear",
  "rrfFallback": true,
  "minSemanticSimilarity": 0.72,
  "maxCandidates": 50
}
```

---

## Ranking strategy

Ranking operates **after fusion** on the unified candidate pool.

### Rank features

| Feature | Weight direction | Description |
|---------|------------------|-------------|
| `fusedScore` | ↑ | Hybrid retrieval score |
| `domainPriority` | ↑ | Profile-ordered content types |
| `confidenceScore` | ↑ | Entry-level composite |
| `evidenceLevel` | ↑ | L1–L5 ordinal |
| `clinicalRiskTier` | ↓ for farmer chat | Deprioritize CRITICAL in GENERAL_CHAT unless emergency |
| `localeAlignment` | ↑ | BN query → BN-rich chunk |
| `speciesMatch` | ↑ | Exact species in query context |
| `recency` | ↑ | `lastReviewedAt` decay |
| `chunkSpecificity` | ↑ | Shorter heading-aligned chunks for precise questions |
| `vetApproved` | ↑ required gate | Must pass for MEDICINE dosage chunks |

### Domain priority boost

```
domainBoost = (N - priorityIndex) / N   // first domain in profile list gets highest
finalRankScore = fusedScore * (1 + 0.2 * domainBoost) * localeBoost * speciesBoost
```

### Optional re-ranker (cost-gated)

When `profile.rerankerEnabled: true` and budget allows:

1. Take top 20 by `finalRankScore`
2. Cross-encoder or LLM-lite scoring via **cheap chat route** (e.g. Gemini Flash)
3. Re-order → select top `maxChunks` (default 8)

Re-ranker is **optional** — disabled by default for farmer chat; enabled for `prescription-v1`.

### Output limits

| Profile | maxChunks | maxEntities | tokenBudget |
|---------|-----------|-------------|-------------|
| `farmer-chat-v1` | 6 | 4 | 1200 |
| `ai-doctor-v1` | 10 | 8 | 1800 |
| `prescription-v1` | 8 | 6 | 2000 |
| `feed-advisor-v1` | 8 | 6 | 1600 |
| `emergency-v1` | 6 | 5 | 1500 |

---

## Context builder

The **Context Builder** transforms ranked chunks + entry metadata into a **`KnowledgeContextPack`** suitable for LLM injection.

### Responsibilities

1. **Group** chunks by parent entry
2. **Extract** `structuredFacts[]` from entry `structuredJson` / domain payloads
3. **Render** locale-aware excerpts (BN primary for farmers)
4. **Build** `citationBlock` within token budget
5. **Attach** graph hints for follow-up turns
6. **Compute** `confidenceSummary` and `excludedCount`
7. **Apply** hallucination prevention envelope (see below)

### Token budget algorithm

```
budget = profile.tokenBudget
allocate:
  30% → structuredFacts (JSON-compact, locale-independent numerics)
  50% → entity excerpts (highest rank first)
  20% → citationBlock + graphHints
truncate lowest-rank entities first; never drop structuredFacts for prescription profile
```

### Excerpt rendering

Each retrieved chunk becomes:

```
{inlineCitation} {title} ({evidenceLabel}):
{excerpt — max 280 chars locale-primary}
```

Inline citation from `chunk.citationJson.inline` — e.g. `[dls-manual|p.12]`.

### Structured facts extraction

For medicine entries, context builder **must** surface machine-readable facts separately from prose:

```typescript
type StructuredFact = {
  factId: string;
  domain: string;
  factType: string;           // 'DOSE_MG_KG' | 'WITHDRAWAL_DAYS' | 'CONTRAINDICATION' | …
  species?: LivestockSpecies;
  value: number | string | boolean;
  unit?: string;
  evidenceLevel: string;
  confidenceScore: number;
  sourceCitation: string;
};
```

LLM prompts reference structured facts with **"use only listed facts for dosages"** instruction.

### Legacy compatibility

`AiKnowledgeService.retrieveForRag()` becomes:

```typescript
const pack = await getKnowledgeRetrievalService().retrieve({
  query, locale, taskType: 'GENERAL_CHAT', feature: 'farmer_chat',
});
return pack.citationBlock;  // string compat for existing callers
```

New callers use full `KnowledgeContextPack`.

---

## KnowledgeContextPack

Canonical contract (extends Phase 6A; chunk-aware for 6C):

```typescript
type KnowledgeContextPack = {
  packId: string;                      // cuid
  taskType: AiDbTaskType;
  locale: 'bn' | 'en';
  query: string;
  normalizedQuery: string;
  retrievedAt: string;                   // ISO8601
  retrievalProfileId: string;
  retrievalMode: 'lexical' | 'hybrid' | 'semantic';

  // Ranked content
  chunks: RetrievedChunk[];            // NEW — primary retrieval unit in 6C
  entities: RetrievedEntity[];         // aggregated entry-level view
  structuredFacts: StructuredFact[];

  // LLM-ready strings
  citationBlock: string;                 // compressed grounding block
  groundingInstruction: string;          // hallucination prevention text
  graphHints: GraphHint[];

  // Quality metadata
  filtersApplied: RetrievalFilters;
  confidenceSummary: { min: number; max: number; avg: number };
  excludedCount: number;                 // below threshold
  embeddingCoverage: number;             // 0–1 fraction of hits with vectors

  // Routing decision
  routingDecision: ConfidenceRoutingDecision;

  // Observability
  scores: {
    lexicalMs: number;
    semanticMs: number;
    rankMs: number;
    totalMs: number;
  };
};

type RetrievedChunk = {
  knowledgeEntryId: string;
  chunkIndex: number;
  entryVersion: number;
  contentType: string;
  slug: string;
  title: string;
  excerpt: string;                       // locale-primary
  excerptEn?: string;                    // parallel for doctors
  headingPath?: string;
  evidenceLevel: string;
  confidenceScore: number;
  clinicalRiskTier: string;
  rank: number;
  fusedScore: number;
  lexicalScore?: number;
  semanticScore?: number;
  inlineCitation: string;                // [sourceKey|locator]
  sources: SourceCitation[];
};

type RetrievedEntity = {
  entityId: string;
  slug: string;
  contentType: string;
  title: string;
  evidenceLevel: string;
  confidenceScore: number;
  rank: number;
  chunkCount: number;                    // chunks included from this entry
  sources: SourceCitation[];
};

type RetrievalFilters = {
  species?: LivestockSpecies;
  domainPriority: string[];
  minConfidence: number;
  minEvidenceLevel: string;
  regionScope: string;
  status: 'PUBLISHED';
  vetApprovedOnly?: boolean;
};

type GraphHint = {
  edgeType: string;
  fromSlug: string;
  toSlug: string;
  label: string;
};

type ConfidenceRoutingDecision = {
  action: 'PROCEED' | 'PROCEED_DEGRADED' | 'BLOCK' | 'ESCALATE_HUMAN';
  reason: string;
  failClosed: boolean;
  disclaimerLevel: 'standard' | 'elevated' | 'blocking';
};
```

---

## Citation injection

### Objectives

1. Every grounded statement in LLM output **must be traceable** to a VKL source
2. Farmers see **human-readable BN citations**; logs retain machine IDs
3. Inline tokens enable **post-hoc citation parsing** in UI

### Citation layers

| Layer | Consumer | Format |
|-------|----------|--------|
| **Inline** | LLM context + response parsing | `[sourceKey]` or `[sourceKey\|p.12]` |
| **Human block** | Prompt + mobile "Sources" UI | BN/EN template from source license |
| **Structured** | Audit / compliance | `sourceAttributions[]` with `documentId`, `spanRefs` |

### Injection points

```
┌─────────────────────────────────────────────────────────────┐
│ System prompt slot                                           │
│   groundingInstruction + citationBlock                       │
├─────────────────────────────────────────────────────────────┤
│ User message enrichment (legacy compat)                      │
│   Reference:\n{citationBlock}\n\n{userMessage}              │
├─────────────────────────────────────────────────────────────┤
│ Response post-processing (future 6D)                         │
│   Parse inline tokens → link to source detail API           │
└─────────────────────────────────────────────────────────────┘
```

### Citation block format

**Bangla (farmer):**

```
তথ্যসূত্র (শুধুমাত্র নিচের তথ্য ব্যবহার করুন):
[1] [dls-manual] গবাদি পশুর নিউমোনিয়া — ডিএলএস (২০২৪)
    "[dls-manual] নিউমোনিয়া: জ্বর, কাশি..."
[2] [bvc-protocol] চিকিৎসা প্রোটোকল — BVC
    ...
```

**English (doctor):**

```
Sources (use ONLY the following):
[1] [dls-manual] Bovine Pneumonia — DLS (2024)
    ...
```

### Citation injection rules

| Rule | Enforcement |
|------|-------------|
| Every chunk in pack **must** have `inlineCitation` | Context builder validates; drop chunk if missing |
| Dosage facts **must** include `sourceCitation` in structuredFacts | Prescription profile |
| LLM instructed to cite inline token after each clinical claim | `groundingInstruction` |
| No citation → no claim | Prompt contract |

### Provider-neutral injection

Citation injection happens **entirely in backend** before provider adapter invocation. GPT, Gemini, Claude, and OpenRouter all receive the same enriched messages — no provider-specific RAG APIs (no OpenAI Assistants file search, no Gemini grounding API in 6C — optional future optimization).

---

## Hallucination prevention

### Defense layers

```
Layer 1: Retrieval gates        → don't retrieve low-confidence clinical facts
Layer 2: Confidence routing     → block LLM call if pack insufficient (prescription)
Layer 3: Grounding instruction  → explicit "no external knowledge" contract
Layer 4: Structured facts       → dosages as JSON, not prose-only
Layer 5: Prompt templates       → AiPrompt versions with grounding clauses
Layer 6: Output validation      → (6D) parse dosage mentions vs structuredFacts
Layer 7: Disclaimer resolver    → elevated disclaimer when routingDecision degraded
```

### Grounding instruction (template)

```
You are a veterinary assistant for Bangladesh livestock farmers.

CRITICAL GROUNDING RULES:
1. Use ONLY the Reference section below for clinical, dosage, and treatment facts.
2. If the Reference does not contain enough information, say you cannot advise and recommend consulting a licensed veterinarian.
3. Do NOT invent drug names, doses, withdrawal periods, or diagnoses.
4. When stating a fact from Reference, include its inline citation token exactly as shown (e.g. [dls-manual]).
5. For emergencies, prioritize safety and immediate vet referral.
6. Structured facts (JSON) override prose if they conflict.

Reference:
{citationBlock}
```

### Task-specific strictness

| taskType | Hallucination posture |
|----------|----------------------|
| `GENERAL_CHAT` | Ground when available; allow general animal husbandry phrasing without clinical claims |
| `DISEASE_ANALYSIS` | Strict for diagnosis/differential; soft for general care |
| `PRESCRIPTION_ANALYSIS` | **Strictest** — fail-closed without structured dose facts |
| `FEED_FORMULATION` | Strict for nutrient numbers; soft for general feeding tips |
| `EMERGENCY_CONSULTATION` | Strict for action steps; always include referral language |

### Conflict handling

When retrieved chunks disagree:

1. Prefer **higher evidence level**
2. Then **higher confidence score**
3. Then **newer `lastReviewedAt`**
4. If unresolvable for prescription → `routingDecision: BLOCK`

---

## Confidence routing

Confidence routing decides **whether and how** to proceed to LLM invocation based on pack quality and task risk.

### Input signals

```typescript
type RoutingInput = {
  taskType: AiDbTaskType;
  profile: RetrievalProfile;
  pack: KnowledgeContextPack;         // may be partial pre-build for early exit
  candidatePoolSize: number;
  topConfidence: number;
  topEvidence: AiKnowledgeEvidenceLevel;
  hasStructuredFacts: boolean;
  embeddingCoverage: number;
};
```

### Routing actions

| Action | Meaning |
|--------|---------|
| `PROCEED` | Normal LLM invocation with pack |
| `PROCEED_DEGRADED` | Invoke with pack + elevated disclaimer; optional lexical-only warning |
| `BLOCK` | Do not invoke LLM; return safe template response |
| `ESCALATE_HUMAN` | Offer vet teleconsult / clinic finder |

### Decision matrix

| taskType | Condition | Action |
|----------|-----------|--------|
| `PRESCRIPTION_ANALYSIS` | `structuredFacts` lacks dose for target drug | **BLOCK** |
| `PRESCRIPTION_ANALYSIS` | `confidenceSummary.avg < 0.75` | **BLOCK** |
| `PRESCRIPTION_ANALYSIS` | `topEvidence < L2` | **BLOCK** |
| `EMERGENCY_CONSULTATION` | zero chunks, emergency keywords detected | **PROCEED_DEGRADED** + referral template |
| `DISEASE_ANALYSIS` | `confidenceSummary.avg < 0.55` | **PROCEED_DEGRADED** |
| `GENERAL_CHAT` | empty pack | **PROCEED_DEGRADED** + strong disclaimer |
| `GENERAL_CHAT` | pack present | **PROCEED** |
| Any | `embeddingCoverage < 0.5` (hybrid profile) | **PROCEED_DEGRADED** + log alert |

### Fail-closed vs fail-open

| Profile flag | Behavior |
|--------------|----------|
| `failClosed: true` | `BLOCK` instead of `PROCEED_DEGRADED` when gates fail |
| `failClosed: false` | Allow degraded proceed with disclaimer |

**Mandatory fail-closed:** `prescription-v1`, future `regulatory-v1`.

### Integration with AiRouterEngine

Confidence routing runs **before** router — if `BLOCK`, router never invoked:

```
retrieve() → confidenceRouter.decide()
  → BLOCK → return { content: safeTemplate, disclaimer, pack }
  → PROCEED* → executePromptTask({ enrichedContext: pack })
```

Router failover is **unaffected** — retrieval routing is independent of provider failover.

---

## Retrieval profiles (6C extensions)

Profiles stored as admin-configurable JSON (`AiKnowledgeRetrievalProfile` table — future).

| profileId | taskType | semantic | failClosed | minConf | minEvidence | rerank |
|-----------|----------|----------|------------|---------|-------------|--------|
| `farmer-chat-v1` | GENERAL_CHAT | yes | no | 0.40 | L1 | no |
| `ai-doctor-v1` | DISEASE_ANALYSIS | yes | no | 0.55 | L2 | optional |
| `prescription-v1` | PRESCRIPTION_ANALYSIS | yes | **yes** | 0.75 | L2 | yes |
| `feed-advisor-v1` | FEED_FORMULATION | yes | no | 0.65 | L2 | no |
| `emergency-v1` | EMERGENCY_CONSULTATION | yes | no | 0.60 | L1 | no |
| `symptom-enrich-v1` | DISEASE_ANALYSIS | yes | no | 0.50 | L2 | no |

### Full profile schema (JSON)

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
  "semanticWeight": 0.50,
  "structuredWeight": 0.15,
  "graphWeight": 0.0,
  "expandGraph": true,
  "graphEdgeTypes": ["INTERACTS_WITH", "CONTRAINDICATES", "GOVERNED_BY"],
  "structuredMatchEnabled": true,
  "rerankerEnabled": true,
  "tokenBudget": 2000,
  "failClosed": true,
  "localePreference": ["en", "bn"],
  "vetApprovedRequired": true,
  "groundingStrictness": "strict"
}
```

---

## Integration with AI platform

### AiRouterEngine

| Concern | Integration |
|---------|-------------|
| Chat completion | Unchanged — receives enriched prompt from feature service |
| Embedding | New `executeEmbedding()` entry — EMBEDDING route chain |
| Cost accounting | Embed tokens logged separately on `AiUsageLog` |
| Failover | Embed failover independent of chat failover |
| Provider keys | Vault secrets via existing `AiSecretService` |

### AiFoundationService

```typescript
executePromptTask({
  taskType,
  userMessage,
  locale,
  retrievalContext?: KnowledgeContextPack,  // NEW optional
})
```

When `retrievalContext` provided, foundation merges `citationBlock` + `groundingInstruction` into prompt assembly.

### AiUsageLog metadata

```typescript
retrievalMetadataJson: {
  packId: string;
  retrievalProfileId: string;
  retrievalMode: string;
  chunkCount: number;
  excludedCount: number;
  confidenceSummary: { min, max, avg };
  routingDecision: string;
  embeddingCoverage: number;
  latencyMs: number;
  topSlugs: string[];
}
```

### Feature service integration map

| Feature | taskType | Profile | failClosed |
|---------|----------|---------|------------|
| `AiAssistantService.chat()` | GENERAL_CHAT | farmer-chat-v1 | no |
| Symptom checker enrich | DISEASE_ANALYSIS | symptom-enrich-v1 | no |
| AI Doctor (future) | DISEASE_ANALYSIS | ai-doctor-v1 | no |
| Prescription assistant (future) | PRESCRIPTION_ANALYSIS | prescription-v1 | **yes** |
| Feed advisor (future) | FEED_FORMULATION | feed-advisor-v1 | no |
| Emergency triage (future) | EMERGENCY_CONSULTATION | emergency-v1 | no |

---

## Async embedding pipeline

```
PublishWorkflow.publish()
    → entry.embeddingStatus = PENDING
    → emit KnowledgePublishedEvent
         → BullMQ job: ai:knowledge:embed
              → load PUBLISHED chunks
              → batch embed via AiRouterEngine
              → upsert AiKnowledgeEmbeddingChunk
              → entry.embeddingStatus = INDEXED | PARTIAL | FAILED
```

| Queue | Concurrency | Retry |
|-------|-------------|-------|
| `ai:knowledge:embed` | 4 workers | 3x exponential |
| `ai:knowledge:reindex` | 1 (admin sweep) | manual |

**Idempotency:** `embeddingTextHash` prevents duplicate embed work.

---

## Admin & observability

### Admin API (conceptual)

| Route | Purpose |
|-------|---------|
| `GET /api/admin/ai-ops/knowledge/retrieval-profiles` | List/edit profiles |
| `POST /api/admin/ai-ops/knowledge/retrieval/eval` | Run eval query → pack preview |
| `GET /api/admin/ai-ops/knowledge/embedding/status` | Index health, PARTIAL/FAILED entries |
| `POST /api/admin/ai-ops/knowledge/embedding/reindex` | Trigger re-embed sweep |
| `GET /api/admin/ai-ops/knowledge/retrieval/analytics` | precision@k, latency, block rate |

### Dashboards

| Metric | Target |
|--------|--------|
| Embedding lag (publish → indexed) | p95 < 5 min |
| Hybrid precision@4 (manual eval) | ≥ 0.85 |
| Prescription block rate (true insufficient) | 100% |
| Prescription false-block rate | < 5% |
| Retrieval p95 latency | < 400 ms (excl. re-ranker) |
| Empty pack rate (GENERAL_CHAT) | < 15% |

---

## Security & governance

| Control | Implementation |
|---------|----------------|
| Published-only retrieval | Hard filter `status = PUBLISHED` |
| Draft leakage | STAGING chunks never indexed or returned |
| PII in queries | Do not log raw query text in production — log hash + length |
| Embedding data residency | Configurable provider region per tenant (future) |
| Kill switch | Governance scope `knowledge.retrieval.{domain}` — returns empty pack |
| Rate limit | Per-user retrieval QPS cap |
| Audit | `packId` on usage log links to retrieved slugs + sources |

---

## Sub-phases (implementation roadmap)

| Sub-phase | Scope | Depends on |
|-----------|-------|------------|
| **6C.0** | pgvector schema + embedding worker + EMBEDDING route | 6B publish pipeline |
| **6C.1** | Keyword chunk search upgrade (tsvector) | 6C.0 |
| **6C.2** | Semantic search + hybrid fusion | 6C.0, 6C.1 |
| **6C.3** | Context builder + KnowledgeContextPack | 6C.2 |
| **6C.4** | Confidence routing + fail-closed prescription | 6C.3 |
| **6C.5** | Citation injection + grounding prompts | 6C.3 |
| **6C.6** | Router/foundation integration + usage log metadata | 6C.3, Phase 4 |
| **6C.7** | Admin eval UI + embedding health dashboard | 6C.6 |
| **6C.8** | Optional re-ranker + graph expansion | 6C.2 |
| **6D.0** | Feature binding (AI Doctor, Prescription, Feed) | 6C.6 |

**No implementation in this document scope.**

---

## Success metrics

| Metric | Baseline (6B) | Target (6C) |
|--------|---------------|-------------|
| Retrieval precision@4 | ~0.55 keyword | ≥ 0.85 hybrid |
| BN colloquial recall | Poor | ≥ 0.75 MRR@10 |
| Prescription fail-closed | 0% (not enforced) | 100% when gates fail |
| Citation coverage in AI responses | Partial | ≥ 90% clinical claims with inline token |
| Embedding index freshness | N/A | p95 lag < 5 min |
| Hallucinated dosage rate (eval set) | Unknown | < 2% with strict profile |

---

## Appendix A — Provider adapter notes

### OpenAI (GPT)

- Use `/v1/embeddings` via existing OpenAI provider adapter
- Model from registry: `text-embedding-3-small` default
- Batch up to 2048 inputs per request (platform limit)

### Gemini

- Use `embedContent` REST via Gemini provider adapter
- `taskType: RETRIEVAL_DOCUMENT` for corpus chunks; `RETRIEVAL_QUERY` for queries
- Strong BN performance — recommended primary for BN-heavy reindex

### Claude (Anthropic)

- Chat via Anthropic Messages API
- Embeddings via **Voyage AI** (`voyage-3-lite`) through anthropic provider adapter extension
- Do not assume Claude chat model produces embeddings

### OpenRouter

- OpenAI-compatible `/embeddings` endpoint
- Model keys namespaced: `openai/text-embedding-3-small`
- Use as **tertiary fallback** when direct OpenAI/Gemini unavailable
- Log `providerKey: openrouter` on vectors for cost attribution

---

## Appendix B — Migration from `retrieveForRag()`

| Step | Action |
|------|--------|
| 1 | Implement `KnowledgeRetrievalService.retrieve()` |
| 2 | Wire `retrieveForRag()` as thin wrapper returning `pack.citationBlock` |
| 3 | Update `AiAssistantService.chat()` to pass `taskType: GENERAL_CHAT` |
| 4 | Add `retrievalMetadataJson` to usage logs |
| 5 | Feature-flag hybrid search per profile |
| 6 | Deprecate raw string RAG assembly |

---

## Appendix C — Glossary

| Term | Definition |
|------|------------|
| **KnowledgeContextPack** | Standard retrieval output consumed by LLM features |
| **Hybrid fusion** | Combining lexical + semantic + structured scores |
| **Confidence routing** | Task-aware proceed/block/degrade decision before LLM |
| **Fail-closed retrieval** | Block LLM when grounding insufficient (prescription) |
| **Inline citation** | Machine token `[sourceKey\|locator]` in context and responses |
| **Embedding route** | AiRouterEngine path for embedding modality |
| **Chunk-first retrieval** | Rank `AiKnowledgeChunk` segments, not whole entries |

---

## Appendix D — Example end-to-end flow (farmer chat)

```
1. Farmer asks (BN): "আমার গরুর গায়ে ফোস্কা হয়েছে, কী করব?"
2. AiAssistantService.chat() → retrieve({ taskType: GENERAL_CHAT, locale: 'bn', query })
3. Profile farmer-chat-v1 → hybrid search
4. Keyword hits: "ফোস্কা" → Lumpy Skin Disease chunk
5. Semantic hits: paraphrase "গায়ে গুটি" → same chunk (score 0.89)
6. Fusion → rank #1
7. Context builder → pack with [dls-manual] inline citation
8. Confidence router → PROCEED (confidence 0.72, above 0.40 gate)
9. Prompt enriched with grounding instruction + citation block
10. AiRouterEngine → Gemini Flash (or GPT-4o-mini fallback)
11. Response cites [dls-manual]; usage log records packId
```

---

**Document owner:** Principal AI Retrieval Architect  
**Next review:** Upon 6C.0 schema sign-off or embedding provider selection workshop
