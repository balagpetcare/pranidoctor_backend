# Phase 6C.13 — Veterinary RAG Optimization Plan

**Project:** Prani Doctor  
**Role:** Principal AI Retrieval Optimization Architect  
**Date:** 2026-05-31  
**Status:** Core implementation complete — 2026-05-31  
**Version:** 1.1.0  

**Depends on:**

- `docs/reports/phase-6c-rag-engine-verification.md` — QA baseline (358 tests, retrieval score 74, production readiness 70)
- `docs/plans/phase-6c-rag-engine-architecture.md` — VRE core architecture (6C.0–6C.12 implemented)
- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` — VKL lexical contract, `colloquialBn[]`, retrieval profiles
- `docs/plans/phase-6b3-chunking-citation-engine.md` — chunk boundaries, citation envelope
- `docs/plans/phase-6d-veterinary-ai-assistant.md` — post-LLM safety contract (SP-01 dosage gate)

**Supersedes scope:** Phase 6C architecture §6C.13 placeholder (“Admin eval UI + pgvector ANN”) — expanded into full optimization program.

---

## Executive summary

Phase 6C delivered a **pilot-grade Veterinary RAG Engine (VRE)** with hybrid keyword + in-memory semantic retrieval, feature-weighted reranking, `KnowledgeContextPack` assembly, medical fail-closed routing, and assistant integration. QA verification (**PASS WITH CONDITIONS**) identified **eight open gaps (G1–G8)** blocking production-scale semantic recall, precision optimization, observability, and hallucination containment.

**Phase 6C.13** is the **optimization and hardening program** that closes those gaps without redesigning the VRE core. It targets:

| Current score (QA) | Post-6C.13 target |
|--------------------|-------------------|
| Retrieval: **74** | **≥ 88** |
| Grounding: **81** | **≥ 90** |
| Medical safety: **88** | **≥ 94** |
| Production readiness: **70** | **≥ 85** |
| Technical debt burden: **62** | **≤ 35** |

**Design principle:** Optimize in layers — **index first** (G1, G8), **recall second** (G3), **precision third** (G4, fusion calibration), **safety fourth** (post-LLM validation, medical calibration), **measurement always** (G2, eval framework, golden set).

**Out of scope for 6C.13:** Graph expansion (G5 → 6D), symptom-checker BLOCK signal (G6 → 6D), full AI Doctor feature binding (6D.0).

---

## Implementation progress (2026-05-31)

| Sprint | Scope | Status | Module / artifact |
|--------|-------|--------|-------------------|
| **6C.13a** | pgvector ANN + indexing | **Done** | Migration `20260617120000_ai_phase6c13_rag_optimization`; `pgvector-ann.service.ts`; `pgvector.util.ts`; dual-write in `embedding-pipeline.service.ts` |
| **6C.13b** | Retrieval metadata logging | **Done** | `retrieval-metadata.builder.ts`; `AiUsageLog.retrievalMetadataJson`; pack `retrievalMetadata` |
| **6C.13c** | Bangla colloquial expansion | **Done** | `colloquial-map.ts`; `query-normalizer.service.ts`; keyword OR expansion |
| **6C.13d** | Medical confidence calibration | **Done** | `medical-confidence.calibration.ts`; `resolveCalibratedRetrievalProfile()` |
| **6C.13e** | Cross-encoder rerank | **Done** | `cross-encoder-reranker.service.ts`; wired in `KnowledgeRetrievalService` |
| **6C.13f** | Post-LLM validation | **Done** | `post-llm-validator.service.ts`; `AiAssistantService` BLOCK/SANITIZE |
| **6C.13g** | Golden-set eval tooling | **Done** | `eval/golden-set.eval.ts`; `eval/corpora/farmer-bn-smoke-v1.json`; `npm run vre:eval` |
| **6C.13h** | Admin eval UI | **Pending** | pranidoctor-web BFF + dashboard |
| **6C.13i** | Production cutover | **Pending** | Run migration; enable `VRE_PGVECTOR_ANN`; G1 corpus + re-baseline |

**Tests:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — **369 passed** (50 files).

**Semantic search:** 2000-vector cap **removed**; pgvector ANN when column available, else full-corpus `vectorJson` scan.

---

## Gap analysis (from verification report)

| ID | Gap | Current behavior | Clinical / ops risk | 6C.13 workstream |
|----|-----|------------------|----------------------|------------------|
| **G1** | In-memory vector scan (2000 cap) | `SemanticSearchService` loads recent 2000 `vectorJson` rows, full cosine in Node | **High** — miss older/relevant chunks at scale | §1 pgvector ANN, §2 indexing |
| **G2** | No `retrievalMetadataJson` on `AiUsageLog` | Pack metadata discarded after request | **Medium** — blind to precision, block rate, latency | §6 retrieval metadata logging |
| **G3** | No colloquial BN query expansion | Farmer informal terms miss lexical plane | **Medium** — poor BN recall (score 60) | §4 Bangla colloquial expansion |
| **G4** | No cross-encoder re-ranker | Feature-weighted `RerankerService` only | **Medium** — suboptimal precision@4 | §3 cross-encoder reranking |
| **G5** | Empty `graphHints` | No 1-hop related entity expansion | Medium — deferred to **6D** | — |
| **G6** | Symptom checker silent on BLOCK | `retrieveForRag()` returns `''` | Low — deferred to **6D** | — |
| **G7** | Embedding queue ops visibility | BullMQ exists; no admin dashboard | Low | §7 eval framework (ops panel) |
| **G8** | Cross-model dimension mismatch | Vectors with wrong dimensions skipped silently | **Medium** — partial semantic index | §1 migration + §2 model-scoped indexes |

**Additional gaps (not in G-table but in QA matrix):**

| Gap | Risk | 6C.13 workstream |
|-----|------|------------------|
| No post-LLM dosage/fact validation | **High** for prescription | §5 post-LLM validation |
| No golden-set eval harness | Blocks calibration | §8 golden-set testing |
| Static fusion weights (0.40/0.45) | Suboptimal per profile | §9 fusion weight calibration |
| Static `medicalMinConfidence` thresholds | False block / false proceed | §10 medical confidence calibration |
| No admin eval UI | Ops cannot tune or preview | §7 evaluation framework |

---

## Current baseline (implemented)

```
knowledge-retrieval/
├── embedding/     → BullMQ queue, pipeline, refresh cron
├── search/        → keyword (ILIKE + lexical util), semantic (in-memory cosine)
├── ranking/       → feature-weighted reranker (no cross-encoder)
├── packs/         → context, citation, evidence, confidence builders
├── grounding/     → strictness profiles, medical safety, low-confidence handler
└── retrieve()     → hybrid → rerank → gates → pack → routing decision
```

| Component | Implementation | Limitation |
|-----------|----------------|------------|
| Vector storage | `AiKnowledgeEmbeddingChunk.vectorJson` (JSON array) | No native vector type; no ANN |
| Semantic search | `findMany({ take: 2000, orderBy: embeddedAt desc })` | Recency bias, O(n) scan |
| Keyword search | Content/title/searchText ILIKE + locale boost | No tsvector, no colloquial map |
| Reranker | Domain/confidence/locale multipliers | No query-passage cross-encoder |
| Usage logging | `AiUsageLog.metadataJson` (generic) | No structured retrieval sidecar |
| Eval | 15 verification unit tests | No golden-set CI, no precision@k metrics |

---

## Optimization architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Phase 6C.13 Optimization Layer                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  Query Path                                                                  │
│  ┌──────────────┐   ┌─────────────────┐   ┌──────────────────────────────┐  │
│  │ Query        │──►│ Lexical plane   │──►│ Hybrid fusion (calibrated)   │  │
│  │ Normalizer   │   │ + colloquial BN │   │                              │  │
│  │ + colloquial │   │ + pg tsvector   │   └──────────────┬───────────────┘  │
│  └──────────────┘   └─────────────────┘                  │                  │
│         │                                                  ▼                  │
│         │           ┌─────────────────┐   ┌──────────────────────────────┐  │
│         └──────────►│ Semantic plane  │──►│ Feature rerank + cross-enc   │  │
│                     │ pgvector HNSW   │   │ (cost-gated)                 │  │
│                     │ model-scoped    │   └──────────────┬───────────────┘  │
│                     └─────────────────┘                  │                  │
│                                                          ▼                  │
│                     ┌─────────────────────────────────────────────────┐   │
│                     │ KnowledgeContextPack → confidence routing        │   │
│                     └──────────────────────┬──────────────────────────┘   │
│                                            │                                │
│                     ┌──────────────────────▼──────────────────────────┐   │
│                     │ LLM completion (AiRouterEngine)                    │   │
│                     └──────────────────────┬──────────────────────────┘   │
│                                            │                                │
│                     ┌──────────────────────▼──────────────────────────┐   │
│                     │ Post-LLM validator (dosage, citation, facts)       │   │
│                     └──────────────────────┬──────────────────────────┘   │
│                                            │                                │
│                     ┌──────────────────────▼──────────────────────────┐   │
│                     │ AiUsageLog.retrievalMetadataJson + eval pipeline   │   │
│                     └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. pgvector ANN migration

### 1.1 Objective

Replace in-memory JSON cosine scan with **PostgreSQL pgvector approximate nearest neighbor (ANN)** search, eliminating the 2000-row cap and enabling full-corpus semantic recall at sub-400 ms p95.

### 1.2 Prerequisites

| Prerequisite | Action |
|--------------|--------|
| PostgreSQL ≥ 15 with `vector` extension | Enable via migration `CREATE EXTENSION IF NOT EXISTS vector` |
| Embedding provider configured | At least one stable model (e.g. `text-embedding-3-small`, 1536d) registered in `AiModel` |
| Dimension registry | Canonical `dimensions` per `modelKey` in model registry — no mixed-dimension index |

### 1.3 Schema migration strategy

**Phase A — additive (zero downtime):**

```sql
-- New column alongside vectorJson (dual-write period)
ALTER TABLE ai_knowledge_embedding_chunks
  ADD COLUMN vector vector(1536);  -- dimension parameterized per model migration

