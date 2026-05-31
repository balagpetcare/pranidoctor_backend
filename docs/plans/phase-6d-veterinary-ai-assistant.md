# Phase 6D — Veterinary AI Assistant Product Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary AI Product Architect  
**Date:** 2026-05-31  
**Status:** Phase 6D.0–6D.6 implemented (backend gateway + six assistants)  
**Version:** 1.1.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL domains, evidence, retrieval contract)
- `docs/plans/phase-6b-knowledge-ingestion-architecture.md` (published knowledge, vet approval pipeline)
- `docs/plans/phase-6c-rag-architecture.md` (RAG engine, `KnowledgeContextPack`, confidence routing — 6C.0–6C.6 implemented)
- `docs/reports/phase-6b-knowledge-verification.md`
- `docs/reports/phase-6c-rag-verification.md`
- `docs/plans/ai-phase-4-router-engine.md`
- `docs/plans/ai-phase-5-hardening.md`
- `docs/ai/AI_ECOSYSTEM_MASTER_PLAN.md`

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Feature services, RAG binding, safety orchestration, escalation APIs |
| `pranidoctor-web` | Doctor console, vet review queues, escalation inbox, admin safety dashboards |
| `pranidoctor_user` | Farmer mobile — six AI assistants (via backend only) |

**Phase numbering alignment:**

| Phase | Scope |
|-------|--------|
| **6A** | Veterinary Knowledge Layer — entity model, evidence, workflows |
| **6B** | Knowledge Ingestion — sources, editorial/vet/publish |
| **6C** | RAG Engine — hybrid retrieval, context packs, confidence routing |
| **6D** | **This document** — productized veterinary AI assistants |

---

## Executive summary

Phases 6A–6C established **what knowledge exists**, **how it enters the VKL**, and **how it is retrieved and grounded** before any LLM call. Phase 6D defines **how farmers and doctors experience that capability** as six distinct, safety-bounded **Veterinary AI Assistants**:

| Assistant | Primary user | Clinical risk | Default posture |
|-----------|--------------|---------------|-----------------|
| **AI Doctor** | Farmer | Medium | Educate + triage; never definitive diagnosis |
| **AI Prescription Assistant** | Farmer / field staff | **Critical** | Fail-closed; structured facts only |
| **AI Vaccine Assistant** | Farmer | Medium–High | Schedule + cold-chain guidance; vet for deviations |
| **AI Feed Advisor** | Farmer | Medium | Ration suggestions; toxic-ingredient block |
| **AI Breeding Advisor** | Farmer | Medium | Timing/protocol guidance; dystocia → escalate |
| **AI Emergency Assistant** | Farmer | **Critical** | First-aid SOP + immediate vet/clinic redirect |

Each assistant is a **product surface** — not a separate LLM — sharing:

- `KnowledgeRetrievalService` (Phase 6C) with task-specific retrieval profiles
- `AiRouterEngine` for model execution
- `AiSafetyService` + confidence routing for pre/post guards
- Unified **escalation**, **disclaimer**, and **audit** contracts

**Bangladesh context:** BN-first UX for farmers; licensed-vet escalation paths; DLS/government bulletin alignment; mobile-first, low-literacy-safe interaction patterns.

This document defines product architecture and tracks **Phase 6D backend implementation** (gateway + six assistants). Mobile UX (6D.8) and escalation inbox automation (6D.7) remain planned.

---

## Implementation progress (backend)

| Sub-phase | Scope | Status | Notes |
|-----------|-------|--------|-------|
| **6D.0** | Assistant registry + gateway + shared safety (RAG fail-closed) | **Done** | `src/modules/ai/veterinary-assistants/` |
| **6D.1** | AI Doctor | **Done** | `POST /assistants/ai-doctor`, profile `ai-doctor-v1` |
| **6D.2** | AI Emergency Assistant | **Done** | `POST /assistants/emergency`, empty-pack escalation |
| **6D.3** | AI Feed Advisor | **Done** | `POST /assistants/feed`, profile `feed-advisor-v1` |
| **6D.4** | AI Vaccine Assistant | **Done** | `POST /assistants/vaccine`, profile `vaccine-advisor-v1` |
| **6D.5** | AI Breeding Advisor | **Done** | `POST /assistants/breeding`, profile `breeding-advisor-v1` |
| **6D.6** | AI Prescription Assistant | **Done** | `POST /assistants/prescription`, structured-facts gate |
| **6D.7** | Escalation inbox + vet review triggers | Planned | — |
| **6D.8** | Mobile UX + analytics dashboards | Planned | — |

