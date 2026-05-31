# Phase 6D.1 — AI Doctor Verification Report

**Project:** Prani Doctor  
**Role:** Principal Veterinary Safety Auditor  
**Date:** 2026-05-31  
**Scope:** `src/modules/ai/ai-doctor/` — session, intake, differential, emergency, confidence, escalation engines + orchestrator + API  
**Reference plan:** `docs/plans/phase-6d-ai-doctor.md`  
**Depends on:** Phase 6C VRE (`ai-doctor-v1` profile), post-LLM validator (6C.13f), `AiEscalationRecord`

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **PASS WITH CONDITIONS** |
| **Pilot AI Doctor (backend)** | **Yes** — fail-closed clinical workflow operational |
| **Production farmer rollout** | **Conditional** — mobile UX (6D.1f), live corpus, golden-set eval pending |
| **TypeScript (`npm run typecheck:ai`)** | **0 errors** |
| **Unit tests (`npx vitest run src/modules/ai`)** | **398 passed** (52 files) |
| **AI Doctor tests** | **27 passed** (14 unit + 13 verification) |

### Composite scores (0–100)

| Score | Value | Interpretation |
|-------|------:|----------------|
| **Safety score** | **91** | Fail-closed, emergency triage, escalation, and hallucination gates verified |
| **Diagnostic score** | **78** | Symptom gating + grounded differentials; live accuracy unmeasured |
| **Grounding score** | **87** | VKL → VRE → Router enforced; citation-required differentials |
| **Production readiness score** | **73** | Backend engines complete; mobile + eval + case DB table pending |

**Score methodology:** Each domain scored against Phase 6D.1 acceptance criteria (implemented / partial / missing), weighted by clinical risk. Production readiness includes test coverage, API completeness, and ops dependencies.

---

## Methodology

1. **Static code audit** — traced `AiDoctorOrchestratorService` through intake → emergency → VRE → differential fusion → confidence → LLM/post-validate → escalation paths.
2. **Engine unit tests** — `ai-doctor.test.ts` (14 tests).
3. **Safety verification suite** — `ai-doctor.verification.test.ts` (13 tests) covering all seven validation domains.
4. **Regression suite** — `npx vitest run src/modules/ai` (398 tests).
5. **Safe remediation** — applied during audit (see § Remediation applied).

---

## Validation matrix

| Domain | Status | Evidence |
|--------|--------|----------|
| **Symptom collection** | **PASS** | Completeness score, clarification plan, BN colloquial normalization, min-1-symptom gate |
| **Diagnosis reasoning** | **PASS WITH GAPS** | Graph + RAG fusion; educational language contract; no definitive diagnosis in formatter |
| **Emergency detection** | **PASS** | Graph red flags + lexicon + `assessSymptomRisk`; LLM skipped on CRITICAL |
| **Citation grounding** | **PASS** | `allDifferentialsHaveCitations()` gate; `citationBlock` appended to LLM output |
| **Hallucination resistance** | **PASS** | Post-LLM validator; `containsDiagnosisLanguage()` block; dosage BLOCK |
| **Low confidence behavior** | **PASS** | Fail-closed &lt; 0.35; PROCEED_DEGRADED + low score → BLOCK; escalation recommended |
| **Vet escalation** | **PASS** | `AiEscalationRecord` on emergency, fail-closed, treatment intent, user request |

---

## 1. Symptom collection

### Expected

Structured taxonomy + free text; BN colloquial expansion; completeness ≥ 0.60 before LLM; clarification questions without LLM when incomplete.

### Observed

| Check | Result |
|-------|--------|
| `computeSymptomCompleteness()` weighted scoring | ✅ |
| `meetsLlmCompletenessGate()` at 0.60 threshold | ✅ |
| `buildClarificationPlan()` static i18n templates | ✅ |
| `validateSymptomCodes()` species validation | ✅ |
| `validateFreeTextSymptoms()` safety pre-check | ✅ |
| `assertIntakeHasSymptoms()` min-1 signal | ✅ (audit fix) |
| BN colloquial via `normalizeQueryForRetrieval` | ✅ |
| `POST /doctor/cases/:id/intake` API | ✅ |