ALTER TABLE ai_knowledge_embedding_chunks
  ADD COLUMN embedding_model_id TEXT REFERENCES ai_models(id);

-- Backfill job: vectorJson → vector WHERE dimensions match AND active = true
```

**Phase B — index creation (concurrent, model-scoped):**

```sql
-- Partial index per active embedding model (prevents cross-dimension pollution)
CREATE INDEX CONCURRENTLY idx_akec_vector_hnsw_openai_3_small
  ON ai_knowledge_embedding_chunks
  USING hnsw (vector vector_cosine_ops)
  WHERE active = true
    AND model_key = 'text-embedding-3-small'
    AND dimensions = 1536;

-- Metadata pre-filter indexes (applied before ANN in query planner)
CREATE INDEX CONCURRENTLY idx_akec_domain_species
  ON ai_knowledge_embedding_chunks (active, embedded_at DESC)
  INCLUDE (knowledge_entry_id, chunk_index, entry_version);
```

**Phase C — cutover:**

1. `SemanticSearchService` reads from `vector` column via raw SQL `<=>` operator.
2. Dual-write: embed pipeline writes both `vectorJson` (rollback safety) and `vector` for 2 release cycles.
3. Deprecate in-memory scan path behind feature flag `VRE_PGVECTOR_ANN=true`.
4. After validation, stop writing `vectorJson` (retain column for audit export).

### 1.4 Query pattern (conceptual)

```sql
SELECT
  e.knowledge_entry_id,
  e.chunk_index,
  e.entry_version,
  1 - (e.vector <=> $1::vector) AS semantic_score
FROM ai_knowledge_embedding_chunks e
JOIN ai_knowledge_entries ke ON ke.id = e.knowledge_entry_id
WHERE e.active = true
  AND e.model_key = $2
  AND ke.status = 'PUBLISHED'
  AND ke.content_type = ANY($3::text[])
  AND ($4::text IS NULL OR $4 = ANY(ke.species))
  AND e.entry_version = ke.version
