# Phase 6B.3 — Chunking & Citation Engine Verification Report

**Project:** Prani Doctor  
**Role:** Principal AI Knowledge QA Auditor  
**Date:** 2026-05-31  
**Scope:** `src/modules/ai/knowledge-chunking/`, Prisma CCE models, migration `20260615120000_ai_phase6b3_chunking_citation_engine`, VKF/KIP integration hooks  
**Reference plan:** `docs/plans/phase-6b3-chunking-citation-engine.md`  
**Depends on:** Phase 6B.1 VKF, Phase 6B.2 KIP (`docs/reports/phase-6b2-import-pipeline-verification.md`)

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **PASS WITH CONDITIONS** |
| **Production readiness (VKF chunk path)** | **Yes** — controlled admin rollout with publish gates |
| **Production readiness (6C embedding on versionId keys)** | **Partial** — handoff API ready; embedding pipeline still entry-keyed |
| **TypeScript (`npm run typecheck:ai`)** | **0 errors** |
| **Unit tests (`npx vitest run src/modules/ai`)** | **330 passed** (48 files) |
| **Chunking module tests** | **9 passed** (1 file) |

Phase 6B.3 delivers a version-scoped Chunking & Citation Engine (CCE) that segments VKF content into RAG-ready STAGING chunks, assigns provisional evidence/confidence, attaches per-chunk citations with locators, and promotes immutable PUBLISHED copies on version publish. Core veterinary safety gates (clinical evidence finalization, per-chunk citations for HIGH/CRITICAL) are enforced at publish.

**Weighted readiness score: 4.0 / 5** — suitable for VKF pilot chunking and metadata-enriched retrieval prep; overlap policies, BN/EN alignment edge cases, and 6C version-key migration remain follow-ups.

---

## Methodology

1. **Chunk quality audit** — policy registry, boundary rules, token estimates, empty-body guards  
2. **Citation quality audit** — span/locator mapping, inline tokens, chunk vs version scope  
3. **Evidence assignment audit** — provisional heuristics, vet finalization, append-only history  
4. **Confidence scoring audit** — formula v2 components, provisional cap, profile gates  
5. **Metadata envelope audit** — schema v1 completeness, embed template, filter sidecars  
6. **Integration audit** — KIP post-import, vet approval, VKF publish promotion  
7. **Automated verification** — `npm run typecheck:ai`, `npx vitest run src/modules/ai`  
8. **Safe remediation** — fixes applied during this audit (see § Remediation applied)

---

## Validation matrix

| Domain | Status | Score | Evidence |
|--------|--------|-------|----------|
| Chunk quality | **PASS WITH CONDITIONS** | 4/5 | Domain policies, medicine section split, heading split, structured JSON path |
| Citation quality | **PASS** | 4/5 | Per-chunk locators, headingPath → sectionRef, inline tokens, publish remap |
| Evidence assignment | **PASS** | 4/5 | Provisional ingest, AI-draft L1 cap, vet finalize wired |
| Confidence scoring | **PASS** | 4/5 | Formula v2, 0.65 cap, component breakdown, profile gates |
| Metadata quality | **PASS** | 4/5 | Envelope v1, embed prefix tags, contentHash, publish refresh |

---

## 1. Chunk quality

### Policy registry

| chunkPolicyId | Domain trigger | Status |
|---------------|----------------|--------|
| `MEDICINE_BY_SECTION` | MEDICINE | ✅ dose/indication/withdrawal split |
| `DISEASE_BY_HEADING` | DISEASE | ✅ markdown H2/H3 |
| `PROTOCOL_BY_STEP` | CLINICAL_PROTOCOL | ✅ via heading fallback |
| `EMERGENCY_BY_ACTION` | EMERGENCY | ✅ via heading fallback |
| `VACCINE_BY_SCHEDULE_ROW` | VACCINE | ✅ policy mapped |
| `FEED_BY_NUTRIENT_BLOCK` | FEED | ✅ policy mapped |
| `FARM_MGMT_BY_SECTION` | FARM_MGMT | ✅ policy mapped |
| `REGULATORY_BY_RECORD` | REGULATORY_BD | ✅ structured JSON path |
| `GENERIC_BY_PARAGRAPH` | Fallback | ✅ |

### Verified behaviors

| Check | Result |
|-------|--------|
| Stable `{versionId}:{chunkIndex}` identity | ✅ |
| STAGING created on `processVersion` | ✅ |
| PUBLISHED promoted on publish (copy, not move) | ✅ |
| Token estimate on each chunk | ✅ |
| Empty-body fallback chunk | ✅ (fixed) |
| `chunkPolicyId` persisted on version when unset | ✅ |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| 50-token overlap for narrative policies not implemented | Low | Open — plan §1.5 deferred |
| BN/EN section count mismatch uses index alignment | Medium | Open — misalignment risk when locale section counts differ |
| No `ChunkDiffService` incremental re-chunk | Medium | Open — full rebuild on each `processVersion` |
| Token max cap (512) not enforced | Low | Open |

