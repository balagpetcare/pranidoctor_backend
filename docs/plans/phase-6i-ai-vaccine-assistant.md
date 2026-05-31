# Phase 6I — AI Vaccine Assistant Product Architecture

**Project:** Prani Doctor  
**Role:** Principal Veterinary Preventive Care Architect  
**Date:** 2026-05-31  
**Status:** 6I.1a–6I.1h implemented (backend orchestrator + engines + API) — 2026-05-31  
**Version:** 1.1.0  

**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` — VKL Vaccine domain, `VaccinationSchedule`, `ColdChainRule`, graph edges
- `docs/plans/phase-6b4-editorial-governance.md` — vet approval, HIGH-risk publish gates, DLS schedule re-review
- `docs/plans/phase-6c-rag-engine-architecture.md` — VRE profiles, `KnowledgeContextPack`, structured facts, confidence routing
- `docs/plans/phase-6c13-rag-optimization.md` — BN colloquial expansion, post-LLM validation
- `docs/plans/phase-6d-veterinary-ai-assistant.md` — assistant gateway, shared safety SP-01–SP-10, escalation taxonomy
- `docs/plans/phase-6d-ai-doctor.md` — sibling boundary (no diagnosis; symptom handoff out)
- `docs/plans/phase-6h-ai-prescription-assistant.md` — vaccine–medicine interaction contract (`VaccineMedicineConflict`)
- `docs/plans/phase-6e-wave1-mvc-corpus.md` — Wave 1 vaccine MVC (12 vaccines, 14 schedules, 4 cold-chain rules)
- `docs/reports/phase-6h-prescription-assistant-verification.md` — cross-assistant interaction patterns

**Parent scope:** This document is the **deep product architecture for AI Vaccine Assistant only**. The 6D.4 gateway stub (`POST /assistants/vaccine`, profile `vaccine-advisor-v1`) is transport only; this plan defines the **complete preventive-care decision-support product** including operational livestock vaccination records.

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | Vaccine orchestration, schedule engine, eligibility, booster/missed detection, reminders, safety, escalation APIs |
| `pranidoctor-web` | Vet preventive-care review console, schedule bulletin drift alerts, VKL gap tickets |
| `pranidoctor_user` | Farmer mobile — vaccine lookup, schedule planner, reminders, cited guidance (no autonomous vaccination orders) |

---

## Executive summary

**AI Vaccine Assistant** is Prani Doctor's **preventive-care decision-support surface** for livestock vaccination. It helps farmers, field paravets, and veterinarians:

1. **Look up vaccines** and biologics from the VKL Vaccine Knowledge Base
2. **View species-specific schedules** aligned with Bangladesh national/extension calendars (DLS)
3. **Determine age-based eligibility** using published `ageWindow` matrices and animal profile context
4. **Track boosters** against `boosterIntervalDays` and recorded `LivestockVaccination` history
5. **Detect missed vaccines** by comparing operational records to schedule due windows
6. **Plan vaccination** for individual animals and herd-level programs (educational timelines — not clinical orders)
7. **Surface vaccination reminders** derived from schedule math + user records (push/SMS architecture hooks)
8. **Check vaccine interactions** with medicines and concurrent biologics (deterministic + VKL)
9. **Display risk warnings** — cold chain, live biologics, pregnancy, adverse-event patterns
10. **Escalate to licensed vets** when schedules deviate, grounding fails, or clinical concern appears

### Non-negotiable architecture constraints

> **The AI Vaccine Assistant must never diagnose disease, must never replace a licensed veterinarian, and must never instruct a farmer to administer a vaccine as a substitute for professional judgment.**  
> **Every user-visible output that contains schedule, eligibility, interaction, or safety claims MUST include citations, confidence signaling, and preventive-care safety messaging.**

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1 — Veterinary Knowledge Layer (VKL)                     │
│    Vaccine, VaccinationSchedule, ColdChainRule, Disease (PREVENTED_BY) │
│    Graph: SCHEDULED_BY, PREVENTED_BY, GOVERNED_BY (future)      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2 — RAG Engine (VRE)                                     │
│    vaccine-advisor-v1 → KnowledgeContextPack + schedule facts    │
│    Confidence routing: schedule claims fail-closed when ungrounded │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3 — AI Router (AIMS)                                     │
│    Prompt execution ONLY when routing ≠ BLOCK                    │
│    Post-LLM: no diagnosis language; schedule numeric lock        │
└─────────────────────────────────────────────────────────────────┘
```

**Operational data plane (not VKL):** `LivestockVaccination` records supply **what happened on the farm**; VKL supplies **what should happen per evidence**. The assistant **merges** both — it does not invent schedule dates from LLM prose.

### Product posture

| Dimension | AI Vaccine Assistant |
|-----------|-------------------|
| Clinical risk tier | **R2 — Decision support (preventive)** |
| Clinical role | **Preventive care only** — not diagnostic |
| Default routing | Fail-closed on **schedule date claims**; fail-open degraded on general education |
| Primary taskType | `DISEASE_ANALYSIS` (registry alignment; preventive sub-intent classified internally) |
| Retrieval profile | `vaccine-advisor-v1` (evolve to `vaccine-assistant-v1` at 6I implementation) |
| Farmer access | Schedule guidance + reminders + warnings — **vet confirms administration** |
| Vet access | Herd program review, schedule validation, adverse-event triage support |
| Regulatory overlay | BD `regionScope`; DLS calendar as authoritative schedule source |
| Corpus dependency | Wave 1 MVC vaccine bundle (`scripts/bundles/wave1/vaccine.json`) minimum; Wave 2+ cold-chain expansion |

### Current vs target state