ORDER BY e.vector <=> $1::vector
LIMIT 40;
```

### 1.5 HNSW parameters

| Parameter | Pilot default | Production (prescription) | Notes |
|-----------|---------------|---------------------------|-------|
| `m` (connections) | 16 | 24 | Build-time; higher = better recall, slower build |
| `ef_construction` | 64 | 128 | Index build quality |
| `ef_search` | 64 | 128 | Query-time recall/latency tradeoff |
| Distance | `vector_cosine_ops` | — | Matches current cosine similarity |
| `minSemanticSimilarity` | 0.72 | 0.78 (medicine) | Post-filter on cosine score |

### 1.6 Model migration / G8 resolution

When embedding model changes (dimensions or provider):

1. Register new model in `AiModel` with `dimensions`.
2. Create **new partial HNSW index** for new `model_key`.
3. Run `ai:knowledge:reindex` sweep — embed all published chunks with new model.
4. Flip `AiKnowledgeEmbeddingRoute.activeModelKey` in settings.
5. Tombstone old vectors (`active=false`) — retain for audit.
6. Alert if > 1% chunks fail dimension validation during sweep.

### 1.7 Rollback plan

| Trigger | Action |
|---------|--------|
| ANN recall regression > 10% vs brute-force sample | Feature flag off → in-memory fallback |
| Index build failure | Continue serving lexical-only (`semanticEnabled: false` per profile) |
| pgvector extension unavailable | Block semantic profiles; farmer-chat degrades to keyword |

### 1.8 Acceptance criteria

- [ ] Full corpus searchable (no 2000 cap)
- [ ] Semantic p95 latency < 150 ms (excl. query embed)
- [ ] Recall@40 within 2% of brute-force on 500-chunk sample set
- [ ] Zero cross-dimension vectors in active index

---

## 2. Vector indexing strategy

### 2.1 Multi-layer index architecture

| Layer | Technology | Scope | Purpose |
|-------|------------|-------|---------|
| **L1 — Vector ANN** | pgvector HNSW (cosine) | Per `model_key` + `dimensions` | Semantic candidate generation |
| **L2 — Lexical** | GIN tsvector | Chunk `contentBn`, `contentEn` | Keyword plane precision |
| **L3 — Trigram** | `pg_trgm` GIN | Entry `colloquialBn[]`, trade names | Fuzzy farmer terms |
| **L4 — Metadata** | B-tree / partial | `content_type`, `species[]`, `confidence_score`, `evidence_level` | Pre-ANN filters |
| **L5 — Structured** | GIN jsonb_path | `structuredJson.doseMgKg`, `registrationNo`, `diseaseCode` | Exact clinical field match |
| **L6 — Sidecar denorm** | JSON column on embedding row | Filter fields copied at embed time | Avoid JOIN cost in hot path |

### 2.2 Metadata sidecar (denormalized at embed time)

Copy from CCE `ChunkMetadataEnvelopeV1` + entry fields into `metadataSidecarJson` on `AiKnowledgeEmbeddingChunk`:

```typescript
type VectorMetadataSidecar = {
  contentType: string;
  slug: string;
  species: string[];
  clinicalRiskTier: string;
  evidenceLevel: string;
  confidenceScore: number;
  vetApproved: boolean;
  primaryLocale: 'bn' | 'en';
  sourceKeys: string[];
  lastReviewedAt: string;
  hasStructuredDose: boolean;
  inlineCitationPresent: boolean;
};
```

**Rationale:** ANN query applies filters on sidecar without joining `AiKnowledgeEntry` + chunk tables in the hot path.

### 2.3 Index lifecycle

```
Publish event
  → embed job writes vector + sidecar
  → UPSERT embedding row (idempotent by entryId+chunkIndex+version)
  → ANN index auto-updates (PostgreSQL heap + HNSW)

Deprecate / unpublish
  → active = false (tombstone)
  → vector retained; excluded by partial index WHERE active = true

Re-embed sweep
  → batch by domain (DISEASE first for farmer chat)
  → progress tracked in AiKnowledgeEmbeddingJob table (new)
```

### 2.4 Corpus scale thresholds

| Corpus size | Strategy |
|-------------|----------|
| < 50K chunks | Single HNSW index per model; all domains |
| 50K – 500K | Domain-partitioned partial indexes optional |
| > 500K | Evaluate domain-sharded indexes; external vector DB (Qdrant) as 6C.14 option |
| > 2M | Mandatory external vector store or read replica isolation |

**Current Prani Doctor estimate:** < 20K chunks at pilot — single HNSW per model sufficient.

### 2.5 Index health metrics

| Metric | Alert | Dashboard |
|--------|-------|-----------|
| Publish → indexed lag p95 | > 5 min | Embedding ops panel |
| Active vector count vs published chunk count | Ratio < 0.95 | Corpus health |
| Stale vectors (`entryVersion ≠ entry.version`) | > 0 active | Re-embed queue |
| Index bloat / HNSW size | > 2× row count growth | DBA review |
| Dimension mismatch skip rate | > 0.1% embed jobs | Model registry alert |

---

## 3. Cross-encoder reranking

### 3.1 Objective

Improve **precision@4** after hybrid fusion by scoring query–passage relevance with a cross-encoder, reducing false-positive chunks in prescription and emergency profiles.

### 3.2 Three-stage rank pipeline (target state)

```
Stage 1 — Hybrid fusion        → top 50 candidates
Stage 2 — Feature reranker     → top 20 candidates  (existing RerankerService)
Stage 3 — Cross-encoder        → top k (profile.maxChunks)
```

### 3.3 Cross-encoder options (registry-routed)

| Option | Provider | Latency | Cost | Recommendation |
|--------|----------|---------|------|----------------|
| **A — Dedicated rerank API** | Cohere rerank, Voyage rerank | 50–150 ms | Low per pair | **Primary** for prescription |
| **B — LLM scoring** | Gemini Flash / GPT-4o-mini via AiRouterEngine | 200–500 ms | Medium | Fallback when no rerank route |
| **C — Local cross-encoder** | Self-hosted (e.g. bge-reranker) | 30–80 ms | Infra cost | Future if QPS > 100 |

**Design rule:** Cross-encoder model selected via `AiRoute` with `taskHint: RETRIEVAL_RERANK` — never hardcoded.

### 3.4 Input contract

```typescript
type RerankPair = {
  query: string;           // normalized (post colloquial expansion)
  passage: string;         // locale-primary excerpt, max 512 tokens
  domain: string;          // DISEASE | MEDICINE | …
  entityType: string;
  species?: string[];
  evidenceLevel: string;
  confidenceScore: number;
};
```

Batch size: **10 pairs per API call** (Stage 2 top-20 → 2 batches).

### 3.5 Profile activation matrix

| Profile | `rerankerEnabled` | Cross-encoder default | Max pairs | Skip condition |
|---------|-------------------|----------------------|-----------|----------------|
| `prescription-v1` | **true** | On | 20 | Never skip (fail-closed profile) |
| `emergency-v1` | **true** | On | 16 | Skip if latency budget exhausted |
| `ai-doctor-v1` | true | Optional | 12 | Skip if `AIRoute.maxCostUsd` exceeded |
| `disease-analysis-v1` | false → **true** after eval | Optional | 12 | A/B gated |
| `farmer-chat-v1` | false | Off | — | Feature-weighted only (cost) |
| `feed-advisor-v1` | false | Off | — | Lexical+semantic sufficient |

### 3.6 Cost gate

```
if (sessionCostUsd + estimatedRerankCost > route.maxCostUsd)
  → skip Stage 3; preserve Stage 2 order
  → log retrievalMetadataJson.rerankSkipped = true
