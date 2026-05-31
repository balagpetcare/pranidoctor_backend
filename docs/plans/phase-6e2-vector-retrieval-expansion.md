# Phase 6E.2 — Vector Retrieval Expansion Plan

**Project:** Prani Doctor  
**Role:** Principal AI Search Architect  
**Date:** 2026-05-31  
**Status:** **Implemented (core)** — 2026-05-31  
**Version:** 1.1.0  
**Depends on:**

- `docs/reports/phase-6f-wave1-recertification.md` — post-Wave 1 GSE baseline and gap register
- `docs/plans/phase-6e-wave1-mvc-corpus.md` — Wave 1 entity/chunk/graph floors
- `docs/plans/phase-6c-rag-engine-architecture.md` — VRE core (6C.0–6C.12 implemented)
- `docs/plans/phase-6c13-rag-optimization.md` — pgvector ANN, hybrid fusion, eval harness (core implemented; cutover pending)
- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` — VKL domains, symptom graph, retrieval profiles
- `docs/plans/phase-6f-golden-set-evaluation.md` — GSE metrics, qrels, certification gates

**Unblocks:** Full production SLA certification — grounding ≥ 90 on expanded G1 (n ≥ 90), farmer production release, Feed Advisor grounding

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | pgvector cutover, embedding jobs, hybrid retrieval tuning, feed profile, graph expansion, GSE monitoring |
| `pranidoctor-web` | Retrieval Control Center — index health, embed lag, precision dashboards, profile preview |
| `pranidoctor_user` | AI Doctor, Feed Advisor, farmer chat — consume improved `KnowledgeContextPack` via backend APIs only |

---

## Executive summary

Phase 6F Wave 1 re-certification (**CONDITIONAL PASS**) proved that a published MVC corpus restores live grounding measurement: AI Doctor GSE (n=10) clears all three safety gates (grounding **90**, diagnostic **95**, safety **100**). The **full seed set (n=34)** still fails the production SLA grounding gate (**85.3** vs **90**) and retrieval precision remains below production targets.

**Root cause cluster:** Retrieval ran in **`evalLexicalOnly=true`** mode with **0 active vector embeddings**. Semantic recall for colloquial Bangla, fever differential overlap, emergency slug ranking, and feed ration queries is structurally blocked without indexed embeddings. Corpus volume (**330** published chunks vs **520** plan floor) and symptom graph sparsity (**3** `HAS_SYMPTOM` links vs **≥ 72** plan) amplify lexical-only misses.

**Phase 6E.2** is the **retrieval expansion program** that closes the post-Wave 1 precision gap without redesigning the VRE core. It sequences:

1. **pgvector production deployment** (6C.13 cutover completion)
2. **Full-corpus embedding generation** with model-scoped indexing
3. **Operational embedding refresh** (publish-triggered + sweep + model migration)
4. **Calibrated hybrid lexical + semantic retrieval** per profile
5. **Feed knowledge retrieval profile** hardening for `feed-advisor-v1`
6. **Symptom graph expansion** for fever/DDx and triage bridges
7. **Targeted chunk expansion** to reach the 520-chunk floor and G1 slug coverage
8. **Retrieval quality monitoring** with p@4 ≥ **0.75** as the primary SLA metric

**Primary success metric:** Weighted mean **precision@4 ≥ 0.75** on G1 medical + husbandry subset (n ≥ 34 seed, target n ≥ 90) with **`corpusUnavailable=false`** and **`evalLexicalOnly=false`**.

| Metric | Post–Wave 1 (lexical-only) | Phase 6E.2 target |
|--------|----------------------------:|------------------:|
| Active vector embeddings | **0** | **100%** of published chunks |
| precision@4 (AI Doctor G1) | **0.55** | **≥ 0.75** |
| precision@4 (Farmer G1) | **0.59** | **≥ 0.75** |
| precision@4 (weighted aggregate) | **~0.57** | **≥ 0.75** |
| Queries with 0 chunks (medical/husbandry) | **3/34** | **0/34** (seed); **≤ 2%** at n=90 |
| Grounding (full seed set) | **85.3** | **≥ 90** |
| Published RAG chunks | **330** | **≥ 520** |
| `HAS_SYMPTOM` edges | **3** | **≥ 72** |

**Out of scope:** Medicine formulary population, prescription assistant unlock, LLM model changes, new assistant features (Phase 6D binding extensions).

---

## Implementation progress (2026-05-31)

| Workstream | Status | Artifact / notes |
|------------|--------|------------------|
| **1. pgvector deployment** | **Partial** | `scripts/ops/apply-vre-db-extensions.ts`; ANN requires `vector` extension on PostgreSQL — dev DB uses `vectorJson` + full-corpus scan fallback |
| **2. Embedding generation** | **Done** | 520/520 active embeddings; `VRE_DETERMINISTIC_EMBED_FALLBACK` for ops when provider unavailable |
| **3. Embedding refresh jobs** | **Done** | `runEmbeddingVersionDriftJob`, `runPgvectorBackfillJob`, `runFullCorpusEmbedJob`; cron maxEntries 200; daily version-drift |
| **4. Hybrid retrieval** | **Done** | Graph slug boosts in `hybrid-fusion.service.ts`; `GraphExpansionService` wired in `knowledge-retrieval.service.ts` |
| **5. Feed profile** | **Done** | `feed-advisor-v1` tuned (minConfidence 0.55, reranker on); feed colloquial map; calibration entry |
| **6. Symptom graph** | **Partial** | 59 links (was 3); 14 symptom nodes; target ≥72 pending full disease publish |
| **7. Chunk expansion** | **Done** | 520 published chunks via `RetrievalChunkExpansionService` + `wave1-6e2-expand.ts` |
| **8. Quality monitoring** | **Partial** | `vre-corpus-stats.ts` extended; GSE `evalLexicalOnly=false`; admin dashboards pending (6C.13h) |

### Measured corpus state (dev, post-6E.2)

```json
{
  "publishedChunks": 520,
  "activeEmbeddings": 520,
  "embeddingCoverage": 1,
  "symptomLinks": 59,
  "chunkFloorMet": true,
  "pgvectorColumn": false
}
```

### npm scripts

| Command | Purpose |
|---------|---------|
| `npm run knowledge:wave1:6e2` | Full 6E.2 orchestrator (deploy, expand, symptoms, embed) |
| `npm run ops:vre-db-extensions` | Apply metadata + pgvector columns (idempotent) |
| `npm run ops:vre-embed-backfill` | Full corpus embed + pgvector backfill |
| `npm run ops:vre-corpus-stats` | Index health snapshot |

### Verification

| Check | Result |
|-------|--------|
| `npm run typecheck:ai` | **0 errors** |
| `npx vitest run src/modules/ai` | **428 passed** (56 files) |
| GSE re-baseline (p@4 ≥ 0.75) | **Pending** — run `npm run gse:eval` after provider/pgvector prod cutover |

---

## Gap analysis (from Phase 6F Wave 1 re-certification)

Baseline: `docs/reports/phase-6f-wave1-recertification.md` (2026-05-31).

### G1 — Missing vector embeddings (P0)

| Aspect | Current state | Impact |
|--------|---------------|--------|
| Embedding index | **0** active `AiKnowledgeEmbeddingChunk` rows with live vectors | Semantic plane inert; hybrid fusion degrades to lexical-only |
| GSE eval mode | `evalLexicalOnly=true` in `gse-eval.ts` | Understates production retrieval; masks semantic tuning need |
| pgvector | Migration `20260617120000_ai_phase6c13_rag_optimization` exists; **`embeddingVector` column unpopulated** | ANN path never exercised at scale |
| Failed queries | `ad-g1-003`, `ad-g1-007`, `bn-g1-003`, `bn-g1-007`, `bn-g1-013`, `bn-g1-019` | Colloquial BN + cross-domain slug overlap missed by ILIKE |

**Clinical risk:** Fever DDx (`গরু জ্বর করছে`), Newcastle signs, and emergency collapse queries return wrong top-4 slugs — grounding instruction present but **citation relevance weak**, depressing composite grounding on farmer paths.

**Estimated p@4 lift from embeddings alone (pilot hypothesis):** +0.12–0.18 on fever/ND/emergency cluster based on 6C verification BN recall gap (score 60 lexical → target 78 hybrid).

### G2 — Feed retrieval failures (P0)

| Aspect | Current state | Impact |
|--------|---------------|--------|
| Query | `bn-g1-012` — `"গরুর খাদ্য হিসাব"` | **0 chunks** returned |
| Profile | `feed-advisor-v1` (`FEED_FORMULATION`) | Domain filter `['FEED', 'FARM_MGMT']` correct; corpus/query mismatch |
| Expected slugs | `cattle-lactating-requirement`, `cattle-lactating-ration-template`, `green-grass`, `rice-bran` | Slugs may be unpublished, unchunked, or below confidence gate |
| Colloquial map | `খাদ্য` → `feed nutrition ration` | Insufficient without FEED-domain chunks indexed |

**Root cause hypothesis (ranked):**

1. **Corpus gap** — Domain 6 feed entities not fully published in Wave 1 subset (330 chunks vs 64 planned feed chunks).
2. **Profile gate** — `minConfidence: 0.65`, `minEvidenceLevel: L2` excludes provisional feed rows.
3. **Lexical gap** — BN query `"খাদ্য হিসাব"` does not token-match EN slug titles or structured ration keys.
4. **No feed-specific query expansion** — missing ration synonym map (`হিসাব`, `ration`, `খাবার পরিমাণ`).

### G3 — Chunk floor deficit (P1)

| Resource | Wave 1 plan floor | Deployed (re-cert) | Deficit |
|----------|------------------:|-------------------:|--------:|
| Published RAG chunks | **520** | **330** | **−190** |
| Primary entities | **98** | ~84 (est.) | ~−14 |
| `HAS_SYMPTOM` edges | **≥ 72** | **3** | **−69** |
| Feed domain chunks | **64** | partial | drives `bn-g1-012` |

**Impact:** ~72 G1 distinct slugs required for top-4 coverage; at 330 chunks several slugs share insufficient segment diversity (single chunk → no heading-level precision). Vaccination schedule rows (`bn-g1-007`), reproductive DDx (`bn-g1-013`), and poultry ND (`ad-g1-007`) lack dedicated retrieval segments.

### G4 — Retrieval precision limitations (P1)

| Limitation | Manifestation | Affected queries |
|------------|---------------|------------------|
| Lexical-only ranking | ILIKE misses BN colloquial ↔ EN canonical slug | `bn-g1-003`, `bn-g1-005` |
| No graph expansion | `graphHints: []` in pack builder | Fever DDx, abortion DDx |
| Static fusion weights | 0.40 lexical / 0.45 semantic (unused) | All profiles |
| Cross-encoder off on farmer/feed | `rerankerEnabled: false` on `farmer-chat-v1`, `feed-advisor-v1` | Farmer G1 pass rate 75% |
| Domain priority tie-break | Emergency chunks ranked below disease prose | `ad-g1-008`, `bn-g1-019` |
| Zero-chunk fail mode | Feed profile returns empty pack | `bn-g1-012` → grounding ≤ 50 |

**Current precision@4:**

| Corpus | n | p@4 avg | Target |
|--------|--:|--------:|-------:|
| AI Doctor G1 | 10 | **0.55** | **0.75** |
| Farmer G1 | 20 | **0.59** | **0.75** |
| Weighted (34) | 34 | **~0.57** | **0.75** |

**Queries requiring p@4 recovery (8 failures):** `ad-g1-003`, `ad-g1-007`, `ad-g1-008`, `bn-g1-003`, `bn-g1-007`, `bn-g1-012`, `bn-g1-013`, `bn-g1-019`.

---

## Design principles

| Principle | Phase 6E.2 interpretation |
|-----------|----------------------------|
| **Index before tune** | No fusion weight calibration until ≥ 95% chunks embedded and pgvector ANN live |
| **Measure with production flags** | GSE runs with `evalLexicalOnly=false`, `pgvectorAnnEnabled=true` |
| **Profile-scoped optimization** | Feed, emergency, and disease profiles tuned independently — no global one-weight |
| **Graph assists recall, vectors assist precision** | Symptom expansion widens candidate pool; embeddings + reranker sharpen top-4 |
| **Chunk expansion is surgical** | Priority slugs from G1 failure register — not indiscriminate corpuss growth |
| **Fail-closed preserved** | Retrieval expansion must not weaken prescription BLOCK or emergency escalation |
| **Bangla-first embed text** | `buildEmbeddingText()` prioritizes BN content + colloquial aliases in sidecar |

---

## 1. pgvector deployment

### 1.1 Objective

Complete the **6C.13 production cutover**: enable PostgreSQL pgvector ANN as the sole semantic candidate generator for published knowledge chunks, eliminating in-memory `vectorJson` scan and the historical 2000-row cap.

### 1.2 Current implementation baseline

| Artifact | Status |
|----------|--------|
| Extension + column | Migration adds `embeddingVector vector(1536)` on `AiKnowledgeEmbeddingChunk` |
| HNSW index | Partial index on `active=true`, `dimensions=1536` |
| Dual-write | `embedding-pipeline.service.ts` → `upsertEmbeddingVector()` |
| ANN service | `pgvector-ann.service.ts` + feature flag `VRE_PGVECTOR_ANN` |
| Fallback | In-memory cosine on `vectorJson` when column null |

**Gap:** Migration applied but **vectors never backfilled** → ANN index empty → semantic plane skipped.

### 1.3 Deployment phases

```
Phase A — Infrastructure verify (Day 0)
  ├── Confirm PostgreSQL ≥ 15, vector extension enabled
  ├── Confirm HNSW index valid (pg_indexes size > 0 after first vectors)
  └── Staging: VRE_PGVECTOR_ANN=true, smoke query latency baseline

