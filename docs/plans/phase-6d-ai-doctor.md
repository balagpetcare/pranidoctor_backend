# Phase 6D.1 — AI Doctor Product Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary AI Product Architect  
**Date:** 2026-05-31  
**Status:** 6D.1a–6D.1e implemented (backend engines + orchestrator + API) — 2026-05-31  
**Version:** 1.1.0  

**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` — VKL entity model, evidence, symptom graph
- `docs/plans/phase-6b-knowledge-ingestion-architecture.md` — published knowledge, vet approval pipeline
- `docs/plans/phase-6c-rag-engine-architecture.md` — VRE hybrid retrieval, `KnowledgeContextPack`, confidence routing
- `docs/plans/phase-6c13-rag-optimization.md` — pgvector ANN, BN colloquial expansion, post-LLM validation
- `docs/plans/phase-6d-veterinary-ai-assistant.md` — assistant gateway, shared safety, six-assistant registry
- `docs/reports/phase-6c13-rag-optimization-verification.md` — RAG baseline scores and golden-set eval

**Parent scope:** This document is the **deep product architecture for AI Doctor only**. Shared assistant gateway, escalation inbox, and mobile shell patterns remain in `phase-6d-veterinary-ai-assistant.md`.

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | AI Doctor orchestration, case/session state, RAG binding, safety, escalation APIs |
| `pranidoctor-web` | Vet escalation inbox, session replay, VKL gap tickets from AI Doctor usage |
| `pranidoctor_user` | Farmer mobile — AI Doctor journey (symptom intake → differential → escalation) |

---

## Executive summary

**AI Doctor** is Prani Doctor's farmer-facing **clinical decision-support assistant**. It helps livestock owners:

1. **Collect symptoms** systematically (structured + free text, BN colloquial)
2. **Suggest differentials** ranked by evidence — never a definitive diagnosis
3. **Assess risk** using symptom graph + VKL clinical risk tiers
4. **Triage emergencies** with immediate vet redirect when red flags fire
5. **Score confidence** at case, differential, and response levels
6. **Escalate to a licensed vet** when thresholds or policy require human judgment

### Non-negotiable architecture constraint

> **Every AI Doctor response MUST traverse three layers in order. Direct LLM-only medical advice is forbidden.**

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Veterinary Knowledge Layer (VKL)                     │
│    Published entities, symptom graph, evidence, structured facts │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — RAG Engine (VRE)                                     │
│    Hybrid retrieval → KnowledgeContextPack → confidence routing  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — AI Router (AIMS)                                     │
│    Prompt execution ONLY when routing ≠ BLOCK                    │
│    Post-LLM validation before user sees clinical claims          │
└─────────────────────────────────────────────────────────────────┘
```

If Layer 1 or Layer 2 cannot supply sufficient grounded knowledge for the clinical claim class, **the LLM is not invoked** — the user receives a safe template and escalation offer instead.

### Current vs target state

| Capability | Today (6D.0 gateway) | Target (this document) |
|------------|---------------------|------------------------|
| Single-turn chat via `POST /assistants/ai-doctor` | ✅ | Retained as turn transport |
| Symptom taxonomy + rules checker | ✅ (`SymptomCheckerService`) | Becomes **on-ramp** to AI Doctor case |
| Multi-turn symptom collection | ❌ | Structured intake wizard + follow-up questions |
| Differential diagnosis (grounded) | Partial (graph weights only) | Graph + RAG fusion with citations |
| Risk assessment | Partial (bucket in symptom checker) | Unified case risk score |
| Emergency triage | Handoff to Emergency assistant | Inline red-flag gate + auto-handoff |
| Confidence scoring | RAG pack summary only | Case + differential + turn-level scores |
| Human vet escalation | `humanRedirect` flag | Full escalation taxonomy + case binding |

**Backend gateway (6D.0) is implemented.** Phase 6D.1 engines (session, intake, differential, emergency, confidence, escalation) and orchestrator are **implemented** — see § Implementation progress.

---

## Implementation progress (2026-05-31)

| Sub-phase | Scope | Status | Module / artifact |
|-----------|-------|--------|-------------------|
| **6D.1a** | Case model + state machine + API skeleton | **Done** | `ai-doctor/engines/ai-doctor-session.engine.ts`; `POST/GET /api/ai/doctor/cases` |
| **6D.1b** | Symptom intake + completeness + clarification | **Done** | `symptom-intake.engine.ts`; `POST .../cases/:id/intake` |
| **6D.1c** | Triage + emergency detection | **Done** | `emergency-detection.engine.ts`; CRITICAL → skip LLM + escalation |
| **6D.1d** | Differential fusion (graph + VRE) | **Done** | `differential-diagnosis.engine.ts`; citation-required differentials |
| **6D.1e** | Orchestrator + confidence + post-LLM gate | **Done** | `ai-doctor-orchestrator.service.ts`; `POST .../analyze`, `.../escalate` |
| **6D.1f** | Escalation binding + mobile UX | **Pending** | pranidoctor_user |
| **6D.1g** | Golden-set eval + pilot metrics | **Pending** | Extend 6C.13 eval corpora |

