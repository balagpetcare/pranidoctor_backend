# Phase 6C — Veterinary RAG Engine Verification Report

**Project:** Prani Doctor  
**Role:** Principal Retrieval QA Auditor  
**Date:** 2026-05-31  
**Scope:** `src/modules/ai/knowledge-retrieval/`, `AiRouterEngine.executeEmbedding`, `AiAssistantService.chat`, `AiKnowledgeService.retrieveForRag`  
**Reference plan:** `docs/plans/phase-6c-rag-architecture.md`  
**Depends on:** Phase 6B ingestion QA — `docs/reports/phase-6b-knowledge-verification.md`

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **PASS WITH CONDITIONS** |
| **Pilot RAG readiness** | **Yes** — lexical hybrid + confidence gates operational |
| **Production-scale semantic RAG** | **Conditional** — in-memory vector scan, no pgvector ANN |
| **TypeScript (`npm run typecheck:ai`)** | **0 errors** |
| **Unit tests (`npx vitest run src/modules/ai`)** | **285 passed** (40 files) |
| **RAG module tests** | **14 passed** (2 files) |

The Veterinary RAG Engine implements profile-driven hybrid retrieval, `KnowledgeContextPack` assembly, citation/grounding injection, and fail-closed medical confidence routing. Core safety controls work as designed. Semantic accuracy at scale depends on embedding provider availability and index maturity (6C.8).

---

## Methodology

1. **Static code audit** — traced `KnowledgeRetrievalService.retrieve()` through keyword, semantic, fusion, gating, pack build, and `AiAssistantService` injection/block paths.
2. **Control verification** — validated confidence router decision matrix against Phase 6C architecture gates.
3. **Unit test execution** — fusion, routing, citations, locale scoring, structured facts, full AI module suite.
4. **Integration path review** — publish → embed schedule, chat fail-closed, legacy `retrieveForRag` wrapper.
5. **Safe remediation** — applied non-breaking fixes during audit (see § Remediation applied).

---

## Validation matrix

| Domain | Status | Score | Evidence |
|--------|--------|-------|----------|
| Retrieval accuracy | **PASS WITH GAPS** | 3/5 | Lexical + hybrid fusion; semantic limited by scan cap |
| Citation integrity | **PASS** | 4/5 | Inline tokens + slug fallback; source registry when `sourceId` set |
| Context quality | **PASS** | 4/5 | `KnowledgeContextPack`, grounding instruction, structured facts |
| Ranking quality | **PASS WITH GAPS** | 3/5 | Weighted fusion + domain boost; no cross-encoder re-ranker |
| Hallucination controls | **PASS** | 4/5 | Grounding rules, fail-closed medical, prescription gates |
| Low-confidence behavior | **PASS** | 4/5 | BLOCK / PROCEED_DEGRADED / PROCEED matrix enforced |
| Multi-language retrieval | **PASS WITH GAPS** | 3/5 | BN-first excerpts + locale lexical boost; no colloquial map |

**Weighted overall:** **3.6 / 5** — suitable for controlled farmer-chat pilot with vet escalation on block.

---

## 1. Retrieval accuracy

### Expected

Hybrid lexical + semantic retrieval over **published chunks** with evidence/confidence gates and domain-aware ranking.

### Observed

| Check | Result |
|-------|--------|
| Chunk-level retrieval (not whole entry) | ✅ |
| Keyword search on `contentBn`, `contentEn`, titles, `searchText` | ✅ |
| Semantic cosine on `AiKnowledgeEmbeddingChunk.vectorJson` | ✅ |
| Hybrid weighted fusion (0.40 lexical / 0.45 semantic default) | ✅ |
| Domain priority boost in fusion | ✅ |
| Profile `domainPriority` filter on search planes | ✅ |
| Species filter when provided | ✅ |
| Stale embedding version excluded | ✅ (audit fix: `entryVersion === entry.version`) |
| pgvector ANN / full corpus semantic recall | ❌ In-memory scan max 2000 vectors |
| Colloquial BN query expansion | ❌ Not implemented |
| Re-ranker (cross-encoder) | ❌ 6C.8 pending |

### Retrieval modes

```
lexical only  → no embeddings / semantic miss
semantic only → lexical miss, embeddings hit
hybrid        → both planes contribute
```

**Verdict:** **PASS WITH GAPS** — accurate for indexed published content at pilot scale; semantic recall degrades beyond 2000 most-recent vectors.

---

## 2. Citation integrity

### Expected

Every retrieved chunk carries traceable inline citation; human-readable BN/EN blocks; source attribution when registry-linked.

### Observed

| Check | Result |
|-------|--------|
| `extractInlineCitation` from `chunk.citationJson.inline` | ✅ |
| Fallback `[sourceKey]` or `[slug]` | ✅ |
| `buildCitationBlock` includes inline token in excerpt line | ✅ |
| `buildSourceCitations` with `sourceId` + `sourceKey` | ✅ |
| Slug fallback when no `sourceId` | ✅ (audit fix) |
| Per-chunk distinct page/section locators | ❌ Shared entry-level citation |
| License template in human citation block | ❌ Not wired in pack (6B metadata only) |