```

### 3.7 Conflict resolution (post rerank)

When top chunks disagree on clinical facts:

1. Prefer higher **evidence level** (L1 > L2 > L3 > L4)
2. Then higher **confidence score**
3. Then newer **`lastReviewedAt`**
4. If still tied on MEDICINE dosage → **BLOCK** (prescription profile)

### 3.8 Fallback behavior

| Failure | Behavior |
|---------|----------|
| Rerank API timeout (> 800 ms) | Stage 2 order preserved; `rerankSkipped: 'timeout'` |
| Rerank API error | Stage 2 order; audit warning |
| All pairs score < 3/10 | Trigger low-confidence policy early |

### 3.9 Acceptance criteria

- [ ] precision@4 improvement ≥ **+8 pp** on prescription golden set vs Stage 2 only
- [ ] p95 rerank latency < 300 ms (dedicated API) / 600 ms (LLM fallback)
- [ ] Zero additional LLM calls on BLOCK path (rerank runs pre-pack, pre-gate)

---

## 4. Bangla colloquial query expansion

### 4.1 Objective

Close G3 — improve farmer recall when queries use informal Bangla, regional terms, or transliterated English drug names.

### 4.2 Data sources

| Source | Field | Usage |
|--------|-------|-------|
| VKL entity | `colloquialBn[]` | Canonical → farmer term mapping (6A) |
| Editorial import | `keywordsBn[]` | Synonym expansion |
| Manual curated map | `VkColloquialMap` table (new) | Query-time lookup |
| Usage mining | Top failed-retrieval queries (from metadata logs) | Continuous expansion |

### 4.3 VkColloquialMap schema (conceptual)

```typescript
type VkColloquialMapEntry = {
  id: string;
  colloquialTerm: string;      // normalized BN (NFC)
  canonicalTerm: string;       // standard veterinary term
  canonicalSlug?: string;      // optional entity slug boost
  domain?: string;             // DISEASE | MEDICINE | …
  species?: string[];
  locale: 'bn';
  source: 'EDITORIAL' | 'MINED' | 'VET_SUBMITTED';
  confidence: number;          // 0–1 map quality
  active: boolean;
};
```

**Index:** GIN trigram on `colloquialTerm`; B-tree on `canonicalSlug`.

### 4.4 Query normalization pipeline

```
Raw user query
  → Unicode NFC normalize
  → Script detect (BN / EN / mixed / transliterated)
  → Tokenize (BN word boundaries)
  → Colloquial lookup (exact → trigram fuzzy @ 0.85)
  → Expand: append canonical terms (OR boost, not replace)
  → Species hint extraction (গরু → COW, ছাগল → GOAT)
  → Domain hint (from session context, prior turn entity)
  → Output: NormalizedQuery { text, expandedTerms[], locale, speciesHint, domainHints[] }
```

### 4.5 Expansion rules

| Rule | Example | Effect |
|------|---------|--------|
| Exact colloquial match | `গাভীর দুধ` → `mastitis` canonical | Add canonical to tsquery OR clause |
| Fuzzy trigram | `মাস্টাইটিস` typo variants | Boost matching entries |
| Transliteration | `enrofloxacin` in BN query | Route to MEDICINE domain filter |
| Multi-term | `গরুর পায়ে ফোলা` | Expand each token; AND core terms |
| No match | Unknown colloquial | Pass-through; semantic plane carries recall |

### 4.6 Integration points

| Plane | How expansion applies |
|-------|-------------------------|
| Keyword | Expanded terms in tsquery / ILIKE OR clauses |
| Semantic | Embed **original + expanded** concatenation (max 512 chars) |
| Structured | Canonical slug hints boost structured field search |
| Cross-encoder | Receives normalized query (post-expansion) |

### 4.7 Governance

- Editorial review queue for `VET_SUBMITTED` and `MINED` entries
- Minimum `confidence ≥ 0.7` for auto-activation
- Kill switch: `knowledge.retrieval.colloquial_expansion` governance scope
- A/B flag: `VRE_COLLOQUIAL_EXPANSION=true` per tenant

### 4.8 Acceptance criteria

- [ ] BN colloquial MRR@10 ≥ **0.75** on 30-query farmer golden set
- [ ] Zero false expansions causing wrong-domain retrieval on medicine eval set
- [ ] Expansion adds < 15 ms p95 to query normalization

---

## 5. Post-LLM validation

### 5.1 Objective

Close hallucination gap — validate LLM output against retrieved `structuredFacts` and pack citations **before** returning to user, especially for dosage, withdrawal, and emergency action steps.

### 5.2 Validator placement

```
AiAssistantService.chat()
  → retrieve() → pack
  → if BLOCK → respondBlocked (no LLM)     ← existing
  → LLM completion
  → PostLlmValidator.validate()            ← NEW
  → if FAIL → sanitize / block / escalate
  → return response + validationMetadata