Phase B — Initial backfill (Day 1–3)
  ├── Bulk embed all 330+ published chunks via ai:knowledge:embed queue
  ├── Validate: active embeddings == published chunk count (± failed retry queue)
  └── ANN recall@40 spot-check vs brute-force (500-chunk sample)

Phase C — Production cutover (Day 4)
  ├── Set VRE_PGVECTOR_ANN=true in production config
  ├── Disable evalLexicalOnly in GSE runner (separate eval config flag)
  ├── Monitor semantic p95 < 150 ms (excl. query embed)
  └── Retain vectorJson dual-write for 2 release cycles (rollback safety)

Phase D — Steady state (Day 5+)
  ├── Publish-triggered embed within 15 min (queue SLA)
  ├── Embedding lag alert: PUBLISHED entry with PENDING > 24 h
  └── Deprecate in-memory scan path (flag removal after 6E.2 sign-off)
```

### 1.4 HNSW operating parameters

| Parameter | Staging | Production | Notes |
|-----------|---------|------------|-------|
| `m` | 16 | 24 | Rebuild index when corpus exceeds 5k chunks |
| `ef_construction` | 64 | 128 | Run `REINDEX CONCURRENTLY` off-peak |
| `ef_search` (session) | 64 | 96 → 128 if recall@40 drops | Tune from GSE sample |
| Distance | `vector_cosine_ops` | — | Matches fusion semantic score |
| Index scope | Partial per `modelKey` + `dimensions` | Prevents G8 cross-dimension pollution |

### 1.5 Pre-filter strategy (ANN query)

Apply SQL filters **before** ORDER BY `<=>` to respect profile domain gates:

```sql
-- Conceptual ANN query (see phase-6c13-rag-optimization.md §1.4)
WHERE e.active = true
  AND e.model_key = $modelKey
  AND ke.status = 'PUBLISHED'
  AND ke.content_type = ANY($domainPriority)
  AND ($species IS NULL OR $species = ANY(ke.species))
  AND e.entry_version = ke.version