**Execution path (all assistants):** `KnowledgeRetrievalService.retrieve()` → confidence routing → on BLOCK/empty emergency/prescription without facts: safe template (no LLM) → else `AiFoundationService.executePromptTask()` → `AiOrchestratorService` → `AiRouterEngine`.

**API:** `GET /assistants` discovery; `POST /assistants/{ai-doctor|prescription|vaccine|feed|breeding|emergency}`.

---

## Strategic intent

| Today (post–6C baseline) | After Phase 6D (target) |
|--------------------------|-------------------------|
| Generic `AiAssistantService.chat()` with farmer-chat RAG | **Six named assistants** with dedicated journeys and prompts |
| One retrieval profile for all chat | **Per-assistant profiles** + structured fact requirements |
| Safety guards ad hoc in chat/triage | **Unified Safety Policy Engine** per assistant |
| Escalation partially wired in triage | **Standard escalation taxonomy** across all assistants |
| No product-level vet review triggers from AI usage | **Usage-driven vet review signals** fed to VKL editorial queue |
| Farmer cannot distinguish advisory vs actionable | **Clear UX tiers:** Info → Guidance → Action (vet-required) |

---

## Design principles

| Principle | Phase 6D interpretation |
|-----------|-------------------------|
| **Assistant ≠ autonomous clinician** | AI educates, structures questions, and suggests next steps — licensed vets diagnose, prescribe, and certify |
| **Retrieve before respond** | Every assistant invocation runs RAG with assistant-specific profile before LLM |
| **Risk-proportional gates** | Higher clinical risk → higher confidence thresholds, stricter fail-closed, mandatory escalation |
| **Fail-closed on harm** | Prescription, emergency action steps, and off-label medicine → block rather than guess |
| **Fail-open with disclaimer on education** | General husbandry, non-dosage guidance may proceed degraded with elevated disclaimer |
| **Human escalation is a feature** | One-tap vet call, clinic finder, and async vet review — not an error state |
| **Bangla-first, plain language** | Farmer assistants default `locale=bn`; avoid Latin-only drug names without BN gloss |
| **Species-aware** | Livestock context (species, age, pregnancy, weight) required where clinical risk > LOW |
| **Audit everything** | Session, pack ID, routing decision, escalation reason on every assistant turn |
| **Close the loop to VKL** | Repeated blocks, low-confidence clusters, and user “incorrect” feedback → vet review triggers |

---

## Product architecture overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VETERINARY AI ASSISTANT LAYER (6D)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Mobile / Doctor Client                                                      │
│       │                                                                      │
│       ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Assistant Gateway (feature key → assistant config)                 │    │
│  │   ai_doctor | prescription | vaccine | feed | breeding | emergency │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│       ┌──────────────────────────┼──────────────────────────┐               │
│       ▼                          ▼                          ▼               │
│  Context Enricher          Safety Pre-Check            Session / Case        │
│  (animal, farm, season)    (input + risk class)        (AiVeterinaryCore)   │
│       │                          │                          │               │
│       └──────────────────────────┼──────────────────────────┘               │
│                                  ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ KnowledgeRetrievalService.retrieve(profileId, taskType, species)     │    │
│  │   → KnowledgeContextPack + routingDecision                           │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                  │                                           │
│              ┌───────────────────┼───────────────────┐                      │
│              ▼                   ▼                   ▼                      │
│         BLOCK            PROCEED_DEGRADED         PROCEED                   │
│              │                   │                   │                      │
│              ▼                   └─────────┬─────────┘                      │
│     Safe template +                  ▼                                     │
│     escalation offer          AiFoundationService → AiRouterEngine         │
│                                          │                                   │
│                                          ▼                                   │
│                               Safety Post-Check + Output validation        │
│                                          │                                   │
│                                          ▼                                   │
│                               Response + disclaimer + citations              │
│                               (+ escalation card if triggered)             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                    │
         ▼                                    ▼
  AiUsageLog + audit                   Vet review trigger queue (6D ops)
