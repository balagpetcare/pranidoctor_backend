# Phase 6H — AI Prescription Assistant Product Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary Clinical AI Architect  
**Date:** 2026-05-31  
**Status:** 6H.1a–6H.1h implemented (backend orchestrator + engines + API) — 2026-05-31  
**Verification:** `docs/reports/phase-6h-prescription-assistant-verification.md` — Safety **90**, Grounding **86**, Production readiness **72** (PASS WITH CONDITIONS)
**Version:** 1.1.0  

**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` — VKL Medicine KB, regulatory overlay, evidence gates
- `docs/plans/phase-6b4-editorial-governance.md` — vet approval, HIGH-risk publish gates, re-review policy
- `docs/plans/phase-6c-rag-engine-architecture.md` — VRE `prescription-v1` profile, structured facts, fail-closed routing
- `docs/plans/phase-6c13-rag-optimization.md` — post-LLM validation, medical confidence calibration
- `docs/plans/phase-6d-veterinary-ai-assistant.md` — assistant gateway, shared safety policies SP-01–SP-10, escalation taxonomy
- `docs/plans/phase-6d-ai-doctor.md` — sibling assistant handoff (treatment intent → Prescription)
- `docs/plans/phase-6f-golden-set-evaluation.md` — Bank D medicine eval contract

**Parent scope:** This document is the **deep product architecture for AI Prescription Assistant only**. Shared assistant gateway, escalation inbox, and mobile shell patterns remain in `phase-6d-veterinary-ai-assistant.md`. The 6D.6 gateway stub (`POST /assistants/prescription`) is transport only; this plan defines the **complete prescription decision-support product**.

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Prescription orchestration, medicine safety engine, interaction graph, vet/farmer policy gates, escalation APIs |
| `pranidoctor-web` | Vet prescription review console, medicine KB gap tickets, regulatory overlay dashboards |
| `pranidoctor_user` | Farmer mobile — medicine lookup, safety warnings, vet escalation (no autonomous Rx) |

---

## Executive summary

**AI Prescription Assistant** is Prani Doctor's **vet-supervised pharmacology decision-support surface**. It helps livestock owners, field paravets, and licensed veterinarians:

1. **Look up medicines** and formulations from the VKL Medicine Knowledge Base
2. **Reference drug facts** — class, route, BD availability, prescription status
3. **Check species and age restrictions** against published dose matrices
4. **Surface contraindications** from graph edges and structured fields
5. **Look up withdrawal periods** for milk, meat, and egg-producing animals
6. **Analyze drug–drug interactions** via `INTERACTS_WITH` graph traversal
7. **Check vaccine–medicine interactions** (live biologics, immunosuppressants, concurrent antibiotic windows)
8. **Display safety warnings** aggregated from regulatory, clinical, and context signals
9. **Escalate to licensed vets** when grounding, policy, or clinical risk requires human judgment

### Non-negotiable architecture constraint

> **Every Prescription Assistant response that contains clinical pharmacology claims MUST traverse three layers in order. Direct LLM-only medicine advice is forbidden. The assistant NEVER autonomously prescribes, plans treatment, or recommends doses to farmers without vet review.**

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Veterinary Knowledge Layer (VKL)                     │
│    Drug, Formulation, WithdrawalRule, Regulatory BD entities     │
│    Graph: INTERACTS_WITH, CONTRAINDICATES, REQUIRES_WITHDRAWAL   │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — RAG Engine (VRE)                                     │
│    prescription-v1 → KnowledgeContextPack + structuredFacts      │
│    Confidence routing: fail-closed default                       │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — AI Router (AIMS)                                     │
│    Prompt execution ONLY when routing ≠ BLOCK                    │
│    Post-LLM validation: numeric dose lock, Rx language filter    │
└─────────────────────────────────────────────────────────────────┘
```

If Layer 1 or Layer 2 cannot supply sufficient grounded pharmacology facts for the claim class, **the LLM is not invoked** — the user receives a safe template, regulatory referral, or vet escalation offer instead.

### Product posture

| Dimension | AI Prescription Assistant |
|-----------|---------------------------|
| Clinical risk tier | **R3 — Action clinical** (highest non-emergency) |
| Default routing | **Fail-closed** |
| Primary taskType | `PRESCRIPTION_ANALYSIS` |
| Retrieval profile | `prescription-v1` |
| Farmer access | **Reference + safety only** — no dose recommendation without vet review flag |
| Vet access | **Validation + interaction check** — structured output; vet signs outside AI |
| Regulatory overlay | **Mandatory** for BD queries (`REGULATORY_BD` domain injection) |

### Current vs target state

| Capability | Today (6D.6 gateway) | Target (this document) |
|------------|---------------------|------------------------|
| Single-turn via `POST /assistants/prescription` | ✅ | Retained as turn transport |
| Structured-facts gate (no facts → BLOCK) | ✅ | Extended to per-claim-class gates |
| Medicine lookup (catalog search) | Partial (RAG only) | ✅ `POST .../prescription/sessions/:id/lookup` |
| Drug reference cards | ❌ | ✅ `DrugReferenceCard` in analyze response |
| Species / age restriction check | Partial (profile filters) | ✅ `evaluateSpeciesEligibility` + age matrix |
| Contraindication surfacing | Partial (graph in pack) | ✅ Pre-LLM `PrescriptionSafetyReport` |
| Withdrawal period lookup | Partial (structuredFacts) | ✅ `POST .../withdrawal` + matrix resolver |
| Drug interaction analysis | Partial (graph expand) | ✅ `InteractionBundle` + interactions API |
| Vaccine interaction checks | ❌ | ✅ `evaluateVaccineMedicineConflicts` |
| Safety warning aggregation | Ad hoc | ✅ Unified `PrescriptionSafetyReport` |
| Vet workflow (Rx validation) | ❌ | **Pending** — `VET_VALIDATION` mode scaffold only |
| Farmer dose recommendation | **Blocked by design** | Remains blocked — vet review required |
| Autonomous prescription generation | **Forbidden** | Enforced at orchestrator + post-LLM |

---

## Implementation progress (2026-05-31)

| Sub-phase | Scope | Status | Module / artifact |
|-----------|-------|--------|-------------------|
| **6H.1a** | Session model + mode gate + API skeleton | **Done** | `ai-prescription/engines/prescription-session.engine.ts`; `POST/GET /api/ai/prescription/sessions` |
| **6H.1b** | Medicine lookup + drug reference cards | **Done** | `medicine-lookup.engine.ts`, `species-eligibility.engine.ts` |
| **6H.1c** | PharmacologySafetyEngine (species, age, CI) | **Done** | `contraindication.engine.ts`, `safety-report.engine.ts` |
| **6H.1d** | Interaction + vaccine conflict evaluator | **Done** | `interaction.engine.ts`, `vaccine-interaction.engine.ts` |
| **6H.1e** | Withdrawal + structured facts extension | **Done** | `withdrawal.engine.ts`; `extractStructuredFacts` extended |
| **6H.1f** | Farmer flows + PX prohibition enforcement | **Done** | `ai-prescription-orchestrator.service.ts`; farmer dose LLM skip |
| **6H.1g** | Vet validation orchestrator (doctor app) | **Pending** | Mode gate only — no doctor UI |
| **6H.1h** | Escalation binding + gateway integration | **Done** | `prescription-escalation.engine.ts`; `POST .../escalate`; gateway uses orchestrator |
| **6H.1i** | Golden-set Bank D + pilot metrics | **Pending** | Extend 6F eval corpora |

**Tests:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — **440 passed** (57 files, incl. 14 prescription tests).

**Safety guarantees implemented:**
- VKL → VRE (`prescription-v1`) → Router pipeline on every analyze turn
- No autonomous Rx — farmer dose requests skip LLM narrative (PX-03)
- All analyze responses include `citations`, `confidence`, `safetyClassification`
- `PrescriptionSafetyReport` aggregates CI, interactions, withdrawal, vaccine conflicts
- Escalation records on BLOCK / safety triggers / user request
- Audit events: `PRESCRIPTION_ANALYZE`, `PRESCRIPTION_ESCALATE` → AI Analytics via `AiAuditService`