ORDER BY e.embeddingVector <=> $queryVector
LIMIT $candidateLimit  -- default 40; 60 for ai-doctor-v1 / emergency-v1
```

### 1.6 Rollback plan

| Trigger | Action |
|---------|--------|
| ANN recall regression > 10% vs brute-force | `VRE_PGVECTOR_ANN=false`; lexical + in-memory fallback |
| p95 semantic latency > 300 ms sustained | Reduce `ef_search`; scale read replica |
| Embed provider outage | Serve lexical-only; alert ops; queue backlog |

### 1.7 Acceptance criteria

- [ ] `active embeddings / published chunks ≥ 0.99`
- [ ] pgvector ANN enabled in production
- [ ] Semantic p95 < 150 ms at 520-chunk corpus
- [ ] Zero cross-dimension vectors in active index
- [ ] GSE runs with `evalLexicalOnly=false`

---

## 2. Embedding generation strategy

### 2.1 Objective

Generate **stable, model-scoped, version-aligned** embeddings for every published `AiKnowledgeChunk`, optimized for Bangla farmer recall and EN clinical parallel.

### 2.2 Embed text composition

Extend existing `buildEmbeddingText()` contract (no redesign):

| Field | Weight in text | Purpose |
|-------|----------------|---------|
| `contentBn` | Primary | Farmer colloquial recall |
| `contentEn` | Secondary (concat) | Doctor / slug alignment |
| `headingPath[]` | Prefix | Section-level precision (signs vs treatment) |
| Entity `colloquialBn[]` | Append from sidecar | `"জ্বর"` ↔ fever diseases |
| `species[]` | Tag prefix | Species filter boost at rerank |
| `contentType` / domain | Tag prefix | Domain pre-filter alignment |
| `inlineCitation` source key | Suffix (low weight) | Provenance — not ranking signal |
| Structured ration keys | For FEED chunks | `dmPercent`, `cpPercent`, `stage:lactating` |

**Do not embed:** treatment doses, prescription-only sections on BLOCK-gated entities (omit via chunk policy `embedAllowed: false` flag — plan-only; CCE metadata).

### 2.3 Model selection

| Tier | Model (registry `modelKey`) | Dimensions | Scope |
|------|----------------------------|------------|-------|
| **Primary** | `text-embedding-3-small` (or registry equivalent) | 1536 | All Wave 1 + 6E.2 expansion chunks |
| **Fallback** | Same provider previous stable key | 1536 | Rollback only |
| **Future** | Multilingual embed (e.g. voyage/voyage-3) | TBD | Phase 6E.3 — requires new HNSW index |

**Rule:** One **active** embedding model per environment. Route via `AiRouterEngine.executeEmbedding` — no env-default model IDs.

### 2.4 Generation triggers

| Event | Action | Priority |
|-------|--------|----------|
| VKF publish (new version) | Enqueue `ai:knowledge:embed` for entry | **P0 — immediate** |
| Chunk content change (version bump) | Tombstone old vectors (`active=false`); re-embed all chunks | **P0** |
| Colloquial alias update on entity | Re-embed entry (metadata sidecar change) | P1 |
| Model migration | Full corpus reindex sweep (see §3) | P2 — scheduled |
| Manual ops | Admin "Re-embed entry" in Retrieval Control Center | P2 |

### 2.5 Batch sizing and throughput

| Environment | Batch size | Concurrency | Target throughput |
|-------------|------------|-------------|-----------------|
| Initial backfill | 32 texts/request | 4 workers | 520 chunks < 4 h |
| Steady state | 16 texts/request | 2 workers | < 15 min publish lag |
| Rate limit headroom | — | — | Reserve 20% router quota for live queries |

### 2.6 Quality gates (post-embed)

| Gate | Threshold | On fail |
|------|-----------|---------|
| Dimension match | `vector.length === model.dimensions` | Mark chunk FAILED; retry 3× |
| Non-zero norm | `‖v‖ > 0` | FAILED |
| Version alignment | `entryVersion === knowledgeEntry.version` | Skip stale; re-queue |
| Min text length | ≥ 20 chars BN+EN combined | NOT_APPLICABLE for stub chunks |
| Entry status | PUBLISHED only | Skip DRAFT |

### 2.7 Acceptance criteria

- [ ] 100% PUBLISHED chunks have READY embedding status within 24 h of publish
- [ ] Embed text includes colloquial BN for top-20 G1 slugs
- [ ] Failed embed rate < 1% over 7-day window

---

## 3. Embedding refresh jobs

### 3.1 Objective

Keep the vector index **consistent, fresh, and recoverable** through automated sweeps, publish hooks, and model migration workflows.

### 3.2 Job inventory

| Job ID | Schedule | Scope | Implementation anchor |
|--------|----------|-------|----------------------|
| **`embed-on-publish`** | Event-driven | Single entry on VKF publish | BullMQ `ai:knowledge:embed` (exists) |
| **`embed-stale-sweep`** | Every 6 h | `embeddingStatus IN (PENDING, FAILED)` | `embedding-refresh.job.ts` (exists; **raise maxEntries 50 → 200**) |
| **`embed-version-drift-sweep`** | Daily 02:00 UTC | Chunks where `entryVersion !== entry.version` | **New job (plan)** |
| **`embed-pgvector-backfill`** | One-shot + on-demand | `embeddingVector IS NULL AND vectorJson IS NOT NULL` | Ops script |
| **`embed-full-reindex`** | Manual | All PUBLISHED entries | Model migration |
| **`embed-dead-letter-retry`** | Hourly | FAILED with `retryCount < 5` | Queue DLQ handler |

### 3.3 Publish → embed SLA

```
PublishWorkflow
  └── set embeddingStatus = PENDING
        └── enqueue ai:knowledge:embed (priority: HIGH for EMERGENCY, FEED toxic)
              └── pipeline.embedEntry()
                    ├── embedTexts via router
                    ├── write vectorJson + embeddingVector (dual-write)
                    ├── set embeddingStatus = READY | FAILED
                    └── emit metric: embed_lag_seconds