```

### Assistant registry (conceptual)

| assistantId | feature key | taskType | retrievalProfileId | audience |
|-------------|-------------|----------|-------------------|----------|
| `ai-doctor` | `ai_doctor` | `DISEASE_ANALYSIS` | `ai-doctor-v1` | Farmer |
| `prescription` | `prescription_assistant` | `PRESCRIPTION_ANALYSIS` | `prescription-v1` | Farmer (vet-supervised) |
| `vaccine` | `vaccine_assistant` | `DISEASE_ANALYSIS` | `vaccine-advisor-v1` | Farmer |
| `feed` | `feed_advisor` | `FEED_FORMULATION` | `feed-advisor-v1` | Farmer |
| `breeding` | `breeding_advisor` | `GENERAL_CHAT` | `breeding-advisor-v1` | Farmer |
| `emergency` | `emergency_assistant` | `EMERGENCY_CONSULTATION` | `emergency-v1` | Farmer |

---

## Shared safety framework

### Risk tiers (product level)

| Tier | Definition | Examples | Default LLM posture |
|------|------------|----------|---------------------|
| **R0 — Informational** | General husbandry, record-keeping | Housing, seasonal tips | Proceed / degraded OK |
| **R1 — Educational clinical** | Disease awareness, prevention | “What is mastitis?” | Proceed with disclaimer |
| **R2 — Decision support** | Differential suggestions, vaccine timing | AI Doctor differentials | Degraded if low confidence; escalate on red flags |
| **R3 — Action clinical** | Dosage, withdrawal, treatment choice | Prescription assistant | **Fail-closed** without structured facts + vet path |
| **R4 — Emergency action** | Immediate steps, referral | Emergency assistant | SOP-only grounding; always escalation CTA |

### Confidence routing (inherits Phase 6C)

| routingDecision | User-visible behavior | LLM invoked? |
|-----------------|----------------------|--------------|
| `PROCEED` | Normal response + standard disclaimer | Yes |
| `PROCEED_DEGRADED` | Caution banner + elevated disclaimer | Yes |
| `BLOCK` | Safe template + vet/clinic redirect | **No** |
| `ESCALATE_HUMAN` | Partial guidance + mandatory escalation card | Optional (emergency only) |

### Human escalation taxonomy

| escalationType | Trigger examples | Destination |
|----------------|------------------|-------------|
| `VET_CALL_NOW` | Emergency red flags, R4, failed prescription | Phone / tele-vet |
| `VET_BOOKING` | R2–R3 unresolved, user request | Appointment flow |
| `CLINIC_FINDER` | Emergency, no vet on call | Nearest clinic map |
| `ASYNC_VET_REVIEW` | Low confidence, complex case | Vet queue (24–48h SLA) |
| `FIELD_AGENT` | Breeding AI timing, vaccination camp | Extension worker referral |

Escalation records extend existing `AiEscalationRecord` with `assistantId`, `packId`, and `triggerRuleId`.

### Vet review triggers (VKL feedback loop)

Usage patterns that **open or prioritize VKL editorial/vet review** (not user-facing):

| Signal | Threshold | VKL action |
|--------|-----------|------------|
| Assistant `BLOCK` rate on entity slug | >5% of queries / 7 days | Flag entity for re-review |
| User feedback “incorrect” on cited chunk | ≥3 reports | Queue domain lead review |
| Repeated low-confidence on same intent | ≥10 sessions / 30 days | Coverage gap ticket |
| Prescription structured fact missing | Any BLOCK | Log gap; prioritize medicine ingest |
| Emergency SOP outdated vs bulletin | Regulatory `effectiveTo` passed | Auto-deprecate + review |
| New molecule query with zero retrieval | First occurrence | Ingestion backlog item |

---

## Global confidence thresholds

Aligned with Phase 6A retrieval gates and Phase 6C implemented profiles. Phase 6D adds **assistant-level overrides**.

| Assistant | minConfidence | minEvidence | medicalMinConfidence | failClosed | structuredFactsRequired |
|-----------|---------------|-------------|----------------------|------------|-------------------------|
| AI Doctor | 0.55 | L2 | 0.55 | No | No |
| AI Prescription | 0.75 | L2 | 0.75 | **Yes** | **Yes (dose)** |
| AI Vaccine | 0.60 | L2 | 0.60 | No | Schedule facts for off-label species |
| AI Feed Advisor | 0.65 | L2 | 0.65 | No | Nutrient numbers from VKL only |
| AI Breeding Advisor | 0.50 | L1 | 0.55 | No | No |
| AI Emergency | 0.60 | L1 (SOP) | 0.60 | No* | SOP steps from EMERGENCY domain |

\*Emergency: fail-closed on **dosage**; fail-open on **first-aid SOP** with mandatory escalation CTA when pack empty.

---

## Global safety policies

| Policy ID | Rule | Applies to |
|-----------|------|------------|
| **SP-01** | Never output drug dose without `structuredFacts` citation | Prescription, Doctor (dosage questions) |
| **SP-02** | Never contradict published VKL regulatory BD facts | All |
| **SP-03** | Mandatory BN disclaimer on every farmer response | All farmer assistants |
| **SP-04** | Pregnancy/lactation queries → escalate if medicine involved | Prescription, Doctor, Vaccine |
| **SP-05** | Off-label species medicine → BLOCK + vet referral | Prescription |
| **SP-06** | Human food chain withdrawal must cite source | Prescription, Vaccine |
| **SP-07** | Emergency assistant must show “call vet now” within first 2 lines | Emergency |
| **SP-08** | Image-based diagnosis is suggestive only | Doctor (+ IMAGE_ANALYSIS) |
| **SP-09** | No antibiotic prescription language without vet supervision flag | Prescription |
| **SP-10** | Log `packId` + `routingDecision` on every turn | All |

---

# Assistant specifications

---

## 1. AI Doctor

**Purpose:** Help farmers understand animal health issues, recognize urgency, and decide when to call a vet — grounded in VKL disease knowledge and symptom graph.

### Primary personas

| Persona | Goal | Locale |
|---------|------|--------|
| Smallholder farmer | “What might this be? Is it urgent?” | BN |
| Farm manager | Structured triage for herd issue | BN / EN |
| Doctor app (future) | Differential support with EN precision | EN |

### User journey — Farmer (happy path)

```
1. Open AI Doctor from livestock profile (species pre-filled)
2. Describe symptoms (voice or text, BN colloquial OK)
3. Optional: attach photo (IMAGE_ANALYSIS adjunct)
4. System runs symptom graph + RAG (disease-analysis-v1)
5. AI returns:
   - Plain BN summary of possible causes (ranked, not definitive)
   - Red-flag check (“call vet immediately if…”)
   - Home care ONLY if VKL says safe for farmer tier
   - Sources with inline citations