| Capability | Today (6D.4 gateway) | Target (this document) |
|------------|---------------------|------------------------|
| Single-turn via `POST /assistants/vaccine` | ✅ | Retained as turn transport |
| RAG on VACCINE domain | ✅ | Extended with schedule structured-fact gates |
| Vaccine lookup | Partial (RAG only) | ✅ Deterministic slug resolution + cards |
| Species-specific schedules | Partial | ✅ Schedule engine + species/stage matrix |
| Age-based eligibility | ❌ | ✅ Eligibility evaluator |
| Booster tracking | ❌ | ✅ VKL interval + `LivestockVaccination` merge |
| Missed vaccine detection | Partial (mobile status only) | ✅ Assistant-driven overdue analysis |
| Vaccination planning | ❌ | ✅ Herd timeline planner (non-ordering) |
| Vaccination reminders | Partial (mobile records) | ✅ Reminder policy engine + notification contract |
| Vaccine interaction checks | Partial (Prescription owns) | ✅ Bidirectional handoff + vaccine-native checks |
| Risk warnings | Ad hoc | ✅ `VaccineSafetyReport` aggregation |
| Escalation rules | Basic `humanRedirect` | ✅ Full taxonomy + `AiEscalationRecord` |
| Multi-turn case sessions | ❌ | ✅ `AiVaccineSession` state machine |
| Citations + confidence on all outputs | Partial | ✅ Mandatory contract (VX-10) |

---

## Implementation progress (2026-05-31)

| Sub-phase | Scope | Status | Module / artifact |
|-----------|-------|--------|-------------------|
| **6I.1a** | Session model + intent router + API skeleton | **Done** | `ai-vaccine/engines/vaccine-session.engine.ts`, `vaccine-intent.engine.ts`; `POST/GET /api/ai/vaccine/sessions` |
| **6I.1b** | Vaccine lookup + reference cards | **Done** | `vaccine-lookup.engine.ts`, `vaccine-metadata.util.ts` |
| **6I.1c** | ScheduleEngine + eligibility evaluator | **Done** | `schedule-retrieval.engine.ts`, `eligibility.engine.ts` |
| **6I.1d** | Booster + missed + LivestockVaccination mapping | **Done** | `booster.engine.ts`, `missed-vaccine.engine.ts`, `vaccine-history.loader.ts` |
| **6I.1e** | Reminder policy contract | **Done** | `reminder.engine.ts`; `POST .../reminders` |
| **6I.1f** | Interaction service + Prescription bridge | **Done** | `vaccine-interaction-check.engine.ts`; `POST .../interactions` |
| **6I.1g** | VaccineSafetyReport + escalation binding | **Done** | `vaccine-safety-report.engine.ts`, `vaccine-escalation.engine.ts` |
| **6I.1h** | Orchestrator + envelope (VX-10) + gateway | **Done** | `ai-vaccine-orchestrator.service.ts`; `POST /assistants/vaccine` uses orchestrator |
| **6I.1i** | Mobile UX + notification delivery | **Pending** | `pranidoctor_user` |
| **6I.1j** | Golden-set corpora + pilot metrics | **Pending** | Extend Phase 6F eval |

**Tests:** `npm run typecheck:ai` — 0 errors; `npx vitest run src/modules/ai` — **481 passed** (60 files, incl. 27 vaccine tests).

**Verification:** `docs/reports/phase-6i-vaccine-assistant-verification.md` — Safety **88**, Grounding **84**, Production readiness **70** (PASS WITH CONDITIONS)

**Safety guarantees implemented:**
- VKL → VRE (`vaccine-advisor-v1`) → Router on every analyze turn
- No diagnosis language path — intent router blocks and offers AI Doctor handoff (VX-01)
- All analyze responses include `citations`, `confidence`, `safetyMessaging` (VX-10)
- Schedule summaries rendered from VKL rows before LLM; post-LLM validation via `validateLlmOutput`
- Escalation records on BLOCK / safety triggers / user request
- Audit events: `VACCINE_ANALYZE`, `VACCINE_ESCALATE` → AI Analytics via `AiAuditService`

**API surface:**

| Method | Route |
|--------|-------|
| `POST` | `/api/ai/vaccine/sessions` |
| `GET` | `/api/ai/vaccine/sessions/:id` |
| `POST` | `/api/ai/vaccine/sessions/:id/analyze` |
| `POST` | `/api/ai/vaccine/sessions/:id/lookup` |
| `POST` | `/api/ai/vaccine/sessions/:id/schedules` |
| `POST` | `/api/ai/vaccine/sessions/:id/eligibility` |
| `POST` | `/api/ai/vaccine/sessions/:id/boosters` |
| `POST` | `/api/ai/vaccine/sessions/:id/missed` |
| `POST` | `/api/ai/vaccine/sessions/:id/reminders` |
| `POST` | `/api/ai/vaccine/sessions/:id/interactions` |
| `POST` | `/api/ai/vaccine/sessions/:id/escalate` |
| `POST` | `/api/ai/assistants/vaccine` (orchestrator-backed gateway) |

**Corpus dependency:** Wave 1 vaccine MVC publish still improves schedule grounding density; fail-closed remains correct without full corpus.

---

## Strategic intent

| Principle | Vaccine Assistant interpretation |
|-----------|----------------------------------|
| **Prevent, don't diagnose** | Language contract: "protection schedule" not "your animal has disease X" |
| **Schedule from VKL, history from farm** | Dates and intervals come from `structuredFacts[]` + DB records — never LLM invention |
| **Retrieve before respond** | Every analytical turn runs VRE with `vaccine-advisor-v1` before router |
| **Vet administers, AI educates** | Farmer sees when/why/warnings; vet (or trained paravet under vet plan) performs injection |
| **National program alignment** | DLS vaccination calendar source required on schedule entities (6E Wave 1) |
| **Cold chain is safety-critical** | Live/attenuated biologics → mandatory cold-chain block when applicable |
| **Escalation on deviation** | Off-schedule acceleration, unknown product, adverse reaction → vet path |
| **Bangla-first** | Colloquial BN ("টিকা", "FMD টিকা") in; canonical antigen in parentheses |
| **Species-aware always** | Cattle, buffalo, goat, sheep, poultry, duck profiles gate all schedule logic |
| **Audit everything** | Session ID, pack ID, schedule slugs, routing decision, reminder IDs per turn |
| **Close the loop to VKL** | Unknown vaccine name, schedule drift vs DLS → editorial gap ticket |

---

## Explicit prohibitions (normative)

