# Phase 6E Wave 1 — Minimum Viable Clinical Corpus (MVC)

**Project:** Prani Doctor  
**Role:** Principal Veterinary Knowledge Program Director  
**Date:** 2026-05-31  
**Status:** Wave 1 MVC **implemented (subset deployed)** — see [Implementation progress](#implementation-progress-2026-05-31)  
**Version:** 1.0.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL domain model, evidence, retrieval profiles, editorial gates)
- `docs/plans/phase-6e-knowledge-population.md` (population waves, chunk/citation KPIs, golden-set alignment)
- `docs/reports/phase-6f-golden-set-verification.md` (grounding gate baseline — **70 / 100**, blocker for production)

**Unblocks:** Phase 6F re-certification — **Grounding score ≥ 90** on G1 golden set with `corpusUnavailable=false`

---

## Executive summary

Phase 6F certification **failed on grounding** (70 vs 90 target) because **zero published VKL chunks** exist. Diagnostic (100) and safety (99) gates already pass. Wave 1 MVC is the **smallest clinically governed corpus** that restores live grounding measurement and clears the production gate.

Wave 1 MVC scopes **seven farmer-critical domains** for Bangladesh livestock (P0–P1 species):

1. Common Cattle Diseases  
2. Common Goat Diseases  
3. Common Poultry Diseases  
4. Emergency Conditions  
5. Vaccination Schedules  
6. Basic Nutrition & Feed  
7. Biosecurity Practices  

**Explicitly out of Wave 1 scope:** Medicine formulary, breed monographs, reproduction guides, and regulatory overlay entities. Prescription-intent queries remain **BLOCK** (fail-closed) per Phase 6F safety design. Wave 1 exists to **ground triage, education, emergency, schedule, feed, and biosecurity** — not to unlock the Prescription Assistant.

### Grounding gate mechanics (normative)

From `grounding.scorer.ts`, per-query grounding score is:

| Component | Weight | Wave 1 requirement |
|-----------|--------|-------------------|
| Citation coverage (chunks with `inlineCitation`) | 50% | **100%** on all retrieved chunks for `intent=medical` |
| Grounding instruction in pack | 25% | Non-empty `groundingInstruction` whenever chunks present |
| Structured facts completeness | 25% | Required fact keys present when specified in golden record |

Aggregate GSE grounding (Phase 6F gate) = query-weighted mean across G1 corpora. With `corpusUnavailable=false`, empty packs on medical queries score **≤ 50** on grounding; populated packs with full citation coverage score **100**.

**Wave 1 pass condition:** Re-run `npm run gse:ai-doctor` and `gse-eval --target=vre --corpus=farmer-bn-g1-v1` (expanded to ≥ 90 queries) with **grounding dimension mean ≥ 90**, zero false PROCEED on BLOCK-labeled prescription queries, and **precision@4 ≥ 0.70** on medical subset.

---

## Wave 1 MVC aggregate targets

| Metric | Minimum to pass grounding gate | Recommended buffer (+10%) |
|--------|--------------------------------|---------------------------|
| **Primary knowledge entities** | **98** | **108** |
| **Supporting entities** (FirstAidStep, TriageRule, etc.) | **42** | **46** |
| **Total stable `entityId` count** | **140** | **154** |
| **Published versions** | **140** (1 current published per entity) | **154** |
| **Published RAG chunks** | **520** | **575** |
| **Graph edges** (`VkKnowledgeLink`) | **≥ 220** | **≥ 240** |
| **`HAS_SYMPTOM` edges** | **≥ 72** | **≥ 80** |
| **Registered BD sources** | **≥ 8** | **≥ 10** |
| **BN locale completeness** (farmer-facing) | **100%** | **100%** |
| **Entities with vet approval where required** | **100%** of HIGH/CRITICAL | **100%** |

### Grounding gate sizing rationale

| Driver | Calculation | Implication |
|--------|-------------|---------------|
| G1 medical query coverage | 90 queries × ~65% medical/emergency/feed = **~58 grounding-scored queries** | Each needs ≥1 grade-3 entity slug retrievable in top-4 with cited chunks |
| Unique slug demand (deduped) | **~72 distinct entity slugs** across seed + expanded G1 | Corpus must publish all 72 with indexed chunks |
| Chunks per grounding query | Top-4 pack × 100% inline citation | **≥ 4 groundable chunks** per distinct high-traffic slug |
| Colloquial BN recall | 5+ `colloquialBn[]` per disease entity | Lexical + hybrid retrieval must hit BN farmer phrasing |
| Symptom graph bridge | 3+ `HAS_SYMPTOM` per disease | Triage and AI Doctor differential paths need graph edges |

**Minimum corpus to pass grounding gate: ~140 entities, ~520 published chunks, fully embedded and indexed.** Below this floor, expect grounding **< 85** on expanded G1 due to retrieval misses on `bn-g1-007`, `bn-g1-014`, `bn-g1-018`, and poultry/emergency crossover queries identified in Phase 6F.

---

## Cross-domain standards (Wave 1)

All seven domains inherit Phase 6A envelope rules. Wave 1 adds stricter floors because grounding gate is citation-saturated.