**API surface:**

| Method | Route |
|--------|-------|
| `POST` | `/api/ai/prescription/sessions` |
| `GET` | `/api/ai/prescription/sessions/:id` |
| `POST` | `/api/ai/prescription/sessions/:id/analyze` |
| `POST` | `/api/ai/prescription/sessions/:id/lookup` |
| `POST` | `/api/ai/prescription/sessions/:id/interactions` |
| `POST` | `/api/ai/prescription/sessions/:id/withdrawal` |
| `POST` | `/api/ai/prescription/sessions/:id/escalate` |
| `POST` | `/api/ai/assistants/prescription` (orchestrator-backed gateway) |

**Corpus dependency:** Medicine formulary Wave 3a still required for production grounding density; fail-closed remains correct without corpus.

---

## Strategic intent

| Principle | Prescription Assistant interpretation |
|-----------|--------------------------------------|
| **Reference, don't prescribe** | Farmers receive drug facts and safety warnings — not treatment instructions |
| **Retrieve before respond** | Every turn runs VRE with `prescription-v1` before router |
| **Structured facts over prose** | Dose, withdrawal, and interaction severity come from `structuredFacts[]`, not LLM invention |
| **Vet is the prescriber** | Licensed vets use validation mode; AI highlights conflicts — vet signs Rx externally |
| **Regulatory truth is absolute** | BD banned substances and registration status override LLM (SP-02) |
| **Fail-closed on harm** | Missing dose matrix, off-label species, or unresolved interaction → BLOCK |
| **Escalation is success** | Vet booking, async review, and call-now are designed outcomes |
| **Bangla-first for farmers** | BN summaries with EN INN in parentheses for drug names |
| **Species-aware always** | Species, age, weight, pregnancy, lactation, production stage required for R3 queries |
| **Audit everything** | Session ID, pack ID, drugs queried, interaction edges, routing decision per turn |
| **Close the loop to VKL** | BLOCK on unknown drug → medicine ingest priority ticket |

---

## Explicit prohibitions (normative)

These rules are **architectural invariants** — enforced at pre-check, orchestrator, output validator, and UX contract layers. No feature flag may disable them for farmer-tier users.

| Prohibition ID | Rule | Enforcement layer |
|----------------|------|-------------------|
| **PX-01** | **No autonomous prescription generation** — AI must never output a complete Rx (drug + dose + route + duration + frequency) as an actionable farmer instruction | Orchestrator mode gate; post-LLM Rx pattern filter |
| **PX-02** | **No autonomous treatment plans** — no multi-step therapy regimens, combination protocols, or "give X then Y" sequences without vet-supervised mode | Intent classifier; post-LLM sequence detector |
| **PX-03** | **No dose recommendations without vet review** — farmer tier must not receive mg/kg, ml/kg, or volume instructions unless `vetReviewRequired=false` on a **reference-only** fact display (e.g., label excerpt) with mandatory "confirm with vet" | Structured fact renderer; SP-01 |
| **PX-04** | **No LLM-invented numeric doses** — any number in output must match `structuredFacts[]` within tolerance | Post-LLM numeric lock |
| **PX-05** | **No antibiotic prescription language** for farmer tier without vet supervision flag (SP-09) | Language filter + audit |
| **PX-06** | **No off-label species dosing** — species absent from `speciesDoseMatrix` → BLOCK (SP-05) | Pre-LLM matrix evaluator |
| **PX-07** | **No contradicting regulatory BD facts** — banned substance queries → BLOCK + regulatory citation (SP-02) | Regulatory overlay pre-check |
| **PX-08** | **No bypassing VRE** with raw `executePromptTask()` for pharmacology content | Orchestrator invariant |
| **PX-09** | **No treatment plan handoff from AI Doctor** — Doctor routes intent; Prescription never extends into diagnosis | Cross-assistant boundary |
| **PX-10** | **No autonomous refill or repeat prescription** | Intent block list |

### Allowed outputs (farmer tier)

| Output type | Example | Vet review banner |
|-------------|---------|-------------------|
| Drug identification | "This is oxytetracycline — an antibiotic" | Always |
| Registration status | "Registered in BD under DGD no. …" | Always |
| Contraindication warning (cited) | "Not recommended in pregnancy — see source" | Always + escalate |
| Withdrawal fact (cited) | "Meat withdrawal: 28 days (VKL source)" | Always |
| Interaction warning (cited) | "May interact with [drug B] — severity HIGH" | Always + escalate |
| Missing data | "We don't have verified dose data for this species" | BLOCK + vet CTA |

### Allowed outputs (vet tier)

| Output type | Example | Constraint |
|-------------|---------|------------|
| Rx validation report | "Proposed dose within published range" | Requires vet-entered Rx context |
| Interaction matrix | All pairwise interactions for Rx set | Graph-grounded only |
| Withdrawal summary | Max withhold across Rx set | Regulatory overlay included |
| Draft annotation | Highlighted conflicts for vet decision | **Not** a signed prescription |

---

## Product boundaries

### In scope — AI Prescription Assistant

- Medicine lookup and drug reference (published VKL entities)
- Species, age, weight, pregnancy, lactation context capture
- Contraindication and interaction surfacing (drug–drug, drug–vaccine)
- Withdrawal period lookup (milk, meat, egg)
- BD regulatory overlay (registration, banned substances)
- Safety warning aggregation
- Vet-supervised validation workflow (doctor app)
- Escalation to licensed vet (call, book, async review)
- Handoff from AI Doctor on treatment intent (SP-01, AD-03)
- VKL gap tickets on unknown drugs

### Out of scope — routed to sibling assistants

| User intent | Route to | Reason |
|-------------|----------|--------|
| Disease differential, symptom triage | AI Doctor | `DISEASE_ANALYSIS` domain |
| Emergency first aid | AI Emergency Assistant | R4 SOP-only |
| Vaccination schedule (no medicine interaction) | AI Vaccine Assistant | Schedule facts domain |
| Feed ration, toxic feed | AI Feed Advisor | `FEED_FORMULATION` |
| Electronic prescription signing | Doctor practice management | Outside AI scope |
| Pharmacy fulfillment, inventory | Marketplace / ERP | Transactional domain |

---

## Three-layer stack (detailed)

### Layer 1 — Veterinary Knowledge Layer (VKL)

Prescription Assistant consumes these VKL domains via VRE profiles:

| Domain | Entity types | Prescription use | Required evidence |
|--------|--------------|------------------|-------------------|
| `MEDICINE` | `Drug`, `Formulation`, `ActiveIngredient`, `WithdrawalRule` | Dose matrix, routes, contraindications, interactions | ≥ L2; **VET_APPROVED** for dosage chunks |
| `REGULATORY_BD` | `DrugRegistration`, `BannedSubstance`, `SlaughterWithdrawal` | Legal status, bans, statutory withdrawal | L5 for registration; L2 for slaughter rules |
| `VACCINE` | `Vaccine`, `VaccinationSchedule` | Vaccine–medicine interaction checks | ≥ L2 |
| `CLINICAL_PROTOCOL` | `TreatmentPathway` (read-only context) | Line-of-therapy awareness — **no autonomous plan** | ≥ L2; doctor audience only |

**Medicine KB structured payload (from Phase 6A):**

```typescript
DrugStructuredPayload {
  genericName: string;
  brandNamesBd: string[];
  drugClass: string;
  prescriptionRequired: boolean;
  routes: ('IM' | 'IV' | 'PO' | 'TOPICAL' | 'INHALATION')[];
  speciesDoseMatrix: SpeciesDoseRow[];
  contraindications: ContraindicationRef[];
  pregnancyCategory?: 'A' | 'B' | 'C' | 'D' | 'X' | 'UNKNOWN';
  lactationSafe?: boolean | 'CAUTION' | 'UNKNOWN';
  antimicrobialClass?: string;          // for SP-09 governance
}

SpeciesDoseRow {
  species: LivestockSpecies;
  ageMinDays?: number;
  ageMaxDays?: number;
  weightMinKg?: number;
  weightMaxKg?: number;
  productionStage?: ('DRY' | 'LACTATING' | 'PREGNANT' | 'GROWING' | 'FINISHING')[];
  doseMgPerKg?: number;
  doseMlPerKg?: number;
  doseFixed?: { value: number; unit: string };
  frequency?: string;
  maxDurationDays?: number;
  route: string;
  evidenceLevel: EvidenceLevel;
  vetApproved: boolean;
}

WithdrawalRuleStructured {
  species: LivestockSpecies;
  productType: 'MILK' | 'MEAT' | 'EGG' | 'ORGAN';
  withdrawalDays: number;
  regulatoryBasis?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
}
```