| Prohibition ID | Rule | Enforcement layer |
|----------------|------|-------------------|
| **VX-01** | **Never diagnose disease** — no differentials, no "your animal has X", no symptom-to-disease inference | Intent classifier; post-LLM diagnosis pattern filter; route to AI Doctor |
| **VX-02** | **Never replace a veterinarian** — no autonomous vaccination orders, no "you must give dose X now" as binding instruction | Mode gate; language contract; administration verbs blocked for farmer tier |
| **VX-03** | **No schedule dates without VKL structured facts** — age windows, booster intervals, routes from `VaccinationSchedule.structuredJson` only | Pre-LLM schedule engine; post-LLM numeric lock |
| **VX-04** | **No off-schedule acceleration** without published L2+ fact and vet-approved chunk | BLOCK + escalate |
| **VX-05** | **No LLM-invented booster intervals** — intervals must match `boosterIntervalDays` in pack | Structured fact lock |
| **VX-06** | **No bypassing VRE** for schedule or interaction claims | Orchestrator invariant |
| **VX-07** | **No treatment or antibiotic dosing** — medicine questions → Prescription Assistant | Cross-assistant router (SP-01) |
| **VX-08** | **No disease workup from vaccination context** — "sick after vaccine" → AI Doctor + Emergency if severe | Intent router |
| **VX-09** | **No product-specific registration claims** without REGULATORY_BD entity (Wave 3a) | Template: "confirm product with vet" |
| **VX-10** | **No clinical output without citations + confidence + safety messaging** | Response envelope validator |

### Allowed outputs (farmer tier)

| Output type | Example | Requirements |
|-------------|---------|--------------|
| Vaccine identification | "FMD vaccine protects against foot-and-mouth disease" | Citation + confidence tier + disclaimer |
| Schedule window (educational) | "National program suggests first FMD dose around 3–6 months" | 2+ citations (schedule + DLS source) |
| Eligibility status | "Based on age (4 months), within published window" | Structured fact + citation |
| Booster due estimate | "Next booster due in ~45 days (if prior dose on [date])" | VKL interval + user record; confidence if record missing |
| Missed vaccine alert | "Scheduled dose was due [date]; consult your vet" | Operational data + schedule; escalate nudge |
| Cold-chain reminder | "Keep 2–8°C; do not freeze" | `ColdChainRule` citation |
| Interaction warning | "Avoid concurrent antibiotic X — see vet" | Citation; Prescription handoff offer |
| Adverse reaction guidance | "Swelling may occur; call vet if …" | VKL post-vaccination SOP; escalate on severe signs |

### Forbidden outputs (all tiers)

| Output type | Reason |
|-------------|--------|
| Definitive disease diagnosis | VX-01 — AI Doctor domain |
| Prescription / dose for medicine | VX-07 — Prescription domain |
| "Give 2 ml IM today without vet" | VX-02 — replaces veterinarian |
| Extra dose "because outbreak nearby" without cited protocol | VX-04 |
| Schedule dates not in VKL | VX-03 |

---

## Product boundaries

### In scope — AI Vaccine Assistant

- Vaccine lookup and reference cards
- Species- and age-specific schedule display
- Eligibility evaluation (too young / in window / overdue for primary)
- Booster due calculation from VKL + vaccination history
- Missed / overdue vaccine detection
- Herd vaccination planning timelines (educational)
- Reminder generation policy (dates, channels — hooks only in architecture)
- Vaccine–medicine and vaccine–vaccine interaction surfacing
- Cold-chain and biologic risk warnings
- Adverse-event triage language (non-diagnostic) with escalation
- Escalation to licensed vet
- VKL gap tickets on unknown products
- Integration with `LivestockVaccination` operational records

### Out of scope — routed to sibling assistants

| User intent | Route to | Reason |
|-------------|----------|--------|
| Symptom triage, "what disease is this?" | AI Doctor | VX-01 |
| Emergency bleeding, collapse, dystocia | AI Emergency Assistant | R4 |
| Drug dose, antibiotic timing | AI Prescription Assistant | R3 |
| Feed, nutrition | AI Feed Advisor | FEED domain |
| Breeding, heat detection | AI Breeding Advisor | REPRODUCTION domain |
| Vaccine procurement, inventory pricing | Marketplace / ERP | Transactional |
| Official disease notification to DLS | Government reporting workflows | Outside AI |
| Replacing vet vaccination camp logistics | Field operations product | Optional `FIELD_AGENT` escalation only |

---

## Vaccine Knowledge Base (VKL) consumption

### Entity types (Phase 6A § Vaccine Knowledge Base)

| Entity | Key structured fields | Assistant use |
|--------|----------------------|---------------|
| `Vaccine` | `antigen`, `manufacturer`, `valency`, `storageTempC`, `doseMl`, `route` | Lookup, reference cards, cold-chain warnings |
| `VaccinationSchedule` | `species`, `ageWindow`, `boosterIntervalDays`, `seasonalNotes`, `route` | Eligibility, planning, reminders |
| `ColdChainRule` | `maxExposureMinutes`, `transportGuidance`, temperature range | Risk warnings for live biologics |

### Graph edges

| Edge | Use |
|------|-----|
| `SCHEDULED_BY` | Vaccine → VaccinationSchedule species-age matrix |
| `PREVENTED_BY` | Disease → Vaccine (educational "protects against" — not diagnosis) |
| `GOVERNED_BY` | Vaccine → DrugRegistration (future Wave 3a) |
| Custom `VACCINE_MEDICINE_CONFLICT` | Cross-domain interaction (shared with Prescription 6H) |
| Custom `VACCINE_VACCINE_INTERVAL` | Minimum days between live vaccines (future edge type) |

### Wave 1 MVC corpus alignment (Phase 6E)

| Corpus segment | Count | Grounding requirement |
|----------------|-------|----------------------|
| `Vaccine` headers | 12 | Storage/handling; trustTier ≤ 2 + DLS for schedules |
| `VaccinationSchedule` | 14 | `dls-vaccination-calendar-bd` on every schedule row |
| `ColdChainRule` | 4 | Mandatory for live vaccine paths |
| `farm-annual-vaccination-calendar` | 1 | Multi-species overview chunk |

**Chunk policy:** `VACCINE_BY_SCHEDULE_ROW` — schedule rows are atomic retrieval units.

### Structured fact types (VRE extension for 6I)

