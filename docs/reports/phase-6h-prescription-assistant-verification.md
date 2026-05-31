# Phase 6H.1 — AI Prescription Assistant Verification Report

**Project:** Prani Doctor  
**Role:** Principal Veterinary Safety Auditor  
**Date:** 2026-05-31  
**Scope:** `src/modules/ai/ai-prescription/` — medicine lookup, interaction/contraindication engines, safety report, confidence, escalation + orchestrator + API  
**Reference plan:** `docs/plans/phase-6h-ai-prescription-assistant.md`  
**Depends on:** Phase 6C VRE (`prescription-v1` profile), post-LLM validator (6C.13f), `AiEscalationRecord`, Medicine MVC metadata (`structuredJson`)

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall verdict** | **PASS WITH CONDITIONS** |
| **Pilot Prescription Assistant (backend)** | **Yes** — fail-closed pharmacology workflow operational |
| **Production farmer rollout** | **Conditional** — vet validation UI (6H.1g), Medicine MVC corpus density, golden-set eval (6H.1i) pending |
| **TypeScript (`npm run typecheck:ai`)** | **0 errors** |
| **Unit tests (`npx vitest run src/modules/ai`)** | **454 passed** (58 files) |
| **Prescription Assistant tests** | **28 passed** (14 unit + 14 verification) |

### Composite scores (0–100)

| Score | Value | Interpretation |
|-------|------:|----------------|
| **Safety score** | **90** | Drug safety engines, PX prohibitions, fail-closed, and escalation verified |
| **Grounding score** | **86** | VKL → VRE → Router enforced; structured facts + citation tokens on safety reports |
| **Production readiness score** | **72** | Backend engines complete; medicine corpus, vet UI, golden-set eval pending |

**Score methodology:** Each domain scored against Phase 6H.1 acceptance criteria (implemented / partial / missing), weighted by pharmacological and regulatory risk. Production readiness includes test coverage, API completeness, and ops dependencies.

---

## Methodology

1. **Static code audit** — traced `AiPrescriptionOrchestratorService` through medicine lookup → VRE → safety report fusion → confidence → LLM/post-validate → escalation paths.
2. **Engine unit tests** — `ai-prescription.test.ts` (14 tests).
3. **Safety verification suite** — `ai-prescription.verification.test.ts` (14 tests) covering all seven validation domains.
4. **Regression suite** — `npx vitest run src/modules/ai` (454 tests).
5. **Safe remediation** — applied during audit (see § Remediation applied).

---

## Validation matrix

| Domain | Status | Evidence |
|--------|--------|----------|
| **Drug interactions** | **PASS** | `analyzeDrugInteractions()` — documented edges + unresolved pair surfacing |
| **Contraindications** | **PASS** | Pregnancy, lactation, structured CI list via `evaluateContraindications()` |
| **Species restrictions** | **PASS** | `evaluateSpeciesEligibility()` → `OFF_LABEL_SPECIES` block in safety report |
| **Safety warnings** | **PASS WITH GAPS** | Banned substance, withdrawal, vaccine conflicts; age band now wired |
| **Citation grounding** | **PASS** | Medicine citation tokens on safety report; VRE pack before LLM |
| **Confidence scoring** | **PASS** | Session score with safety penalty; fail-closed at 0.75 |
| **Escalation behavior** | **PASS** | Clinical-trigger gating; `REGULATORY_REFERRAL` / `VET_BOOKING` types |

---

## 1. Drug interactions

### Expected

Pairwise interaction analysis from published medicine metadata; CONTRAINDICATED pairs at CRITICAL risk; unresolved pairs flagged for vet review.

### Observed

| Check | Result |
|-------|--------|
| `interactsWith[]` edge resolution by slug | ✅ |
| Severity mapping (`CONTRAINDICATED` → CRITICAL) | ✅ |
| `unresolvedPairs` when no documented edge | ✅ |
| `POST .../interactions` API | ✅ |
| Graph-based `VkKnowledgeLink` interaction edges | ❌ Schema not yet available — metadata-only |
| Live interaction corpus density | ⚠️ Depends on Wave 3a Medicine MVC publish |