**Graph edges consumed:**

| Edge | Prescription use |
|------|------------------|
| `INTERACTS_WITH` | Drug–drug interaction severity, mechanism |
| `CONTRAINDICATES` | Disease/condition/medicine blocks |
| `REQUIRES_WITHDRAWAL` | Links drug → withdrawal rule entity |
| `GOVERNED_BY` | Drug → BD registration |
| `TREATED_WITH` | Inverse — disease context (doctor mode only) |
| `PREVENTED_BY` | Vaccine linkage for interaction checks |

### Layer 2 — RAG Engine (VRE)

| Parameter | Prescription value |
|-----------|-------------------|
| `profileId` | `prescription-v1` |
| `taskType` | `PRESCRIPTION_ANALYSIS` |
| `domainPriority` | `MEDICINE`, `REGULATORY_BD`, `VACCINE` |
| `minConfidence` | 0.75 |
| `medicalMinConfidence` | 0.75 |
| `minEvidenceLevel` | L2 |
| `failClosed` | **true** |
| `blockLowConfidenceMedical` | **true** |
| `vetApprovedRequired` | **true** (dosage-bearing chunks) |
| `tokenBudget` | 2,000 (600 tokens reserved for structured facts) |
| `semanticWeight` | 0.50 (colloquial BN trade names) |
| `lexicalWeight` | 0.35 (INN, registration numbers) |
| `graphEdgeTypes` | `INTERACTS_WITH`, `CONTRAINDICATES`, `REQUIRES_WITHDRAWAL`, `GOVERNED_BY` |
| `groundingStrictness` | **strict** |

**Routing outcomes for Prescription Assistant:**

| Decision | LLM allowed? | User experience |
|----------|-------------|-----------------|
| `PROCEED` | Yes (vet tier) / Limited (farmer tier) | Cited facts + safety report; farmer: no actionable dose |
| `PROCEED_DEGRADED` | Yes | Caution banner + mandatory vet referral |
| `BLOCK` | **No** | Safe template + vet escalation CTA |
| `ESCALATE_HUMAN` | No (default) | Partial regulatory fact + mandatory escalation |

**Structured fact types required by claim class:**

| Claim class | Required `structuredFacts` | Farmer tier LLM? |
|-------------|------------------------------|------------------|
| Drug identification | `DRUG_IDENTITY` | Yes (reference only) |
| Dose range display | `DOSE_MG_KG` or `DOSE_ML_KG` | **No** — fact card only, no LLM narrative |
| Withdrawal | `WITHDRAWAL_DAYS` + product type | Fact card; LLM may explain in BN |
| Interaction | `INTERACTION_SEVERITY` | Warning card; LLM may explain |
| Contraindication | `CONTRAINDICATION_FLAG` | Warning card |
| Regulatory ban | `BANNED_SUBSTANCE` or `REGISTRATION_STATUS` | BLOCK narrative; template only |
| Vaccine interaction | `VACCINE_MEDICINE_CONFLICT` | Warning + escalate |

### Layer 3 — AI Router (AIMS)

Router executes **only after** VRE returns `PROCEED` or `PROCEED_DEGRADED`:

```
AiFoundationService.executePromptTask({
  promptKey: 'prescription_assistant',
  taskType: 'PRESCRIPTION_ANALYSIS',
  feature: 'prescription_assistant',
  userMessage: enrichedContext,   // pack + safety report + mode contract
  locale: 'bn' | 'en',
})
  → AiOrchestratorService
  → AiRouterEngine
```

**Post-router gate (prescription-hardened):**

```
PostLlmValidator.validate({
  llmOutput,
  pack,
  taskType: 'PRESCRIPTION_ANALYSIS',
  mode: 'FARMER' | 'VET',
  structuredFacts,
})
  → PASS | SANITIZE | BLOCK | ESCALATE
```

Prescription-specific validations:

- Numeric dose in output ∉ structuredFacts → **BLOCK**
- Rx completion pattern detected in farmer mode → **BLOCK**
- Antibiotic prescription verb without vet flag → **BLOCK** (SP-09)
- Withdrawal stated without citation token → **SANITIZE** or **BLOCK**
- Treatment sequence (multi-drug plan) in farmer mode → **BLOCK** (PX-02)

---

## Core capabilities

### 1. Medicine lookup

**Goal:** Resolve user input (generic name, BN trade name, colloquial term) to a published VKL `Drug` entity.

#### Lookup pipeline

```
User input (text / catalog pick)
  → Query normalizer (BN colloquial → canonical INN)
  → Lexical match on brandNamesBd[], genericName, keywordsBn
  → Semantic match (trade name paraphrase)
  → Species filter (if livestock context set)
  → Ranked DrugMatch[] (max 5)
```

```typescript
DrugMatch {
  entityId: string;
  slug: string;
  genericName: string;
  brandNamesBd: string[];
  drugClass: string;
  prescriptionRequired: boolean;
  registrationStatus?: 'REGISTERED' | 'UNKNOWN' | 'NOT_REGISTERED';
  confidenceScore: number;
  citations: InlineCitation[];
}
```

| Gate | Threshold | Behavior if not met |
|------|-----------|---------------------|
| Minimum for entity display | confidence ≥ 0.70 on match | Show "drug not found" + gap ticket |
| Minimum for safety analysis | entity PUBLISHED + VET_APPROVED dose sections | BLOCK pharmacology claims |
| Ambiguous match (>1 top candidate within 0.05) | — | Disambiguation UI — no LLM until resolved |

### 2. Drug reference

**Goal:** Present vet-approved reference card — indication class, formulation, route, BD availability — without treatment instruction.

**Reference card fields (farmer tier):**

| Field | Source | Citation required |
|-------|--------|-------------------|
| Generic / brand names | `Drug.structuredJson` | Yes |
| Drug class | `Drug.structuredJson` | Yes |
| Formulations available | `Formulation` entities | Yes |
| Prescription required (Y/N) | `Drug.prescriptionRequired` | Yes |
| Registered in BD | `GOVERNED_BY` → `DrugRegistration` | Yes (regulatory) |
| Farmer-safe summary | `summaryBn` | Yes |

**Forbidden on reference card (farmer tier):** dose instructions, duration recommendations, "give/inject/administer" verbs.

### 3. Species restrictions

**Goal:** Deterministically evaluate whether a drug has published dosing or use data for the target species.

```
evaluateSpeciesEligibility(drug, species, context)
  → ELIGIBLE | OFF_LABEL | UNKNOWN | CONTRAINDICATED
```

| Result | Behavior |
|--------|----------|
| `ELIGIBLE` | Proceed to age/weight matrix check |
| `OFF_LABEL` | **BLOCK** (SP-05) + vet referral |
| `UNKNOWN` | **BLOCK** + VKL gap ticket |
| `CONTRAINDICATED` | Safety warning + **BLOCK** dose path + escalate |

Species context sourced from livestock profile: cattle, buffalo, goat, sheep, poultry, duck, pig (future).

### 4. Age restrictions

**Goal:** Match animal age against `SpeciesDoseRow.ageMinDays` / `ageMaxDays` and production stage.

```typescript
AgeEligibilityResult {
  eligible: boolean;
  matchedRow?: SpeciesDoseRow;
  reason?: 'TOO_YOUNG' | 'TOO_OLD' | 'STAGE_MISMATCH' | 'NO_ROW';
  citations: InlineCitation[];
}
```