6. User taps “Talk to vet” if urgency high → escalation
```

### User journey — Escalation path

```
Symptom text matches red-flag lexicon OR triage bucket HIGH
  → Skip dosage/treatment LLM content
  → Emergency Assistant handoff OR VET_CALL_NOW card
  → Create AiEscalationRecord (reason: RED_FLAG_SYMPTOM)
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| No definitive diagnosis language | Prompt + post-output filter (“you have X” → blocked) |
| Differential only from retrieved entities | Grounding instruction |
| Low-confidence medical chunks | Phase 6C `blockLowConfidenceMedical` |
| Symptom graph overlap | Boost retrieval for linked diseases |
| Image analysis | Adjacent task; cannot override text RAG for doses |

### Confidence thresholds

- Profile: `disease-analysis-v1` (min 0.55, L2)
- Escalate to human if: triage urgency ≥ 4 OR confidenceSummary.avg < 0.50

### Vet review triggers

- New symptom phrase cluster with zero RAG hits
- User marks “wrong diagnosis suggestion”
- Red-flag false negative report

---

## 2. AI Prescription Assistant

**Purpose:** Support **vet-supervised** medicine guidance — dose validation, interaction warnings, withdrawal periods — never autonomous prescribing for farmers.

### Primary personas

| Persona | Goal | Access |
|---------|------|--------|
| Farmer (restricted) | “Is this dose OK?” with vet context | Read-only suggestions; BLOCK without facts |
| Licensed vet (doctor app) | Prescription drafting support | Full profile + EN structured output |
| Field paravet | Reference lookup | BN summaries; no new prescriptions |

### User journey — Farmer (supervised)

```
1. User selects animal + medicine (catalog or text)
2. System retrieves MEDICINE + REGULATORY_BD (prescription-v1)
3. If structuredFacts (dose, withdrawal) present AND confidence OK:
   → Show VKL-sourced facts ONLY with citations
   → “Confirm with your veterinarian before treating”
4. If missing facts or low confidence:
   → BLOCK — no LLM treatment narrative
   → Offer VET_BOOKING / ASYNC_VET_REVIEW
```