**Contribution to diagnostic score:** +22

---

## 2. Diagnosis reasoning

### Expected

Ranked differentials from symptom graph + VRE; educational non-definitive language; no LLM-only speculation.

### Observed

| Check | Result |
|-------|--------|
| `loadGraphDifferentials()` from `AiSymptomDiseaseLink` | ✅ |
| `fuseDifferentials()` graph + RAG merge | ✅ |
| `formatDifferentialSummary()` educational header | ✅ |
| LLM prompt: "Do not confirm diagnosis" | ✅ |
| Graph-only path when RAG empty (no LLM) | ✅ |
| Live differential precision@k eval | ❌ Pending 6D.1g |
| `POST .../follow-up` multi-turn API | ❌ Not implemented |

**Contribution to diagnostic score:** +18 / reasoning architecture sound; live accuracy unmeasured (−8).

---

## 3. Emergency detection

### Expected

Red flags before LLM; CRITICAL → emergency content + escalation; no speculative clinical LLM on emergency path.

### Observed

| Check | Result |
|-------|--------|
| `loadGraphRedFlags()` on symptom codes | ✅ |
| `detectLexiconEmergency()` BN + EN patterns | ✅ |
| `assessSymptomRisk()` combined risk | ✅ |
| `shouldSkipLlmForEmergency()` gate | ✅ |
| Emergency at intake (before completeness LLM) | ✅ |
| `AI_DOCTOR_TRIAGE_RED_FLAG` audit event | ✅ (audit fix) |
| `VET_CALL_NOW` escalation type | ✅ |
| Emergency Assistant handoff object | ⚠️ Flag only (`emergencyHandoff: true`); no auto-route to `/assistants/emergency` |

**Contribution to safety score:** +24

---

## 4. Citation grounding

### Expected

All medical content traceable to VKL sources; no LLM proceed without grounded citations.

### Observed

| Check | Result |
|-------|--------|
| VRE `ai-doctor-v1` before every analyze | ✅ |
| `allDifferentialsHaveCitations()` enforcement | ✅ |
| `citationCoverage(pack) > 0` when chunks present | ✅ |
| `pack.citationBlock` appended to response | ✅ |
| Graph differentials cite `[slug]` tokens | ✅ |
| `buildEnrichedPromptContext(pack)` in LLM prompt | ✅ |
| LLM output body citation token validation | ⚠️ Partial — relies on prompt + post-LLM dosage gate |
| Live corpus for citation quality | ⚠️ 0 published chunks locally |

**Contribution to grounding score:** +20

---

## 5. Hallucination resistance

### Expected

Post-LLM validation; block definitive diagnosis; block uncited dosage; sanitize overconfident degraded output.

### Observed

| Check | Result |
|-------|--------|
| `validateLlmOutput()` on analyze path | ✅ |
| `containsDiagnosisLanguage()` → refused + graph summary | ✅ |
| `sanitizeAssistantOutput()` on pass path | ✅ |
| Dosage without structured facts → BLOCK | ✅ |
| `definitely has` pattern in diagnosis filter | ✅ (audit fix) |
| LLM-as-judge output validation | ❌ Deferred 6D.1g |

**Contribution to safety score:** +22

---

## 6. Low confidence behavior

### Expected

Fail-closed below confidence floor; degraded routing triggers escalation; farmer-visible tier badge.

### Observed