| Condition | Behavior |
|-----------|----------|
| No row for age band | **BLOCK** dose claims; reference-only mode OK |
| Age unknown | Require age input before R3 analysis |
| Neonatal / geriatric edge | `PROCEED_DEGRADED` + mandatory vet referral |

### 5. Contraindications

**Goal:** Surface all published contraindications for drug + animal context (species, pregnancy, lactation, conditions).

#### Contraindication sources (merged)

1. `Drug.contraindications[]` structured field
2. `CONTRAINDICATES` graph edges (drug → disease/condition/medicine)
3. Session context conditions (from AI Doctor handoff or user-declared)

```typescript
ContraindicationWarning {
  severity: 'ABSOLUTE' | 'RELATIVE' | 'CAUTION';
  condition: string;
  descriptionBn: string;
  citations: InlineCitation[];
  source: 'structured' | 'graph';
}
```

| Severity | Farmer tier | Vet tier |
|----------|-------------|----------|
| `ABSOLUTE` | **BLOCK** + escalate | Highlight in validation report |
| `RELATIVE` | Warning + vet referral | Highlight — vet decides |
| `CAUTION` | `PROCEED_DEGRADED` | Annotate |

**Pregnancy/lactation (SP-04):** Any medicine query with `pregnancy=true` or `lactating=true` → minimum `PROCEED_DEGRADED`; antimicrobial or category D/X → **BLOCK** + `VET_CALL_NOW`.

### 6. Withdrawal period lookup

**Goal:** Return milk, meat, and egg withdrawal periods with regulatory citation for food-producing animals.

#### Withdrawal resolution

```
resolveWithdrawal(drug, species, productType[])
  → REQUIRES_WITHDRAWAL edges
  → WithdrawalRule entities
  → SlaughterWithdrawal regulatory overlay (REGULATORY_BD)
  → max(withdrawalDays) across applicable tissues
```

```typescript
WithdrawalSummary {
  drugSlug: string;
  species: LivestockSpecies;
  periods: Array<{
    productType: 'MILK' | 'MEAT' | 'EGG' | 'ORGAN';
    withdrawalDays: number;
    regulatoryBasis?: string;
    citations: InlineCitation[];
  }>;
  confidenceScore: number;
}
```

| Gate | Rule |
|------|------|
| Food-producing species | Withdrawal citation **mandatory** (SP-06) |
| Missing withdrawal for registered drug | **BLOCK** + gap ticket |
| Regulatory vs VKL conflict | Regulatory wins (SP-02) → higher value + audit flag |

### 7. Drug interaction analysis

**Goal:** Evaluate pairwise and N-way interactions for a set of medicines (vet mode) or single-drug interaction query (farmer mode).

#### Interaction traversal

```
Input: drugSlugs[] (1–8 drugs)
  → For each pair (A, B): traverse INTERACTS_WITH edges (both directions)
  → Merge severity: max(CLINICAL_SIGNIFICANCE)
  → Include active metabolite edges if modeled
  → Build InteractionBundle
```

```typescript
DrugInteraction {
  drugA: string;
  drugB: string;
  severity: 'MILD' | 'MODERATE' | 'SEVERE' | 'CONTRAINDICATED';
  mechanismBn?: string;
  clinicalEffectBn?: string;
  recommendationTier: 'MONITOR' | 'AVOID' | 'CONTRAINDICATED';
  citations: InlineCitation[];
}

InteractionBundle {
  pairs: DrugInteraction[];
  unresolvedPairs: Array<{ drugA: string; drugB: string; reason: 'NO_EDGE' }>;
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CONTRAINDICATED';
}
```

| Condition | Routing |
|-----------|---------|
| All pairs resolved with citations | `PROCEED` (vet) / warnings (farmer) |
| Any `CONTRAINDICATED` pair | **BLOCK** farmer dose path; vet report highlight |
| Any unresolved pair for proposed Rx | **BLOCK** vet validation — "insufficient data" |
| ≥3 drugs (polypharmacy) | `PROCEED_DEGRADED` minimum |

### 8. Vaccine interaction checks

**Goal:** Detect conflicts between medicines and recent/upcoming vaccination (live vaccines, immunosuppression, antibiotic interference with biologics).

#### Cross-domain check

```
Input: drugSlugs[], vaccineSlugs[] | vaccinationHistory (user/vet supplied)
  → MEDICINE + VACCINE graph expansion
  → Edge types: custom VACCINE_MEDICINE_CONFLICT (future) + INTERACTS_WITH cross-domain
  → Protocol rules: e.g., live vaccine + immunosuppressive antibiotic window
  → VaccineInteractionReport
```

```typescript
VaccineMedicineConflict {
  medicineSlug: string;
  vaccineSlug: string;
  conflictType: 'LIVE_VACCINE_ANTIBIOTIC' | 'IMMUNOSUPPRESSION' | 'TIMING_WINDOW' | 'CONCURRENT_ADMIN';
  severity: 'MODERATE' | 'SEVERE';
  recommendedWindowBn: string;       // e.g., "avoid 7 days before/after"
  citations: InlineCitation[];
}
```

| Scenario | Behavior |
|----------|----------|
| Farmer asks "can I deworm after FMD vaccine?" | Retrieve schedule + interaction → cited guidance + vet confirm |
| Vet validates Rx against herd vaccination calendar | Full cross-check in validation report |
| Unknown vaccine product | **BLOCK** + Vaccine Assistant handoff offer |
| Live vaccine + high-risk antibiotic | **BLOCK** + `VET_CALL_NOW` if farmer intends same-day admin |

### 9. Safety warnings

**Goal:** Aggregate all safety signals into a single **`PrescriptionSafetyReport`** consumed by UI and LLM context.

```typescript
PrescriptionSafetyReport {
  reportId: string;
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  warnings: SafetyWarning[];
  contraindications: ContraindicationWarning[];
  interactions: DrugInteraction[];
  vaccineConflicts: VaccineMedicineConflict[];
  regulatoryFlags: RegulatoryFlag[];
  withdrawalSummary?: WithdrawalSummary;
  escalationRequired: boolean;
  escalationType?: EscalationType;
  blockReasons: string[];
  citations: InlineCitation[];
}

SafetyWarning {
  code: string;           // e.g. 'SP-04-PREGNANCY', 'PX-06-OFF-LABEL'
  severity: 'INFO' | 'CAUTION' | 'HIGH' | 'CRITICAL';
  messageBn: string;
  messageEn: string;
  citationRequired: boolean;
}
```

**Warning precedence (highest wins for routing):**

1. Banned substance (regulatory) → **BLOCK**
2. Absolute contraindication → **BLOCK**
3. CRITICAL interaction → **BLOCK** (farmer) / highlight (vet)
4. Pregnancy/lactation antimicrobial → **BLOCK** or escalate
5. Off-label species → **BLOCK**
6. Missing dose fact → **BLOCK**
7. Relative contraindication → `PROCEED_DEGRADED`
8. Informational → `PROCEED`

### 10. Escalation rules

**Goal:** Auditable path to licensed veterinary care when policy or safety requires human judgment.

#### Escalation triggers

| Trigger ID | Condition | Escalation type |
|------------|-----------|-----------------|
| `PRESCRIPTION_BLOCK` | VRE routing `BLOCK` | `VET_BOOKING` + `ASYNC_VET_REVIEW` |
| `BANNED_SUBSTANCE` | Regulatory overlay match | `REGULATORY_REFERRAL` + `VET_CALL_NOW` |
| `PREGNANCY_MEDICINE` | SP-04 fired | `VET_CALL_NOW` or `VET_BOOKING` |
| `ANTIBIOTIC_FARMER` | SP-09 — farmer antibiotic intent | `VET_BOOKING` (mandatory) |
| `OFF_LABEL_SPECIES` | SP-05 | `VET_BOOKING` |
| `UNRESOLVED_INTERACTION` | Missing graph edge on proposed Rx | `ASYNC_VET_REVIEW` |
| `POLYPHARMACY_HIGH_RISK` | ≥3 drugs + any MODERATE+ interaction | `ASYNC_VET_REVIEW` |
| `LOW_CONFIDENCE_DEGRADED` | Pack avg < 0.80 | `ASYNC_VET_REVIEW` |
| `USER_REQUESTED_VET` | User taps "Ask vet" | User-selected type |
| `VET_VALIDATION_REQUEST` | Vet submits Rx for check | `ASYNC_VET_REVIEW` (peer review, optional) |
| `AI_DOCTOR_HANDOFF` | Treatment intent from Doctor case | `VET_BOOKING` + Prescription session |