**Contribution to safety score:** +18

---

## 2. Contraindications

### Expected

Structured contraindication list + physiological state (pregnancy, lactation) warnings with citations.

### Observed

| Check | Result |
|-------|--------|
| `contraindications[]` from `structuredJson` | ✅ |
| Pregnancy warning (`pregnancy: true`) | ✅ |
| Lactation warning | ✅ |
| Renal/hepatic structured CI passthrough | ✅ |
| Species-specific CI matrix | ⚠️ Partial — relies on entry-level metadata |
| BN localized CI descriptions | ✅ |

**Contribution to safety score:** +14

---

## 3. Species restrictions

### Expected

Off-label species blocked; dose matrix species row required for eligibility.

### Observed

| Check | Result |
|-------|--------|
| `evaluateSpeciesEligibility()` OFF_LABEL detection | ✅ |
| `OFF_LABEL_SPECIES` in `blockReasons` | ✅ |
| Escalation on off-label (`VET_BOOKING`) | ✅ |
| Extra-label use guidance for vet mode | ⚠️ Informational only — no separate vet override path |
| Multi-species polypharmacy in one session | ✅ Up to `PRESCRIPTION_MAX_POLYPHARMACY` (8) |

**Contribution to safety score:** +12

---

## 4. Safety warnings (withdrawal, banned, vaccine, age)

### Expected

Withdrawal periods, banned substances, live-vaccine + antibiotic conflicts, age band restrictions.

### Observed

| Check | Result |
|-------|--------|
| `bannedSubstance` → CRITICAL + `REGULATORY_REFERRAL` | ✅ |
| Meat/milk withdrawal from `speciesDoseMatrix` | ✅ |
| Live vaccine + antibiotic heuristic | ✅ |
| `evaluateAgeEligibility()` in safety report | ✅ (audit fix — was implemented but unwired) |
| `AGE_RESTRICTION` block reason | ✅ |
| Withdrawal API `POST .../withdrawal` | ✅ |
| Regulatory substance list completeness | ⚠️ Ops — depends on corpus |

**Contribution to safety score:** +16

---

## 5. Citation grounding

### Expected

All pharmacology claims traceable to published VKL medicine entries; VRE before LLM; structured facts displayed when available.

### Observed

| Check | Result |
|-------|--------|
| VRE `prescription-v1` before every analyze | ✅ |
| `buildMedicineCitation()` tokens on safety report | ✅ |
| `citationLines` appended to analyze response | ✅ |
| `buildEnrichedPromptContext(pack)` in LLM prompt | ✅ |
| Fail-closed when `structuredFacts.length === 0` on `prescription-v1` | ✅ |
| `formatStructuredFactsForDisplay()` in response | ✅ |
| Live medicine chunk density in target env | ⚠️ Wave 3a MVC pending |
| LLM body citation token validation | ⚠️ Partial — dosage + PX-01 gates |

**Contribution to grounding score:** +22

---

## 6. Confidence scoring

### Expected

Session confidence reflects retrieval quality + safety penalties; fail-closed below floor; farmer-visible tier badge.

### Observed

| Scenario | Expected | Verified |
|----------|----------|----------|
| Session score &lt; 0.75 | Fail-closed, no LLM | ✅ |
| CRITICAL safety risk | Score penalty + fail-closed | ✅ |
| VRE `BLOCK` | BLOCK, no LLM | ✅ |
| `PROCEED_DEGRADED` | Escalation recommended | ✅ |
| Confidence badge in response | `[Verified information]` etc. | ✅ |
| Farmer dose request (PX-03) | LLM skipped | ✅ |

**Thresholds:**

| Constant | Value |
|----------|------:|
| `PRESCRIPTION_FAIL_CLOSED_CONFIDENCE` | 0.75 |
| `PRESCRIPTION_ESCALATION_CONFIDENCE` | 0.80 |
| `PRESCRIPTION_MIN_CONFIDENCE` | 0.75 |