| Fact type | Schema sketch | Claim class |
|-----------|---------------|-------------|
| `VACCINE_IDENTITY` | `{ antigen, slug, route, doseMl }` | Lookup |
| `SCHEDULE_AGE_WINDOW` | `{ species, antigen, ageWindowBn, ageMinDays?, ageMaxDays? }` | Eligibility |
| `BOOSTER_INTERVAL_DAYS` | `{ species, antigen, days }` | Booster / reminders |
| `COLD_CHAIN_TEMP` | `{ minC, maxC, noFreeze }` | Risk warnings |
| `VACCINE_MEDICINE_CONFLICT` | `{ vaccine, medicine, conflictType, windowDays }` | Interactions |
| `VACCINE_VACCINE_INTERVAL` | `{ vaccineA, vaccineB, minDays }` | Concurrent biologic checks |
| `POST_VACCINATION_EXPECTATION` | `{ reactionTier, observationBn }` | Education only |

---

## Three-layer stack (detailed)

### Layer 1 — VKL

Preventive-care retrieval prioritizes **published + vet-approved** schedule rows (`clinicalRiskTier: HIGH`, evidence ≥ L2 per 6E).

| Domain filter | Priority |
|---------------|----------|
| `VACCINE` | Primary |
| `FARM_MGMT` | Herd health program, seasonal calendar |
| `DISEASE` | **Prevention context only** (`PREVENTED_BY`) — no symptom/differential retrieval profile |

**Symptom graph:** Not used for vaccine assistant (prevents diagnosis drift). Red-flag symptom queries reroute to AI Doctor / Emergency.

### Layer 2 — VRE

| Parameter | Vaccine Assistant value |
|-----------|-------------------------|
| `profileId` | `vaccine-advisor-v1` (target rename: `vaccine-assistant-v1`) |
| `taskType` | `DISEASE_ANALYSIS` (registry); internal `preventiveIntent: VACCINATION` |
| `domainPriority` | `VACCINE`, `FARM_MGMT`, `DISEASE` (prevention edges only) |
| `minConfidence` | 0.60 |
| `medicalMinConfidence` | 0.60 |
| `minEvidenceLevel` | L2 for schedule dates; L1 allowed for cold-chain SOP titles |
| `failClosed` | **false** for general education; **true** for schedule date / booster interval claims |
| `blockLowConfidenceMedical` | **true** |
| `vetApprovedRequired` | **true** for schedule-bearing chunks |
| `tokenBudget` | 1,600 |
| `semanticWeight` | 0.47 (BN colloquial "টিকা কখন") |
| `graphEdgeTypes` | `SCHEDULED_BY`, `PREVENTED_BY` |
| `groundingStrictness` | **moderate** → **strict** for schedule claim class |

**Routing outcomes:**

| Decision | LLM allowed? | User experience |
|----------|-------------|-----------------|
| `PROCEED` | Yes | Schedule summary + citations + confidence badge |
| `PROCEED_DEGRADED` | Yes | "Confirm with vet" + reduced schedule detail |
| `BLOCK` | **No** | Safe template + vet CTA |
| `ESCALATE_HUMAN` | Optional adjunct | Adverse reaction / unknown product |

### Layer 3 — AI Router

```
AiFoundationService.executePromptTask({
  promptKey: 'vaccine_assistant',
  taskType: 'DISEASE_ANALYSIS',
  feature: 'vaccine_assistant',
  userMessage: enrichedContext,
  locale: 'bn' | 'en',
})
```

**Post-LLM validation (vaccine-specific):**

- Diagnosis language patterns → **BLOCK** + route offer to AI Doctor (VX-01)
- Schedule numbers ∉ structuredFacts → **BLOCK** (VX-03, VX-05)
- Administration imperative to farmer without vet-supervision flag → **SANITIZE** or **BLOCK** (VX-02)
- Missing citation tokens on schedule claims → **SANITIZE** or **BLOCK**
- Treatment/dose medicine patterns → handoff Prescription (VX-07)

---

## Core capabilities

### 1. Vaccine lookup

**Goal:** Resolve BN colloquial, trade name, or antigen code to published `Vaccine` entity.

```
User input → normalizer → lexical + semantic match (VACCINE domain)
  → DrugMatch-style VaccineMatch[] (max 5)
  → VaccineReferenceCard (cited)
```

| Gate | Behavior |
|------|----------|
| confidence ≥ 0.70 | Show card |
| Ambiguous top-2 within 0.05 | Disambiguation UI |
| No match | BLOCK + VKL gap ticket + vet CTA |

### 2. Species-specific schedules

**Goal:** Return national-program-aligned schedule rows for species + production stage.

```
resolveSchedules(species, stage?, antigenFilter?)
  → Vk published VaccinationSchedule entities
  → filter regionScope=BD, status=PUBLISHED
  → ScheduleRow[] with citations (DLS source mandatory)
```

**Output:** `SpeciesSchedulePack` — ordered list of antigens, age windows, booster intervals, seasonal notes.

### 3. Age-based eligibility

**Goal:** Deterministic eligibility from animal age (days) vs `ageWindow` / parsed min-max.

```typescript
EligibilityResult {
  status: 'NOT_ELIGIBLE' | 'APPROACHING' | 'IN_WINDOW' | 'OVERDUE_PRIMARY' | 'UNKNOWN';
  ageDays: number;
  scheduleSlug: string;
  ageWindowDisplayBn: string;
  citations: InlineCitation[];
  confidenceScore: number;
  vetConfirmRequired: boolean;  // always true for HIGH tier schedules
}
```

| Status | Farmer messaging |
|--------|------------------|
| `NOT_ELIGIBLE` | "Too young per national schedule — consult vet" |
| `IN_WINDOW` | "Within published window — plan with vet" |
| `OVERDUE_PRIMARY` | "Primary dose window may have passed — vet advice" |
| `UNKNOWN` | Missing age → prompt; BLOCK schedule claims |

### 4. Booster tracking

**Goal:** Compute next due date from last `administeredDate` + VKL `boosterIntervalDays`.

```
lastDose = LivestockVaccination.administeredDate (matched by antigen/slug mapping)
interval = SCHEDULE structuredJson.boosterIntervalDays
nextDue = lastDose + interval
  → BoosterStatus { dueInDays, overdue, citations }
```

| Data gap | Behavior |
|----------|----------|
| No administered history | Show VKL primary schedule only; confidence **Limited** |
| History without VKL mapping | `PROCEED_DEGRADED` + manual vet confirmation |
| Interval missing in VKL | BLOCK booster claim |