```typescript
AiEscalationRecord {
  id: string;
  sessionId: string;
  caseId?: string;                    // AI Doctor handoff
  assistantId: 'prescription';
  triggerRuleId: string;
  escalationType: EscalationType;
  drugSnapshot: { slugs: string[]; species: string };
  safetyReportId?: string;
  packId?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}
```

---

## Access modes

Prescription Assistant operates in two **mutually enforced modes**:

| Mode | Audience | API scope | Dose in response | Rx generation |
|------|----------|-----------|------------------|---------------|
| **FARMER_REFERENCE** | Farmer mobile | `pranidoctor_user` | **Never actionable** — fact cards only | **Forbidden** (PX-01–03) |
| **VET_VALIDATION** | Doctor web app | `pranidoctor-web` | Vet-entered doses validated against VKL | **Forbidden** — vet signs externally |

Mode is resolved from **auth context** (farmer JWT vs vet license claim) — not from user self-declaration.

---

## User flows

### Flow F1 — Farmer medicine lookup (reference only)

```
Farmer opens Prescription Assistant from livestock profile
  → Species, age, pregnancy, weight pre-filled
  → Enters drug name (BN colloquial or catalog search)
  → System: medicine lookup → entity match
  → VRE retrieve (prescription-v1) — reference sections only
  → PrescriptionSafetyReport (contraindications, registration, class)
  → UI: Drug Reference Card + Safety Warnings + citations
  → Banner: "ঔষধ প্রয়োগের আগে অবশ্যই ভেটেরিনারianের পরামর্শ নিন"
  → NO dose recommendation
  → FAB: "ভেটের সাথে কথা বলুন"
```

### Flow F2 — Farmer withdrawal inquiry

```
Farmer: "গরুর মাংস বিক্রির আগে কত দিন অপেক্ষা?"
  → Drug + species required (prompt if missing)
  → VRE: MEDICINE withdrawal chunks + REGULATORY_BD overlay
  → structuredFacts: WITHDRAWAL_DAYS present?
     YES → Withdrawal fact card (cited) + BN explanation (LLM allowed)
     NO  → BLOCK + vet booking
  → SP-06: milk/meat citation visible
```

### Flow F3 — Farmer interaction question

```
Farmer: "এই antibiotic আর worm medicine একসাথে দেওয়া যাবে?"
  → Resolve both drugs
  → InteractionBundle evaluator (pre-LLM)
  → Severity CONTRAINDICATED or SEVERE → BLOCK actionable guidance + escalate
  → MODERATE/MILD → Warning cards (cited) + "confirm with vet" — no dosing
  → Unresolved pair → BLOCK + async vet review
```

### Flow F4 — Farmer blocked (fail-closed)

```
Farmer: "মাস্টাইটিসের জন্য কত ml antibiotic দেব?"
  → Intent: dose recommendation (R3)
  → Farmer tier → PX-03 enforced
  → VRE may retrieve dose facts
  → Orchestrator: structured facts rendered as **reference excerpt** ONLY
  → LLM narrative with dose → **BLOCKED**
  → Template: "Dosage must be confirmed by a licensed veterinarian"
  → Escalation: VET_BOOKING (mandatory)
  → Audit: FARMER_DOSE_REQUEST_BLOCKED
```

### Flow F5 — AI Doctor handoff

```
Farmer in AI Doctor session asks treatment/dose question (AD-03)
  → Doctor orchestrator detects TREATMENT_INTENT
  → EmergencyHandoff-style PrescriptionHandoff:
       preservedContext: { caseId, symptomSnapshot, species, differentials[] }
  → Prescription session created (mode=FARMER_REFERENCE)
  → Pre-fill: condition context for contraindication check
  → Do NOT carry diagnosis certainty language into Prescription
  → Safety report includes condition-linked contraindications
  → Escalation recommended (Doctor case urgency inherited)
```

### Flow F6 — Unknown drug

```
User enters drug not in VKL
  → Lookup: zero matches above threshold
  → BLOCK — no LLM pharmacology
  → VKL gap ticket: { query, species, locale, sessionId }
  → Editorial queue priority: HIGH (medicine ingest)
  → User: "This medicine is not in our verified database" + vet CTA
```

---

## Vet flows

### Flow V1 — Prescription validation (doctor app)

```
Vet opens Prescription Validation from consultation workflow
  → Mode: VET_VALIDATION (license verified)
  → Vet enters proposed Rx:
       drugs[], dose per drug, route, frequency, duration
  → Livestock context: species, age, weight, pregnancy, lactation
  → Recent vaccination history (optional)
  → Orchestrator:
       1. Medicine lookup (all drugs)
       2. Species/age matrix validation per drug
       3. InteractionBundle (all pairs)
       4. VaccineMedicineConflict check
       5. WithdrawalSummary (max across Rx)
       6. PrescriptionSafetyReport
       7. VRE retrieve for narrative context
       8. LLM: validation summary ONLY (no new drugs suggested)
  → Output: PrescriptionValidationReport
       - per-drug: IN_RANGE | OUT_OF_RANGE | NO_DATA
       - interactions highlighted
       - withdrawal max days
       - contraindications
       - vet decision remains with vet
  → Vet signs Rx in practice management system (outside AI)
  → Audit: full Rx snapshot + reportId + packId
```

### Flow V2 — Vet drug reference (quick lookup)

```
Vet searches INN or brand name
  → EN-primary retrieval (prescription-v1 locale preference)
  → Full structured reference including dose matrix rows
  → Citations with evidence level + source
  → No LLM required if structured display sufficient
  → Optional LLM: clinical notes from VKL body (doctor audience)
```

### Flow V3 — Vet interaction-only check

```
Vet enters 2–8 drugs (no doses)
  → Skip dose matrix validation
  → InteractionBundle + vaccine cross-check
  → Deterministic report — LLM optional for mechanism explanation
  → Fast path: no router if graph complete
```

### Flow V4 — Vet escalation to peer review

```
Validation report: unresolved interaction or OFF_LABEL concern
  → Vet taps "Request peer review"
  → ASYNC_VET_REVIEW with Rx snapshot + safety report
  → Senior vet / CVQ queue (6B.4 governance)
  → Out of band from farmer escalation
```

---

## Safety controls

### Pre-LLM controls (deterministic)

| Control ID | Check | Fail action |
|------------|-------|-------------|
| **SC-01** | Auth mode resolution (farmer vs vet) | Reject misclassified R3 |
| **SC-02** | Intent classification (lookup vs dose vs plan vs interaction) | Route to correct pipeline |
| **SC-03** | Regulatory banned substance match | BLOCK + REGULATORY_REFERRAL |
| **SC-04** | Species eligibility | BLOCK if OFF_LABEL |
| **SC-05** | Age/stage matrix | BLOCK dose path if no row |
| **SC-06** | Pregnancy/lactation policy (SP-04) | BLOCK or escalate |
| **SC-07** | VRE routing decision | No LLM on BLOCK |
| **SC-08** | structuredFacts presence for claim class | BLOCK |
| **SC-09** | vetApproved on dosage chunks | Exclude unapproved chunks |
| **SC-10** | Antibiotic farmer intent (SP-09) | BLOCK + escalate |

### Post-LLM controls

| Control ID | Check | Fail action |
|------------|-------|-------------|
| **SC-11** | Numeric dose lock (PX-04) | BLOCK output |
| **SC-12** | Rx completion pattern (PX-01) | BLOCK output |
| **SC-13** | Treatment sequence (PX-02) | BLOCK output |
| **SC-14** | Prescription verb filter (SP-09) | SANITIZE or BLOCK |
| **SC-15** | Citation coverage ≥ 90% pharmacology claims | SANITIZE |
| **SC-16** | Withdrawal without citation (SP-06) | BLOCK |
| **SC-17** | Contradiction with structuredFacts | BLOCK |