### Sample citation block shape

```
তথ্যসূত্র (শুধুমাত্র নিচের তথ্য ব্যবহার করুন):
[1] [dls-manual] Title — [dls-manual] Title
    "[dls-manual] excerpt..."
```

**Verdict:** **PASS** — machine traceability adequate for pilot; page-level audit requires 6B span propagation.

---

## 3. Context quality

### Expected

Typed `KnowledgeContextPack` with chunks, entities, structured facts, token-budget-aware citation block, grounding instruction.

### Observed

| Check | Result |
|-------|--------|
| `KnowledgeContextPack` typed output | ✅ |
| `chunks[]`, `entities[]`, `structuredFacts[]` | ✅ |
| `citationBlock` + `groundingInstruction` | ✅ |
| `confidenceSummary`, `excludedCount`, `embeddingCoverage` | ✅ |
| Latency breakdown in `scores` | ✅ |
| Empty chunk bodies skipped in pack assembly | ✅ (audit fix) |
| Token budget engine (30/50/20 split) | ⚠️ Excerpt cap 280 chars; no dynamic budget trim |
| `graphHints` | ❌ Empty (graph expansion not implemented) |

**Verdict:** **PASS** — context is structured and LLM-ready; advanced token budgeting deferred.

---

## 4. Ranking quality

### Expected

Fused scores with domain, locale, evidence, confidence weighting; max chunks per entity; profile limits.

### Observed

| Check | Result |
|-------|--------|
| Hybrid fusion dedupe by `{entryId, chunkIndex}` | ✅ |
| Domain priority boost (`domainPriorityBoost`) | ✅ |
| `maxChunks`, `maxChunksPerEntity` enforced | ✅ |
| Confidence/evidence gate before selection | ✅ |
| Vet approval filter when `vetApprovedRequired` | ✅ |
| Locale lexical boost (BN +12% when BN wins) | ✅ (audit fix) |
| Cross-encoder re-rank top-20 | ❌ |
| Recency / `lastReviewedAt` rank feature | ❌ |

### Fusion formula (implemented)

```
fusedScore = (wLex × normLex + wSem × normSem) × (1 + 0.2 × domainBoost)
```

**Verdict:** **PASS WITH GAPS** — deterministic ranking suitable for pilot; re-ranker would improve precision@4.

---

## 5. Hallucination controls

### Expected

Grounding contract in prompt; fail-closed for high-risk tasks; structured facts for dosages; no LLM on BLOCK.

### Observed

| Check | Result |
|-------|--------|
| `buildGroundingInstruction` BN/EN rules | ✅ |
| "Use ONLY Reference" contract | ✅ |
| `AiAssistantService` skips LLM on `BLOCK` | ✅ |
| `respondBlocked` with vet redirect message | ✅ |
| Prescription profile requires structured dose facts | ✅ |
| Medical chunk confidence gate | ✅ |
| Output validation (dosage parse vs facts) | ❌ 6D |
| `AiUsageLog.retrievalMetadataJson` | ❌ Not yet wired |

### Grounding injection path

```
KnowledgeRetrievalService.retrieve()
  → pack.groundingInstruction
  → AiAssistantService enriched user message (pre-LLM)
  → AiVeterinaryCoreService.chat()
```

**Verdict:** **PASS** — pre-LLM grounding and block path meet Phase 6C safety intent.

---

## 6. Low-confidence behavior

### Decision matrix (verified by unit tests)

| Scenario | Profile | Expected | Actual |
|----------|---------|----------|--------|
| Medical chunk confidence 0.40 | farmer-chat-v1 | **BLOCK** | ✅ |
| Medical chunk confidence 0.70 | farmer-chat-v1 | **PROCEED** | ✅ |
| Prescription, no structured facts | prescription-v1 | **BLOCK** | ✅ |
| Empty pack, failClosed false | farmer-chat-v1 | **PROCEED_DEGRADED** | ✅ |
| Empty pack, failClosed true | prescription-v1 | **BLOCK** | ✅ |
| Partial embedding coverage | farmer-chat-v1 | **PROCEED_DEGRADED** | ✅ |
| Chat assistant on BLOCK | — | No LLM call | ✅ |
| Chat on PROCEED_DEGRADED | — | LLM + caution prefix | ✅ (audit fix) |

### Fail-closed chat response

When `routingDecision.action === 'BLOCK'`, user receives BN/EN safe message, `refused: true`, `humanRedirect: true`, audit action `RETRIEVAL_FAIL_CLOSED`.

**Verdict:** **PASS**

---

## 7. Multi-language retrieval

### Expected

BN-first farmer retrieval; EN doctor parity; locale-aware search boost; bilingual embed text.

### Observed