### 5. Missed vaccine detection

**Goal:** Identify overdue scheduled doses using operational records vs calendar.

```
for each LivestockVaccination where status ∈ { DUE, OVERDUE, SCHEDULED }:
  compare scheduledDate vs today
  enrich with VKL schedule context (what was due)
  → MissedVaccineAlert[]
```

Integrates existing mobile status computation (`computeVaccineStatus`) — assistant adds **VKL-grounded explanation** and escalation policy.

| Severity | Condition |
|----------|-----------|
| `INFO` | Due within 7 days |
| `WARNING` | Overdue < 30 days |
| `HIGH` | Overdue ≥ 30 days or core antigen (FMD, PPR) |
| `CRITICAL` | Herd outbreak season + overdue core vaccine (if seasonalNotes match) |

### 6. Vaccination planning

**Goal:** Educational timeline for one animal or herd — **not** a clinical order set.

```
buildVaccinationPlan(livestock[], horizonMonths)
  → merge per-animal eligibility + booster projections
  → sort by date
  → VaccinationPlanTimeline { events[], citations[], confidenceSummary }
```

**Rules:**

- Each timeline event must cite a `VaccinationSchedule` versionId
- Plans display "Discuss with your veterinarian before administration"
- No automatic creation of `LivestockVaccination` rows without user confirm (UX)

### 7. Vaccination reminders

**Goal:** Policy-driven reminder generation connecting schedule math to notification channels.

```typescript
ReminderPolicy {
  leadDaysBeforeDue: number[];      // e.g. [14, 7, 1]
  overdueRepeatDays: number[];      // e.g. [1, 7, 14]
  quietHoursLocal: { start, end };
  maxRemindersPerWeek: number;
  locale: 'bn' | 'en';
}

VaccinationReminder {
  id: string;
  livestockId: string;
  vaccinationRecordId?: string;
  scheduleSlug: string;
  dueDate: string;
  channel: 'PUSH' | 'SMS' | 'IN_APP';
  messageBn: string;
  citations: InlineCitation[];
  confidenceTier: ConfidenceTier;
  safetyFooterBn: string;           // mandatory
}
```

**Architecture note:** Notification delivery is **out of band** (push provider, SMS gateway). 6I defines **reminder content contract** — citations and safety footer required in every template.

### 8. Vaccine interaction checks

**Goal:** Surface conflicts between vaccines, and between vaccines and medicines.

**Vaccine-native path:**

```
evaluateVaccineInteractions(vaccineSlugs[], medicineSlugs?, proposedDates?)
  → VACCINE_VACCINE_INTERVAL edges
  → delegate medicine pairs to Prescription VaccineMedicineConflict evaluator (6H)
  → VaccineInteractionReport
```

| Scenario | Behavior |
|----------|----------|
| Farmer asks "antibiotic after FMD vaccine?" | Vaccine assistant leads; cites both domains; offer Prescription deep-dive |
| Concurrent live vaccines too close | BLOCK same-day guidance + vet escalate |
| Unknown medicine | Prescription handoff |

### 9. Risk warnings

**Goal:** Aggregate preventive risks into **`VaccineSafetyReport`**.

```typescript
VaccineSafetyReport {
  reportId: string;
  overallRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  warnings: VaccineSafetyWarning[];
  coldChain?: ColdChainSummary;
  eligibility?: EligibilityResult[];
  interactions?: VaccineInteractionReport;
  missedAlerts?: MissedVaccineAlert[];
  escalationRequired: boolean;
  escalationType?: EscalationType;
  citations: InlineCitation[];
  confidence: SessionConfidence;
  safetyMessaging: SafetyMessagingBlock;  // mandatory
}

SafetyMessagingBlock {
  disclaimerBn: string;
  disclaimerEn: string;
  vetSupervisionBn: string;
  notDiagnosisBn: string;
  regulatoryBn?: string;
}
```

**Warning codes (examples):**

| Code | Trigger |
|------|---------|
| `VC-01` | Live vaccine + cold-chain breach risk |
| `VC-02` | Off-schedule user request |
| `VC-03` | Pregnancy + live vaccine (SP-04) |
| `VC-04` | Missed core antigen overdue |
| `VC-05` | Severe adverse reaction keywords |
| `VC-06` | Unknown vaccine product |
| `VC-07` | Concurrent medicine conflict |

### 10. Escalation rules

| Trigger ID | Condition | Escalation type |
|------------|-----------|-----------------|
| `VACCINE_SCHEDULE_BLOCK` | VRE BLOCK on schedule claims | `VET_BOOKING` |
| `UNKNOWN_VACCINE_PRODUCT` | Lookup fail | `ASYNC_VET_REVIEW` + VKL gap |
| `OFF_SCHEDULE_REQUEST` | User wants acceleration without fact | `VET_BOOKING` |
| `ADVERSE_REACTION_SEVERE` | Emergency lexicon post-vaccination | `VET_CALL_NOW` + Emergency handoff |
| `ADVERSE_REACTION_MILD` | Local swelling, fever | `VET_BOOKING` |
| `MISSED_CORE_VACCINE` | FMD/PPR overdue HIGH | `VET_BOOKING` |
| `INTERACTION_CONTRAINDICATED` | Vaccine–medicine CONTRAINDICATED | `VET_CALL_NOW` |
| `PREGNANCY_LIVE_VACCINE` | SP-04 | `VET_BOOKING` |
| `DIAGNOSIS_INTENT` | VX-01 | Route to AI Doctor |
| `USER_REQUESTED_VET` | User FAB | User-selected |
| `DLS_SCHEDULE_DRIFT` | Admin-detected bulletin mismatch | Editorial queue (internal) |

```typescript
AiEscalationRecord {
  id: string;
  sessionId: string;
  assistantId: 'vaccine';
  triggerRuleId: string;
  escalationType: EscalationType;
  livestockId?: string;
  vaccineSnapshot: { slugs: string[]; species: string };
  safetyReportId?: string;
  packId?: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}
```

---

## Mandatory output envelope (VX-10)

Every analytical API response and LLM turn **must** include:

```typescript
VaccineAssistantResponseEnvelope {
  answerBn: string;
  answerEn?: string;
  citations: InlineCitation[];       // min 1 per schedule/safety claim
  confidence: {
    tier: 'STRONG' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';
    score: number;                   // 0.0 – 1.0
    factors: string[];               // e.g. missing history, REVIEW_DUE
  };
  safetyMessaging: SafetyMessagingBlock;
  routingDecision: ConfidenceRoutingDecision;
  humanRedirect: boolean;
  escalationOffer?: EscalationOffer;
  safetyReport?: VaccineSafetyReport;
  packId?: string;
}
```

### Confidence tiers (farmer UX)

| Tier | Numeric range | Badge (BN) | Routing |
|------|---------------|------------|---------|
| **Strong** | avg ≥ 0.70 | "জাতীয় সূচি অনুযায়ী" | PROCEED |
| **Moderate** | 0.60 – 0.69 | "ভেটেরিনারিয়ান নিশ্চিত করুন" | PROCEED_DEGRADED |
| **Limited** | 0.45 – 0.59 | "সীমিত তথ্য — পশুচিকিৎসকের পরামর্শ" | PROCEED_DEGRADED + escalate nudge |
| **Insufficient** | < 0.45 or BLOCK | "পর্যাপ্ত তথ্য নেই" | BLOCK — no LLM for schedule claims |

### Citation requirements by output type

| Output type | Min citations | Source |
|-------------|---------------|--------|
| Schedule age window | 2 | VaccinationSchedule + DLS calendar |
| Booster interval | 2 | Schedule row + prior dose record metadata |
| Cold-chain warning | 1 | ColdChainRule or Vaccine storage section |
| Vaccine identity | 1 | Vaccine entity |
| Interaction | 2 | VACCINE + MEDICINE sources |
| Missed alert | 1 | Schedule + operational record timestamp |
| Post-vaccination expectation | 1 | VKL SOP / vaccine body |

---

## Access modes

| Mode | Audience | Schedule display | Administration language |
|------|----------|------------------|-------------------------|
| **FARMER_GUIDANCE** | Farmer mobile | Educational windows | Forbidden imperatives (VX-02) |
| **VET_HERD_REVIEW** | Doctor web | Full matrix + herd gaps | Validation annotations only — vet orders externally |

Mode resolved from **auth context** — not user self-selection.

---

## User flows

### Flow F1 — Farmer vaccine lookup

```
Farmer selects animal → species/age pre-filled
  → Enters "FMD টিকা"
  → Vaccine lookup → VaccineReferenceCard
  → VRE retrieve (identity + storage)
  → Envelope with citations + confidence + safety messaging
  → FAB: "ভেটের সাথে পরিকল্পনা করুন"
```

### Flow F2 — Farmer schedule & eligibility

```
Farmer: "গরুর FMD টিকা কখন?"
  → resolveSchedules(COW) + eligibility(ageDays)
  → If IN_WINDOW: cited window text (no "give today")
  → If missing age: prompt age
  → If BLOCK: template + vet booking
```

### Flow F3 — Booster & reminder

```
Farmer views animal vaccination history
  → Booster tracking engine
  → nextDue computed
  → ReminderPolicy generates IN_APP reminder (cited)
  → Optional push notification (architecture hook)
```

### Flow F4 — Missed vaccine

```
Mobile list shows OVERDUE record
  → Assistant explains per VKL what was due
  → MissedVaccineAlert HIGH → VET_BOOKING escalation
```

### Flow F5 — Interaction question

```
Farmer: "FMD টিকার পর antibiotic দেওয়া যাবে?"
  → VaccineInteractionReport + Prescription bridge
  → Cited warning + Prescription handoff
  → No diagnosis (VX-01)
```

### Flow F6 — Sick after vaccine (boundary)

```
Farmer: "টিকা দেওয়ার পর গরু হাঁচা দিচ্ছে ও জ্বর"
  → NOT diagnosis — classify ADVERSE_OR_SYMPTOM
  → Mild: cited post-vaccination expectation + vet booking
  → Severe keywords: Emergency handoff + VET_CALL_NOW
  → Offer AI Doctor only for symptom education (separate session)
```

### Flow V1 — Vet herd review

```
Vet selects farm → herd vaccination matrix
  → Missed/core antigen summary
  → Export cited herd plan for camp planning
  → No auto-send orders to farmers
```

---

## Complete workflow

### Session lifecycle state machine

```
                    ┌──────────────┐
                    │   CREATED    │
                    └──────┬───────┘
                           │ livestock context
                           ▼
                    ┌──────────────┐
         ┌─────────│   INTAKE     │◄────────┐
         │         └──────┬───────┘         │
         │                │ query classified │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         │    │ INTENT_GATE           │      │
         │    │ diagnosis? → Doctor   │      │
         │    │ medicine? → Rx        │      │
         │    └───────────┬───────────┘      │
         │                │ preventive       │
         │                ▼                  │
         │    ┌───────────────────────┐      │
         │    │ SCHEDULE_ENGINE       │      │
         │    │ (deterministic)       │      │
         │    └───────────┬───────────┘      │
         │                │                  │
         │    ┌───────────┴───────────┐      │
         │    │                       │      │
         │ BLOCK│                  OK   │      │
         │    ▼                       ▼      │
         │ ┌─────────┐    ┌───────────────────────┐
         │ │ BLOCKED │    │  VKL + VRE RETRIEVE   │
         │ └────┬────┘    └───────────┬───────────┘
         │      │                     │
         │      │                     ▼
         │      │            ┌───────────────────────┐
         │      │            │  AI ROUTER (optional) │
         │      │            └───────────┬───────────┘
         │      │                        │
         │      │                        ▼
         │      │            ┌───────────────────────┐
         │      │            │ POST_LLM_VALIDATE     │
         │      │            └───────────┬───────────┘
         └──────┴────────────────────────┘
                                    │
                                    ▼
                         ┌───────────────────────┐
                         │ ENVELOPE_DELIVERED    │
                         │ citations+confidence  │
                         │ +safetyMessaging      │
                         └───────────┬───────────┘
                                     ▼
                              ┌───────────────┐
                              │  ESCALATED?   │
                              └───────────────┘
```

---

## Vaccine orchestration layer (conceptual)