### UX safety controls

| Control | Requirement |
|---------|-------------|
| Persistent disclaimer | BN vet-supervision disclaimer on every screen (SP-03) |
| Mode badge | Farmer sees "Reference only — not a prescription" |
| Antibiotic banner | Additional governance notice when antimicrobial class detected |
| Escalation FAB | Visible on all non-LOW safety reports |
| No dead ends on BLOCK | Always vet CTA + optional async review |
| Tap-for-source | Every clinical fact links to VKL citation |

---

## Citation requirements

### Normative citation contract

Every pharmacology claim in user-visible output must map to an **`InlineCitation`** resolvable to a published VKL version + chunk.

```typescript
InlineCitation {
  token: string;              // e.g. [cite:med-oxytetracycline:dose:1]
  entityId: string;
  versionId: string;
  chunkIndex?: number;
  sourceKey: string;
  evidenceLevel: EvidenceLevel;
  trustTier: number;
  locator?: string;           // section: dose | withdrawal | interaction
}
```

### Citation requirements by output type

| Output type | Min citations | Source requirements | Farmer display |
|-------------|---------------|---------------------|----------------|
| Drug identity | 1 | MEDICINE entity, trustTier ≤ 2 | Required |
| Drug class / indication summary | 1 | VET_APPROVED chunk | Required |
| Dose range (reference card) | 2 | DOSE section + source with trustTier ≤ 2 | Fact card — vet banner |
| Withdrawal period | 2 | WithdrawalRule + regulatory if BD | Required |
| Interaction severity | 2 | INTERACTS_WITH edge sources (both drugs) | Required |
| Contraindication | 1 | CONTRAINDICATES or structured field | Required |
| Registration status | 1 | DrugRegistration (L5 preferred) | Required |
| Banned substance | 1 | BannedSubstance regulatory entity | Template only |
| Vaccine conflict | 2 | VACCINE + MEDICINE sources | Required |

### Citation block assembly (VRE)

- `citationBlock` token budget: 600 tokens minimum reserved in `prescription-v1`
- Locale: EN first for vet; BN first for farmer with EN INN in parentheses
- **Never drop** regulatory ban citations during token trim
- Re-review banner (6B.4 R1): append "Under veterinary re-review" when `REVIEW_DUE` flag set

### Citation failure behavior

| Condition | Action |
|-----------|--------|
| Claim with zero citation mapping | Post-LLM BLOCK |
| Citation to deprecated version | Re-retrieve; if unavailable → BLOCK |
| Source trustTier > 2 for dose claim | Exclude claim → BLOCK dose path |
| Provisional evidence (pre-vet) | Never in retrieval — governance gate |

---

## Confidence requirements

### Confidence layers

| Layer | Computed from | Farmer display | Vet console |
|-------|---------------|----------------|-------------|
| **Retrieval confidence** | VRE `confidenceSummary.avg` | Tier badge | Numeric + chunk list |
| **Structured fact confidence** | Per-fact extractor score | Hidden | Per-fact 0–1 |
| **Interaction confidence** | Edge weight × evidence | "Verified / Limited" | Edge detail |
| **Safety report confidence** | Weighted merge | Overall risk badge | Full breakdown |
| **Response confidence** | Post-LLM validator pass + citation coverage | Disclaimer tier | Audit log |

### Confidence tiers (farmer UX)

| Tier | Numeric range | Badge (BN) | Routing |
|------|---------------|------------|---------|
| **Verified** | avg ≥ 0.85 | "যাচাইকৃত তথ্য" | PROCEED (reference) |
| **Moderate** | 0.75 – 0.84 | "ভেটের পরামর্শ নিন" | PROCEED_DEGRADED |
| **Insufficient** | < 0.75 | "যথেষ্ট তথ্য নেই" | BLOCK — no LLM |

### Confidence tiers (vet UX)

| Tier | Numeric range | Display |
|------|---------------|---------|
| **High** | ≥ 0.85 | Green — suitable for validation |
| **Acceptable** | 0.75 – 0.84 | Amber — confirm edge cases |
| **Insufficient** | < 0.75 | Red — do not rely; missing VKL data |

### Gate matrix (normative)

| Scenario | minConfidence | minEvidence | structuredFacts | LLM (farmer) | LLM (vet) |
|----------|---------------|-------------|-------------------|--------------|-----------|
| Drug lookup / reference | 0.70 | L2 | DRUG_IDENTITY | Optional | Optional |
| Withdrawal lookup | 0.75 | L2 | WITHDRAWAL_DAYS | Yes | Yes |
| Interaction check | 0.75 | L2 | INTERACTION_SEVERITY | Yes (explain) | Yes |
| Contraindication | 0.75 | L2 | CONTRAINDICATION_FLAG | Yes (warn) | Yes |
| Dose validation | 0.75 | L2 | DOSE_* | **No** | Yes (validation narrative) |
| Regulatory ban | 0.80 | L5/L2 | BANNED_SUBSTANCE | **No** | Template |
| Vaccine interaction | 0.75 | L2 | VACCINE_MEDICINE_CONFLICT | Yes | Yes |
| Polypharmacy (≥3 drugs) | 0.80 | L2 | All pairs resolved | **No** | Degraded OK |

### Confidence downgrade rules

- Missing animal weight when dose matrix is weight-band-specific → cap at 0.74 → BLOCK dose
- Trade name only match (no generic resolution) → cap at 0.70
- Single-source manufacturer label for off-label species → OFF_LABEL BLOCK regardless of score
- Mixed BN/EN query with low lexical recall → apply 6C.13 degraded flag
- Entity in `REVIEW_DUE` (6B.4) → downgrade one tier + banner
- `PARTIAL` embedding index (6C) → cap retrieval confidence at 0.78

---

## Complete workflow

### Session lifecycle state machine

```
                    ┌──────────────┐
                    │   CREATED    │
                    └──────┬───────┘
                           │ mode + livestock context set
                           ▼
                    ┌──────────────┐
         ┌─────────│   INTAKE     │◄────────┐
         │         └──────┬───────┘         │
         │                │ drug(s) resolved │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         │    │  REGULATORY_PRECHECK  │      │
         │    └───────────┬───────────┘      │
         │         banned?                  │
         │    yes ────────┼──────── no       │
         │                ▼                  │
         │    ┌───────────────────┐          │
         │    │ BLOCKED_REG       │          │
         │    └─────────┬─────────┘          │
         │              │ escalate           │
         │                                   │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         │    │ SAFETY_ENGINE         │      │
         │    │ (species, age, CI,    │      │
         │    │  interactions, vac)   │      │
         │    └───────────┬───────────┘      │
         │                │                  │
         │    ┌───────────┴───────────┐      │
         │    │                       │      │
         │ CRITICAL│              OK   │      │
         │    ▼                       ▼      │
         │ ┌─────────┐    ┌───────────────────────┐
         │ │ BLOCKED │    │  VKL + VRE RETRIEVE   │
         │ └────┬────┘    └───────────┬───────────┘
         │      │                     │
         │      │              ┌──────┴──────┐
         │      │         BLOCK│        PROCEED*
         │      │              ▼             ▼
         │      │    ┌─────────────────┐  ┌───────────────────────┐
         │      │    │ BLOCKED         │  │ MODE_GATE             │
         │      │    │ (no LLM)        │  │ farmer: ref / vet: val│
         │      │    └────────┬────────┘  └───────────┬───────────┘
         │      │             │                       │
         │      │             │                       ▼
         │      │             │            ┌───────────────────────┐
         │      │             │            │  AI ROUTER (Layer 3)  │
         │      │             │            └───────────┬───────────┘
         │      │             │                        │
         │      │             │                        ▼
         │      │             │            ┌───────────────────────┐
         │      │             │            │ POST_LLM_VALIDATE     │
         │      │             │            └───────────┬───────────┘
         │      │             │                        │
         └──────┴─────────────┴────────────────────────┘
                                    │
                                    ▼
                         ┌───────────────────────┐
                         │ RESPONSE_DELIVERED    │
                         └───────────┬───────────┘
                                     │
                         ┌───────────┴───────────┐
                         │                       │
                         ▼                       ▼
                  ┌────────────┐         ┌───────────────┐
                  │  FOLLOW_UP │         │  ESCALATED    │
                  └────────────┘         └───────────────┘
```