| Check | Result |
|-------|--------|
| Excerpt locale-primary (`bn` → `contentBn`) | ✅ |
| Parallel excerpt (`excerptEn`) both locales | ✅ (audit fix: EN gets BN parallel) |
| Title locale selection | ✅ |
| Embedding text BN + EN concatenation | ✅ |
| Locale lexical boost in keyword ranker | ✅ (audit fix) |
| `colloquialBn[]` query expansion | ❌ Phase 6A backlog |
| Separate BN/EN vector indexes | ❌ Single bilingual vector |

**Verdict:** **PASS WITH GAPS** — bilingual content supported; colloquial BN recall still lexical-dependent.

---

## Integration verification

| Integration point | Status |
|-------------------|--------|
| `KnowledgePublishWorkflowService` → `scheduleEmbedEntry` | ✅ |
| `AiRouterEngine.executeEmbedding` | ✅ |
| Embedding fallback chain (OpenAI/Gemini/OpenRouter/Anthropic) | ✅ |
| `AiKnowledgeService.retrieveForRag()` → pack wrapper | ✅ Returns `''` on BLOCK |
| `AiAssistantService.chat()` full pack + block | ✅ |
| `AiModule` registers retrieval + embedding services | ✅ |
| Symptom checker via `retrieveForRag` | ⚠️ Empty string on block (no explicit escalate) |

---

## Test evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `knowledge-retrieval.test.ts` | 9 | Pass |
| `knowledge-retrieval.verification.test.ts` | 5 | Pass |
| Full `src/modules/ai` | 285 | Pass |

**Recommended follow-up tests (not blocking pilot):**

- Integration test with mocked Prisma for end-to-end `retrieve()` pack shape
- Golden-set precision@4 eval harness (manual corpus)
- Assistant blocked path session/message assertions

---

## Remediation applied (this audit)

| Issue | Severity | Fix |
|-------|----------|-----|
| No locale boost in keyword ranking | Medium | `lexical-scoring.util.ts` + locale param on keyword search |
| Stale embedding vectors ranked | Medium | Skip when `entryVersion !== knowledgeEntry.version` |
| Empty chunk bodies in pack | Low | Skip chunks with no BN/EN text |
| Missing slug citation when no `sourceId` | Medium | `buildSourceCitations` slug fallback |
| EN locale missing parallel excerpt | Low | `excerptEn` for both locales |
| PROCEED_DEGRADED without caution prefix | Medium | `degradedContextPrefix` in `AiAssistantService` |
| Structured facts path brittle | Low | `resolveStructuredRecord()` helper |
| Verification test coverage thin | Low | `knowledge-retrieval.verification.test.ts` |

---

## Open gaps (not auto-fixed)

| ID | Gap | Risk | Target |
|----|-----|------|--------|
| G1 | In-memory vector scan (2000 cap) | Miss older/relevant chunks | 6C.8 pgvector ANN |
| G2 | No `retrievalMetadataJson` on `AiUsageLog` | Observability gap | 6C.6 follow-up |
| G3 | No colloquial BN query map | Poor farmer recall | 6A lexical upgrade |
| G4 | No re-ranker | Suboptimal precision@4 | 6C.8 |
| G5 | No graph expansion (`graphHints` empty) | Miss related drug/interaction context | 6D |
| G6 | Symptom checker silent on BLOCK | Weak triage grounding signal | 6D |
| G7 | Embedding async fire-and-forget only | No BullMQ retry dashboard | 6C.8 |
| G8 | Cross-model dimension mismatch skips vectors | Partial semantic index | Re-embed sweep ops |

---

## Pilot checklist

Before enabling RAG-grounded farmer chat at scale:

- [ ] Run migrations `20260611120000_ai_phase6b_knowledge_ingestion` + `20260612120000_ai_phase6c_rag_embeddings`
- [ ] Configure at least one embedding provider (OpenAI or Gemini recommended)
- [ ] Publish knowledge entries and confirm `embeddingStatus → READY`
- [ ] Spot-check `KnowledgeRetrievalService.retrieve()` for top farmer queries (BN)
- [ ] Verify BLOCK path returns vet redirect (no LLM tokens consumed)
- [ ] Monitor `RETRIEVAL_FAIL_CLOSED` audit events
- [ ] Manual precision@4 eval on 20-query golden set (target ≥ 0.70 lexical pilot)

---

## Sign-off

| Role | Assessment |
|------|------------|
| **Retrieval QA Auditor** | Core RAG engine **PASS WITH CONDITIONS** |
| **Blockers for pilot** | None (code-level); migration + embed provider required (ops) |
| **Blockers for production semantic scale** | G1, G4, G7 |

**Next recommended action:** Run a 20-query BN golden-set eval after first embed batch; tune `medicalMinConfidence` and fusion weights from measured precision@4.

---

*Report generated: 2026-05-31 — Phase 6C Veterinary RAG Engine QA Audit*