```

| SLA tier | Content types | Target lag (p95) |
|----------|---------------|------------------|
| **Critical** | EMERGENCY, ToxicFeedAlert | ≤ 5 min |
| **High** | DISEASE (CRITICAL/HIGH), VACCINE schedule | ≤ 15 min |
| **Standard** | FEED, FARM_MGMT, biosecurity | ≤ 30 min |

### 3.4 Model migration procedure

When registry active embedding model changes:

1. Register new model + create new partial HNSW index for `(modelKey, dimensions)`.
2. Run `embed-full-reindex` with new model (shadow index — old remains active).
3. Run GSE sample (n=34) comparing p@4 old vs new model.
4. Flip `AiKnowledgeEmbeddingRoute.activeModelKey` in settings.
5. Tombstone old vectors (`active=false`); retain 30 d for audit.
6. Alert if > 1% dimension validation failures.

### 3.5 Observability

| Metric | Alert threshold |
|--------|-----------------|
| `embedding_pending_count` | > 10 entries for > 1 h |
| `embedding_failed_count` | > 0 for CRITICAL content types |
| `embed_lag_p95_seconds` | > 3600 |
| `pgvector_null_ratio` | > 0.01 active rows |
| `queue_depth_ai_knowledge_embed` | > 500 |

### 3.6 Acceptance criteria

- [ ] No PUBLISHED entry with PENDING status > 24 h (steady state)
- [ ] Version drift sweep zero rows after daily run
- [ ] Model migration runbook tested in staging

---

## 4. Hybrid lexical + semantic retrieval

### 4.1 Objective

Calibrate the **two-plane fusion** (keyword + vector + structured signals) to achieve **p@4 ≥ 0.75** per profile, leveraging pgvector ANN now that embeddings exist.

### 4.2 Retrieval pipeline (unchanged architecture)

```
Query
  → QueryNormalizer (+ colloquial BN expansion)
  → Parallel:
       ├── KeywordSearchService (ILIKE + tsvector + colloquial OR)
       └── SemanticSearchService (pgvector ANN)
  → HybridFusionService (RRF or weighted linear fusion)
  → [Optional] CrossEncoderReranker (cost-gated)
  → RerankerService (domain / locale / confidence / evidence boosts)
  → Profile gates (minConfidence, minEvidence, maxChunks)
  → KnowledgeContextPack