**Contribution to safety score:** +15

---

## 7. Escalation behavior

### Expected

Escalation on clinical safety triggers; no spurious DB records on every degraded proceed; user-initiated escalation API.

### Observed

| Trigger | Escalation type | Verified |
|---------|-----------------|----------|
| Banned substance | `REGULATORY_REFERRAL` | ✅ |
| Off-label / age restriction | `VET_BOOKING` | ✅ |
| Critical interaction | `VET_CALL_NOW` / booking | ✅ |
| Fail-closed / refused | Escalation recommended | ✅ |
| `shouldCreateEscalationRecord()` clinical gating | ✅ (audit fix — was creating on every `humanRedirect`) |
| `AiEscalationRecord` persisted | ✅ On clinical triggers only |
| `POST .../escalate` user request | ✅ |
| Vet validation inbox UI (6H.1g) | ❌ Pending |

**Contribution to safety score:** +15

---

## PX prohibition compliance

| Rule | Description | Status |
|------|-------------|--------|
| **PX-01** | No autonomous prescription / treatment plan language | ✅ `containsAutonomousPrescriptionLanguage()` + post-LLM BLOCK |
| **PX-02** | No uncited dosage in LLM output | ✅ Post-LLM validator (mg/kg + ml/kg) |
| **PX-03** | No actionable farmer dose via LLM | ✅ `shouldSkipLlmForFarmerDoseRequest()` — EN + BN patterns |
| **PX-04** | No Rx generation without vet mode | ✅ Reference-only farmer mode; vet mode informational |

---

## Three-layer stack verification

```
Layer 1 — VKL (published medicine entries, structuredJson)
Layer 2 — VRE (KnowledgeRetrievalService, prescription-v1)
Layer 3 — AI Router (executePromptTask, post-LLM validate)
```

| Path | LLM invoked? | Verified |
|------|-------------|----------|
| VRE BLOCK | **No** | ✅ |
| Fail-closed confidence | **No** | ✅ |
| Farmer dose intent (PX-03) | **No** | ✅ |
| No structured facts (prescription-v1) | **No** | ✅ |
| CRITICAL safety (banned / CI interaction) | **No** (refused template) | ✅ |
| Grounded PROCEED | Yes + citations + post-validate | ✅ |
| Post-LLM BLOCK (dosage / PX-01) | Refused template | ✅ |

---

## Test evidence

| Suite | Tests | Result |
|-------|-------|--------|
| `ai-prescription.test.ts` | 14 | Pass |
| `ai-prescription.verification.test.ts` | 14 | Pass |
| Full `src/modules/ai` | 454 | Pass |
| `npm run typecheck:ai` | — | 0 errors |

### Verification test coverage

- Documented + unresolved drug interactions
- Pregnancy and structured contraindications
- Off-label species + age band restriction
- Banned substance regulatory escalation
- Medicine citation tokens on safety report
- Confidence fail-closed floor
- Farmer dose / prescribe / BN injection skip (PX-03)
- Post-LLM uncited dosage block
- PX-01 autonomous prescription language block
- Escalation record clinical gating
- Escalation type mapping

---

## Score breakdown

### Safety score: **90**

| Component | Weight | Score |
|-----------|--------|------:|
| Drug interaction + CI engines | 20% | 92 |
| Species / age / banned gates | 20% | 90 |
| PX-01/02/03 farmer protections | 20% | 93 |
| Fail-closed confidence | 15% | 88 |
| Escalation on clinical triggers | 15% | 87 |
| Audit trail (`PRESCRIPTION_ANALYZE`, `PRESCRIPTION_ESCALATE`) | 10% | 85 |

### Grounding score: **86**

| Component | Weight | Score |
|-----------|--------|------:|
| VRE-before-LLM enforcement | 30% | 94 |
| Structured facts + citation tokens | 25% | 90 |
| Fail-closed without structured facts | 20% | 88 |
| Post-LLM dosage grounding (mg + ml) | 15% | 85 |
| Live medicine corpus citation quality | 10% | 40 (sparse locally) |