`*` Includes `PROCEED_DEGRADED`.

### End-to-end sequence (vet validation — happy path)

```
Vet            Doctor App           Prescription Orchestrator      Safety Engine        VRE              AI Router
  │                 │                        │                      │                  │                  │
  │── enter Rx ────►│                        │                      │                  │                  │
  │                 │── validate ───────────►│                      │                  │                  │
  │                 │                        │── lookup drugs ─────►│                  │                  │
  │                 │                        │── matrix + CI + IX ──►│ (deterministic)  │                  │
  │                 │                        │── retrieve() ───────────────────────────►│ prescription-v1  │
  │                 │                        │◄─ KnowledgeContextPack + structuredFacts │                  │
  │                 │                        │── if PROCEED ─────────────────────────────────────────────►│
  │                 │                        │◄─ validation narrative ────────────────────────────────────│
  │                 │                        │── postLlmValidate ───►│                  │                  │
  │◄─ validation report + safety + citations ─│                      │                  │                  │
  │                 │                        │── audit + usage log ─►│                  │                  │
```

### End-to-end sequence (farmer dose request — BLOCK path)

```
Farmer         Mobile App           Prescription Orchestrator      VRE                    Response
  │                 │                        │                      │                        │
  │── "how much X?" ►│                        │                      │                        │
  │                 │── analyze (FARMER) ───►│                      │                        │
  │                 │                        │── mode gate: PX-03 ──►│                        │
  │                 │                        │── retrieve() ────────►│                        │
  │                 │                        │◄─ pack + dose facts  │                        │
  │                 │                        │── NO dose LLM ───────────────────────────────►│
  │                 │                        │── render fact card (structured only)           │
  │◄─ reference excerpt + vet CTA + BLOCK banner ─────────────────────────────────────────────│
  │                 │                        │── escalation record ─────────────────────────►│
```

---

## Prescription orchestration layer (conceptual)

New orchestration sits **above** `VeterinaryAssistantService.ask()` — gateway remains transport.

```
AiPrescriptionOrchestrator
├── SessionManager           — session CRUD, mode, livestock binding
├── MedicineLookupService    — drug resolution, disambiguation
├── RegulatoryPrecheckService— banned substance, registration
├── PharmacologySafetyEngine — species, age, CI, interactions, vaccine conflicts
├── WithdrawalService        — withdrawal + regulatory overlay merge
├── ConfidenceService        — multi-layer score aggregation
├── EscalationService        — trigger rules, AiEscalationRecord
├── ModeGateService          — FARMER_REFERENCE vs VET_VALIDATION enforcement
└── PrescriptionTurnExecutor — calls VeterinaryAssistantService when LLM allowed
```

### Session model

```typescript
AiPrescriptionSession {
  id: string;
  userId: string;
  customerId: string;
  mode: 'FARMER_REFERENCE' | 'VET_VALIDATION';
  vetLicenseNo?: string;              // VET_VALIDATION only
  livestockId?: string;
  species: LivestockSpecies;
  ageDays?: number;
  weightKg?: number;
  pregnancy: boolean;
  lactating: boolean;
  locale: 'bn' | 'en';
  drugSlugs: string[];
  proposedRx?: VetProposedRx;         // VET_VALIDATION only
  vaccinationHistory?: VaccineHistoryEntry[];
  safetyReport?: PrescriptionSafetyReport;
  confidence: SessionConfidence;
  doctorCaseId?: string;              // AI Doctor handoff
  escalationIds: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
}

VetProposedRx {
  lines: Array<{
    drugSlug: string;
    doseValue: number;
    doseUnit: 'MG_KG' | 'ML_KG' | 'FIXED';
    route: string;
    frequency: string;
    durationDays: number;
  }>;
}
```

### API surface (conceptual)

| Method | Route | Purpose | Mode |
|--------|-------|---------|------|
| `POST` | `/api/ai/prescription/sessions` | Create session | Both |
| `POST` | `/api/ai/prescription/sessions/:id/lookup` | Medicine lookup | Both |
| `POST` | `/api/ai/prescription/sessions/:id/analyze` | Full safety + optional LLM | Both |
| `POST` | `/api/ai/prescription/sessions/:id/validate` | Vet Rx validation | VET only |
| `POST` | `/api/ai/prescription/sessions/:id/interactions` | Interaction-only check | Both |
| `POST` | `/api/ai/prescription/sessions/:id/withdrawal` | Withdrawal lookup | Both |
| `POST` | `/api/ai/prescription/sessions/:id/escalate` | User-initiated escalation | Both |
| `GET` | `/api/ai/prescription/sessions/:id` | Session replay | Both |
| `POST` | `/assistants/prescription` | **Existing** — low-level turn | Both |

---

## Safety policies (Prescription specific)

| Policy | Rule |
|--------|------|
| **RX-01** | No LLM call without VRE pack (except static i18n templates) |
| **RX-02** | Farmer mode: no actionable dose in LLM output (PX-03) |
| **RX-03** | Vet mode: no autonomous Rx document generation (PX-01) |
| **RX-04** | Treatment plan sequences forbidden in farmer mode (PX-02) |
| **RX-05** | Every pharmacology claim must map to pack citation or structured fact |
| **RX-06** | Post-LLM BLOCK → safe template, not raw output |
| **RX-07** | Regulatory BD facts override LLM (SP-02) |
| **RX-08** | Pregnancy/lactation + medicine → escalate (SP-04) |
| **RX-09** | Log `sessionId`, `packId`, `drugSlugs[]`, `routingDecision`, `safetyReportId` every turn |
| **RX-10** | Farmer BN disclaimer + prescription-specific regulatory disclaimer |
| **RX-11** | Antibiotic class → SP-09 enforcement + extended audit |
| **RX-12** | Unknown drug → VKL gap ticket within same request lifecycle |
| **RX-13** | AI Doctor handoff preserves caseId; no diagnosis language in Prescription output |
| **RX-14** | Withdrawal for food animals requires dual citation (clinical + regulatory when available) |

---

## Integration map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    AI PRESCRIPTION ASSISTANT PRODUCT                     │
├─────────────────────────────────────────────────────────────────────────┤
│  AI Doctor ──TREATMENT_INTENT handoff──► AiPrescriptionSession           │
│  Livestock profile ─────────────────────► species / pregnancy context    │
│  AiPrescriptionOrchestrator ──turn──────► VeterinaryAssistantService     │
│  VeterinaryAssistantService ────────────► KnowledgeRetrievalService (VRE)│
│  KnowledgeRetrievalService ─────────────► VKL MEDICINE + REGULATORY_BD   │
│  PharmacologySafetyEngine ──────────────► VkKnowledgeLink graph          │
│  VeterinaryAssistantService ────────────► AiFoundationService → Router   │
│  PostLlmValidator ◄────────────────────── Router output                  │
│  AiEscalationRecord ────────────────────► Vet inbox                      │
│  VKL gap tickets ───────────────────────► Editorial medicine queue (EG)  │
│  AI Vaccine Assistant ◄── cross-link────► vaccine interaction checks     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Medicine KB governance integration (Phase 6B.4)

| Governance rule | Prescription impact |
|-----------------|---------------------|
| HIGH/CRITICAL medicine entities require Vet Review | Only VET_APPROVED chunks in dose retrieval |
| Approval expiry (R1) | `REVIEW_DUE` banner + confidence downgrade |
| Regulatory dual approval | BD ban/registration entities always dual-signed |
| Change request on dose field | Blocks publish until resolved — prevents stale Rx grounding |
| Conflict C4 (import vs published dose) | Quarantine until editor resolves |

---

## Observability & success metrics