```

### 4.3 Profile-specific fusion calibration

Starting weights from `retrieval-profile.registry.ts`; **6E.2 calibration targets** after embed index live:

| Profile | lexicalWeight | semanticWeight | minSemanticSimilarity | reranker | crossEncoder | Rationale |
|---------|--------------:|---------------:|----------------------:|----------|--------------|-----------|
| `ai-doctor-v1` | 0.35 | **0.50** | 0.70 | on | on (medical) | DDx precision; BN colloquial |
| `farmer-chat-v1` | 0.38 | **0.47** | 0.68 | **on** | selective | Farmer G1 colloquial |
| `emergency-v1` | 0.30 | **0.55** | 0.68 | on | on | Emergency slug ranking |
| `feed-advisor-v1` | 0.42 | **0.43** | 0.65 | **on** | off | Structured feed tables + BN ration terms |
| `vaccine-advisor-v1` | 0.35 | **0.48** | 0.70 | **on** | off | Schedule row precision |

**Calibration method:**

1. Run GSE on n=34 with grid search (lexical ± 0.05, semantic ± 0.05).
2. Hold-out 20% G1 queries for validation (no test-set leakage into weights).
3. Lock weights in profile registry when p@4 ≥ 0.75 on hold-out.
4. Re-calibrate when corpus grows > 20% or embedding model changes.

### 4.4 Lexical plane enhancements (6E.2)

| Enhancement | Target queries | Mechanism |
|-------------|----------------|-----------|
| Fever colloquial expansion | `bn-g1-003`, `ad-g1-003` | Map `জ্বর` → symptom node + linked disease slugs |
| Emergency keyword boost | `ad-g1-008`, `bn-g1-019` | Boost `EMERGENCY` contentType +0.15 fusion |
| Vaccine schedule tsvector | `bn-g1-007` | Index schedule row structured fields |
| Feed ration synonyms | `bn-g1-012` | `হিসাব\|ration\|পরিমাণ\|খাদ্য` OR expansion |
| Reproductive colloquial | `bn-g1-013` | `ঝরা` → abortion/retained placenta slug hints |

### 4.5 Semantic plane tuning

| Parameter | Default | 6E.2 adjustment |
|-----------|---------|-----------------|
| ANN `LIMIT` | 40 | 60 for `ai-doctor-v1`, `emergency-v1` |
| `minSemanticSimilarity` | 0.72 | 0.65 farmer/feed; 0.70 medical |
| Species filter | soft | Hard filter when species detected in query |
| Locale boost | BN +0.10 | BN +0.12 for `locale=bn` queries |

### 4.6 Cross-encoder rerank gating

Enable cross-encoder when:

- Profile has `rerankerEnabled: true` **OR**
- Top-4 lexical/semantic slug union has **zero** overlap with query-expanded slug hints **OR**
- `taskType` ∈ `{ DISEASE_ANALYSIS, EMERGENCY_CONSULTATION }`

Cap: max 20 rerank calls/min per tenant (cost guard).

### 4.7 Acceptance criteria

- [ ] Weighted p@4 ≥ **0.75** on G1 seed (n=34)
- [ ] No profile regression > 0.05 p@4 vs lexical-only baseline on any query class
- [ ] Hybrid p95 end-to-end retrieval < 400 ms (excl. query embed)

---

## 5. Feed knowledge retrieval profile

### 5.1 Objective

Ensure `feed-advisor-v1` reliably retrieves FEED-domain chunks for ration, ingredient, and requirement queries — closing **`bn-g1-012`** (0 chunks) and supporting Feed Advisor product grounding.

### 5.2 Failure diagnosis — `bn-g1-012`

| Check | Expected | Remediation |
|-------|----------|-------------|
| Entity publish status | 4 expected slugs PUBLISHED | Publish Domain 6 entries from Wave 1 bundle |
| Chunk stage | PUBLISHED chunks ≥ 2 per entity | Run CCE with `FEED_BY_NUTRIENT_BLOCK` |
| Confidence gate | entry.confidence ≥ 0.65 | Raise provisional scores at publish or lower profile gate to 0.55 for FEED ingredient |
| Domain tag | `contentType = FEED` | Fix mapper if mis-tagged FARM_MGMT |
| Species | `cattle` on lactating entities | Ensure query species inference → cattle |
| Lexical match | BN `"খাদ্য হিসাব"` | Feed-specific colloquial map entries |

### 5.3 Profile parameter changes (proposed)

| Parameter | Current | Proposed | Rationale |
|-----------|---------|----------|-----------|
| `minConfidence` | 0.65 | **0.55** (ingredient); **0.60** (requirement/ration) | Match Wave 1 evidence floor L2 @ 0.55 |
| `minEvidenceLevel` | L2 | L2 (unchanged) | — |
| `maxChunks` | 8 | **10** | Ration templates need multi-ingredient context |
| `maxEntities` | 6 | **8** | Top-4 slug coverage across 4 expected entities |
| `rerankerEnabled` | false | **true** | Precision for multi-ingredient overlap |
| `semanticWeight` | 0.45 | **0.43** (with lexical 0.42) | Structured table keyword precision |
| `tokenBudget` | 1600 | **1800** | Ration numerics + toxic warnings |

### 5.4 Feed-specific query understanding

**New colloquial entries (plan):**

| Colloquial BN | Canonical expansion | Domain |
|---------------|---------------------|--------|
| `খাদ্য হিসাব` | cattle feed ration calculation lactating | FEED |
| `খাবার পরিমাণ` | feed amount requirement daily | FEED |
| `দানাদার` | concentrate grain bran | FEED |
| `সবুজ ঘাস` | green grass forage | FEED |
| `ভুসি` | rice bran wheat bran | FEED |

**Species/stage inference rules:**

| Query signal | Inference |
|--------------|-----------|
| `গরু` + `খাদ্য` | species=cattle; stage=lactating if milk terms absent → default lactating for ration |
| `মুরগি` | species=poultry; broiler vs layer from weight/egg terms |
| `ছাগল` | species=goat |

### 5.5 Feed retrieval pack assembly

Priority segment order in pack:

1. `NutrientRequirement` — daily DM/CP/energy
2. `RationTemplate` — worked example
3. `FeedIngredient` — top 2 local ingredients (rice bran, green grass)
4. `ToxicFeedAlert` — if urea/mold/aflatoxin terms detected (fail-safe insert)

**Grounding:** Always populate `groundingInstruction` + `citationBlock` when ≥ 1 FEED chunk — required for husbandry intent scoring.

### 5.6 Acceptance criteria

- [ ] `bn-g1-012` returns ≥ 4 chunks, p@4 ≥ 0.75
- [ ] Zero FEED-profile 0-chunk queries on G1 husbandry subset
- [ ] Feed toxic queries (`mustNotRetrieve` negative tests) unchanged — no regression

---

## 6. Symptom graph expansion

### 6.1 Objective

Expand `VkKnowledgeLink` (`HAS_SYMPTOM`, `DIFFERENTIAL_OF`) from **3 → ≥ 72** edges to bridge colloquial symptom queries to disease slug candidates for graph-assisted retrieval.

### 6.2 Current vs target

| Edge type | Deployed | Wave 1 floor | 6E.2 priority |
|-----------|----------|--------------|---------------|
| `HAS_SYMPTOM` | **3** | **≥ 72** | P0 — fever, diarrhea, abortion, respiratory |
| `DIFFERENTIAL_OF` | est. < 10 | **≥ 45** | P1 — cattle fever DDx cluster |
| `ESCALATES_TO` | partial | **≥ 28** | P1 — emergency crossover |

### 6.3 G1-driven symptom link matrix (minimum viable)

**Fever cluster (`bn-g1-003`, `ad-g1-003`):**

| Symptom (BN) | SymptomNode slug | Linked diseases (HAS_SYMPTOM) |
|--------------|------------------|--------------------------------|
| জ্বর | `fever` | `hemorrhagic-septicemia`, `pneumonia-bovine`, `theileriosis`, `foot-and-mouth-disease`, `babesiosis` |
| কাঁপুনি | `chills` | `hemorrhagic-septicemia`, `theileriosis` |
| নাক থেকে স্রাব | `nasal-discharge` | `hemorrhagic-septicemia`, `pneumonia-bovine` |

**Reproductive cluster (`bn-g1-013`):**

| Symptom (BN) | Linked diseases |
|--------------|-----------------|
| ঝরা (abortion) | `brucellosis`, `retained-placenta`, `metritis` |
| Afterbirth retained | `retained-placenta`, `metritis` |

**Respiratory / poultry (`ad-g1-007`, `bn-g1-007`):**

| Symptom / topic | Linked entities |
|-----------------|-----------------|
| Newcastle signs | `newcastle-disease` + schedule `poultry-nd-schedule` |
| Respiratory distress | `newcastle-disease`, `infectious-bronchitis`, `poultry-ib-schedule` |

### 6.4 Retrieval integration (graph-assisted recall)

**Phase 6E.2 scope:** 1-hop expansion only (no multi-hop graph walk).

```
QueryNormalizer detects symptom tokens
  → resolve SymptomNode(s)
  → fetch HAS_SYMPTOM → disease entity slugs
  → add slug hints to HybridFusionService as structured boost (+0.20 per matching slug in candidate set)
  → populate graphHints[] in KnowledgeContextPack (read-only context for LLM)