| Scenario | Expected | Verified |
|----------|----------|----------|
| Case score &lt; 0.35 | BLOCK, no LLM | ✅ |
| No grounded citations | BLOCK | ✅ |
| VRE `BLOCK` | BLOCK, no LLM | ✅ |
| `PROCEED_DEGRADED` + score &lt; 0.55 | BLOCK | ✅ |
| Graph-only differentials, empty RAG | Summary + escalation nudge | ✅ |
| Confidence badge in response | `[Strong evidence]` etc. | ✅ |
| Incomplete intake (&lt; 0.60) | Clarification, no LLM | ✅ |

**Thresholds:**

| Constant | Value |
|----------|------:|
| `AI_DOCTOR_FAIL_CLOSED_CONFIDENCE` | 0.35 |
| `AI_DOCTOR_ESCALATION_CONFIDENCE` | 0.55 |
| `AI_DOCTOR_COMPLETENESS_LLM_THRESHOLD` | 0.60 |

**Contribution to safety score:** +18

---

## 7. Vet escalation

### Expected

Automatic escalation on emergency, fail-closed, treatment intent; user-initiated escalation API.

### Observed

| Trigger | Escalation type | Verified |
|---------|-----------------|----------|
| `RED_FLAG_SYMPTOM` | `VET_CALL_NOW` | ✅ |
| `TREATMENT_INTENT` | `ASYNC_VET_REVIEW` | ✅ |
| `LOW_CONFIDENCE_OR_BLOCK` | `ASYNC_VET_REVIEW` | ✅ |
| `USER_REQUESTED_VET` | `VET_BOOKING` | ✅ |
| `AiEscalationRecord` persisted | ✅ |
| Session marked `ESCALATED` | ✅ |
| `AI_DOCTOR_FAIL_CLOSED` audit | ✅ (audit fix) |
| Vet inbox UI (6D.7) | ❌ Pending |

**Contribution to safety score:** +7

---

## Three-layer stack verification

```
Layer 1 — VKL (symptom graph, published entries)
Layer 2 — VRE (KnowledgeRetrievalService, ai-doctor-v1)
Layer 3 — AI Router (executePromptTask, post-LLM validate)
```

| Path | LLM invoked? | Verified |
|------|-------------|----------|
| Emergency CRITICAL | **No** | ✅ |
| VRE BLOCK | **No** | ✅ |
| Low confidence / no citations | **No** | ✅ |
| Treatment intent | **No** | ✅ |
| Grounded PROCEED | Yes + citations | ✅ |
| Post-LLM BLOCK/diagnosis language | Refused template | ✅ |

---

## Test evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `ai-doctor.test.ts` | 14 | Pass |
| `ai-doctor.verification.test.ts` | 13 | Pass |
| Full `src/modules/ai` | 398 | Pass |
| `npm run typecheck:ai` | — | 0 errors |

### Verification test coverage

- Symptom required + completeness gate
- Emergency lexicon + skip LLM
- Educational differential formatting with citations
- Treatment intent detection
- Fail-closed confidence matrix
- Post-LLM dosage block
- Definitive diagnosis language detection
- Escalation reason mapping

---

## Score breakdown

### Safety score: **91**

| Component | Weight | Score |
|-----------|--------|------:|
| Emergency fail-closed (no LLM) | 20% | 95 |
| Low-confidence fail-closed | 20% | 92 |
| Hallucination / post-LLM gates | 20% | 90 |
| Treatment intent block | 10% | 95 |
| Escalation on all BLOCK paths | 15% | 88 |
| Audit trail | 10% | 85 |
| Input safety (free text) | 5% | 90 |

### Diagnostic score: **78**

| Component | Weight | Score |
|-----------|--------|------:|
| Symptom intake completeness | 25% | 88 |
| Differential fusion architecture | 25% | 85 |
| Educational language contract | 20% | 82 |
| Clarification workflow | 15% | 80 |
| Live differential accuracy | 15% | 40 (not measured) |

### Grounding score: **87**