| Metric | Pilot target | Measurement |
|--------|-------------|-------------|
| LLM bypass rate on BLOCK | 100% | Audit: zero router tokens when BLOCK |
| False PROCEED on BLOCK-labeled queries (Bank D) | **0%** | Golden-set eval |
| Citation coverage in pharmacology claims | ≥ 95% | Post-LLM validator + manual sample |
| Farmer dose recommendation leak rate | **0%** | PX-03 output filter audit |
| Autonomous Rx generation attempts blocked | 100% | PX-01 pattern filter |
| Interaction recall (published pairs) | ≥ 90% | Bank D interaction sub-bank |
| Withdrawal citation compliance (food species) | 100% | SP-06 validator |
| Unknown drug → gap ticket creation | 100% | Session audit |
| Vet validation turnaround | < 3 s p95 (no LLM) | Performance trace |
| Escalation rate on farmer R3 queries | Tracked (expect high by design) | Funnel analytics |

### Eval harness extension

Extend Phase 6F Bank D with Prescription session scenarios:

| Corpus | Queries | Validates |
|--------|---------|-----------|
| `prescription-farmer-bn-g1-v1.json` | 25 | Lookup, withdrawal, BLOCK dose |
| `prescription-vet-en-g1-v1.json` | 20 | Validation, interactions |
| `prescription-block-bn-v1.json` | 15 | Ban, off-label, missing facts |
| `prescription-vaccine-ix-v1.json` | 10 | Vaccine–medicine conflicts |

---

## Sub-phase roadmap (Prescription only)

| Sub-phase | Scope | Depends on | Status |
|-----------|-------|------------|--------|
| **6H.1a** | Session model + mode gate + API skeleton | 6D.6 gateway | **Done** |
| **6H.1b** | Medicine lookup + drug reference cards | 6H.1a, Medicine KB corpus | **Done** |
| **6H.1c** | PharmacologySafetyEngine (species, age, CI) | 6H.1b | **Done** |
| **6H.1d** | Interaction + vaccine conflict evaluator | 6H.1c, graph edges | **Done** |
| **6H.1e** | Withdrawal + regulatory overlay merge | 6H.1c, REGULATORY_BD corpus | **Done** |
| **6H.1f** | Farmer flows + PX prohibition enforcement | 6H.1d, 6H.1e | **Done** |
| **6H.1g** | Vet validation orchestrator (doctor app) | 6H.1f | Pending |
| **6H.1h** | AI Doctor handoff + escalation binding | 6H.1f, 6D.1 | **Done** |
| **6H.1i** | Golden-set Bank D + pilot metrics | 6H.1g, 6F | Pending |

**Medicine KB corpus dependency:** Wave 1 MVC (Phase 6E) intentionally excludes formulary. Prescription Assistant pilot requires **Wave 3a Medicine MVC** ingest before 6H.1b production rollout.

---

## Mobile & doctor UX principles

### Farmer mobile (`pranidoctor_user`)

| Pattern | Requirement |
|---------|-------------|
| **Reference-only badge** | Persistent "Not a prescription" header |
| **Drug search** | BN colloquial + trade names; show INN in parentheses |
| **Fact cards** | Structured VKL data — not LLM paragraphs — for doses |
| **Safety stack** | Warnings ordered by severity; red for BLOCK |
| **Withdrawal display** | Milk/meat icons + days + tap-for-source |
| **Interaction view** | Pair cards with severity color + citations |
| **No Rx pad** | No "generate prescription" affordance |
| **Escalation FAB** | Always visible |
| **Doctor handoff context** | Show "From AI Doctor" banner without diagnosis text |

### Doctor web (`pranidoctor-web`)

| Pattern | Requirement |
|---------|-------------|
| **Validation panel** | Side-by-side Rx entry + safety report |
| **Traffic-light dose check** | IN_RANGE / OUT_OF_RANGE / NO_DATA per line |
| **Interaction matrix** | N×N grid for polypharmacy |
| **Withdrawal max** | Highlight longest withhold across Rx |
| **Citation drawer** | Full source text + evidence level |
| **Sign externally** | Clear CTA that signing is outside AI |
| **Peer review trigger** | From unresolved interaction state |

---

## Compliance (Bangladesh)

| Topic | Prescription Assistant policy |
|-------|------------------------------|
| **Practitioner of medicine** | AI never prescribes; farmers directed to BVC-licensed vets |
| **Drugs Act / DGD** | Registration and banned substance facts from REGULATORY_BD overlay |
| **Antibiotic stewardship** | SP-09; no farmer-facing antibiotic dose guidance |
| **Food safety** | Withdrawal periods cite regulatory source; farmer warned on milk/meat |
| **AI disclaimer** | Mandatory BN disclaimer; regulatory disclaimer on medicine screens |
| **Data privacy** | Session data customer-scoped; Rx snapshots encrypted at rest |
| **Record retention** | Prescription sessions retained 24 months minimum |

---

## Appendix A — Retrieval session context

```typescript
sessionContext: {
  sessionId: string;
  mode: 'FARMER_REFERENCE' | 'VET_VALIDATION';
  drugSlugs: string[];
  species: LivestockSpecies;
  ageDays?: number;
  weightKg?: number;
  pregnancy: boolean;
  lactating: boolean;
  proposedRx?: VetProposedRx;
  vaccinationSlugs?: string[];
  doctorCaseId?: string;
  previousPackId?: string;
}
```

---

## Appendix B — Prompt contract slots (prescription_assistant)

| Slot | Source | Required |
|------|--------|----------|
| `groundingInstruction` | VRE pack | Always |
| `citationBlock` | VRE pack | Always |
| `structuredFactsBlock` | VRE pack | Always for R3 |
| `safetyReportBlock` | PharmacologySafetyEngine | Always |
| `modeContract` | ModeGateService | Always — farmer vs vet rules |
| `prohibitionContract` | Static PX-01–03 | Always |
| `regulatoryBlock` | REGULATORY_BD facts | When BD scope |
| `userMessage` | User / vet input | Always |

---

## Appendix C — Structured fact type registry

| Fact type | Schema sketch | Used for |
|-----------|---------------|----------|
| `DRUG_IDENTITY` | `{ genericName, drugClass, slug }` | Lookup |
| `DOSE_MG_KG` | `{ species, min, max, route }` | Validation |
| `DOSE_ML_KG` | `{ species, min, max, route }` | Validation |
| `WITHDRAWAL_DAYS` | `{ species, productType, days }` | Withdrawal |
| `INTERACTION_SEVERITY` | `{ drugA, drugB, severity }` | Interactions |
| `CONTRAINDICATION_FLAG` | `{ condition, severity }` | Safety |
| `BANNED_SUBSTANCE` | `{ substance, banScope }` | Regulatory BLOCK |
| `REGISTRATION_STATUS` | `{ status, registrationNo }` | Reference |
| `VACCINE_MEDICINE_CONFLICT` | `{ medicine, vaccine, conflictType }` | Vaccine ix |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **AI Prescription Assistant** | Vet-supervised pharmacology decision-support (this document) |
| **Fail-closed** | BLOCK path — no LLM when grounding insufficient |
| **PrescriptionSafetyReport** | Aggregated safety signals for a session |
| **FARMER_REFERENCE mode** | Read-only drug facts — no actionable dosing |
| **VET_VALIDATION mode** | Rx checking against VKL — vet signs externally |
| **InteractionBundle** | Pairwise drug interaction evaluation result |
| **KnowledgeContextPack** | VRE output — mandatory input to router |

---

## Document cross-reference

| Document | Relationship |
|----------|--------------|
| `phase-6d-veterinary-ai-assistant.md` | Parent — six assistants, SP policies, gateway |
| `phase-6d-ai-doctor.md` | Sibling — treatment intent handoff |
| `phase-6a-veterinary-knowledge-architecture.md` | Medicine KB, graph edges, retrieval profiles |
| `phase-6b4-editorial-governance.md` | Vet approval, medicine publish gates |
| `phase-6c-rag-engine-architecture.md` | `prescription-v1`, structured facts, fail-closed |
| `phase-6f-golden-set-evaluation.md` | Bank D eval contract |

---

**Document owner:** Principal Veterinary Clinical AI Architect  
**Next review:** Upon Wave 3a Medicine MVC sign-off or doctor app prescription validation UX kickoff