```

### 5.3 Validation tiers

| Tier | Trigger | Checks | On failure |
|------|---------|--------|------------|
| **T0 — Citation** | All profiles | Output references only pack slugs/citations | Strip uncited claims |
| **T1 — Numeric clinical** | Medical intent OR MEDICINE chunks in pack | Dosage mg/kg, ml, frequency vs `structuredFacts` | BLOCK + vet redirect |
| **T2 — Withdrawal** | Prescription / regulatory | `withdrawalDays` match | BLOCK |
| **T3 — Contraindication** | Prescription | Banned substance mentions without pack support | BLOCK |
| **T4 — Emergency** | Emergency profile | No false reassurance; escalation CTA present when pack empty/degraded | Force ESCALATE_HUMAN |

### 5.4 Dosage validation algorithm (SP-01)

```typescript
// Extract numeric dose claims from LLM output (regex + unit normalizer)
for (const claim of extractDoseClaims(llmOutput)) {
  const fact = findMatchingStructuredFact(claim, pack.structuredFacts);
  if (!fact) → FAIL('uncited_dose');
  if (Math.abs(claim.value - fact.doseMgKg) / fact.doseMgKg > 0.10) → FAIL('dose_mismatch');
}
// Allow range facts: fact.doseMin ≤ claim ≤ fact.doseMax
```

### 5.5 Non-blocking validations (farmer-chat)

| Check | Failure action |
|-------|----------------|
| Missing disclaimer when PROCEED_DEGRADED | Append standard disclaimer |
| Overconfident language ("definitely", "guaranteed cure") | Soft rewrite via template |
| Species mismatch in advice | Append species clarification |

### 5.6 Validator output schema

```typescript
type PostLlmValidationResult = {
  passed: boolean;
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'T4';
  failures: Array<{ code: string; detail: string; severity: 'warn' | 'block' }>;
  sanitizedOutput?: string;
  action: 'PASS' | 'SANITIZE' | 'BLOCK' | 'ESCALATE';
};
```

Attach to `AiUsageLog.metadataJson.validationResult` and `retrievalMetadataJson`.

### 5.7 Performance budget

- T0 citation check: < 10 ms (regex)
- T1 dosage parse: < 50 ms
- No additional LLM call for validation in v1 (rule-based only)
- LLM-as-judge validation deferred to 6D eval harness

### 5.8 Acceptance criteria

- [ ] 100% dosage claims blocked when no matching `structuredFacts` (prescription profile)
- [ ] Hallucinated dosage rate < **2%** on eval set (from QA target)
- [ ] False block rate on valid vet responses < **5%**

---

## 6. Retrieval metadata logging

### 6.1 Objective

Close G2 — attach structured retrieval telemetry to every AI request for analytics, calibration, and incident investigation.

### 6.2 Schema extension

Add `retrievalMetadataJson` to `AiUsageLog` (dedicated column preferred over nested `metadataJson` for queryability):

```typescript
type RetrievalMetadataJson = {
  schemaVersion: '1.0';
  packId: string;
  retrievalProfileId: string;
  retrievalMode: 'hybrid' | 'lexical' | 'semantic';
  queryHash: string;              // sha256(normalizedQuery) — not raw text in prod
  queryLocale: 'bn' | 'en';
  queryExpanded: boolean;
  domainsRetrieved: string[];
  chunkCount: number;
  excludedCount: number;
  groundableChunkCount: number;
  confidenceSummary: { min: number; max: number; avg: number };
  evidenceSummary: { min: string; max: string; dominant: string };
  routingDecision: ConfidenceRoutingAction;
  routingReason: string;
  medicalRiskTier: string;
  embeddingCoverage: number;
  degraded: boolean;
  failClosed: boolean;
  semanticEnabled: boolean;
  rerankerEnabled: boolean;
  rerankSkipped?: string;         // 'cost' | 'timeout' | 'disabled'
  crossEncoderModelKey?: string;
  topSlugs: string[];             // max 6
  topSourceKeys: string[];
  topChunkKeys: string[];         // entryId:chunkIndex
  fusionWeights: { lexical: number; semantic: number };
  latencyMs: {
    lexical: number;
    semantic: number;
    fusion: number;
    rerank: number;
    packBuild: number;
    total: number;
  };
  pgvectorAnn: boolean;           // feature flag state
  validationResult?: PostLlmValidationResult;
};
```

### 6.3 Write path

```
KnowledgeRetrievalService.retrieve()
  → pack.scores + routingDecision already computed
  → return pack with packId

AiAssistantService.chat() / orchestrator
  → after retrieve(), stash retrievalMetadata on request context
  → after LLM + validation, merge into AiUsageLog write

AiUsageMonitoringService.logUsage()
  → persist retrievalMetadataJson atomically with usage row
```

### 6.4 Privacy controls

| Field | Production policy |
|-------|-------------------|
| Raw query text | **Never** in usage log; `queryHash` only |
| Chunk excerpts | Slug + chunkIndex only |
| PII in query | Hash only; length logged for abuse detection |
| Dev/staging | Optional raw query in `metadataJson.debug` with scope gate |

### 6.5 Analytics surfaces (admin)

| Metric | Source |
|--------|--------|
| Block rate by profile | `routingDecision = BLOCK` |
| Degraded rate | `degraded = true` |
| precision@k proxy | Manual eval + slug hit rate in sessions |
| Semantic vs lexical contribution | Fusion weight + plane latency |
| Rerank skip rate | `rerankSkipped` |
| Post-LLM validation failure rate | `validationResult.action` |

### 6.6 Acceptance criteria

- [ ] 100% of RAG-grounded `AiUsageLog` rows have `retrievalMetadataJson`
- [ ] Admin dashboard queries block rate, latency p95, top blocked reasons
- [ ] PII audit: zero raw farmer queries in production logs

---

## 7. Evaluation framework

### 7.1 Objective

Provide **repeatable, CI-integrated retrieval evaluation** — not just unit tests — to measure optimization impact and gate releases.

### 7.2 Framework components

```
┌─────────────────────────────────────────────────────────┐
│                  VRE Evaluation Framework                │
├─────────────────────────────────────────────────────────┤
│  Eval Corpus Registry    → versioned query sets          │
│  Eval Runner CLI         → scripts/ops/vre-eval.mjs       │
│  Metrics Engine          → precision@k, MRR, nDCG, block │
│  Regression Comparator   → baseline vs candidate diff    │
│  Report Generator        → docs/reports/vre-eval-*.md    │
│  Admin Eval API          → POST /admin/ai-ops/knowledge/ │
│                            retrieval/eval                 │
│  Admin Eval UI           → pranidoctor-web ai-ops panel  │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Eval runner modes