| Component | Weight | Score |
|-----------|--------|------:|
| VRE-before-LLM enforcement | 30% | 95 |
| Citation-required differentials | 25% | 92 |
| Pack citation block injection | 20% | 88 |
| Fail-closed without citations | 15% | 90 |
| Live corpus citation quality | 10% | 35 (empty DB) |

### Production readiness score: **73**

| Criterion | Status |
|-----------|--------|
| Type safety | ✅ |
| 398 AI module tests | ✅ |
| API routes (cases/intake/analyze/escalate) | ✅ |
| Case persistence (`AiAssistantMemory`) | ✅ (interim) |
| Mobile UX (6D.1f) | ❌ |
| Golden-set AI Doctor eval (6D.1g) | ❌ |
| Symptom checker → case handoff API | ❌ |
| Dedicated `AiDoctorCase` table | ❌ |
| Published VKL corpus in target env | ⚠️ Ops |

---

## Remediation applied (this audit)

| Issue | Severity | Fix |
|-------|----------|-----|
| Empty symptom intake allowed | Medium | `assertIntakeHasSymptoms()` + Zod `.refine()` on intake schema |
| Treatment intent only blocked at analyze | Medium | Block at `submitIntake()` via `isTreatmentIntentQuery()` |
| No audit on emergency triage | Low | `AI_DOCTOR_TRIAGE_RED_FLAG` audit event |
| No audit on fail-closed path | Low | `AI_DOCTOR_FAIL_CLOSED` audit event |
| `definitely has` not caught by diagnosis filter | Medium | Added pattern to `ai-safety.guardrails.ts` |
| Thin safety verification coverage | Medium | Added `ai-doctor.verification.test.ts` (13 tests) |

---

## Open gaps (not auto-fixed)

| ID | Gap | Risk | Target |
|----|-----|------|--------|
| **G1** | No live differential accuracy eval | Medium | 6D.1g golden set |
| **G2** | Case stored in memory not dedicated table | Low | 6D.1f schema migration |
| **G3** | No `follow-up` turn API | Medium | 6D.1e follow-up |
| **G4** | Emergency handoff flag only (no auto-route) | Low | Mobile 6D.1f |
| **G5** | Symptom checker → AI Doctor case bridge | Medium | 6D.1f |
| **G6** | Empty local VKL corpus | High (ops) | Publish + embed batch |
| **G7** | LLM output citation token validation | Medium | 6D.1g eval harness |

---

## Production readiness assessment

**Backend safety architecture:** Ready for **controlled pilot** with vet escalation on all BLOCK paths and no LLM on emergency/low-confidence routes.

**Farmer production rollout blocked by:** mobile journey (6D.1f), live VKL corpus, golden-set accuracy baseline (6D.1g).

### Pilot checklist

- [ ] Publish disease KB chunks for top 20 farmer queries
- [ ] Run AI Doctor golden-set eval (`doctor-case-bn-g1-v1.json` — 6D.1g)
- [ ] Wire mobile intake → analyze → escalation UI
- [ ] Connect symptom checker session → `createCase(symptomCheckSessionId)`
- [ ] Monitor `AI_DOCTOR_FAIL_CLOSED` and `AI_DOCTOR_TRIAGE_RED_FLAG` audit rates
- [ ] Verify zero LLM tokens on emergency path (usage log spot-check)

---

## Sign-off

| Role | Assessment |
|------|------------|
| **Principal Veterinary Safety Auditor** | AI Doctor backend **PASS WITH CONDITIONS** |
| **Safety score** | **91** |
| **Diagnostic score** | **78** |
| **Grounding score** | **87** |
| **Production readiness score** | **73** |
| **Blockers for pilot** | Published VKL corpus + mobile UX |
| **Blockers for production** | G1, G5, G6, G7 |

**Recommended next action:** Seed VKL disease chunks, implement 6D.1g golden-set eval for AI Doctor cases, and wire mobile intake flow.

---

*Report generated: 2026-05-31 — Phase 6D.1 AI Doctor Safety Audit*