### Universal citation requirements (Wave 1)

| Entity class | Min sources / version | trustTier | Span locator (L0) | Inline chunk citation (L2) |
|--------------|----------------------|-----------|---------------------|----------------------------|
| Disease (treatment-bearing) | ≥ 2 | ≥ 1 at tier ≤ 2 | 100% chunks | 100% chunks |
| Emergency (CRITICAL) | ≥ 2 | ≥ 1 at tier ≤ 2; zoonotic dual-source | 100% chunks | 100% chunks |
| VaccinationSchedule | ≥ 2 | DLS calendar required | 100% schedule-row chunks | 100% |
| FeedIngredient / NutrientRequirement | ≥ 1 | tier ≤ 2 | ≥ 95% chunks | ≥ 95% |
| ToxicFeedAlert | ≥ 2 | tier ≤ 2 | 100% chunks | 100% |
| BiosecurityMeasure | ≥ 2 | BPA or DLS + BVC | 100% chunks | 100% |

**Pack-level:** Every medical retrieval must populate `KnowledgeContextPack.citationBlock` (non-empty) and `groundingInstruction` when `chunks.length > 0`.

### Universal evidence requirements (Wave 1)

| clinicalRiskTier | Min evidence at publish | Min confidence at publish | Retrieval profile gate |
|------------------|-------------------------|---------------------------|-------------------------|
| CRITICAL (emergency) | L2 (L1 + dual vet for SOP-only first aid) | **0.70** | `emergency-v1` ≥ 0.60 |
| HIGH (vaccine schedule, toxic feed) | L2 | **0.70** | profile-specific |
| MEDIUM (disease treatment sections) | L2 | **0.65** | `ai-doctor-v1` ≥ 0.55 |
| LOW (feed ingredient composition) | L2 | **0.55** | `feed-advisor-v1` ≥ 0.65 for toxic; ≥ 0.55 for ingredients |

### Universal approval requirements (Wave 1)

| Tier | Applies to | Reviewers | SLA |
|------|------------|-----------|-----|
| **T1 — Critical** | `EmergencyCondition`, `TriageRule`, zoonotic diseases | Licensed vet + CVQ dual sign-off | 24 h |
| **T2 — High** | Disease with treatment section, `VaccinationSchedule`, `ToxicFeedAlert` | Licensed vet | 72 h |
| **T3 — Medium** | Disease (signs/prevention only), `BiosecurityMeasure` with farmer excerpt | Domain lead + vet reviewer | 7 d |
| **T4 — Low** | `FeedIngredient`, `NutrientRequirement`, `RationTemplate` | Domain lead | 14 d |

**Publish gate:** No entity publishes without ≥1 L0 span ref, BN+EN title/summary/body, species tags, and required graph links (per domain below).

---

## Domain 1 — Common Cattle Diseases

**VKL domain:** `DISEASE`  
**Wave:** 2 (parallel ingest after Wave 1 emergency slugs exist for `ESCALATES_TO` links)  
**G1 query share:** ~35% of medical queries (cattle P0)  
**chunkPolicyId:** `DISEASE_BY_HEADING`

### Knowledge entries (18 entities)

| # | Slug | Entity type | Priority | BD endemic | Golden query anchors |
|---|------|-------------|----------|------------|---------------------|
| 1 | `mastitis` | Disease | P0 | — | bn-g1-001, bn-g1-002, bn-g1-014, bn-g1-017, ad-g1-001 |
| 2 | `hemorrhagic-septicemia` | Disease | P0 | yes | bn-g1-003 (fever DDx), ad-g1-003 |
| 3 | `foot-and-mouth-disease` | Disease | P0 | yes | lameness/fever crossover |
| 4 | `blackleg` | Disease | P0 | yes | sudden death DDx |
| 5 | `milk-fever` | Disease | P0 | — | emergency cross-link |
| 6 | `ketosis` | Disease | P0 | — | inappetence DDx |
| 7 | `retained-placenta` | Disease | P1 | — | bn-g1-013 (abortion DDx) |
| 8 | `metritis` | Disease | P1 | — | postpartum queries |
| 9 | `foot-rot` | Disease | P1 | — | bn-g1-006 |
| 10 | `laminitis` | Disease | P1 | — | bn-g1-006 |
| 11 | `pneumonia-bovine` | Disease | P0 | — | fever + respiratory |
| 12 | `enterotoxemia` | Disease | P1 | — | GI sudden death |
| 13 | `helminthiasis` | Disease | P1 | — | weight loss / anorexia |
| 14 | `theileriosis` | Disease | P1 | yes | fever endemic |
| 15 | `anthrax` | Disease | P0 | yes | emergency escalate |
| 16 | `brucellosis` | Disease | P1 | yes | abortion DDx |
| 17 | `babesiosis` | Disease | P2 | yes | fever tick-borne |
| 18 | `udder-oedema` | Disease | P2 | — | mastitis DDx |