**Tests:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — **398 passed** (52 files, incl. 27 AI Doctor tests).

**Verification:** `docs/reports/phase-6d-ai-doctor-verification.md` — Safety 91, Diagnostic 78, Grounding 87, Production Readiness 73.

**Safety guarantees implemented:**
- Fail-closed when case confidence &lt; 0.35, VRE `BLOCK`, or missing grounded citations
- LLM skipped on CRITICAL emergency / red-flag triage
- Treatment-intent queries blocked and escalated
- Post-LLM validation + diagnosis-language sanitization
- All differentials require inline citation tokens

**Case persistence:** `AiAssistantMemory` (`CASE_CONTEXT` kind) — dedicated `AiDoctorCase` table deferred to 6D.1f if needed.

---

### Current vs target state (updated)

| Capability | Before 6D.1 | After 6D.1e |
|------------|-------------|-------------|
| Multi-turn symptom collection | ❌ | ✅ Intake + clarification plan |
| Differential diagnosis (grounded) | Partial | ✅ Graph + RAG fusion with citations |
| Risk assessment | Partial | ✅ Unified `CaseRiskAssessment` |
| Emergency triage | Handoff only | ✅ Inline detection + auto-escalation |
| Confidence scoring | RAG only | ✅ Case + differential + tier badges |
| Human vet escalation | Flag only | ✅ `AiEscalationRecord` binding |

**Backend gateway (6D.0) is implemented.** This plan defines the **complete AI Doctor product workflow** to be built in sub-phases 6D.1a–6D.1g.

---

## Strategic intent (unchanged)

| Principle | AI Doctor interpretation |
|-----------|-------------------------|
| **Educate, don't diagnose** | Language contract: "possible causes" not "your animal has X" |
| **Retrieve before respond** | Every turn runs VRE with `ai-doctor-v1` before router |
| **Symptoms before speculation** | Minimum symptom completeness gate before differential LLM |
| **Red flags trump retrieval** | Emergency lexicon → triage BLOCK path before any LLM |
| **Confidence is visible** | Farmers see tier badges; vets see numeric scores in console |
| **Escalation is success** | Vet handoff is a designed outcome, not an error |
| **Bangla-first** | Colloquial BN in; canonical terms surfaced in parentheses |
| **Species-aware** | Cattle, buffalo, goat, sheep profiles affect graph + retrieval |
| **Audit everything** | Case ID, pack ID, routing decision, escalation reason per turn |

---

## Product boundaries

### In scope — AI Doctor

- Symptom intake (structured taxonomy + free text + optional photo adjunct)
- Differential suggestion (ranked, cited, non-definitive)
- Risk / urgency assessment (LOW → CRITICAL)
- Emergency triage and Emergency Assistant handoff
- Confidence scoring and degraded-mode UX
- Vet escalation (call, book, async review)
- Multi-turn case sessions with clarification loops
- Integration with livestock profile (species, age, pregnancy, weight)

### Out of scope — routed to sibling assistants

| User intent | Route to | Reason |
|-------------|----------|--------|
| Drug dose, prescription, withdrawal | AI Prescription Assistant | R3 fail-closed |
| Immediate first-aid SOP steps | AI Emergency Assistant | R4 SOP-only |
| Vaccination schedule | AI Vaccine Assistant | Schedule facts domain |
| Feed ration / toxic feed | AI Feed Advisor | FEED domain |
| Breeding / heat / dystocia | AI Breeding Advisor → Emergency if red flag | REPRODUCTION domain |

### Explicitly forbidden

- LLM response when `routingDecision.action === 'BLOCK'`
- Treatment or dosage recommendations without VKL structured facts + citation
- Definitive diagnosis phrasing in farmer-facing output
- Bypassing VRE with raw `executePromptTask()` for clinical content
- Offline LLM inference for medical advice (cached SOP titles only for Emergency)

---

## Three-layer stack (detailed)

### Layer 1 — Veterinary Knowledge Layer (VKL)

AI Doctor consumes these VKL domains via VRE profiles:

| Domain | AI Doctor use | Required evidence |
|--------|---------------|-------------------|
| `DISEASE` | Differential entities, symptom associations | ≥ L2 for treatment-adjacent claims |
| `CLINICAL_PROTOCOL` | Workup steps, farmer-safe observation guidance | ≥ L2 |
| `EMERGENCY` | Red-flag SOP cross-reference | ≥ L1 for SOP titles |
| `MEDICINE` | Read-only context (contraindication awareness) — **no dosing** | ≥ L2 if referenced |
| Symptom graph | `AiSymptomNode`, `AiSymptomDiseaseLink` | Graph edges + published entry link |

**Symptom graph role:** Provides deterministic differential priors and red-flag detection **before** RAG. Graph output enriches VRE `sessionContext` — it does not replace RAG for narrative clinical content.

### Layer 2 — RAG Engine (VRE)

| Parameter | AI Doctor value |
|-----------|-----------------|
| `profileId` | `ai-doctor-v1` |
| `taskType` | `DISEASE_ANALYSIS` |
| `domainPriority` | `DISEASE`, `CLINICAL_PROTOCOL`, `EMERGENCY`, `MEDICINE` |
| `minConfidence` | 0.55 (calibrated per 6C.13) |
| `medicalMinConfidence` | 0.55 |
| `minEvidenceLevel` | L2 |
| `failClosed` | **false** for general education; **true** for treatment/dose sub-intents |
| `blockLowConfidenceMedical` | **true** |
| `tokenBudget` | 1,800 |
| `semanticWeight` | 0.50 (symptom paraphrase recall) |

**VRE outputs consumed:**

```typescript
KnowledgeContextPack {
  packId: string;
  chunks: RetrievedChunk[];          // groundable only
  structuredFacts: StructuredFact[];
  citationBlock: string;
  evidenceBlock: string;
  confidenceBlock: string;
  confidenceSummary: { min, max, avg };
  groundingInstruction: string;
  routingDecision: ConfidenceRoutingDecision;
  retrievalMetadata: RetrievalMetadata;
  graphHints?: GraphHint[];         // 6D.1d — DIFFERENTIAL_OF expansion
}
```

**Routing outcomes for AI Doctor:**

| Decision | LLM allowed? | User experience |
|----------|-------------|-----------------|
| `PROCEED` | Yes | Normal differential summary + citations |
| `PROCEED_DEGRADED` | Yes | Caution banner + elevated disclaimer |
| `BLOCK` | **No** | Safe template + vet escalation CTA |
| `ESCALATE_HUMAN` | Optional (emergency adjunct only) | Partial SOP + mandatory escalation card |

### Layer 3 — AI Router (AIMS)

Router executes **only after** VRE returns `PROCEED` or `PROCEED_DEGRADED`:

```
AiFoundationService.executePromptTask({
  promptKey: 'ai_doctor',
  taskType: 'DISEASE_ANALYSIS',
  feature: 'ai_doctor',
  userMessage: enrichedContext,   // pack grounding + case summary
  locale: 'bn' | 'en',
})
  → AiOrchestratorService
  → AiRouterEngine (model route, failover, usage logging)
```

**Post-router gate (6C.13f):**

```
PostLlmValidator.validate({
  llmOutput,
  pack,
  taskType: 'DISEASE_ANALYSIS',
})
  → PASS | SANITIZE | BLOCK | ESCALATE
```

Blocked post-validation output is replaced with safe template — never shown raw to user.

---

## Core capabilities

### 1. Symptom collection

**Goal:** Gather sufficient structured clinical context before differential generation.

#### Intake modes

| Mode | Entry point | Data captured |
|------|-------------|---------------|
| **Guided taxonomy** | Symptom body-system picker | `symptomCodes[]`, species, severity, duration |
| **Free text (BN colloquial)** | Voice or text box | Normalized terms via 6C.13 colloquial map |
| **Livestock profile** | Animal card pre-fill | Species, age, pregnancy, weight estimate |
| **Photo adjunct** | Optional camera | `IMAGE_ANALYSIS` task — suggestive only (SP-08) |
| **Follow-up clarification** | AI Doctor turn 2+ | Targeted questions from `ClarificationPlan` |

#### Symptom completeness model

```typescript
SymptomCompletenessScore {
  score: number;           // 0.0 – 1.0
  requiredFieldsMet: boolean;
  missingFields: ('duration' | 'severity' | 'body_system' | 'progression')[];
  redFlagScreened: boolean;
}
```

| Gate | Threshold | Behavior if not met |
|------|-----------|---------------------|
| Minimum for differential LLM | completeness ≥ 0.60 AND ≥1 symptom signal | Ask clarifying questions (no LLM) |
| Minimum for degraded differential | completeness ≥ 0.40 | Graph-only differentials + "tell us more" |
| Red-flag screen | Always before LLM | Emergency path if any red flag |