### User journey — Vet (doctor app, future)

```
1. Vet enters intended prescription (drug, dose, route, duration)
2. RAG retrieves interactions, contraindications, withdrawal
3. Assistant highlights conflicts from graph edges (INTERACTS_WITH, CONTRAINDICATES)
4. Output structured Rx draft — vet signs electronically (outside AI scope)
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| **Fail-closed default** | `prescription-v1` failClosed=true |
| Structured dose required | `structuredFacts` must include DOSE_MG_KG |
| Vet-approved VKL for HIGH risk | `vetApprovedRequired=true` on profile |
| Antibiotic governance | SP-09; extra audit scope |
| Off-label species | SP-05 BLOCK |
| No LLM invented doses | Output validator compares numbers to structuredFacts |

### Human escalation

- Mandatory on every BLOCK
- Optional “Ask vet to review prescription” → ASYNC_VET_REVIEW

### Confidence thresholds

- minConfidence **0.75**, medicalMinConfidence **0.75**, evidence **≥ L2**

### Vet review triggers

- Any BLOCK with user-provided drug not in VKL
- Interaction edge missing between commonly co-prescribed pair

---

## 3. AI Vaccine Assistant

**Purpose:** Guide vaccination schedules, cold-chain basics, and booster timing per species — aligned with national/extension schedules.

### User journey

```
1. Select species + age/production stage
2. Optional: prior vaccination history (user input)
3. RAG retrieves VACCINE + SCHEDULE entities
4. Assistant returns:
   - Recommended schedule window (BN)
   - Cold-chain reminders if applicable
   - What to expect post-vaccination (mild reactions)
5. If schedule deviation or unknown product:
   → PROCEED_DEGRADED + “confirm with vet”
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| Schedule facts from VKL only | Structured schedule rows |
| Live vaccine cold-chain | Mandatory warning block |
| Off-schedule acceleration | Escalate; no “extra dose OK” without L2+ fact |
| Concurrent medicine questions | Hand off to Prescription assistant |

### Confidence thresholds

- minConfidence **0.60**, evidence **≥ L2** for schedule dates
- New profile: `vaccine-advisor-v1` (domainPriority: VACCINE, DISEASE, FARM_MGMT)

### Human escalation

- `VET_BOOKING` for adverse reaction reports
- `FIELD_AGENT` for mass vaccination camp coordination (optional product)

### Vet review triggers

- Product name not in catalog
- Schedule mismatch vs latest DLS bulletin

---

## 4. AI Feed Advisor

**Purpose:** Help farmers formulate rations, avoid toxic feeds, and meet species-stage nutrient targets using VKL feed entities.

### User journey

```
1. Select species, production stage, body weight (or estimate)
2. List available ingredients (local names BN)
3. RAG retrieves FEED, NutrientRequirement, ToxicFeedAlert
4. Assistant suggests ration adjustments (percentages, not brand promotion)
5. Toxic ingredient match → hard BLOCK with alert text from VKL
6. Export summary for farmer records (PDF later — out of scope)
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| Nutrient numbers from structuredFacts only | SP-01 variant for CP/DM/TDN |
| ToxicFeedAlert graph | Immediate BLOCK + escalation |
| No commercial brand endorsement | Prompt policy |
| Weight estimate uncertainty | PROCEED_DEGRADED if weight AI confidence low |

### Confidence thresholds

- Profile: `feed-advisor-v1` — min **0.65**, L2
- taskType: `FEED_FORMULATION`

### Human escalation

- Nutritionist/vet for production animals with metabolic disease
- ASYNC_VET_REVIEW when ration targets cannot be met with stated ingredients

### Vet review triggers

- Repeated toxic false positives/negatives
- Missing local ingredient in VKL

---

## 5. AI Breeding Advisor

**Purpose:** Support heat detection timing, AI timing, pregnancy checkpoints, and basic dystocia recognition — **not** replacement for insemination technician.

### User journey

```
1. Select animal (cow/buffalo/goat), parity, last heat/AI date
2. Describe signs (BN colloquial)
3. RAG retrieves REPRODUCTION protocols, EstrusSign, ParturitionGuide
4. Assistant returns timing window + observation checklist
5. Dystocia / prolapse / severe bleeding keywords:
   → Immediate Emergency Assistant handoff
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| Dystocia red-flag lexicon | Route to Emergency |
| No hormone protocol dosing | BLOCK dosage questions → Prescription |
| AI Technician marketplace separate | Link out, not conflated |
| Bull infertility complex cases | Escalate to vet |