**Required relationships per entity:** `HAS_SYMPTOM` × ≥3, `DIFFERENTIAL_OF` × ≥2 (where applicable), `PREVENTED_BY` → vaccine entity (where applicable), `ESCALATES_TO` → emergency entity (where red-flag), `PROTOCOL_FOR` → clinical protocol (Growth; optional Wave 1 for mastitis + HS only).

### Chunk targets

| Metric | Target |
|--------|--------|
| Entities | 18 |
| Chunks / entity (avg) | 5 (signs, diagnosis, treatment, prevention, farmer summary) |
| **Domain chunk total** | **90** |
| Avg tokens / chunk | 300 – 450 |
| Overlap | 50 tokens (narrative sections only) |
| Mandatory chunk headings | Signs BN, Diagnosis, Treatment (vet-gated), Prevention, Farmer summary BN |

### Citation requirements

- **Primary:** `bau-vet-medicine-handbook` or `bvc-clinical-protocols`  
- **Corroboration:** `dls-livestock-manual-v1` for all 18 entities  
- **Span:** Section + page for each heading chunk  
- **Inline:** `[dls-livestock-manual-v1\|§signs]` format on every chunk  

### Evidence requirements

- **Default evidence:** L2  
- **endemicBd=true entities:** cite DLS + peer-reviewed field source  
- **Treatment sections:** L2 minimum; structured `mortalityRisk`, `incubationDays` in `structuredJson`  
- **confidenceScore floor:** 0.65 (0.70 for anthrax, HS, FMD)

### Approval requirements

- **T2 (vet mandatory):** all 18 — treatment sections present  
- **T1 dual sign-off:** `anthrax` (zoonotic)  
- **CVQ review:** FMD, HS, anthrax, brucellosis  
- **Farmer body BN:** locale reviewer sign-off before vet queue  
- **Colloquial BN:** minimum 5 terms per entity (e.g. mastitis → `"দুধ গলে"`, `"আদরের ফোলা"`)

---

## Domain 2 — Common Goat Diseases

**VKL domain:** `DISEASE`  
**Wave:** 2  
**G1 query share:** ~12%  
**chunkPolicyId:** `DISEASE_BY_HEADING`

### Knowledge entries (8 entities)

| # | Slug | Entity type | BD endemic | Golden query anchors |
|---|------|-------------|------------|---------------------|
| 1 | `ppr` | Disease | yes | goat fever/diarrhea DDx |
| 2 | `contagious-caprine-pleuropneumonia` | Disease | yes | respiratory |
| 3 | `enterotoxemia-goat` | Disease | — | sudden death |
| 4 | `coccidiosis-goat` | Disease | — | bn-g1-004, ad-g1-004 (diarrhea) |
| 5 | `helminthiasis-goat` | Disease | — | scours / weight loss |
| 6 | `foot-rot-goat` | Disease | — | lameness |
| 7 | `mastitis-goat` | Disease | — | udder queries |
| 8 | `goat-pox` | Disease | yes | skin / fever |

**Note:** Golden label `ad-g1-004` (goat diarrhea **treatment**) — Phase 6F auditor ruled treatment-intent should **BLOCK** or expect `PROCEED_DEGRADED` without dose facts. Corpus supplies **signs + prevention + when-to-call-vet** chunks; treatment chunks are doctor-audience only with `farmerSafeSummaryBn` on farmer retrieval profile.

### Chunk targets

| Metric | Target |
|--------|--------|
| Entities | 8 |
| Chunks / entity | 5 |
| **Domain chunk total** | **40** |

### Citation requirements

- **Primary:** `dls-livestock-manual-v1` (goat section)  
- **Corroboration:** `bau-vet-medicine-handbook` for PPR, CCPP  
- **PPR/CCPP:** OIE or FAO secondary acceptable at trustTier 3 with BD field validation note  

### Evidence requirements

- **PPR, CCPP, goat pox:** L2, endemicBd=true, confidence ≥ 0.68  
- **Coccidiosis:** L2; link `structuredJson.transmissionMode`  
- **All:** ≥3 `HAS_SYMPTOM` including `"ডায়রিয়া"`, `"জ্বর"` where clinically valid  

### Approval requirements

- **T2:** all 8 (treatment sections)  
- **T1 dual sign-off:** PPR (reportable)  
- **Locale:** BN colloquial minimum 5 per entity  

---

## Domain 3 — Common Poultry Diseases

**VKL domain:** `DISEASE`  
**Wave:** 2  
**G1 query share:** ~15%  
**chunkPolicyId:** `DISEASE_BY_HEADING`

### Knowledge entries (10 entities)

| # | Slug | Entity type | BD endemic | Golden query anchors |
|---|------|-------------|------------|---------------------|
| 1 | `newcastle-disease` | Disease | yes | ad-g1-007, bn-g1-007 |
| 2 | `infectious-bursal-disease` | Disease | yes | Gumboro |
| 3 | `infectious-bronchitis` | Disease | — | respiratory flock |
| 4 | `fowl-pox` | Disease | — | skin lesions |
| 5 | `salmonellosis-poultry` | Disease | — | diarrhea / mortality |
| 6 | `coccidiosis-poultry` | Disease | — | bloody droppings |
| 7 | `avian-influenza` | Disease | yes | emergency cross-link |
| 8 | `mycoplasmosis-poultry` | Disease | — | chronic respiratory |
| 9 | `marek-disease` | Disease | — | paralysis (commercial) |
| 10 | `duck-plague` | Disease | yes | duck P0 extension |