| Mode | Command (conceptual) | Use |
|------|---------------------|-----|
| **Offline** | `npm run vre:eval -- --corpus farmer-bn-v1` | CI nightly |
| **Profile sweep** | `--profile all` | Calibration |
| **A/B compare** | `--baseline main --candidate feature/pgvector` | PR gate |
| **Live preview** | Admin UI single query | Ops debugging |

### 7.4 Metrics catalog

| Metric | Formula | Target (pilot) | Target (prod) |
|--------|---------|----------------|---------------|
| precision@4 | Relevant in top 4 / 4 | ≥ 0.70 | ≥ 0.85 |
| MRR@10 | Mean reciprocal rank | ≥ 0.65 | ≥ 0.75 |
| nDCG@10 | Normalized DCG | ≥ 0.70 | ≥ 0.80 |
| BN colloquial MRR@10 | MRR on colloquial subset | ≥ 0.65 | ≥ 0.75 |
| Block rate (prescription) | BLOCK / total prescription queries | Monitor | False block < 5% |
| Fail-closed true positive | BLOCK when no ground truth match | 100% | 100% |
| Retrieval p95 latency | End-to-end retrieve() | < 400 ms | < 300 ms |
| Hallucinated dosage rate | Post-LLM eval failures / dose queries | — | < 2% |

### 7.5 Eval corpus versioning

```
eval/
├── corpora/
│   ├── farmer-bn-v1.json       # 30 BN colloquial queries
│   ├── prescription-en-v1.json # 25 dose/interaction queries
│   ├── emergency-bn-v1.json    # 15 triage queries
│   └── disease-mixed-v1.json   # 20 BN+EN symptom queries
├── relevance/
│   └── judgments/              # qrels: queryId → chunkKey → grade 0-3
└── baselines/
    └── 2026-05-31-pilot.json   # frozen baseline metrics
```

### 7.6 CI integration

| Trigger | Gate |
|---------|------|
| PR touching `knowledge-retrieval/` | Run unit tests + offline eval on `farmer-bn-v1` (20 queries) |
| Nightly | Full corpus eval; alert if precision@4 drops > 3 pp |
| Pre-release | Full corpus + compare to baseline file |
| Post pgvector cutover | Mandatory re-baseline |

### 7.7 Admin eval UI (pranidoctor-web)

| Panel | Function |
|-------|----------|
| Query playground | Enter query → preview pack, routing, latency breakdown |
| Corpus manager | Upload/version eval sets; assign relevance judgments |
| Metrics dashboard | precision@k trends, block rate, latency by profile |
| Embedding health | Index lag, vector count, model drift (G7) |
| Calibration studio | Fusion weight / confidence threshold what-if (read-only until approved) |

### 7.8 Acceptance criteria

- [ ] Eval runner produces reproducible report artifact
- [ ] CI gate blocks PR if precision@4 regresses > 3 pp on farmer set
- [ ] Admin playground accessible to `knowledge.retrieval.eval` scope

---

## 8. Golden-set testing

### 8.1 Objective

Establish **curated, clinically reviewed query–relevance sets** as the authoritative quality bar for 6C.13 optimizations.

### 8.2 Golden set tiers

| Tier | Size | Review | Purpose |
|------|------|--------|---------|
| **G0 — Smoke** | 20 queries | Engineering | CI PR gate (< 60 s) |
| **G1 — Pilot** | 90 queries | 1 vet reviewer | Release gate |
| **G2 — Production** | 300+ queries | 2 vet reviewers + inter-rater κ | Continuous monitoring |

### 8.3 Query record schema

```typescript
type GoldenQuery = {
  id: string;
  tier: 'G0' | 'G1' | 'G2';
  locale: 'bn' | 'en';
  query: string;
  profileId: string;
  taskType: AiDbTaskType;
  species?: LivestockSpecies;
  domain?: string;
  intent: 'medical' | 'husbandry' | 'emergency' | 'prescription' | 'general';
  colloquial: boolean;
  expectedRouting: ConfidenceRoutingAction;
  relevantChunks: Array<{
    entrySlug: string;
    chunkIndex: number;
    grade: 0 | 1 | 2 | 3;  // 0=irrelevant, 3=highly relevant
  }>;
  mustNotRetrieve?: string[];  // slugs that must NOT appear in top 4
  notes?: string;
};
```

### 8.4 Initial G1 corpus composition (90 queries)

| Domain | BN | EN | Medical | Notes |
|--------|----|----|---------|-------|
| DISEASE | 20 | 10 | 15 | Include 10 colloquial BN |
| MEDICINE | 10 | 15 | 20 | Dose + withdrawal focus |
| EMERGENCY | 10 | 5 | 15 | Fail-closed scenarios |
| FARM_MGMT | 10 | 5 | 0 | Non-medical baseline |
| FEED | 5 | 5 | 0 | Feed advisor profile |
| **Total** | **55** | **35** | **50** | |

### 8.5 Golden set test execution

```
For each GoldenQuery:
  1. retrieve({ profileId, query, locale, species })
  2. Assert routingDecision matches expectedRouting (± documented exceptions)
  3. Compute precision@4 against grade ≥ 2 chunks
  4. Assert mustNotRetrieve slugs absent from top 4
  5. If medical + PROCEED: assert groundableChunkCount > 0
  6. Record latencyMs.total
```

### 8.6 Governance