### Confidence thresholds

- Profile: `breeding-advisor-v1` — min **0.50**, L1 for educational; **0.55** medicalMin for intervention timing

### Human escalation

- `FIELD_AGENT` (AI technician booking) for insemination service
- `VET_CALL_NOW` for dystocia signs

### Vet review triggers

- Breed-specific protocol gaps
- User reports wrong timing advice affecting pregnancy

---

## 6. AI Emergency Assistant

**Purpose:** Immediate, actionable first-aid steps for critical situations until a vet arrives.

### User journey — Critical path

```
1. User taps Emergency (prominent UI) or auto-routed from red flags
2. Minimal questions: species, symptom, consciousness/bleeding (Y/N)
3. RAG emergency-v1 (EMERGENCY domain priority)
4. If SOP retrieved:
   → Numbered farmer actions (BN, short sentences)
   → “Call vet NOW” header (SP-07)
   → Stop conditions (“if no improvement in X minutes…”)
5. If pack empty:
   → No LLM clinical invention
   → VET_CALL_NOW + CLINIC_FINDER only
6. Optional: share location with vet service (future)
```

### Risk controls

| Control | Mechanism |
|---------|-----------|
| SOP-only action steps | Must cite EMERGENCY chunks |
| No sedative/anesthetic dosing | BLOCK → Prescription |
| Always show escalation CTA | UI requirement |
| Voice mode supported | Short utterances; same RAG gates |
| Post-incident disclaimer | Legal limitation of phone advice |

### Confidence thresholds

- min **0.60**; L1 acceptable for established extension SOPs (Phase 6A matrix)
- Empty pack → `ESCALATE_HUMAN`, not silent LLM

### Human escalation

- **Always** offer `VET_CALL_NOW`
- Auto-create escalation record on session start (audit)

### Vet review triggers

- Any session without matching SOP for reported emergency type
- Farmer feedback “advice delayed care”

---

## Cross-assistant flows

### Handoff matrix

| From | To | Condition |
|------|-----|-----------|
| AI Doctor | Emergency | Red-flag / HIGH triage |
| AI Doctor | Prescription | User asks dose/drug |
| Breeding | Emergency | Dystocia signs |
| Feed | Prescription | Medicated feed / additive dose |
| Vaccine | Prescription | Antibiotic concurrent use |
| Any | Vet booking | User tap or BLOCK |

### Symptom checker relationship

Existing `SymptomCheckerService` becomes **on-ramp** to AI Doctor:

```
Symptom checker → differentials (rules graph)
              → optional “Explain with AI Doctor” (RAG enrichment)
              → shared escalation records
```

---

## Mobile UX principles (farmer)

| Pattern | Requirement |
|---------|-------------|
| **Progressive disclosure** | Start with 1–2 questions; avoid long forms |
| **Voice-first BN** | Colloquial input; display canonical term in parentheses |
| **Citation chips** | Tap to see source title (DLS, BVC, etc.) |
| **Risk badges** | “Educational only” / “Vet confirmation required” |
| **Escalation FAB** | Persistent “Call vet” on R2+ sessions |
| **Offline** | Cached emergency SOP titles only; no LLM offline |

---

## Doctor / vet console (web)

| Capability | Purpose |
|------------|---------|
| Escalation inbox | ASYNC_VET_REVIEW queue by assistant |
| Session replay | Audit: query, pack, response, citations |
| VKL gap tickets | From vet review triggers |
| Assistant analytics | BLOCK rate, escalation rate, confidence histogram |
| Prompt version pin | Per-assistant prompt rollback |

---

## Compliance & medico-legal (Bangladesh)

| Topic | Policy |
|-------|--------|
| **AI disclaimer** | Every response; stronger on R2+ |
| **Practitioner of medicine** | Farmers not licensed to prescribe; product enforces |
| **Drug Act alignment** | Prescription assistant references DGD registration entities |
| **Data privacy** | Animal health data customer-scoped; no training on user content without consent |
| **Record retention** | Assistant sessions 24 months minimum for dispute resolution |