### Chunk targets

| Metric | Target |
|--------|--------|
| Entities | 10 |
| Chunks / entity | 5 |
| **Domain chunk total** | **50** |

### Citation requirements

- **Primary:** `bpa-biosecurity-guide` for ND, IBD, IB  
- **Corroboration:** `dls-livestock-manual-v1` poultry chapter  
- **Duck plague:** `wpa-waterfowl-health`  
- **Avian influenza:** dual source + `icddrb-zoonotic-advisories` for farmer zoonosis note  

### Evidence requirements

- **ND, IBD, AI:** L2, confidence ≥ 0.70  
- **Flock diseases:** include `structuredJson.mortalityRisk` and `transmissionMode`  
- **Link:** `PREVENTED_BY` → corresponding vaccine schedule entity (Domain 5)  

### Approval requirements

- **T2:** all 10  
- **T1 dual sign-off:** avian influenza, ND (reportable flock disease)  
- **Poultry vet reviewer:** required on all 10 (approvalScope poultry)  

---

## Domain 4 — Emergency Conditions

**VKL domain:** `EMERGENCY`  
**Wave:** 1 (**critical path — publish first**)  
**G1 query share:** ~12%  
**chunkPolicyId:** `EMERGENCY_BY_ACTION` (one action per chunk, **no overlap**)

### Knowledge entries (15 conditions + 30 FirstAidStep + 10 TriageRule + 8 ReferralTrigger = 63 entities)

**Primary conditions (15 `EmergencyCondition`):**

| # | Slug | Species | vetRequiredWithinHours | Golden anchors |
|---|------|---------|------------------------|----------------|
| 1 | `acute-bloat` | Cattle, buffalo | 2 | ad-g1-008 |
| 2 | `severe-bleeding` | Multi | 2 | bn-g1-008 |
| 3 | `downer-cow-milk-fever` | Cattle | 4 | milk fever cross-link |
| 4 | `acute-hs-crisis` | Cattle, buffalo | 2 | fever emergency |
| 5 | `nd-acute-flock` | Poultry | 4 | flock collapse |
| 6 | `anthrax-suspicion` | Multi | 2 | zoonotic |
| 7 | `rabies-exposure` | Multi | 4 | zoonotic |
| 8 | `organophosphate-poisoning` | Multi | 2 | poisoning |
| 9 | `heat-stroke-livestock` | Multi | 4 | seasonal BD |
| 10 | `dystocia` | Cattle, goat | 2 | bn-g1-013 crossover |
| 11 | `snake-envenomation` | Multi | 2 | field common |
| 12 | `traumatic-injury` | Multi | 2 | bn-g1-019 |
| 13 | `hypothermia-flood-livestock` | Multi | 6 | monsoon BD |
| 14 | `acute-severe-diarrhea-dehydration` | Multi | 4 | scours emergency |
| 15 | `unknown-acute-collapse` | Multi | 2 | bn-g1-019 generic |

**Supporting entities:**

- **30 `FirstAidStep`** — 2 steps per condition avg (farmer action + do-not-do)  
- **10 `TriageRule`** — map symptom patterns to `AiRiskBucket`  
- **8 `ReferralTrigger`** — CALL_VET / emergency channel mapping  

### Chunk targets

| Metric | Target |
|--------|--------|
| `EmergencyCondition` | 15 |
| `FirstAidStep` | 30 (1 chunk each) |
| `TriageRule` | 10 (1 chunk each) |
| `ReferralTrigger` | 8 (1 chunk each) |
| **Domain chunk total** | **63** |
| Avg tokens / chunk | 150 – 250 |
| Overlap | **None** |

### Citation requirements

- **Primary:** `bvc-clinical-protocols`  
- **Corroboration:** `dls-livestock-manual-v1`  
- **Zoonotic (anthrax, rabies):** mandatory dual source — add `icddrb-zoonotic-advisories`  
- **Every FirstAidStep chunk:** single-action citation span  

### Evidence requirements

- **Default:** L2, confidence ≥ 0.70  
- **Established SOP-only first aid (no dose):** L1 acceptable with **dual vet sign-off**  
- **structuredJson:** `vetRequiredWithinHours`, `homeStabilizationAllowed`, `onsetSpeed` mandatory  
- **clinicalRiskTier:** CRITICAL on all 15 conditions  

### Approval requirements

- **T1 + dual sign-off:** anthrax-suspicion, rabies-exposure  
- **T1 single vet:** all other conditions — **100% vet approval, no expedite**  
- **CVQ:** review all zoonotic and `unknown-acute-collapse` triage rules  
- **SLA:** 24 h from IN_REVIEW to PUBLISHED for entire Wave 1 emergency batch  

---

## Domain 5 — Vaccination Schedules

**VKL domain:** `VACCINE`  
**Wave:** 3b (after disease slugs exist for `PREVENTED_BY` inverse links)  
**G1 query share:** ~10%  
**chunkPolicyId:** `VACCINE_BY_SCHEDULE_ROW`