- Golden sets stored in repo under `eval/corpora/` (G0) and secure admin export (G1/G2 with clinical content flags)
- Version bump on any judgment change
- Inter-rater agreement target κ ≥ 0.75 for G2
- Quarterly refresh from production `retrievalMetadataJson` mined failures

### 8.7 Acceptance criteria

- [ ] G0 smoke set runs in CI on every PR
- [ ] G1 pilot set passes before 6C.13 production cutover
- [ ] Documented baseline: precision@4 ≥ 0.70 (pilot) / 0.85 (prod target)

---

## 9. Fusion weight calibration

### 9.1 Objective

Replace static default weights (lexical 0.40, semantic 0.45) with **profile-tuned, eval-validated** weights that maximize precision@4 per task type.

### 9.2 Current vs target weights

| Profile | Current wLex / wSem | Target (initial hypothesis) | Calibration method |
|---------|---------------------|----------------------------|-------------------|
| `farmer-chat-v1` | 0.40 / 0.45 | 0.38 / 0.47 | Grid search on farmer-bn G1 |
| `prescription-v1` | 0.35 / 0.50 | 0.42 / 0.38 | Maximize dose-chunk precision@4 |
| `emergency-v1` | 0.30 / 0.55 | 0.28 / 0.57 | Colloquial emergency subset |
| `disease-analysis-v1` | 0.40 / 0.45 | 0.35 / 0.50 | Symptom paraphrase set |
| `feed-advisor-v1` | 0.40 / 0.45 | 0.45 / 0.40 | Ingredient code exact match |

### 9.3 Calibration procedure

```
1. Select profile + golden subset (min 20 queries)
2. Grid search wLex ∈ [0.20, 0.60], wSem = 1 - wLex - wStruct (wStruct fixed per profile)
3. For each weight pair:
     run offline eval → precision@4, MRR@10
4. Select Pareto-optimal pair (max precision@4, latency < budget)
5. Vet review top-5 retrieval changes for clinical safety
6. Store in RetrievalProfileCalibration table (versioned)
7. Deploy via admin settings or profile registry hot-reload
```

### 9.4 RRF fallback tuning

When semantic plane unavailable (embed failure, pgvector down):

```
RRFscore(d) = Σ 1 / (k + rank_i(d)),  k ∈ {40, 60, 80}
```

Calibrate `k` on golden set where semantic plane intentionally disabled.

### 9.5 Normalization strategy

Current: min-max normalize per plane within candidate set.

**Optimization:** Switch to **z-score normalization** within plane when candidate count > 10; reduces score compression when all lexical hits are weak.

### 9.6 Storage model

```typescript
type RetrievalProfileCalibration = {
  profileId: string;
  version: number;
  lexicalWeight: number;
  semanticWeight: number;
  structuredWeight: number;
  rrfK: number;
  normalization: 'minmax' | 'zscore';
  calibratedAt: string;
  evalCorpusVersion: string;
  metrics: { precisionAt4: number; mrrAt10: number };
  approvedBy?: string;
};
```

### 9.7 Safety constraints (non-negotiable)

| Constraint | Rule |
|------------|------|
| Prescription wStruct | ≥ 0.25 always |
| Emergency wSem | ≥ 0.50 always |
| Weight change max delta | ± 0.10 per release without vet sign-off |
| Regression gate | precision@4 must not drop > 2 pp on G1 |

### 9.8 Acceptance criteria

- [ ] All production profiles have calibrated weights backed by eval report
- [ ] Weights stored versioned; rollback to prior version in < 5 min
- [ ] `retrievalMetadataJson.fusionWeights` reflects active calibration version

---

## 10. Medical confidence calibration

### 10.1 Objective

Tune `minConfidence`, `medicalMinConfidence`, and evidence floors to minimize **false blocks** (farmer frustration) and **false proceeds** (clinical risk) using golden-set and production telemetry.

### 10.2 Current thresholds (baseline)

| Profile | minConfidence | medicalMinConfidence | minEvidence | failClosed |
|---------|---------------|----------------------|-------------|------------|
| farmer-chat-v1 | 0.40 | 0.55 | L1 | false |
| prescription-v1 | 0.75 | 0.75 | L2 | true |
| disease-analysis-v1 | 0.55 | 0.55 | L2 | false |
| emergency-v1 | 0.60 | 0.60 | L1 | false |

### 10.3 Calibration dimensions

| Dimension | What to tune | Metric |
|-----------|--------------|--------|
| **medicalMinConfidence** | Threshold for MEDICINE/DISEASE chunks in medical queries | False proceed rate on dose queries |
| **minConfidence (avg)** | `isLowConfidenceSummary` degraded trigger | Degraded rate vs user satisfaction proxy |
| **minConfidence (min)** | `summary.min < threshold × 0.85` | Outlier chunk exclusion |
| **blockLowConfidenceMedical** | On/off per profile | Block rate on farmer medical |
| **Evidence floor** | L1 vs L2 for emergency | Emergency recall vs safety |

### 10.4 Calibration procedure

```
Phase 1 — Offline (golden set)
  For each medical query in G1:
    sweep medicalMinConfidence ∈ [0.45, 0.80] step 0.05
    measure: true block rate, false block rate, precision@4

Phase 2 — Shadow mode (production)
  Log what routing WOULD BE at candidate thresholds
  Compare to actual for 2 weeks via retrievalMetadataJson

Phase 3 — Approved deploy
  Vet sign-off on threshold change document
  Gradual rollout: 10% → 50% → 100% tenant traffic
```

### 10.5 Target operating points

| Profile | False block rate | False proceed (medical) | True fail-closed |
|---------|------------------|-------------------------|------------------|
| farmer-chat-v1 | < 8% | < 1% | 100% on empty pack |
| prescription-v1 | < 5% | **0%** | 100% when no structured facts |
| emergency-v1 | < 5% | < 0.5% | 100% on empty emergency pack |

### 10.6 Confidence score semantics

Clarify that retrieval confidence is **editorial ingest confidence** (6B), not model softmax. Calibration must not treat low ingest confidence as override for strong lexical+semantic match without vet review flag.