---

## 2. Citation quality

### Layers implemented

| Layer | Status | Implementation |
|-------|--------|----------------|
| L0 span refs | ✅ | `spanRefsJson` on chunk citations |
| L1 human citation | ✅ | `humanCitationBn/En` via templates |
| L2 inline token | ✅ | `inlineCitationKey` + metadata cache |
| L3 pack attribution | ✅ | `buildRagHandoffPayload` + 6C consumer |

### Verified behaviors

| Check | Result |
|-------|--------|
| Per-chunk citation rows with `chunkId` FK | ✅ |
| `headingPath` → `sectionRef` for chunk-specific locator | ✅ |
| Page ref from span or version citation | ✅ |
| Chunk citations cleared and recreated on re-process | ✅ |
| **Publish remaps `chunkId` STAGING → PUBLISHED** | ✅ (fixed) |
| Version-level citations preserved (`chunkId = null`) | ✅ |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Publish left citations pointing at STAGING chunk IDs | **High** | **Fixed** — remap by `chunkIndex` on promote |
| No citations when version has zero citations | Medium | Open — chunks get `[unknown]` metadata token |
| Multi-source blending not implemented | Low | Open — primary citation only |
| `sourceKeys` used inline token not sourceKey | Medium | **Fixed** |

---

## 3. Evidence assignment

### Model: `VkKnowledgeEvidence`

| Field | Populated | Status |
|-------|-----------|--------|
| `evidenceLevel` | ✅ | L1–L5 |
| `assessmentMethod` | ✅ | INGEST_HEURISTIC / VET_REVIEW |
| `provisional` | ✅ | true until vet finalize |
| `rationaleBn/En` | ✅ | BN-first rationale strings |
| `supersedesEvidenceId` | ✅ | history chain |

### Triggers

| Trigger | Method | Status |
|---------|--------|--------|
| KIP import / `processVersion` | INGEST_HEURISTIC provisional | ✅ |
| Vet `recordApproval` | VET_REVIEW finalize | ✅ (fixed) |
| Publish gate HIGH/CRITICAL | Requires non-provisional | ✅ |

### Heuristic rules verified

| Rule | Result |
|------|--------|
| AI-generated draft → max L1 | ✅ |
| Trust tier ≥ 4 → L1 | ✅ |
| HIGH/CRITICAL finalize → min L2 | ✅ |
| Registration field boost | ✅ |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| Vet approval did not finalize evidence | **High** | **Fixed** — `recordApproval` calls `processVersion({ finalizeEvidence: true })` |
| Every `processVersion` appends new evidence row | Low | By design — append-only audit trail |
| Editorial review evidence path not wired | Medium | Open — EDITORIAL_REVIEW method unused |

---

## 4. Confidence scoring

### Model: `VkKnowledgeConfidence`

| Field | Status |
|-------|--------|
| `score` | ✅ |
| `formulaVersion` v2 | ✅ |
| `componentsJson` breakdown | ✅ (fixed) |
| `provisional` flag | ✅ |
| `meetsProfileGatesJson` | ✅ |
| `computedBy` | ✅ INGEST_PIPELINE / PUBLISH_JOB |

### Formula v2 verification

| Component | Weight | Stored correctly |
|-----------|--------|----------------|
| Evidence level | 0.35 | ✅ `evidenceLevelScore()` |
| Source trust | 0.25 | ✅ `trustTierScore()` |
| Recency | 0.20 | ✅ |
| Review completeness | 0.10 | ✅ |
| Graph connectivity | 0.10 | ✅ default 0 |

| Rule | Result |
|------|--------|
| Provisional cap 0.65 | ✅ |
| CRITICAL blocks farmer-chat profile | ✅ |
| Publish recomputes non-provisional confidence | ✅ (fixed) |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| `componentsJson.evidence` stored final score not component | **Medium** | **Fixed** |
| Publish confidence was placeholder `{ publishPromotion: true }` | **Medium** | **Fixed** — full recompute on promote |
| Graph connectivity always 0 | Low | Open — no graph edges wired |

---

## 5. Metadata quality

### Envelope v1 (`ChunkMetadataEnvelopeV1`)