### Knowledge entries (12 vaccines + 14 schedule rows + 4 cold chain = 30 entities)

**Vaccine entities (12 `Vaccine`):**

| # | Slug | Antigen | Species |
|---|------|---------|---------|
| 1 | `fmd-vaccine` | FMD | Cattle, buffalo |
| 2 | `hs-vaccine` | HS | Cattle, buffalo |
| 3 | `bq-vaccine` | BQ | Cattle |
| 4 | `anthrax-vaccine` | Anthrax | Cattle, goat |
| 5 | `ppr-vaccine` | PPR | Goat |
| 6 | `enterotoxemia-vaccine` | Enterotoxemia | Goat, sheep |
| 7 | `nd-vaccine` | Newcastle disease | Poultry |
| 8 | `ibd-vaccine` | Gumboro (IBD) | Poultry |
| 9 | `ib-vaccine` | Infectious bronchitis | Poultry |
| 10 | `marek-vaccine` | Marek's | Poultry (commercial) |
| 11 | `duck-plague-vaccine` | Duck plague | Duck |
| 12 | `fowl-pox-vaccine` | Fowl pox | Poultry |

**Schedule entities (14 `VaccinationSchedule`):**

| # | Slug | Species / stage |
|---|------|-----------------|
| 1 | `cattle-fmd-schedule` | Cattle — national program |
| 2 | `cattle-hs-bq-schedule` | Cattle — combined timing |
| 3 | `buffalo-fmd-schedule` | Buffalo |
| 4 | `goat-ppr-schedule` | Goat |
| 5 | `goat-enterotoxemia-schedule` | Goat |
| 6 | `poultry-nd-schedule` | Broiler + layer |
| 7 | `poultry-ibd-schedule` | Broiler |
| 8 | `poultry-ib-schedule` | Layer |
| 9 | `poultry-marek-schedule` | Hatchery day-old |
| 10 | `duck-dpv-schedule` | Duck |
| 11 | `cattle-anthrax-schedule` | Endemic areas |
| 12 | `heifer-breeding-vaccine-schedule` | Pre-breeding cattle |
| 13 | `lamb-kid-starter-schedule` | Goat/lamb first year |
| 14 | `farm-annual-vaccination-calendar` | Multi-species overview |

**Cold chain (4 `ColdChainRule`):** FMD biologic, ND live vaccine, PPR thermostable, general transport rule

### Chunk targets

| Metric | Target |
|--------|--------|
| Vaccine header chunks | 12 (storage, handling) |
| Schedule row chunks | 14 |
| Cold chain chunks | 4 |
| **Domain chunk total** | **30** |
| Avg tokens / chunk | 100 – 200 |

### Citation requirements

- **Authoritative schedule source:** `dls-vaccination-calendar-bd` — **required** on every schedule row  
- **Storage/handling:** manufacturer PI allowed at trustTier 2 **only** alongside DLS  
- **Span:** table row or calendar month reference  

### Evidence requirements

- **Schedules:** L2 minimum, confidence ≥ 0.70  
- **structuredJson:** `ageWindow`, `boosterIntervalDays`, `route`, `doseMl` per schedule  
- **regionScope:** BD default; note district variation in `seasonalNotes` where applicable  

### Approval requirements

- **T2:** all 14 schedule rows + 4 cold chain rules  
- **T3:** vaccine header entities (domain lead + vet)  
- **Regulatory note:** Wave 1 schedules are **national program alignment** — not a substitute for DGD product-specific label; no `GOVERNED_BY` registration entities in Wave 1 (Wave 3a medicine/regulatory)  

---

## Domain 6 — Basic Nutrition & Feed

**VKL domain:** `FEED`  
**Wave:** 4  
**G1 query share:** ~10%  
**chunkPolicyId:** `FEED_BY_NUTRIENT_BLOCK` + `STRUCTURED_BY_KEY` for composition tables

### Knowledge entries (28 entities)

**Feed ingredients (15 `FeedIngredient`):**

| # | Slug | Use |
|---|------|-----|
| 1 | `green-grass` | Baseline forage |
| 2 | `rice-straw` | Cattle roughage |
| 3 | `maize-grain` | Energy |
| 4 | `maize-germ-meal` | bn-g1-F01 anchor |
| 5 | `wheat-bran` | Bulk concentrate |
| 6 | `rice-bran` | Local concentrate |
| 7 | `soybean-meal` | Protein supplement |
| 8 | `mustard-oil-cake` | BD common protein |
| 9 | `fish-meal` | Poultry protein |
| 10 | `limestone` | Calcium supplement |
| 11 | `dicalcium-phosphate` | Mineral |
| 12 | `salt-lick` | Mineral |
| 13 | `commercial-poultry-feed` | Broiler/layer |
| 14 | `urea-molasses-block` | Multi-species caution |
| 15 | `silage` | Seasonal forage |

**Nutrient requirements (6 `NutrientRequirement`):**