### Production readiness score: **72**

| Criterion | Status |
|-----------|--------|
| Type safety | ✅ |
| 454 AI module tests | ✅ |
| API routes (sessions/analyze/lookup/interactions/withdrawal/escalate) | ✅ |
| Session persistence (`AiAssistantMemory`) | ✅ |
| Vet validation UI (6H.1g) | ❌ |
| Golden-set prescription eval (6H.1i) | ❌ |
| Wave 3a Medicine MVC corpus published | ⚠️ Ops |
| Interaction graph (`VkKnowledgeLink`) | ❌ Future |
| Mobile prescription journey | ❌ |

---

## Remediation applied (this audit)

| Issue | Severity | Fix |
|-------|----------|-----|
| Escalation record created on every `humanRedirect` (including degraded proceed) | Medium | `shouldCreateEscalationRecord()` — clinical triggers only |
| Age eligibility engine not wired into safety report | Medium | `ageDays` passed to `buildPrescriptionSafetyReport()` |
| BN dose patterns missed (`\b` incompatible with Bengali) | Medium | Split EN `\b` patterns + BN substring patterns in `shouldSkipLlmForFarmerDoseRequest()` |
| No PX-01 autonomous Rx language filter | High | `prescription-output.guard.ts` + post-LLM BLOCK for `PRESCRIPTION_ANALYSIS` |
| `DOSE_ML_KG` not matched in post-LLM validator | Medium | Extended `findMatchingDoseFact()` for ml/kg facts |
| Thin prescription verification coverage | Medium | Added `ai-prescription.verification.test.ts` (14 tests) |

---

## Open gaps (not auto-fixed)

| ID | Gap | Risk | Target |
|----|-----|------|--------|
| **G1** | No live prescription golden-set eval | Medium | 6H.1i Bank D corpus |
| **G2** | Medicine MVC corpus density low in dev | High (ops) | Wave 3a publish + embed |
| **G3** | Interactions metadata-only (no graph edges) | Medium | `VkKnowledgeLink` schema |
| **G4** | Vet validation UI / async review inbox | Medium | 6H.1g |
| **G5** | Mobile prescription assistant journey | Medium | Flutter 6H.1f |
| **G6** | Unresolved interaction pairs lack LLM inference | Low | By design — vet review required |
| **G7** | Extra-label vet override workflow | Low | 6H.2 governance |

---

## Production readiness assessment

**Backend safety architecture:** Ready for **controlled pilot** with vet escalation on all BLOCK paths, no LLM on farmer dose requests, and no autonomous Rx language in outputs.

**Farmer production rollout blocked by:** Medicine MVC corpus publish, mobile journey, golden-set pharmacology eval (6H.1i), vet validation UI (6H.1g).

### Pilot checklist

- [ ] Publish Wave 3a Medicine MVC entries with `structuredJson` (dose matrix, interactions, withdrawal)
- [ ] Run prescription golden-set eval (`prescription-g1-v1.json` — 6H.1i)
- [ ] Wire mobile medicine lookup → analyze → escalation UI
- [ ] Monitor `PRESCRIPTION_ANALYZE` fail-closed and escalation audit rates
- [ ] Verify zero LLM tokens on PX-03 farmer dose path (usage log spot-check)
- [ ] Vet inbox for `ASYNC_VET_REVIEW` prescription escalations (6H.1g)

---

## Sign-off

| Role | Assessment |
|------|------------|
| **Principal Veterinary Safety Auditor** | Prescription Assistant backend **PASS WITH CONDITIONS** |
| **Safety score** | **90** |
| **Grounding score** | **86** |
| **Production readiness score** | **72** |
| **Blockers for pilot** | Medicine MVC corpus + mobile UX |
| **Blockers for production** | G1, G2, G4, G5 |

**Recommended next action:** Publish Wave 3a medicine entries, implement 6H.1i golden-set eval, and wire vet validation UI (6H.1g).

---

*Report generated: 2026-05-31 — Phase 6H.1 AI Prescription Assistant Safety Audit*