#### Clarification question generation

Clarification questions are sourced from:

1. **VKL `ClinicalProtocol` structured fields** (missing duration, severity)
2. **Symptom graph** (discriminating symptoms between top-2 differentials)
3. **Never from LLM invention** — question templates are VKL-backed or static i18n

```
IF completeness < 0.60:
  → build ClarificationPlan from graph discriminators
  → return questions[] WITHOUT calling AiRouterEngine
  → persist case state: AWAITING_CLARIFICATION
```

### 2. Differential diagnosis

**Goal:** Present ranked possible conditions grounded in VKL — educational, not definitive.

#### Differential fusion pipeline

```
Symptom graph weights (deterministic)
        +
VRE retrieved disease chunks (semantic + lexical)
        +
Graph expansion DIFFERENTIAL_OF (1-hop, 6D.1d)
        ↓
DifferentialRanker (weighted merge, dedupe by slug)
        ↓
GroundedDifferential[] (max 5, each requires ≥1 citation OR graph edge to published entry)
```

```typescript
GroundedDifferential {
  slug: string;
  titleBn: string;
  titleEn: string;
  rank: number;                    // 1 = most likely
  confidenceScore: number;         // 0.0 – 1.0 fused
  evidenceLevel: 'L1' | 'L2' | 'L3' | 'L4';
  supportingSymptoms: string[];
  citations: InlineCitation[];
  source: 'graph' | 'rag' | 'fused';
  disclaimerTier: 'educational';
}
```

#### Language contract (farmer BN)

| Allowed | Forbidden |
|---------|-----------|
| "সম্ভাব্য কারণগুলোর মধ্যে…" | "আপনার গরu's mastitis হয়েছে" |
| "এই লক্ষণগুলো দেখা যায়…" | "নিশ্চিত রোগ: …" |
| "চিকিৎসক পরীক্ষা ছাড়া নিশ্চিত নয়" | "আপনি নিজেই চিকিৎসা করুন" |

LLM prompt slot receives `groundingInstruction` + `citationBlock` + explicit **non-diagnosis contract**. Post-LLM filter blocks definitive patterns.

#### Empty differential handling

| Condition | Action |
|-----------|--------|
| Graph + RAG both empty | `BLOCK` — no LLM; escalation offer |
| Graph only, RAG empty | `PROCEED_DEGRADED` — graph differentials with strong disclaimer |
| RAG low confidence | `PROCEED_DEGRADED` or `BLOCK` per medicalMinConfidence |

### 3. Risk assessment

**Goal:** Assign urgency tier driving triage messaging and escalation triggers.

#### Risk inputs

| Signal | Source | Weight |
|--------|--------|--------|
| Red-flag symptoms | Symptom graph `redFlag=true` | **Override → CRITICAL** |
| Free-text emergency lexicon | `detectEmergencyIntent()` | **Override → CRITICAL** |
| Symptom severity (user) | Intake form | HIGH if SEVERE |
| Duration > threshold | Intake form | MEDIUM+ if prolonged |
| Disease clinical risk tier | VKL chunk `clinicalRiskTier` | HIGH if HIGH/CRITICAL |
| Species + production stage | Livestock profile | Modifier (e.g., dairy cow mastitis) |
| Confidence summary avg | VRE pack | LOW confidence → elevate caution |

#### Risk output model

```typescript
CaseRiskAssessment {
  urgencyTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  triageBucket: AiRiskBucket;       // aligns with existing symptom checker
  urgencyLevel: number;             // 1–5 (5 = immediate vet)
  redFlags: RedFlagItem[];
  recommendationBn: string;         // templated, not LLM-only
  escalationRequired: boolean;
  escalationType?: EscalationType;
}
```

#### Risk → action matrix

| urgencyTier | LLM differential? | Escalation | Home care in response? |
|-------------|-------------------|------------|------------------------|
| LOW | Yes (if gates pass) | Optional FAB | Only if VKL farmer-tier SOP exists |
| MEDIUM | Yes | Recommended | Observation guidance only |
| HIGH | Degraded or BLOCK | **Recommended** | No treatment steps |
| CRITICAL | **No** — Emergency handoff | **Mandatory VET_CALL_NOW** | First-aid SOP from EMERGENCY domain only |

### 4. Emergency triage

**Goal:** Detect time-critical situations and route to Emergency Assistant or vet call before speculative LLM content.

#### Red-flag detection (deterministic, pre-LLM)