---

## Observability & success metrics

| Metric | Target (pilot) |
|--------|----------------|
| Assistant BLOCK rate (prescription) | 100% when facts insufficient (by design) |
| Emergency sessions with escalation CTA | 100% |
| AI Doctor escalation on HIGH triage | ≥95% |
| Citation presence in clinical claims | ≥90% |
| User satisfaction (CSAT) AI Doctor | ≥4.0/5 |
| VKL gap tickets resolved SLA | ≤14 days |
| False-negative red-flag rate | <2% (manual audit sample) |

---

## Implementation roadmap (conceptual — no code in this doc)

| Sub-phase | Scope | Depends on |
|-----------|-------|------------|
| **6D.0** | Assistant registry + gateway + shared safety policy engine | 6C.6 |
| **6D.1** | AI Doctor product binding + symptom handoff | 6D.0 |
| **6D.2** | AI Emergency Assistant | 6D.0 |
| **6D.3** | AI Feed Advisor | 6D.0 |
| **6D.4** | AI Vaccine Assistant | 6D.0 |
| **6D.5** | AI Breeding Advisor | 6D.0 |
| **6D.6** | AI Prescription Assistant (farmer restricted + vet app) | 6D.0, VKL medicine coverage |
| **6D.7** | Escalation inbox + vet review trigger automation | 6D.1–6D.6 |
| **6D.8** | Mobile UX + analytics dashboards | 6D.1–6D.6 |

---

## Appendix A — Retrieval profiles to add (Phase 6D)

```json
{
  "profileId": "ai-doctor-v1",
  "taskType": "DISEASE_ANALYSIS",
  "domainPriority": ["DISEASE", "CLINICAL_PROTOCOL", "EMERGENCY", "MEDICINE"],
  "minConfidence": 0.55,
  "minEvidenceLevel": "L2",
  "failClosed": false,
  "blockLowConfidenceMedical": true,
  "medicalMinConfidence": 0.55
}
```

```json
{
  "profileId": "vaccine-advisor-v1",
  "taskType": "DISEASE_ANALYSIS",
  "domainPriority": ["VACCINE", "DISEASE", "FARM_MGMT"],
  "minConfidence": 0.60,
  "minEvidenceLevel": "L2",
  "failClosed": false,
  "blockLowConfidenceMedical": true,
  "medicalMinConfidence": 0.60
}
```

```json
{
  "profileId": "feed-advisor-v1",
  "taskType": "FEED_FORMULATION",
  "domainPriority": ["FEED", "FARM_MGMT"],
  "minConfidence": 0.65,
  "minEvidenceLevel": "L2",
  "structuredMatchEnabled": true
}
```

```json
{
  "profileId": "breeding-advisor-v1",
  "taskType": "GENERAL_CHAT",
  "domainPriority": ["FARM_MGMT", "DISEASE"],
  "minConfidence": 0.50,
  "minEvidenceLevel": "L1",
  "blockLowConfidenceMedical": true,
  "medicalMinConfidence": 0.55
}
```

---

## Appendix B — Escalation reason enum (extension)

| Code | Assistant context |
|------|-------------------|
| `RED_FLAG_SYMPTOM` | Doctor, Emergency |
| `RETRIEVAL_FAIL_CLOSED` | All (RAG BLOCK) |
| `PRESCRIPTION_FACTS_MISSING` | Prescription |
| `TOXIC_FEED_DETECTED` | Feed |
| `DYSTOCIA_SIGNS` | Breeding → Emergency |
| `USER_REQUESTED_VET` | All |
| `LOW_CONFIDENCE_DEGRADED` | All (PROCEED_DEGRADED follow-up) |
| `POLICY_REFUSAL` | Safety pre-check |

---

## Appendix C — Glossary

| Term | Definition |
|------|------------|
| **Assistant** | Named product surface with journey, profile, and policies |
| **Fail-closed** | Block LLM when grounding insufficient |
| **KnowledgeContextPack** | Phase 6C retrieval output consumed by assistants |
| **VKL gap ticket** | Editorial backlog item from usage signals |
| **R4 emergency** | Highest product risk tier — SOP + immediate escalation |

---

**Document owner:** Principal Veterinary AI Product Architect  
**Next review:** Upon 6D.0 gateway design sign-off or first assistant pilot selection