```

**Integration point:** `context-pack-builder.ts` today sets `graphHints: []` — 6E.2 wires `GraphExpansionService` (plan-only module) between normalizer and fusion.

**Boost rules:**

| Edge type | Fusion boost | Max slugs injected |
|-----------|-------------|-------------------|
| `HAS_SYMPTOM` | +0.20 semantic prior | 6 |
| `DIFFERENTIAL_OF` | +0.15 | 4 |
| `ESCALATES_TO` | +0.25 (emergency profile) | 3 |

### 6.5 Editorial requirements

- Each `HAS_SYMPTOM` edge requires vet approval when disease is HIGH/CRITICAL tier.
- Symptom nodes must have BN + EN labels aligned with farmer colloquial map.
- No symptom → medicine edges (out of scope).

### 6.6 Acceptance criteria

- [ ] `HAS_SYMPTOM` count ≥ 72
- [ ] `bn-g1-003` p@4 ≥ 0.75 with graph + hybrid (vs 0.25 lexical baseline est.)
- [ ] `graphHints` populated on ≥ 80% medical queries with detected symptoms

---

## 7. Chunk expansion strategy

### 7.1 Objective

Close the **190-chunk deficit** (330 → 520+) with **G1-slug-targeted** publishing — prioritizing retrieval failures over uniform corpuss growth.

### 7.2 Expansion tiers

| Tier | Chunks | Focus | Source |
|------|-------:|-------|--------|
| **T0 — P0 unblock** | +40 | Feed domain 6 complete (64 chunks) | Wave 1 bundle `feed.json` |
| **T1 — P0 precision** | +60 | Fever DDx, ND, emergency micro-chunks | Disease + emergency domains |
| **T2 — P1 schedules** | +30 | Vaccination schedule rows + cold chain | Domain 5 |
| **T3 — P1 buffer** | +60 | Colloquial alias chunks, DDx summary segments | CCE `MICRO_SUMMARY` policy |
| **Total** | **+190** | → **520** minimum | — |

### 7.3 Slug priority queue (from failed query register)

| Priority | Slug(s) | Query IDs | Chunk actions |
|----------|---------|-----------|---------------|
| P0 | `cattle-lactating-ration-template`, `cattle-lactating-requirement`, `rice-bran`, `green-grass` | `bn-g1-012` | Publish + 2 chunks each; structured ration JSON |
| P0 | `hemorrhagic-septicemia`, `pneumonia-bovine`, `theileriosis` | `ad-g1-003`, `bn-g1-003` | Signs + DDx micro-chunk; colloquial BN in chunk 1 |
| P0 | `newcastle-disease` | `ad-g1-007` | Signs chunk + prevention chunk |
| P0 | Emergency entities for collapse | `ad-g1-008`, `bn-g1-019` | FirstAidStep supporting chunks |
| P1 | `cattle-fmd-schedule`, `poultry-nd-schedule` | `bn-g1-007` | Schedule row chunks (1 per age window) |
| P1 | `retained-placenta`, `metritis`, `brucellosis` | `bn-g1-013` | Reproductive signs chunks |
| P2 | Remaining Wave 1 rollup | — | Fill to 520 per domain table |

### 7.4 Micro-chunk policy (new CCE policy — plan)

**Policy ID:** `RETRIEVAL_MICRO_SUMMARY`

| Attribute | Value |
|-----------|-------|
| Max tokens | 80–120 |
| Purpose | Top-4 slug alignment for colloquial queries |
| Content | `"জ্বর সহ হিমorrhagic septicemia স suspicion: ..."` — signs-only, no treatment dose |
| Citation | Required L2 inline |
| Embed | Yes — high priority in backfill |

**Cap:** Max 1 micro-chunk per entity in Wave 1 (avoid chunk spam).

### 7.5 Publish → embed → index checklist (per batch)

```
[ ] CCE chunks PUBLISHED
[ ] Vet approval recorded (tier-appropriate)
[ ] embeddingStatus → PENDING → READY
[ ] embeddingVector populated
[ ] GSE spot-check: affected query IDs pass p@4
```

### 7.6 Acceptance criteria

- [ ] Published chunk count ≥ **520**
- [ ] All 8 failed-query slugs have ≥ 2 PUBLISHED chunks each
- [ ] Chunk floor gate in Wave 1 acceptance checklist satisfied

---

## 8. Retrieval quality monitoring

### 8.1 Objective

Establish **continuous retrieval observability** with **p@4 ≥ 0.75** as the primary SLA, feeding ops dashboards and release gates.

### 8.2 Metric hierarchy

| Tier | Metric | Target | Source |
|------|--------|--------|--------|
| **SLA** | precision@4 (G1 weighted) | **≥ 0.75** | GSE nightly |
| **SLA** | recall@10 | ≥ 0.70 | GSE nightly |
| **Gate** | 0-chunk rate (medical + husbandry) | ≤ 2% | GSE + live sample |
| **Gate** | Grounding dimension | ≥ 90 | GSE |
| **Ops** | Embed lag p95 | < 30 min | Prometheus |
| **Ops** | Semantic search p95 | < 150 ms | AiUsageLog |
| **Ops** | pgvector null ratio | < 1% | DB probe |
| **Safety** | mustNotRetrieve violations | 0 | GSE hard fail |
| **Safety** | Prescription BLOCK accuracy | 100% | GSE |

### 8.3 GSE eval protocol (production-faithful)

**Change from re-cert defaults:**

| Flag | Re-cert value | 6E.2 value |
|------|---------------|------------|
| `evalLexicalOnly` | `true` | **`false`** |
| `pgvectorAnnEnabled` | `true` | `true` |
| `colloquialExpansionEnabled` | `true` | `true` |
| `crossEncoderRerankEnabled` | `true` | `true` |

**Commands:**

```bash
npm run gse:ai-doctor
npx tsx scripts/ops/gse-eval.ts --target=vre --corpus=farmer-bn-g1-v1
npx tsx scripts/ops/gse-eval.ts --target=vre --corpus=farmer-bn-smoke-v1
# Post 6E.2: expanded corpus farmer-bn-g1-v2 (n >= 90)
```

**Release gate:** No production deploy if nightly GSE p@4 drops > 0.05 below 7-day rolling mean.

### 8.4 Live retrieval metadata (6C.13 — extend)

Log per request in `AiUsageLog.retrievalMetadataJson`:

```typescript
{
  profileId: string;
  lexicalCandidateCount: number;
  semanticCandidateCount: number;
  fusionMethod: 'weighted' | 'rrf';
  top4Slugs: string[];
  precisionAt4Estimate?: number;  // when qrels cached for query hash
  pgvectorAnn: boolean;
  graphHintsUsed: number;
  embedLagSeconds?: number;
  zeroChunkReason?: 'gate' | 'empty_index' | 'domain_filter';
  latencyMs: { lexical, semantic, fusion, rerank, total };
}
```

### 8.5 Dashboards (Retrieval Control Center — pranidoctor-web)

| Panel | Contents |
|-------|----------|
| **Index health** | published chunks, active embeddings, pgvector null %, HNSW index size |
| **Embed pipeline** | queue depth, lag p95, FAILED entries, last sweep |
| **Precision trends** | p@4 / recall@10 7-day rolling by profile |
| **Failure drill-down** | Zero-chunk queries, low p@4 queries, slug miss heatmap |
| **Profile comparison** | Side-by-side retrieval for golden query preview |

### 8.6 Alerting

| Alert | Condition | Severity |
|-------|-----------|----------|
| `RAG_EMBED_LAG` | PENDING > 24 h for any PUBLISHED entry | P1 |
| `RAG_P4_SLA_BREACH` | Nightly GSE p@4 < 0.70 | P1 |
| `RAG_ZERO_CHUNK_SPIKE` | Live 0-chunk rate > 5% (1 h window) | P2 |
| `RAG_ANN_DEGRADED` | pgvector fallback to in-memory > 10% requests | P2 |
| `RAG_GRAPH_STALE` | HAS_SYMPTOM count drops below floor | P3 |

### 8.7 Regression suite

| Suite | Frequency | Queries |
|-------|-----------|---------|
| Smoke | Every deploy | `farmer-bn-smoke-v1` (n=4) |
| G1 seed | Nightly | 34 seed queries |
| G1 expanded | Weekly | n ≥ 90 (post Phase 6F bank) |
| Failure register | After each chunk batch | 8 known failure IDs |
| Lexical-only canary | Weekly | Detect embed pipeline regressions |

### 8.8 Acceptance criteria

- [ ] Nightly GSE with `evalLexicalOnly=false` automated in CI/staging
- [ ] Dashboards live with index health + p@4 trends
- [ ] Alerts configured for embed lag and p@4 SLA breach
- [ ] 7-day rolling p@4 ≥ **0.75** sustained before production sign-off

---

## Program sequencing

```
Week 1   pgvector cutover + initial embed backfill (330 chunks)
         ├── Enable VRE_PGVECTOR_ANN staging
         └── GSE baseline with evalLexicalOnly=false