```
Input: symptomCodes + freeText + species
  → Symptom graph redFlag nodes
  → EMERGENCY_QUERY_PATTERNS (BN + EN)
  → assessSymptomRisk() (existing guardrails)
IF any CRITICAL:
  → case.state = EMERGENCY_TRIAGE
  → SKIP differential LLM
  → invoke Emergency Assistant OR static emergency template
  → create AiEscalationRecord (RED_FLAG_SYMPTOM)
  → audit: TRIAGE_RED_FLAG
```

#### Emergency handoff contract

```typescript
EmergencyHandoff {
  fromAssistant: 'ai-doctor';
  toAssistant: 'emergency';
  caseId: string;
  preservedContext: {
    symptomCodes: string[];
    species: LivestockSpecies;
    redFlags: RedFlagItem[];
    freeTextSummary: string;
  };
  skipLlmOnDoctor: true;
}
```

User sees: immediate "Call vet now" header (SP-07) + option to continue in Emergency Assistant.

#### Symptom checker alignment (G6 closure)

Today `SymptomCheckerService` returns differentials without explicit BLOCK signal when RAG fails. AI Doctor case model **surfaces**:

```typescript
symptomCheckResult: {
  sessionId: string;
  triageBucket: AiRiskBucket;
  differentials: GroundedDifferential[];
  ragAvailable: boolean;           // NEW — explicit signal
  suggestAiDoctor: boolean;        // true when user wants explanation
}
```

---

### 5. Confidence scoring

**Goal:** Transparent, multi-level confidence for farmers (tiers) and vets (numeric).

#### Confidence layers

| Layer | Computed from | Farmer display | Vet console |
|-------|---------------|----------------|-------------|
| **Retrieval confidence** | VRE `confidenceSummary.avg` | Hidden | Numeric + chunk list |
| **Differential confidence** | Graph weight × RAG score fusion | "Strong / Moderate / Limited evidence" | Per-slug 0–1 |
| **Case confidence** | Weighted: completeness + retrieval + differential top-1 | Badge on response | Case dashboard |
| **Response confidence** | Post-LLM validator pass + citation coverage | Disclaimer tier | Audit log |

#### Confidence tiers (farmer UX)

| Tier | Numeric range | Badge (BN) | Routing interaction |
|------|---------------|------------|---------------------|
| **Strong** | avg ≥ 0.70 | "শক্ত প্রমাণ" | PROCEED |
| **Moderate** | 0.50 – 0.69 | "মাঝারি প্রমাণ — চিকিৎসক নিশ্চিত করুন" | PROCEED_DEGRADED |
| **Limited** | 0.35 – 0.49 | "সীমিত তথ্য" | PROCEED_DEGRADED + escalation nudge |
| **Insufficient** | < 0.35 or BLOCK | "পর্যাপ্ত তথ্য নেই" | BLOCK — no LLM |

#### Confidence downgrade rules

- Missing duration → cap case confidence at 0.55
- Single vague symptom → cap differential count at 3
- Image-only input without text → cap at 0.45 (adjunct cannot drive diagnosis)
- Mixed BN/EN colloquial with low RAG recall → apply 6C.13 degraded flag

---

### 6. Human vet escalation

**Goal:** Seamless, auditable path to licensed veterinary care.

#### Escalation triggers

| Trigger ID | Condition | Escalation type |
|------------|-----------|-----------------|
| `RED_FLAG_SYMPTOM` | CRITICAL urgency | `VET_CALL_NOW` |
| `RETRIEVAL_FAIL_CLOSED` | VRE BLOCK | `VET_BOOKING` + `ASYNC_VET_REVIEW` |
| `LOW_CONFIDENCE_DEGRADED` | Case confidence < 0.50 after turn | `ASYNC_VET_REVIEW` |
| `USER_REQUESTED_VET` | User taps "Talk to vet" | User-selected type |
| `TREATMENT_INTENT` | User asks dose/drug mid-session | Handoff to Prescription + `VET_BOOKING` |
| `POLICY_REFUSAL` | Pre-check or post-LLM BLOCK | `VET_BOOKING` |
| `PREGNANCY_MEDICINE` | SP-04 fired | `VET_CALL_NOW` or `VET_BOOKING` |

#### Escalation record

```typescript
AiEscalationRecord {
  id: string;
  caseId: string;
  sessionId: string;
  assistantId: 'ai-doctor';
  triggerRuleId: string;
  escalationType: EscalationType;
  packId?: string;
  urgencyTier: string;
  symptomSnapshot: object;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: DateTime;
}
```

#### Escalation UX (mobile)

- Persistent **"ভেটের সাথে কথা বলুন"** FAB on all R2+ sessions
- One-tap call (if tele-vet configured)
- Clinic finder map integration
- Async review: attach case summary + citations for vet inbox (6D.7)

---