| Field group | Status |
|-------------|--------|
| Identity (entityId, versionId, chunkIndex, slug) | ✅ |
| Locale (primaryLocale, localeFlags) | ✅ BN-first |
| Clinical filters (species, risk, audience) | ✅ |
| Scoring (evidenceLevel, confidenceScore, provisional) | ✅ |
| Citation cache (inline token, human citations) | ✅ |
| Embed hints (prefixTags, excludeFromEmbedding) | ✅ |
| Retrieval boosts | ✅ |
| `contentHash` | ✅ sha256 BN+EN |

### RAG handoff

| Check | Result |
|-------|--------|
| `buildEmbeddingText` BN-first with cite token | ✅ |
| 8192 char cap | ✅ |
| `buildRagHandoffPayload` on PUBLISHED chunks | ✅ |
| Publish refreshes `provisional: false` on PUBLISHED metadata | ✅ (fixed) |

### Findings

| Finding | Severity | Status |
|---------|----------|--------|
| `trustTierMin` hardcoded to 4 | **Medium** | **Fixed** — from source trust tier |
| `sourceKeys` contained inline token | **Medium** | **Fixed** — uses `sourceKey` |
| STAGING metadata stale after publish | Low | Open — STAGING rows retain provisional snapshot (acceptable) |
| `confidence` not in embed prefixTags | Low | Open — evidence level included, confidence omitted |

---

## 6. Integration & publish gates

### Hooks verified

| Hook | Action | Status |
|------|--------|--------|
| `VersionEngineService` (KIP) | `processVersion` after live import | ✅ |
| `KnowledgeFoundationService.recordApproval` | finalize evidence + re-chunk | ✅ |
| `KnowledgeFoundationService.publishVersion` | chunk + promote | ✅ |

### Publish gate checklist

| Gate | Enforced |
|------|----------|
| STAGING chunks exist | ✅ |
| HIGH/CRITICAL per-chunk citations | ✅ |
| HIGH/CRITICAL non-provisional evidence | ✅ |
| Citation trust rules (6B.1) | ✅ via foundation |

---

## 7. Test coverage

| File | Tests | Focus |
|------|------:|-------|
| `knowledge-chunking.test.ts` | 9 | Chunk, citation, evidence, confidence, metadata engines |

### Recommended follow-up tests

- Orchestrator integration with mocked Prisma (full `processVersion` + `promotePublishedChunks`)
- Citation `chunkId` remap assertion on promote
- BN/EN misaligned section regression
- Publish gate failure paths (provisional evidence, missing chunk citations)

---

## Remediation applied (this audit)

| Issue | Fix |
|-------|-----|
| Published chunk citations pointed at STAGING `chunkId` | Remap citations to PUBLISHED chunk IDs by `chunkIndex` on promote |
| Confidence `componentsJson` stored score as evidence component | Proper breakdown via `evidenceLevelScore` + `trustTierScore` |
| Publish confidence was placeholder | Full formula v2 recompute with `provisional: false` |
| Metadata `trustTierMin` hardcoded | Derived from citation `sourceTrustTier` |
| Metadata `sourceKeys` used inline token | Uses canonical `sourceKey` |
| Vet approval did not finalize evidence | `recordApproval` → `processVersion({ finalizeEvidence: true })` |
| Empty chunk list possible after filter | Fallback single chunk from version body |
| PUBLISHED metadata retained provisional flag | Refresh `provisional: false` + confidence on promote |

---

## Open items (non-blocking for VKF pilot)

| Item | Phase | Priority |
|------|-------|----------|
| 6C embedding migration to `{versionId}:{chunkIndex}` | 6C | High |
| Narrative chunk overlap (50 tokens) | 6B.3 hardening | Low |
| BN/EN section alignment algorithm | 6B.3 hardening | Medium |
| Incremental `ChunkDiffService` | 6B.3 hardening | Medium |
| Editorial evidence assessment path | 6B.3+ | Medium |
| Graph connectivity in confidence | 6B.3+ | Low |
| Legacy KIS → VKF chunk migration | 6B.3.7 | High |
| Web Chunk & Citation Control UI | 6B.3.8 | High |

---

## Verification commands

```bash
npm run typecheck:ai
npx vitest run src/modules/ai
npx vitest run src/modules/ai/knowledge-chunking
```

**Results at report time:**

```
AI module: 0 TypeScript errors
Test Files  48 passed (48)
Tests       330 passed (330)
```

---

## Sign-off

| Role | Assessment |
|------|------------|
| **QA Auditor** | Phase 6B.3 CCE **approved for controlled VKF pilot** |
| **Blockers for production RAG cutover** | 6C version-key embedding, legacy migration, overlap/BN-EN hardening |
| **Next verification** | After 6C VKF embedding integration or first production corpus publish |

**Document owner:** Principal AI Knowledge QA Auditor  
**Related:** `docs/plans/phase-6b3-chunking-citation-engine.md`, `docs/reports/phase-6b1-knowledge-foundation-verification.md`