```
AiVaccineOrchestrator
├── SessionManager              — session CRUD, mode, livestock binding
├── VaccineLookupService        — entity resolution
├── ScheduleEngine              — species schedules, eligibility
├── BoosterTrackingService      — VKL interval + LivestockVaccination
├── MissedVaccineService        — overdue analysis
├── VaccinationPlannerService   — timeline generation
├── ReminderPolicyService       — reminder content (not transport)
├── VaccineInteractionService   — vaccine–vaccine + Prescription bridge
├── VaccineSafetyReportBuilder  — warning aggregation
├── IntentRouter                — Doctor / Prescription / Emergency boundaries
├── ConfidenceService           — tier aggregation
├── EscalationService           — AiEscalationRecord
└── VaccineTurnExecutor           — VeterinaryAssistantService when LLM allowed
```

### Session model

```typescript
AiVaccineSession {
  id: string;
  userId: string;
  customerId: string;
  mode: 'FARMER_GUIDANCE' | 'VET_HERD_REVIEW';
  livestockId?: string;
  herdId?: string;                    // VET_HERD_REVIEW
  species: LivestockSpecies;
  ageDays?: number;
  pregnancy: boolean;
  locale: 'bn' | 'en';
  vaccineSlugs: string[];
  vaccinationHistoryIds: string[];   // LivestockVaccination FKs
  safetyReport?: VaccineSafetyReport;
  confidence: SessionConfidence;
  escalationIds: string[];
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### API surface (conceptual)

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/ai/vaccine/sessions` | Create session |
| `GET` | `/api/ai/vaccine/sessions/:id` | Session replay |
| `POST` | `/api/ai/vaccine/sessions/:id/lookup` | Vaccine lookup |
| `POST` | `/api/ai/vaccine/sessions/:id/schedules` | Species schedules |
| `POST` | `/api/ai/vaccine/sessions/:id/eligibility` | Age eligibility |
| `POST` | `/api/ai/vaccine/sessions/:id/boosters` | Booster status |
| `POST` | `/api/ai/vaccine/sessions/:id/missed` | Missed detection |
| `POST` | `/api/ai/vaccine/sessions/:id/plan` | Vaccination plan |
| `POST` | `/api/ai/vaccine/sessions/:id/reminders` | Generate reminder payloads |
| `POST` | `/api/ai/vaccine/sessions/:id/interactions` | Interaction check |
| `POST` | `/api/ai/vaccine/sessions/:id/analyze` | Full pipeline + optional LLM |
| `POST` | `/api/ai/vaccine/sessions/:id/escalate` | User-initiated escalation |
| `POST` | `/assistants/vaccine` | **Existing** gateway turn |

---

## Safety policies (Vaccine specific)

| Policy | Rule |
|--------|------|
| **VC-RX-01** | No LLM on schedule claims when VRE BLOCK (VX-03) |
| **VC-RX-02** | No diagnosis language (VX-01) — post-LLM filter |
| **VC-RX-03** | No farmer administration imperatives (VX-02) |
| **VC-RX-04** | Every response includes `safetyMessaging` block (VX-10) |
| **VC-RX-05** | Citations required per citation matrix |
| **VC-RX-06** | Confidence tier visible on every analytical response |
| **VC-RX-07** | Pregnancy + live vaccine → escalate (SP-04) |
| **VC-RX-08** | Log `sessionId`, `packId`, `scheduleSlugs[]`, `routingDecision` |
| **VC-RX-09** | Unknown product → VKL gap ticket |
| **VC-RX-10** | DLS schedule drift → editorial alert (6B.4) |
| **VC-RX-11** | Adverse severe → Emergency handoff |
| **VC-RX-12** | Cold-chain mandatory for live biologics when `storageTempC` defined |

---

## Integration map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AI VACCINE ASSISTANT PRODUCT                         │
├─────────────────────────────────────────────────────────────────────────┤
│  VKL VACCINE corpus (6E Wave 1) ──────► ScheduleEngine, Lookup          │
│  LivestockVaccination (operational) ──► Booster, Missed, Reminders       │
│  AiVaccineOrchestrator ───────────────► VeterinaryAssistantService        │
│  VeterinaryAssistantService ──────────► KnowledgeRetrievalService (VRE) │
│  VaccineInteractionService ◄──────────► AiPrescriptionOrchestrator (6H)   │
│  IntentRouter ──diagnosis──► AI Doctor (separate case)                    │
│  IntentRouter ──medicine──► Prescription Assistant                        │
│  IntentRouter ──emergency──► Emergency Assistant                          │
│  PostLlmValidator ◄──────────────────── Router output                     │
│  AiEscalationRecord ───────────────────► Vet inbox (6D.7)                 │
│  Notification platform ◄─────────────── ReminderPolicyService (hooks)    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Operational record mapping

| `LivestockVaccination` field | VKL mapping strategy |
|----------------------------|----------------------|
| `vaccineName` | Fuzzy match → `Vaccine.slug` via alias table (6I.2) |
| `vaccineType` | Optional antigen hint |
| `scheduledDate` / `administeredDate` | Booster/missed math |
| `nextDueDate` | Validate against VKL recomputation |
| `status` | Mobile `computeVaccineStatus` — assistant adds cited explanation |

---

## Observability & success metrics

| Metric | Pilot target | Measurement |
|--------|-------------|-------------|
| Diagnosis language leak rate | **0%** | VX-01 filter audit |
| Schedule claim without citation | **0%** | Envelope validator |
| LLM bypass on schedule BLOCK | 100% | Usage audit |
| Booster date accuracy vs VKL | ≥ 95% | Structured fact compare |
| Missed detection recall | ≥ 90% | Test herd fixtures |
| Reminder envelope compliance (safety footer) | 100% | Template audit |
| Farmer administration imperative leak | **0%** | VX-02 pattern scan |
| Escalation on HIGH missed core antigen | ≥ 90% | Funnel |
| Unknown vaccine → gap ticket | 100% | Session audit |

### Eval harness extension (Phase 6F)

| Corpus | Queries | Validates |
|--------|---------|-----------|
| `vaccine-farmer-bn-g1-v1.json` | 25 | Lookup, schedule, eligibility |
| `vaccine-booster-bn-v1.json` | 15 | Booster + history merge |
| `vaccine-block-bn-v1.json` | 10 | Off-schedule, unknown product |
| `vaccine-boundary-bn-v1.json` | 10 | Diagnosis intent → redirect |
| `vaccine-interaction-v1.json` | 10 | Medicine cross-check |