## Complete workflow

### Case lifecycle state machine

```
                    ┌──────────────┐
                    │   CREATED    │
                    └──────┬───────┘
                           │ livestock + species set
                           ▼
                    ┌──────────────┐
         ┌─────────│   INTAKE     │◄────────┐
         │         └──────┬───────┘         │
         │                │ symptoms submitted
         │                ▼                 │
         │    ┌───────────────────────┐     │
         │    │  RED_FLAG_SCREEN      │     │
         │    └───────────┬───────────┘     │
         │         CRITICAL?                │
         │    yes ────────┼──────── no       │
         │                ▼                  │
         │    ┌───────────────────┐          │
         │    │ EMERGENCY_TRIAGE  │          │
         │    └─────────┬─────────┘          │
         │              │ handoff            │
         │              ▼                    │
         │    [Emergency Assistant]          │
         │                                   │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         │    │ COMPLETENESS_CHECK    │      │
         │    └───────────┬───────────┘      │
         │         < 0.60?                   │
         │    yes ────────┼──────── no        │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         └────│ AWAITING_CLARIFICATION│──────┘
              └───────────┬───────────┘
                          │ completeness OK
                          ▼
              ┌───────────────────────┐
              │  VKL + VRE RETRIEVE   │  ← Layer 1 + 2
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         BLOCK│                  PROCEED*
              ▼                       ▼
    ┌─────────────────┐    ┌───────────────────────┐
    │ BLOCKED         │    │ DIFFERENTIAL_GENERATE │
    │ (no LLM)        │    └───────────┬───────────┘
    └────────┬────────┘                │
             │                         ▼
             │              ┌───────────────────────┐
             │              │  AI ROUTER (Layer 3)  │
             │              └───────────┬───────────┘
             │                          │
             │                          ▼
             │              ┌───────────────────────┐
             │              │ POST_LLM_VALIDATE     │
             │              └───────────┬───────────┘
             │                    BLOCK?│
             │                          ▼
             └──────────►┌───────────────────────┐
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

### End-to-end sequence (happy path)

```
Farmer          Mobile App           AI Doctor Orchestrator        VKL/VRE              AI Router
  │                 │                        │                      │                      │
  │── open animal ─►│                        │                      │                      │
  │                 │── create case ────────►│                      │                      │
  │                 │                        │── load livestock ───►│ (profile)            │
  │◄─ symptom UI ───│                        │                      │                      │
  │── pick symptoms + BN text ──────────────►│                      │                      │
  │                 │                        │── graph lookup ─────►│ SymptomGraph         │
  │                 │                        │── red-flag screen ──►│ (deterministic)      │
  │                 │                        │── retrieve() ───────►│ VRE ai-doctor-v1     │
  │                 │                        │◄─ KnowledgeContextPack                      │
  │                 │                        │── fusion differentials│                     │
  │                 │                        │── if PROCEED ──────────────────────────────►│
  │                 │                        │◄─ llmOutput ────────────────────────────────│
  │                 │                        │── postLlmValidate ───►│                      │
  │◄─ differential + citations + confidence ─│                      │                      │
  │                 │                        │── persist turn ──────►│ AiVeterinarySession  │
  │                 │                        │── audit + usage log ─►│ AiUsageLog           │
```

### End-to-end sequence (BLOCK path — no LLM)

```
Farmer          AI Doctor Orchestrator        VRE                    Response
  │                    │                       │                        │
  │── "antibiotic for mastitis" ─────────────►│                        │
  │                    │── retrieve() ────────►│                        │
  │                    │◄─ BLOCK (medical intent, no chunks)            │
  │                    │── NO router call ─────────────────────────────►│
  │◄─ safe template + vet CTA ───────────────────────────────────────────│
  │                    │── escalation record ────────────────────────────►│