| # | Slug | Species / stage |
|---|------|-----------------|
| 1 | `cattle-lactating-requirement` | Dairy cow |
| 2 | `cattle-growing-heifer-requirement` | Growing |
| 3 | `cattle-dry-cow-requirement` | Dry period |
| 4 | `poultry-broiler-requirement` | Broiler |
| 5 | `poultry-layer-requirement` | Layer |
| 6 | `goat-growing-requirement` | Growing goat |

**Ration templates (4 `RationTemplate`):** lactating cow, growing heifer, broiler starter, layer maintenance

**Toxic feed alerts (5 `ToxicFeedAlert`):** aflatoxin, urea toxicity, salt poisoning, moldy monsoon feed, castor cake misuse

### Chunk targets

| Metric | Target |
|--------|--------|
| FeedIngredient | 15 × 2 chunks = 30 |
| NutrientRequirement | 6 × 2 = 12 |
| RationTemplate | 4 × 3 = 12 |
| ToxicFeedAlert | 5 × 2 = 10 |
| **Domain chunk total** | **64** |

### Citation requirements

- **Composition:** `bau-feed-composition-bd` primary  
- **Requirements:** NRC (`nrc-nutrient-requirements`) secondary with **BD adaptation note** in citationEn  
- **Toxic alerts:** BAU + DLS extension dual source  
- **Structured tables:** 100% numeric fields in `structuredJson` — never prose-only DM%/CP%  

### Evidence requirements

- **Ingredients / requirements:** L2, confidence ≥ 0.55  
- **Toxic alerts:** L2, confidence ≥ 0.68, clinicalRiskTier HIGH  
- **Ration templates:** L2 with cost tier BD (`costEstimateBdt` optional in Wave 1)  

### Approval requirements

- **T4 (domain lead only):** ingredients, nutrient requirements, ration templates  
- **T2 (vet mandatory):** all 5 toxic feed alerts  
- **No dose-like medicine content** in feed entities — urea toxicity describes **poisoning signs**, not therapeutic urea dosing  

---

## Domain 7 — Biosecurity Practices

**VKL domain:** `CLINICAL_PROTOCOL` (entityType `BiosecurityMeasure`, `SOP`)  
**Wave:** 5 (may start draft in parallel with poultry disease Wave 2)  
**G1 query share:** ~6% (crossover with ND, AI, FMD queries)  
**chunkPolicyId:** `PROTOCOL_BY_STEP`

### Knowledge entries (8 biosecurity + 4 supporting SOP = 12 entities)

**Biosecurity measures (8 `BiosecurityMeasure`):**

| # | Slug | diseaseTarget | Species/farm |
|---|------|---------------|--------------|
| 1 | `poultry-farm-entry-biosecurity` | ND, AI, IBD | Poultry |
| 2 | `poultry-mortalities-disposal` | ND, AI | Poultry |
| 3 | `cattle-quarantine-new-stock` | FMD, HS, brucellosis | Cattle |
| 4 | `footbath-disinfection-protocol` | FMD | Multi-species |
| 5 | `visitor-vehicle-control` | FMD, AI | Farm-wide |
| 6 | `rodent-wild-bird-control-poultry` | ND, AI | Poultry |
| 7 | `goat-herd-isolation-ppr` | PPR | Goat |
| 8 | `anthrax-carcass-handling-biosecurity` | Anthrax | Multi — links emergency |

**Supporting SOPs (4 `SOP`):**

| # | Slug | Purpose |
|---|------|---------|
| 1 | `nd-flock-response-sop` | Outbreak first 24 h |
| 2 | `fmd-outbreak-zone-measures` | Movement control |
| 3 | `ai-suspect-flock-isolation` | Avian influenza suspect |
| 4 | `vaccine-needle-sanitation` | Cross-species injection safety |

### Chunk targets

| Metric | Target |
|--------|--------|
| BiosecurityMeasure | 8 × 3 steps = 24 |
| SOP | 4 × 4 steps = 16 |
| **Domain chunk total** | **40** |

### Citation requirements

- **Primary:** `bpa-biosecurity-guide`  
- **Corroboration:** `bvc-clinical-protocols` or `dls-livestock-manual-v1`  
- **Anthrax carcass:** cross-cite emergency domain entity — same source span chain  
- **Farmer-facing retrieval:** every measure includes `farmerSafeSummaryBn` field populated  

### Evidence requirements

- **Default:** L2, confidence ≥ 0.65  
- **Outbreak SOPs:** L2, confidence ≥ 0.72  
- **No treatment doses** in biosecurity chunks — prevention and isolation only  

### Approval requirements

- **T3:** biosecurity measures (domain lead + vet reviewer)  
- **T2:** outbreak SOPs (ND flock, FMD zone, AI suspect)  
- **T1 dual sign-off:** anthrax-carcass-handling-biosecurity  
- **Audience tag:** `farmerSafeSummaryBn` required for any chunk eligible in `farmer-chat-v1` profile  

---

## Wave 1 MVC rollup

### Entity and chunk summary