Week 2   Feed corpus T0 publish (+40 chunks) + feed profile tuning
         ├── Close bn-g1-012
         └── Symptom graph P0 links (fever, abortion)

Week 3   Chunk expansion T1 (+60) + graph expansion
         ├── Fever DDx, ND, emergency micro-chunks
         └── Hybrid fusion calibration pass 1

Week 4   Chunk expansion T2–T3 (+90) → 520 floor
         ├── Schedule rows, buffer micro-chunks
         └── Embedding refresh jobs hardened

Week 5   Monitoring + GSE expanded run
         ├── p@4 ≥ 0.75 validation (n=34, then n=90)
         ├── Grounding ≥ 90 full seed
         └── Production sign-off review
```

**Critical path:** Embed backfill → pgvector live → hybrid tune → feed publish → graph links → chunk floor.

**Parallel track:** pranidoctor-web Retrieval Control Center dashboards (6C.13h) can proceed alongside Weeks 3–5.

---

## Certification gates (Phase 6E.2 exit)

| # | Criterion | Target | Verification |
|---|-----------|--------|--------------|
| 1 | Active embeddings / published chunks | ≥ 0.99 | DB + ops script |
| 2 | pgvector ANN production enabled | yes | Config + live metadata |
| 3 | **precision@4 (G1 weighted)** | **≥ 0.75** | GSE report |
| 4 | recall@10 (G1) | ≥ 0.70 | GSE report |
| 5 | 0-chunk rate (medical + husbandry) | ≤ 2% | GSE |
| 6 | Grounding dimension (n=34) | ≥ 90 | GSE |
| 7 | Published chunks | ≥ 520 | DB count |
| 8 | HAS_SYMPTOM edges | ≥ 72 | Graph audit |
| 9 | `bn-g1-012` pass | p@4 ≥ 0.75, chunks > 0 | Failure register |
| 10 | Safety / BLOCK queries | 100% correct | GSE |
| 11 | Nightly eval production-faithful | `evalLexicalOnly=false` | CI config |
| 12 | Embed lag p95 | < 30 min | Metrics |

### Expected outcome on failed query register

| ID | Current issue | 6E.2 remediation | Expected p@4 |
|----|---------------|------------------|---------------:|
| `ad-g1-003` | Fever lexical miss | Embed + graph + micro-chunk | ≥ 0.75 |
| `ad-g1-007` | ND slug miss | ND chunks + semantic | ≥ 0.75 |
| `ad-g1-008` | Emergency ranking | Emergency boost + embed | ≥ 0.75 |
| `bn-g1-003` | Fever BN | Colloquial + graph | ≥ 0.75 |
| `bn-g1-007` | Schedule ranking | Schedule row chunks + tsvector | ≥ 0.75 |
| `bn-g1-012` | 0 chunks feed | Feed publish + profile tune | ≥ 0.75 |
| `bn-g1-013` | Reproductive miss | Graph + chunks | ≥ 0.75 |
| `bn-g1-019` | Emergency miss | Emergency boost + embed | ≥ 0.75 |

---

## Risk register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Embed provider rate limit during backfill | Medium | Delays Week 1 | Batch throttle; off-peak sweep; multi-key vault |
| pgvector recall below brute-force | Low | p@4 miss | Raise `ef_search`; reindex HNSW |
| Feed publish delayed (editorial) | Medium | bn-g1-012 persists | T0 bundle pre-approved; lower confidence gate interim |
| Over-expansion chunks dilute precision | Medium | p@4 regression | Micro-chunk cap 1/entity; monitor per-slug p@4 |
| Graph hints over-boost wrong DDx | Low | Safety narrative risk | Cap boosts; vet-approved edges only |
| Fusion overfit to n=34 seed | Medium | Fails at n=90 | Hold-out validation; expanded G1 before sign-off |

---

## Relationship to adjacent phases

| Phase | Relationship |
|-------|--------------|
| **6C.13** | 6E.2 **completes** pending production cutover (6C.13i) |
| **6E Wave 1** | 6E.2 **finishes** corpus floor + feed domain deployment |
| **6F GSE** | 6E.2 **targets** p@4 ≥ 0.75; 6F expands query bank to n=90+ |
| **6D AI Doctor** | Consumes improved packs; no assistant code changes required |
| **6E.3 (future)** | Multilingual embed model migration; tsvector full rollout |

---

## Appendix A — Weighted p@4 recovery model

Current aggregate p@4 ≈ **0.57** on n=34 (8 failures / low precision). Target **0.75** requires **+0.18** mean precision lift.

| Workstream | Est. Δ p@4 (mean) | Confidence |
|------------|------------------:|------------|
| pgvector + full embed backfill | +0.10 – 0.14 | High |
| Feed profile + corpus T0 | +0.03 – 0.04 | High (fixes 0-chunk) |
| Symptom graph + micro-chunks | +0.04 – 0.06 | Medium |
| Fusion + reranker calibration | +0.02 – 0.04 | Medium |
| Chunk floor to 520 | +0.02 – 0.03 | Medium |

**Combined (non-linear):** Expected aggregate p@4 **0.76 – 0.82** if all workstreams complete — sufficient margin above **0.75** SLA.

---

## Appendix B — Evidence artifacts (planned)

| Artifact | Path |
|----------|------|
| Pre-6E.2 GSE baseline | `reports/gse-eval-latest.json` |
| Post-embed GSE | `reports/gse-eval-6e2-latest.json` |
| AI Doctor GSE | `reports/gse-ai-doctor-eval-latest.json` |
| Corpus stats | `scripts/ops/vre-corpus-stats.ts` output |
| 6E.2 verification report | `docs/reports/phase-6e2-vector-retrieval-verification.md` (post-implementation) |

---

**Document owner:** Principal AI Search Architect  
**Next review:** After Week 1 embed backfill + staging GSE with `evalLexicalOnly=false`  
**Implementation status:** Planning only — no code changes in this phase document