```

### Multi-turn follow-up

| Turn | VRE strategy | Budget |
|------|--------------|--------|
| Turn 1 | Full `ai-doctor-v1` profile | 100% token budget |
| Turn 2+ clarification | Re-retrieve with `sessionContext.symptomCodes[]` + `previousSlugs[]` boost | 40% budget |
| New symptom introduced | Full re-retrieve; reset differential rank | 100% budget |
| Treatment question mid-case | **Route to Prescription** — do not extend Doctor session |

---

## AI Doctor orchestration layer (conceptual)

New orchestration sits **above** `VeterinaryAssistantService.ask()` — gateway remains transport for individual LLM turns.

```
AiDoctorOrchestrator
├── CaseManager           — case CRUD, state machine, completeness
├── SymptomIntakeService  — taxonomy + free text + normalization
├── TriageService         — red flags, urgency, emergency handoff
├── DifferentialService   — graph + RAG fusion ranker
├── ConfidenceService     — multi-layer score aggregation
├── EscalationService     — trigger rules, AiEscalationRecord
└── DoctorTurnExecutor    — calls VeterinaryAssistantService when LLM allowed
```

### Case model

```typescript
AiDoctorCase {
  id: string;
  userId: string;
  customerId: string;
  livestockId?: string;
  species: LivestockSpecies;
  locale: 'bn' | 'en';
  state: CaseState;
  symptomSnapshot: SymptomSnapshot;
  completeness: SymptomCompletenessScore;
  riskAssessment: CaseRiskAssessment;
  differentials: GroundedDifferential[];
  confidence: CaseConfidence;
  currentSessionId: string;
  escalationIds: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### API surface (conceptual)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/ai/doctor/cases` | Create case (livestock binding) |
| `POST` | `/api/ai/doctor/cases/:id/intake` | Submit symptoms (structured + free text) |
| `POST` | `/api/ai/doctor/cases/:id/clarify` | Answer clarification questions |
| `POST` | `/api/ai/doctor/cases/:id/analyze` | Run VKL+VRE+Router pipeline → differential |
| `POST` | `/api/ai/doctor/cases/:id/follow-up` | Multi-turn message (re-retrieve) |
| `POST` | `/api/ai/doctor/cases/:id/escalate` | User-initiated vet escalation |
| `GET` | `/api/ai/doctor/cases/:id` | Case summary for user replay |
| `POST` | `/assistants/ai-doctor` | **Existing** — low-level turn (internal or simple mode) |

---

## Safety policies (AI Doctor specific)

| Policy | Rule |
|--------|------|
| **AD-01** | No LLM call without VRE pack (except static i18n clarification templates) |
| **AD-02** | No definitive diagnosis language in farmer output |
| **AD-03** | Treatment/dose questions → Prescription assistant handoff (SP-01) |
| **AD-04** | CRITICAL triage → no differential LLM; Emergency path only |
| **AD-05** | Every clinical claim in response must map to pack citation or graph published entry |
| **AD-06** | Post-LLM validator BLOCK → safe template, not raw output |
| **AD-07** | Image analysis cannot raise confidence above text-only cap |
| **AD-08** | Pregnancy + medicine mention → escalate (SP-04) |
| **AD-09** | Log `caseId`, `packId`, `routingDecision`, `confidenceSummary` on every analyze turn |
| **AD-10** | Farmer BN disclaimer on every response (SP-03) |

---

## Integration map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AI DOCTOR PRODUCT                                │
├─────────────────────────────────────────────────────────────────────────┤
│  SymptomCheckerService ──on-ramp──► AiDoctorCase                        │
│  Livestock profile ─────────────────► species / pregnancy context        │
│  AiDoctorOrchestrator ──turn──────► VeterinaryAssistantService           │
│  VeterinaryAssistantService ────────► KnowledgeRetrievalService (VRE)    │
│  KnowledgeRetrievalService ─────────► VKL published chunks + embeddings  │
│  VeterinaryAssistantService ────────► AiFoundationService → Router       │
│  PostLlmValidator ◄────────────────── Router output                      │
│  AiEscalationRecord ────────────────► Vet inbox (6D.7)                   │
│  Usage signals ─────────────────────► VKL gap tickets (6D.7)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### Symptom checker → AI Doctor handoff

```
1. User completes SymptomCheckerService.runCheck()
2. Response includes: triageBucket, differentials[], ragAvailable, sessionId
3. UI offers: "আরও বিস্তারিত জানুন" → creates AiDoctorCase from symptom session
4. AI Doctor pre-fills symptomSnapshot — skips re-entry
5. Case proceeds to COMPLETENESS_CHECK → VRE with enriched query
```

---

## Observability & success metrics

| Metric | Pilot target | Measurement |
|--------|-------------|-------------|
| LLM bypass rate on BLOCK | 100% | Audit: zero router tokens when BLOCK |
| Citation coverage in clinical claims | ≥ 90% | Post-LLM validator + manual sample |
| Red-flag → escalation rate | ≥ 95% | CRITICAL cases with escalation record |
| False definitive diagnosis rate | < 1% | LLM output filter + manual audit |
| Colloquial BN expansion hit rate | ≥ 85% | VRE retrieval metadata |
| Case completion (intake → analyze) | ≥ 60% | Funnel analytics |
| Escalation CSAT | ≥ 4.0/5 | Post-escalation survey |
| VKL gap tickets from Doctor BLOCK | Tracked | Editorial queue SLA ≤ 14 days |

### Eval harness extension

Extend 6C.13 golden set with AI Doctor case scenarios:

| Corpus | Queries | Validates |
|--------|---------|-----------|
| `doctor-case-bn-g1-v1.json` | 20 | Intake → differential → routing |
| `doctor-emergency-bn-v1.json` | 10 | Red-flag → no LLM |
| `doctor-block-bn-v1.json` | 10 | Treatment intent → BLOCK/handoff |

---

## Sub-phase roadmap (AI Doctor only)

| Sub-phase | Scope | Depends on |
|-----------|-------|------------|
| **6D.1a** | Case model + state machine + API skeleton | 6D.0 gateway |
| **6D.1b** | Symptom intake + completeness + clarification planner | 6D.1a, SymptomChecker |
| **6D.1c** | Triage service + Emergency handoff | 6D.1b |
| **6D.1d** | Differential fusion (graph + VRE) + confidence layers | 6D.1b, 6C.13 |
| **6D.1e** | AiDoctorOrchestrator + turn executor + post-LLM gate | 6D.1c, 6D.1d |
| **6D.1f** | Escalation binding + mobile UX flows | 6D.1e, 6D.7 inbox |
| **6D.1g** | Golden-set eval + pilot metrics dashboard | 6D.1e, 6C.13g |

**No implementation in this document.** Sub-phases define future delivery order.

---

## Mobile UX principles (AI Doctor)

| Pattern | Requirement |
|---------|-------------|
| **Progressive intake** | Body-system chips → optional free text → duration/severity |
| **Voice-first BN** | Colloquial in; show canonical term in parentheses |
| **Differential cards** | Ranked list with evidence badge + tap-for-source |
| **Confidence badge** | Strong / Moderate / Limited — always visible |
| **Risk banner** | Color-coded urgency tier above fold |
| **Escalation FAB** | Persistent on MEDIUM+ cases |
| **No dead ends on BLOCK** | Always show vet CTA + async review option |
| **Session continuity** | Case persists across app backgrounding |

---

## Compliance (Bangladesh)

| Topic | AI Doctor policy |
|-------|------------------|
| **Practitioner of medicine** | Product never certifies diagnosis; farmers directed to licensed vets for treatment |
| **AI disclaimer** | Mandatory BN disclaimer; stronger on PROCEED_DEGRADED |
| **Drug Act** | No autonomous prescribing; dose questions routed to Prescription assistant |
| **Data privacy** | Case data customer-scoped; query hash in production logs |
| **Record retention** | Cases retained 24 months minimum |

---

## Appendix A — Retrieval session context

```typescript
sessionContext: {
  caseId: string;
  symptomCodes: string[];
  species: LivestockSpecies;
  differentialSlugs?: string[];      // graph priors for VRE boost
  previousPackId?: string;
  previousSlugs?: string[];          // follow-up re-retrieval boost
  urgencyTier?: string;
  completenessScore?: number;
}
```

---

## Appendix B — Prompt contract slots (ai_doctor)

| Slot | Source | Required |
|------|--------|----------|
| `groundingInstruction` | VRE pack | Always |
| `citationBlock` | VRE pack | When chunks > 0 |
| `evidenceBlock` | VRE pack | Clinical profiles |
| `confidenceBlock` | VRE pack | Always |
| `caseSummary` | AiDoctorCase | Multi-turn |
| `differentialSeed` | DifferentialService | Pre-ranked slugs |
| `nonDiagnosisContract` | Static policy | Always |
| `userMessage` | Farmer input | Always |

---

## Appendix C — Glossary

| Term | Definition |
|------|------------|
| **AI Doctor** | Farmer-facing clinical decision-support assistant (this document) |
| **Case** | Multi-turn clinical interaction unit bound to livestock |
| **Grounded differential** | Possible condition with VKL citation or published graph edge |
| **KnowledgeContextPack** | VRE output — mandatory input to router |
| **Fail-closed** | BLOCK path — no LLM when grounding insufficient |
| **Clarification plan** | VKL/graph-driven questions before LLM invocation |

---

## Document cross-reference

| Document | Relationship |
|----------|--------------|
| `phase-6d-veterinary-ai-assistant.md` | Parent — six assistants, shared gateway, escalation taxonomy |
| `phase-6c-rag-engine-architecture.md` | VRE profiles, pack contract, multi-turn strategy §8.5 |
| `phase-6c13-rag-optimization.md` | BN expansion, post-LLM validator, golden eval |
| `phase-6a-veterinary-knowledge-architecture.md` | VKL domains, symptom graph, evidence levels |

---

**Document owner:** Principal Veterinary AI Product Architect  
**Next review:** Upon 6D.1a case model sign-off or AI Doctor mobile UX kickoff