---

## Sub-phase roadmap (Vaccine only)

| Sub-phase | Scope | Depends on | Status |
|-----------|-------|------------|--------|
| **6I.1a** | Session model + intent router + API skeleton | 6D.4 gateway | **Done** |
| **6I.1b** | Vaccine lookup + reference cards | 6E Wave 1 vaccines | **Done** |
| **6I.1c** | ScheduleEngine + eligibility evaluator | 6I.1b, schedule corpus | **Done** |
| **6I.1d** | Booster + missed + LivestockVaccination mapping | 6I.1c, mobile records API | **Done** |
| **6I.1e** | Reminder policy contract | 6I.1d | **Done** |
| **6I.1f** | Interaction service + Prescription bridge | 6H.1d | **Done** |
| **6I.1g** | VaccineSafetyReport + escalation binding | 6I.1f | **Done** |
| **6I.1h** | Orchestrator + envelope validator (VX-10) | 6I.1g, 6C.13 | **Done** |
| **6I.1i** | Mobile UX + notification integration | 6I.1h | Pending |
| **6I.1j** | Golden-set corpora + pilot metrics | 6F, 6I.1h | Pending |

**Corpus gate:** Production schedule grounding requires **6E Wave 1 vaccine MVC published** (14 schedules + DLS source attribution).

---

## Mobile UX principles (`pranidoctor_user`)

| Pattern | Requirement |
|---------|-------------|
| **Preventive-care header** | "টিকা পরিকল্পনা — চিকিৎসকের পরামর্শে প্রয়োগ" |
| **Not diagnosis badge** | Visible on all screens (VX-01) |
| **Confidence badge** | Strong / Moderate / Limited |
| **Citation tap-through** | Source title + DLS reference |
| **Schedule cards** | Age window + booster — no imperative dose |
| **Missed vaccine banner** | Red overdue + vet FAB |
| **Reminder preview** | Shows cited due reason before user enables push |
| **Interaction CTA** | Link to Prescription for medicine detail |
| **Sick after vaccine** | Split: mild (vaccine) vs severe (emergency) — no differential list |

---

## Compliance (Bangladesh)

| Topic | Vaccine Assistant policy |
|-------|--------------------------|
| **Practitioner of medicine** | AI never diagnoses or prescribes vaccination as treatment for disease |
| **National program** | Schedules cite DLS calendar; district variation → vet confirmation |
| **Biologics regulation** | Product-specific claims deferred to Wave 3a `GOVERNED_BY` |
| **Food safety** | Withdrawal questions → Prescription Assistant (SP-06) |
| **AI disclaimer** | Mandatory BN preventive-care disclaimer on every envelope |
| **Data privacy** | Session + vaccination history customer-scoped |
| **Record retention** | Sessions 24 months minimum |

---

## Appendix A — Retrieval session context

```typescript
sessionContext: {
  sessionId: string;
  mode: 'FARMER_GUIDANCE' | 'VET_HERD_REVIEW';
  species: LivestockSpecies;
  ageDays?: number;
  pregnancy: boolean;
  vaccineSlugs?: string[];
  scheduleSlugs?: string[];
  vaccinationRecordIds?: string[];
  previousPackId?: string;
  preventiveIntent?: 'LOOKUP' | 'SCHEDULE' | 'BOOSTER' | 'MISSED' | 'PLAN' | 'INTERACTION';
}
```

---

## Appendix B — Prompt contract slots (`vaccine_assistant`)

| Slot | Source | Required |
|------|--------|----------|
| `groundingInstruction` | VRE pack | Always |
| `citationBlock` | VRE pack | When schedule/safety claims |
| `evidenceBlock` | VRE pack | Schedule turns |
| `confidenceBlock` | VRE pack | Always |
| `scheduleFactsBlock` | ScheduleEngine structured output | Schedule turns |
| `safetyReportBlock` | VaccineSafetyReport | When warnings > 0 |
| `nonDiagnosisContract` | Static VX-01 | Always |
| `nonPrescriptionContract` | Static VX-02 | Always |
| `safetyMessagingBlock` | Static + dynamic | Always |
| `userMessage` | Farmer input | Always |

---

## Appendix C — `vaccine-advisor-v1` profile enhancements (target)

| Field | Current (6D) | Target (6I) |
|-------|--------------|-------------|
| `profileId` | `vaccine-advisor-v1` | `vaccine-assistant-v1` (alias old id) |
| `failClosed` | false | **true** for `scheduleClaimClass` |
| `scheduleMinConfidence` | — | **0.65** |
| `structuredFactTypes` | — | SCHEDULE_*, BOOSTER_*, COLD_CHAIN_* |
| `graphEdgeTypes` | — | `SCHEDULED_BY`, `PREVENTED_BY` |
| `excludeSymptomGraph` | — | **true** |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **AI Vaccine Assistant** | Preventive-care vaccination decision-support (this document) |
| **Preventive-care architecture** | Schedules and protection — explicitly not diagnostic |
| **VaccineSafetyReport** | Aggregated warnings and escalation signals |
| **ScheduleEngine** | Deterministic VKL schedule + eligibility logic |
| **KnowledgeContextPack** | VRE output — mandatory router input |
| **VX-10 envelope** | Citations + confidence + safety messaging on every output |

---

## Document cross-reference

| Document | Relationship |
|----------|--------------|
| `phase-6a-veterinary-knowledge-architecture.md` | Vaccine KB entity model, `SCHEDULED_BY` edges |
| `phase-6d-ai-doctor.md` | Sibling — diagnosis boundary, symptom handoff out |
| `phase-6h-ai-prescription-assistant.md` | Sibling — vaccine–medicine interactions |
| `phase-6d-veterinary-ai-assistant.md` | Parent gateway — §3 AI Vaccine Assistant summary |
| `phase-6e-wave1-mvc-corpus.md` | Vaccine corpus counts and DLS citation rules |
| `phase-6c-rag-engine-architecture.md` | VRE profiles, structured facts, routing |

---

**Document owner:** Principal Veterinary Preventive Care Architect  
**Next review:** Upon 6I.1i mobile UX kickoff or 6I.1j golden-set eval