**Proposed composite retrieval confidence (future):**

```
retrievalConfidence = 0.5 × ingestConfidence
                    + 0.3 × semanticScore
                    + 0.2 × evidenceLevelWeight
```

Defer composite to 6C.14 if golden-set shows ingest-only threshold is insufficient.

### 10.7 Medical intent detector tuning

Current: regex-based `detectMedicalIntent` / `detectEmergencyIntent`.

**Calibration additions:**

- Golden set labeled `intent` field validates detector precision/recall
- Target: medical intent recall ≥ 0.95, precision ≥ 0.85
- False positive medical intent → unnecessary BLOCK risk on husbandry queries

### 10.8 Acceptance criteria

- [ ] Documented threshold change log with vet approval
- [ ] Prescription false proceed rate = **0%** on G1 medicine set
- [ ] Farmer-chat false block rate < **8%** on G1 BN set
- [ ] Shadow mode report completed before any threshold production change

---

## Implementation roadmap (no code — sequencing only)

| Sprint | Workstream | Deliverables | Depends on |
|--------|------------|--------------|------------|
| **6C.13a** | pgvector migration + indexing | Extension migration, HNSW index, semantic service cutover, G8 re-embed sweep | Ops: PostgreSQL pgvector |
| **6C.13b** | Metadata logging + eval CLI | `retrievalMetadataJson`, `vre-eval.mjs`, G0 smoke corpus | 6C.13a (optional parallel) |
| **6C.13c** | Colloquial expansion | `VkColloquialMap`, query normalizer, trigram index | 6A colloquial data |
| **6C.13d** | Golden set G1 + calibration | 90-query corpus, fusion + medical threshold calibration | 6C.13b eval runner |
| **6C.13e** | Cross-encoder rerank | Rerank adapter, cost gate, prescription profile enable | 6C.13a, rerank API route |
| **6C.13f** | Post-LLM validation | T0–T2 validators, prescription BLOCK path | 6C.13d golden set |
| **6C.13g** | Admin eval UI | Playground, metrics dashboard, embedding health | 6C.13b, web BFF |
| **6C.13h** | Production cutover | Feature flags off, re-baseline, sign-off report | All above |

**Critical path:** 6C.13a → 6C.13d → 6C.13e → 6C.13f → production cutover.

---

## Feature flags

| Flag | Default | Purpose |
|------|---------|---------|
| `VRE_PGVECTOR_ANN` | true (fallback: full scan) | ANN vs in-memory fallback |
| `VRE_COLLOQUIAL_EXPANSION` | true | Bangla colloquial map |
| `VRE_CROSS_ENCODER_RERANK` | true | Stage 3 rerank |
| `VRE_POST_LLM_VALIDATION` | true | Output validator |
| `VRE_RETRIEVAL_METADATA_LOG` | true | Usage log sidecar |
| `VRE_CALIBRATED_FUSION_WEIGHTS` | false | Profile calibration table |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pgvector index build locks table | Medium | High | `CREATE INDEX CONCURRENTLY`; off-peak |
| Cross-encoder latency SLO miss | Medium | Medium | Cost gate + Stage 2 fallback |
| Colloquial false expansion | Medium | High | Confidence threshold + editorial review |
| Post-LLM false block on valid vet text | Medium | Medium | Shadow mode; T1 tolerance bands |
| Golden set stale vs corpus | High | Medium | Quarterly refresh; version binding |
| Re-embed sweep overload | Medium | Medium | Domain-batched queue; rate limit |

---

## Success metrics (6C.13 exit)

| Metric | Baseline (QA) | 6C.13 target |
|--------|---------------|--------------|
| Retrieval score | 74 | ≥ 88 |
| Grounding score | 81 | ≥ 90 |
| Medical safety score | 88 | ≥ 94 |
| Production readiness | 70 | ≥ 85 |
| Technical debt burden | 62 | ≤ 35 |
| precision@4 (G1) | Not measured | ≥ 0.85 |
| BN colloquial MRR@10 | ~0.60 est. | ≥ 0.75 |
| Semantic p95 latency | Unbounded (2000 cap) | < 150 ms ANN |
| Hallucinated dosage rate | Unmeasured | < 2% |
| retrievalMetadataJson coverage | 0% | 100% RAG requests |

---

## Dependencies & handoffs

| Dependency | Owner | Required for |
|------------|-------|--------------|
| pgvector on production PostgreSQL | DevOps | §1, §2 |
| Cohere/Voyage rerank route in AiModel registry | AI Platform | §3 |
| `colloquialBn[]` populated on published entries | Editorial / 6B | §4 |
| Vet reviewer for G1 golden set | Clinical | §8, §10 |
| `AiUsageLog` schema migration | Backend | §6 |
| Admin eval UI routes (BFF) | pranidoctor-web | §7 |
| Post-LLM validator integration | 6D team (shared) | §5 |

---

## Out of scope (explicit)

| Item | Deferred to |
|------|-------------|
| Graph expansion (`graphHints`) | Phase 6D |
| Symptom checker BLOCK signal | Phase 6D |
| LLM-as-judge output validation | Phase 6D eval |
| External vector DB (Qdrant/Pinecone) | Phase 6C.14 if corpus > 500K |
| Page-level span citation in pack | Phase 6B.3 propagation |
| Full tsvector migration on chunks | 6C.13b optional; colloquial trigram minimum |

---

## Sign-off criteria

Phase 6C.13 is **complete** when:

1. pgvector ANN serves 100% semantic queries in production
2. G1 golden set passes with precision@4 ≥ 0.85
3. `retrievalMetadataJson` on all RAG usage logs
4. Cross-encoder rerank enabled on `prescription-v1`
5. Post-LLM T1 validation blocks uncited dosage on prescription path
6. Colloquial expansion active for farmer-chat with MRR@10 ≥ 0.75
7. Fusion and medical thresholds documented with vet-approved calibration report
8. Admin eval UI operational for ops team
9. Updated verification report shows retrieval ≥ 88, production readiness ≥ 85

---

*Plan authored: 2026-05-31 — Phase 6C.13 Veterinary RAG Optimization (architecture only, no implementation)*