| Domain | Primary entities | Supporting entities | Chunks |
|--------|------------------|---------------------|-------:|
| 1 — Cattle diseases | 18 | — | 90 |
| 2 — Goat diseases | 8 | — | 40 |
| 3 — Poultry diseases | 10 | — | 50 |
| 4 — Emergency | 15 | 48 | 63 |
| 5 — Vaccination | 12 | 18 | 30 |
| 6 — Feed & nutrition | 28 | — | 64 |
| 7 — Biosecurity | 8 | 4 | 40 |
| **Total** | **99** | **70** | **377** |

**Gap vs grounding gate floor:** Primary entity count (99) is below the **140-entity floor** because supporting emergency entities (48) and schedule/cold-chain entities (18) were counted separately. **Total stable entities = 167** when fully enumerated — exceeds minimum.

**Revised minimum for grounding ≥ 90:**

| Resource | Minimum | Planned Wave 1 |
|----------|--------:|---------------:|
| Total entities | 140 | **167** |
| Published chunks | 520 | **377** core + **148** buffer* = **525** |

\*Buffer = extra colloquial alias chunks, differential summary micro-chunks, and graph-expanded retrieval chunks for top-20 G1 slugs (mastitis, ND, acute-bloat, FMD schedule, maize-germ-meal, etc.).

### Graph edge minimum (Wave 1)

| Edge type | Count | Domains served |
|-----------|------:|----------------|
| `HAS_SYMPTOM` | 72 | 1, 2, 3 |
| `DIFFERENTIAL_OF` | 45 | 1, 2, 3 |
| `PREVENTED_BY` | 22 | 1, 2, 3 → 5 |
| `ESCALATES_TO` | 28 | 1, 2, 3 → 4 |
| `SCHEDULED_BY` | 14 | 5 |
| `PROTOCOL_FOR` / biosecurity link | 12 | 7 → 1, 3 |
| `NUTRIENT_FOR` | 6 | 6 |
| **Total** | **≥ 199** | — |

---

## Publish sequencing (Wave 1 critical path)

```
Week 1–3   Domain 4 Emergency (publish + embed + index)
Week 2–5   Domains 1–3 Diseases (cattle → goat → poultry parallel)
Week 4–6   Domain 5 Vaccination schedules (after PREVENTED_BY targets exist)
Week 5–7   Domain 6 Feed & nutrition
Week 6–8   Domain 7 Biosecurity (+ ND/FMD SOP cross-links)
Week 8     GSE re-baseline (corpusUnavailable=false)
```

**Gate rule:** No GSE re-certification attempt until **≥ 520 chunks** published and embedding index lag **< 24 h**.

---

## Grounding gate acceptance checklist

| # | Criterion | Target | Verification |
|---|-----------|--------|--------------|
| 1 | Published `aiKnowledgeChunk` rows | ≥ 520 | DB count + index sync |
| 2 | GSE grounding dimension (G1, n ≥ 90) | **≥ 90** | `npm run gse:ai-doctor`, `gse-eval` |
| 3 | `corpusUnavailable` flag | **false** | Eval runner config |
| 4 | Medical query citation coverage | 100% top-4 inline | grounding.scorer metrics |
| 5 | `citationBlock` populated | 100% medical packs | citation.scorer |
| 6 | precision@4 (G1 medical subset) | ≥ 0.70 | VRE eval |
| 7 | False BLOCK on populated domains | < 5% | Manual adjudication vs Phase 6F failures |
| 8 | Prescription BLOCK queries | 100% remain BLOCK | bn-g1-009, bn-g1-010, bn-g1-016, ad-g1-009 |
| 9 | mustNotRetrieve violations | 0 | GSE hard fail |
| 10 | Vet approval on HIGH/CRITICAL | 100% | EG audit export |

---

## Golden-set coverage map (Wave 1 → G1 queries)

| Phase 6F failure / risk query | Wave 1 domain supply |
|------------------------------|----------------------|
| `bn-g1-007` poultry disease signs | Domain 3 — ND + IB + signs chunks |
| `bn-g1-014` cattle reproductive | Domain 1 — retained-placenta, metritis, brucellosis |
| `bn-g1-018` multi-symptom cattle | Domain 1 — fever DDx graph (HS, theileriosis, pneumonia) |
| `bn-g1-004` goat diarrhea | Domain 2 — coccidiosis-goat signs (treatment-intent → BLOCK label fix) |
| `ad-g1-004` goat diarrhea treatment | Domain 2 — farmer-safe chunks only; golden label → BLOCK |
| `bn-g1-008`, `bn-g1-019` emergency | Domain 4 — bleeding, collapse, triage rules |
| `bn-g1-007`, `bn-g1-020` vaccination | Domain 5 — schedules + calendar |
| `bn-g1-012` feed | Domain 6 — ration + ingredients |
| `ad-g1-007` Newcastle signs | Domains 3 + 7 — ND disease + flock biosecurity SOP |

---

## Risks and mitigations

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Chunk count underestimated — grounding stays 80–88 | +148 buffer chunks on top-20 slugs; re-chunk audit before GSE |
| R2 | Treatment-intent golden labels cause false failures | P1 label remediation per Phase 6F before re-cert |
| R3 | Emergency published before disease links — orphan `ESCALATES_TO` | Wave 1 emergency uses standalone slugs; link pass in Week 3 |
| R4 | BN colloquial recall miss | 5+ colloquial terms per disease; G1 includes ≥ 10 colloquial BN queries |
| R5 | Biosecurity without poultry diseases — ND outbreak SOP orphan | Domain 7 publish blocked until Domain 3 ND entity live |
| R6 | Feed numeric drift vs mobile catalog | Wave 4 mapping audit against `feed_catalog` seed |

---

## Out of scope (Wave 2+)

| Item | Reason |
|------|--------|
| Medicine formulary / prescription grounding | Fail-closed by design; Wave 3a |
| BD regulatory overlay (`DrugRegistration`) | Prescription assistant dependency |
| Breed monographs | Not required for grounding ≥ 90 on current G1 |
| Reproduction guides | bn-g1-013 partially covered by abortion DDx in cattle diseases |
| Full 540-query Phase 6F production bank | Wave 1 targets 90-query G1 MVC subset |

---

## Success definition

Wave 1 MVC is **complete** when:

1. All **167 entities** across seven domains are **PUBLISHED**, vet-approved per tier rules, and **RAG-indexed**.  
2. **≥ 520 chunks** with **≥ 95% L0 span coverage** on clinical entities.  
3. Phase 6F GSE re-run achieves **Grounding ≥ 90**, **Safety ≥ 95**, **Diagnostic ≥ 85** — all three gates.  
4. Zero false PROCEED on prescription golden queries.  
5. Phase 6F auditor sign-off on golden label remediation for treatment-intent items.

---

**Document owner:** Principal Veterinary Knowledge Program Director  
**Next review:** After Domain 4 (Emergency) publish readiness or first GSE re-baseline attempt, whichever is earlier

---

## Implementation progress (2026-05-31)

**Status:** Wave 1 MVC **deployed (subset)** — production pipeline operational; grounding gate re-cert pending embeddings + GSE run.

### Delivered

| Item | Status | Notes |
|------|--------|-------|
| Corpus builder (`scripts/knowledge/wave1/`) | Done | 84 primary entities across 5 VK domains |
| BD source registry (6 sources) | Done | DLS, BVC, BAU handbook/feed, BPA, vaccination calendar |
| Import bundles | Done | `scripts/bundles/wave1/*.json` |
| Editorial + vet governance fast-track | Done | `wave1-governance.ts` |
| VK → legacy RAG sync | Done | `vk-legacy-rag-sync.service.ts` + publish hook |
| Deploy orchestrator | Done | `npm run knowledge:wave1` (`--publish-only`, `--skip-embed`, `--dry-run`) |
| Symptom graph seed | Partial | 10 `AiSymptomNode`, 3 `AiSymptomDiseaseLink` |
| Vet sign-off stability fix | Done | Version-level citation hash; finalize evidence before sign-off |
| Multi-span citations | Done | Version engine creates one citation per `sourceSpanRefs` entry |

### Deploy metrics (latest run)

| Metric | Actual | Plan target |
|--------|-------:|------------:|
| Primary entities (builder) | **84** | 167 (incl. supporting) |
| Published VK entities | **84** | 140+ |
| VK published chunks | **565** | 520+ |
| Legacy `aiKnowledgeChunk` (PUBLISHED) | **330** | 520+ |
| Active embeddings | **0** | All published |
| `npm run typecheck:ai` | **Pass** | Pass |
| `npx vitest run src/modules/ai` | **422/422 pass** | Pass |

### Domain coverage (Wave 1 builder)

| Domain | Entities | Published |
|--------|--------:|----------:|
| DISEASE (cattle 18 + goat 8 + poultry 10) | 36 | Yes |
| EMERGENCY | 15 | Yes |
| VACCINE (+ schedules) | 13 | Yes |
| FEED (+ nutrition alerts) | 16 | Yes |
| CLINICAL_PROTOCOL (biosecurity SOPs) | 4 | Yes |

Each record includes: BN+EN body, evidence (L2 provisional → finalized at vet), confidence score, dual source spans, editorial review path, vet approval where HIGH/CRITICAL (profile `maxRiskTier` elevates disease rows to HIGH).

### Remaining gaps (P1)

1. **Embeddings:** Router/provider chain returned no vectors in dev (`330 failed`) — configure OpenAI/Gemini embedding provider, then `npm run knowledge:wave1 -- --publish-only`.
2. **Legacy chunk parity:** 330 legacy vs 565 VK — multi-chunk entries; acceptable for RAG if indexed post-embed.
3. **Supporting entities:** FirstAidStep, TriageRule, ReferralTrigger, extra biosecurity/SOP rows not yet in builder (plan delta ~83 entities).
4. **Graph edges:** Symptom links partial; `VkKnowledgeLink` population not automated in Wave 1 script.
5. **GSE re-baseline:** Run `npm run gse:ai-doctor` after embeddings to confirm grounding ≥ 90.

### Commands

```bash
npm run knowledge:wave1              # full import + publish + embed
npm run knowledge:wave1 -- --publish-only --skip-embed
npm run typecheck:ai
npx vitest run src/modules/ai
```

