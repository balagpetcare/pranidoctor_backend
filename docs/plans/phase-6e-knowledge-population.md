# Phase 6E — Veterinary Knowledge Population Strategy

**Project:** Prani Doctor  
**Role:** Principal Veterinary Knowledge Architect  
**Date:** 2026-05-31  
**Status:** Architecture & planning only — no implementation  
**Version:** 1.0.0  
**Depends on:**

- `docs/plans/phase-6a-veterinary-knowledge-architecture.md` (VKL domain model, evidence, retrieval profiles)
- `docs/plans/phase-6b1-knowledge-foundation.md` (VKF — entity, version, citation, review, approval)
- `docs/plans/phase-6b2-knowledge-import-pipeline.md` (KIP — source families, import → draft versions)
- `docs/plans/phase-6b3-chunking-citation-engine.md` (CCE — chunk policies, span citations)
- `docs/plans/phase-6b4-editorial-governance.md` (EG — editorial/vet stages, SLA, expiration)
- `docs/plans/phase-6c-rag-engine-architecture.md` (RAG — hybrid retrieval, golden eval)
- `docs/plans/phase-6c13-rag-optimization.md` (VRE eval corpora, precision@4 targets)
- `docs/plans/phase-6d-veterinary-ai-assistant.md` (six assistants — corpus demand drivers)
- `docs/reports/phase-6b-knowledge-verification.md` (pilot ingest readiness baseline)

---

## Phase numbering disambiguation

| Document | Meaning |
|----------|---------|
| **Phase 6A** | VKL **architecture** — domains, envelope, retrieval contract |
| **Phase 6B.1–6B.4** | **Platform** — foundation, import, chunking, governance (implemented) |
| **Phase 6C** | **RAG Engine** — retrieval over published chunks (implemented) |
| **Phase 6D** | **Product assistants** — consume published corpus (implemented) |
| **Phase 6E** (this document) | **Population strategy** — what to ingest, in what order, to what quality bar |

Phase 6E does **not** specify code, migrations, or UI. It defines the **content program** — source catalog, corpus tiers, editorial capacity, vet approval throughput, chunk/citation/confidence targets, and golden-set generation — required to make Phases 6C–6D clinically useful for **Bangladesh livestock farmers** first.

---

## Repositories in scope

| Repo | Role |
|------|------|
| `pranidoctor-backend` | KIP ingest batches, VKF publish, RAG index, eval corpora (`eval/corpora/`) |
| `pranidoctor-web` | Knowledge Control Center — editorial queues, vet approval console, coverage dashboards |
| `pranidoctor_user` | Farmer/doctor read-only consumption via assistants and search |

---

## Executive summary

Prani Doctor has a **production-ready knowledge platform** (VKF, KIP, CCE, EG, RAG, six veterinary assistants) but a **thin published corpus**. Assistants and RAG can retrieve and ground answers — yet fail-closed paths (prescription, emergency) and farmer chat quality depend on **what is published**, not on pipeline mechanics alone.

**Phase 6E** defines how to populate the Veterinary Knowledge Layer (VKL) across eight priority domains, with **Bangladesh livestock first**:

1. Disease Knowledge  
2. Medicine Knowledge  
3. Vaccine Knowledge  
4. Feed & Nutrition  
5. Breed Knowledge  
6. Reproduction  
7. Emergency Care  
8. Clinical Protocols  

Cross-cutting overlays (not separate population waves but mandatory citations on clinical content):

- **Regulatory (BD)** — DGD/DoF registration, banned substances, slaughter withdrawal (Phase 6A domain 9)  
- **Symptom graph linkage** — `HAS_SYMPTOM` edges from disease entities to existing `AiSymptomNode` taxonomy  

The strategy delivers three corpus tiers (**MVP → Growth → Full**), a **Bangladesh-first species matrix**, governed **editorial and vet approval capacity plans**, quantitative **chunk/citation/confidence targets**, and a **golden-set generation program** tied to VRE eval (Phase 6C.13).

**Population principle:** No assistant goes farmer-facing on a domain until that domain’s **MVP tier** is published, vet-approved where required, indexed in RAG, and passes the corresponding **G1 golden subset**.

---

## Current state analysis

### Platform readiness (post–6D)

| Capability | Status | Population implication |
|------------|--------|------------------------|
| `VkKnowledgeEntity` / `VkKnowledgeVersion` | Implemented | Stable identity for corpus versioning |
| KIP CSV import → VKF drafts | Implemented | Bulk row ingest ready; PDF adapters partial |
| CCE chunk + citation engines | Implemented | Published chunks use domain `chunkPolicyId` |
| EG editorial/vet workflow | Implemented | Human throughput is the bottleneck |
| RAG hybrid retrieval | Implemented | Empty corpus → BLOCK / degraded routing |
| Six veterinary assistants | Implemented | Demand defined; supply undefined |
| Eval corpora `farmer-bn-smoke-v1`, `farmer-bn-g1-v1` | Partial (G1 ~20 queries in repo) | Golden set scaffold exists; judgments incomplete |

### Corpus gap (as of Phase 6E planning baseline)

| Signal | Observation |
|--------|-------------|
| Legacy `AiKnowledgeEntry` | Small admin-seeded set; six content types; not version-audit-grade |
| VKF published versions | Pilot-scale; not covering top-50 farmer intents |
| Symptom graph | Production triage rules exist; **not fully linked** to structured disease entities |
| Feed catalog | Operational product data (`feed_catalog` seed); **not unified** with VKL `FeedIngredient` entities |
| Breed metadata | Scattered in mobile/animal modules; **no VKL breed corpus** |
| Regulatory BD | Architecture defined; **minimal registered sources** ingested |
| RAG eval | G0 smoke passes on infrastructure; **G1 fails on coverage** until corpus populated |

### Demand drivers (assistant × domain)

| Assistant | Primary domains | Fail-closed? | MVP corpus dependency |
|-----------|-----------------|--------------|-------------------------|
| AI Doctor | DISEASE, CLINICAL_PROTOCOL | Partial | Disease MVP + symptom links |
| AI Emergency Assistant | EMERGENCY, DISEASE | **Yes** (empty pack) | Emergency MVP first |
| AI Prescription Assistant | MEDICINE, REGULATORY_BD | **Yes** | Medicine MVP + BD regulatory overlay |
| AI Vaccine Assistant | VACCINE | Partial | National schedule + cold chain |
| AI Feed Advisor | FEED, BREED | Partial | Ingredients + nutrient requirements |
| AI Breeding Advisor | REPRODUCTION, BREED | Partial | Estrus/parturition + local breeds |

---

## Strategic intent

| Today | After Phase 6E execution (target) |
|-------|-----------------------------------|
| Platform without corpus | **MVP corpus** covering ≥80% of top-50 Bangladesh farmer query intents |
| Ad-hoc admin entries | **Source-driven population** via registered DLS/BVC/BAU catalogs |
| English-heavy or sparse BN | **BN-canonical** farmer content with EN clinical parity |
| Generic global disease text | **BD-endemic overlay** (`endemicBd`, `regionScope=BD`, local brand names) |
| Eval infra only | **Versioned golden sets** (G0–G3) with inter-rater agreement |
| Unbounded vet queue | **Staged waves** matching vet approval capacity |

---

## Design principles

| Principle | Phase 6E interpretation |
|-----------|---------------------------|
| **Bangladesh livestock first** | Species, sources, schedules, and regulatory overlays prioritize BD before South Asia expansion |
| **Safety-ordered waves** | Emergency + high-mortality disease before nice-to-have breed trivia |
| **Extract, then adapt** | KIP extracts from authoritative sources; editorial adapts BN farmer voice — no LLM-invented doses |
| **One entity, one identity** | Stable `entityId`/`slug` from day one; population adds versions, not duplicates |
| **Publish is a gate** | MVP tier complete only when published + RAG-indexed + G1 subset green |
| **Citations are non-negotiable** | No publish without locators; chunk span coverage measured |
| **Confidence follows evidence** | Population targets set **floors**; gates from Phase 6A remain ceilings for retrieval |
| **Golden sets drive priorities** | Failed eval queries become next sprint’s entity backlog |
| **Symptom graph integration** | Every MVP disease links to ≥3 symptom nodes where clinically valid |
| **Regulatory overlay always** | Medicine/vaccine MVP includes parallel BD regulatory entities |

---

## Bangladesh-first scope

### Species priority matrix

Population and golden-set queries are weighted by **Bangladesh livestock prevalence** and **Prani Doctor product usage intent**.

| Tier | Species | Bangla colloquial | Population priority | MVP entity share |
|------|---------|-------------------|---------------------|------------------|
| **P0** | Cattle (dairy) | গরু | Highest | 30% of species-tagged entities |
| **P0** | Poultry (broiler + layer) | মুরগি | Highest | 25% |
| **P1** | Goat | ছাগল | High | 15% |
| **P1** | Buffalo | মহিষ | High | 12% |
| **P1** | Duck | হাঁস | High | 8% |
| **P2** | Sheep | ভেড়া | Medium | 5% |
| **P3** | Pigeon, quail, fish (future) | — | Deferred | 0% in MVP |

**Rule:** Every MVP disease, emergency, and vaccine schedule entity must tag **≥1 P0–P1 species**. P2 entities may ship in Growth tier.

### Geographic and regulatory overlay

| Overlay | Scope | Population requirement |
|---------|-------|------------------------|
| `regionScope=BD` | All clinical MVP entities | Default for disease, medicine, vaccine, emergency |
| `endemicBd=true` | Disease entities | Flag for FMD, HS, BQ, PPR (goat), ND (poultry), etc. |
| DLS national schedules | Vaccine | Authoritative schedule rows cited to DLS bulletin |
| DGD/DoF registration | Medicine, vaccine | `DrugRegistration` entities for MVP formulary drugs |
| Monsoon / flood season | Emergency, farm calendar | `seasonalNotes` on emergency and feed toxic alerts |
| Colloquial BN | All farmer-facing | `colloquialBn[]` minimum 5 terms per MVP disease |

### Authoritative source catalog (Bangladesh-first)

Register in `AiKnowledgeSource` / `VkKnowledgeSource` **before** Wave 1 ingest.

| Source key (conceptual) | Publisher | Trust tier | Primary domains | Evidence default |
|-------------------------|-----------|------------|-----------------|------------------|
| `dls-livestock-manual-v1` | DLS | 2 | DISEASE, FARM_MGMT, VACCINE | L2 |
| `dls-vaccination-calendar-bd` | DLS | 2 | VACCINE | L2 |
| `bvc-clinical-protocols` | BVC | 2 | CLINICAL_PROTOCOL, EMERGENCY | L2 |
| `bau-vet-medicine-handbook` | BAU | 2 | MEDICINE, DISEASE | L2 |
| `bpa-biosecurity-guide` | BPA | 2 | CLINICAL_PROTOCOL, DISEASE (poultry) | L2 |
| `wpa-waterfowl-health` | WPA | 2 | DISEASE, VACCINE (duck) | L2 |
| `dgd-veterinary-drug-index` | DGD | 1 | MEDICINE, REGULATORY_BD | L5 |
| `dof-circular-withdrawal` | DoF | 1 | REGULATORY_BD | L5 |
| `bau-feed-composition-bd` | BAU | 2 | FEED | L2 |
| `nrc-nutrient-requirements` | NRC (global) | 3 | FEED | L3 — BD adaptation note required |
| `dls-breed-monographs` | DLS | 2 | BREED | L2 |
| `fao-breed-profile-sa` | FAO | 3 | BREED | L3 — secondary citation |
| `icddrb-zoonotic-advisories` | icddr,b | 2 | DISEASE (zoonotic), EMERGENCY | L2 |

**License gate:** No ingest batch without documented license / government-public-domain status in source registry.

---

## Domain population specifications

Each domain defines: **MVP entities**, **Growth entities**, **entity types**, **key relationships**, **chunk policy**, **vet approval class**, and **assistant unlock**.

### 1. Disease Knowledge

**Purpose:** AI Doctor differentials, symptom checker enrichment, farmer education.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 40 `Disease` + 8 `Syndrome` | Top BD-endemic and high-query conditions |
| **Growth** | +60 diseases, +12 syndromes | Expanded poultry/duck, zoonotic |
| **Full** | 200+ diseases | Comprehensive regional reference |

**MVP disease priority list (illustrative — finalize from query logs + DLS manual TOC):**

| Cluster | Examples (EN slug) | Species |
|---------|-------------------|---------|
| Mastitis & udder | `mastitis`, `udder-oedema` | Cattle, buffalo |
| Metabolic | `milk-fever`, `ketosis` | Cattle |
| Reproductive disease | `retained-placenta`, `metritis` | Cattle, buffalo |
| Foot & lameness | `foot-and-mouth-disease`, `laminitis`, `foot-rot` | Cattle, goat |
| Respiratory | `hemorrhagic-septicemia`, `pneumonia-bovine`, `infectious-bronchitis` | Cattle; poultry |
| GI | `blackleg`, `enterotoxemia`, `coccidiosis`, `helminthiasis` | Multi-species |
| Poultry systemic | `newcastle-disease`, `fowl-pox`, `salmonellosis` | Poultry |
| Goat/sheep | `ppr`, `contagious-caprine-pleuropneumonia` | Goat |
| Zoonotic (farmer-facing) | `anthrax`, `rabies`, `brucellosis` | Multi — **emergency cross-link** |

**Required relationships per MVP disease:**

- `HAS_SYMPTOM` → ≥3 symptom nodes (or new nodes filed)  
- `DIFFERENTIAL_OF` → ≥2 related diseases where applicable  
- `TREATED_WITH` → links to MVP medicine entities (vet-approved edges)  
- `PREVENTED_BY` → links to MVP vaccines where applicable  
- `PROTOCOL_FOR` → ≥1 clinical protocol for P0 diseases (Growth: all MVP)

**Chunk policy:** `DISEASE_BY_HEADING` — signs, diagnosis, treatment, prevention as separate chunks.

**Vet approval:** All `Disease` with treatment sections → **VET_REVIEW**; farmer summaries may be LOW risk but treatment prose is MEDIUM.

**Assistant unlock:** AI Doctor G1 subset green; symptom checker enrichment enabled for linked nodes.

---

### 2. Medicine Knowledge

**Purpose:** AI Prescription Assistant — dosing, interactions, withdrawal, BD formulary.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 30 `Drug` + 25 `WithdrawalRule` + 15 `Formulation` | MVP formulary |
| **Growth** | +40 drugs, interaction graph densification | |
| **Full** | 150+ drugs | Complete BD field formulary |

**MVP drug categories:**

| Class | Examples | clinicalRiskTier |
|-------|----------|------------------|
| Antimicrobials | oxytetracycline, enrofloxacin (where legal), penicillin | HIGH |
| Anti-inflammatories | meloxicam, flunixin | HIGH |
| Antiparasitics | ivermectin, albendazole | HIGH |
| Reproductive | oxytocin, PGF2α analogs | HIGH |
| Mastitis intramammary | common BD brands (generic + `brandNamesBd[]`) | HIGH |
| Vaccine adjuvants / biologics | (cross-link vaccine domain) | HIGH |
| Supportive | oral rehydration, calcium preparations | MEDIUM |

**Required structured fields (MVP):** `speciesDoseMatrix[]`, `routes[]`, `contraindications[]`, `prescriptionRequired`, `brandNamesBd[]`.

**Required relationships:**

- `REQUIRES_WITHDRAWAL` → withdrawal rules  
- `GOVERNED_BY` → DGD registration entities  
- `CONTRAINDICATES` / `INTERACTS_WITH` → top 20 high-risk pairs (MVP)

**Chunk policy:** `MEDICINE_BY_SECTION` — **no overlap** between dose and withdrawal chunks.

**Vet approval:** **Mandatory** — CVQ co-sign for new molecules not on DGD index.

**Assistant unlock:** Prescription assistant enabled only for drugs with `confidenceScore ≥ 0.75` and valid BD registration link.

---

### 3. Vaccine Knowledge

**Purpose:** AI Vaccine Assistant, herd health programs, smart recommendations.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 18 `Vaccine` + 12 `VaccinationSchedule` + 6 `ColdChainRule` | National program core |
| **Growth** | +15 vaccines, species expansion | |
| **Full** | Complete registered biologics catalog | |

**MVP vaccine priorities (BD national program alignment):**

| Species | Antigens (examples) |
|---------|---------------------|
| Cattle/buffalo | FMD, HS, BQ, anthrax (where applicable) |
| Goat | PPR, enterotoxemia, goat pox |
| Poultry | ND, IBD (Gumboro), IB, Marek’s (commercial) |
| Duck | Duck plague (DPV) |

**Required relationships:**

- `PREVENTED_BY` (inverse from disease)  
- `SCHEDULED_BY` → schedule rows with `ageWindow`, `boosterIntervalDays`  
- `GOVERNED_BY` → registration for commercial vaccines

**Chunk policy:** `VACCINE_BY_SCHEDULE_ROW` — one row per species-age; header chunk for general storage/handling.

**Vet approval:** Schedule entities → **VET_REVIEW**; cold chain may be editorial expedite with DLS citation.

**Assistant unlock:** Vaccine assistant G1 subset (schedule + “vaccine not stored cold” scenarios).

---

### 4. Feed & Nutrition

**Purpose:** AI Feed Advisor — nutrients, ingredients, toxic alerts, ration templates.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 25 `FeedIngredient` + 8 `NutrientRequirement` + 6 `RationTemplate` + 5 `ToxicFeedAlert` | |
| **Growth** | +30 ingredients, seasonal rations | |
| **Full** | Align with expanded feed catalog product | |

**MVP alignment:** Map existing `feed_catalog` seed rows → VKL `FeedIngredient` entities (dual-write migration plan in separate ops doc — **not implementation here**).

**Species-stage nutrient requirements (MVP minimum):**

| Species | Stages |
|---------|--------|
| Cattle | lactating cow, growing heifer, dry cow |
| Poultry | broiler starter/finisher, layer |
| Goat | growing, lactating |

**Toxic alerts (MVP — BD-relevant):** aflatoxin, urea toxicity, salt poisoning, castor/meal mis-feeding, monsoon moldy feed.

**Chunk policy:** `FEED_BY_NUTRIENT_BLOCK` + `STRUCTURED_BY_KEY` for composition tables.

**Vet approval:** `ToxicFeedAlert` → vet review; ingredients/nutrients → domain lead expedite.

**Assistant unlock:** Feed advisor G1 subset; toxic alert queries must retrieve alert chunk in top 4.

---

### 5. Breed Knowledge

**Purpose:** Weight estimation context, performance expectations, breeding advisor grounding.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 10 `Breed` + 10 `BreedStandard` + 6 `PerformanceBenchmark` | BD common breeds |
| **Growth** | +15 breeds | Exotic/crossbreds |
| **Full** | Complete DLS monograph set | |

**MVP breeds (illustrative):**

| Species | Breeds |
|---------|--------|
| Cattle | Sahiwal, Red Chittagong, crossbred HF×local |
| Buffalo | Nili-Ravi, Murrah crosses |
| Goat | Black Bengal, Jamunapari crosses |
| Poultry | Sonali, Cobb500, Isa Brown (layer) |
| Duck | Khaki Campbell, local desi duck |

**Chunk policy:** `BREED_BY_SECTION` (from 6B ingest architecture) — standard, performance, management.

**Vet approval:** Editorial expedite (LOW risk); performance benchmarks cite L2+ sources.

**Assistant unlock:** Breeding advisor breed disambiguation queries (“Red Chittagong milk yield”).

---

### 6. Reproduction

**Purpose:** AI Breeding Advisor — estrus, pregnancy, parturition, AI timing.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 6 `BreedingProtocol` + 8 `EstrusSign` + 5 `PregnancyStage` + 4 `ParturitionGuide` | |
| **Growth** | Species-specific expansion, buffalo parity | |
| **Full** | Complete multi-species library | |

**MVP coverage:**

| Topic | Species |
|-------|---------|
| Estrus detection | Cattle, goat |
| AI timing (natural + AI) | Cattle, buffalo |
| Pregnancy diagnosis signs | Cattle, goat |
| Parturition / dystocia red flags | Cattle, buffalo, goat |
| Postpartum metritis prevention | Cattle (link to disease) |

**Chunk policy:** `GENERIC_BY_PARAGRAPH` for guides; `STRUCTURED_BY_KEY` for day-range tables.

**Vet approval:** `ParturitionGuide` dystocia sections → **VET_REVIEW**; estrus signs → domain lead.

**Assistant unlock:** Breeding advisor MVP when parturition/dystocia queries pass G1.

---

### 7. Emergency Care

**Purpose:** AI Emergency Assistant — fail-closed grounding, first aid, referral.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 15 `EmergencyCondition` + 30 `FirstAidStep` + 10 `TriageRule` + 8 `ReferralTrigger` | |
| **Growth** | +20 conditions | Disaster/flood livestock |
| **Full** | Comprehensive emergency library | |

**MVP emergency conditions (align with `AiSymptomNode.redFlag`):**

| Condition | Species | vetRequiredWithinHours |
|-----------|---------|------------------------|
| Anthrax suspicion | Multi | 2 |
| Rabies exposure | Multi | 4 |
| Acute bloat | Cattle | 2 |
| Milk fever / downer | Cattle | 4 |
| HS acute presentation | Cattle, buffalo | 2 |
| ND acute flock | Poultry | 4 |
| Heat stroke | Multi | 4 |
| Severe bleeding / injury | Multi | 2 |
| Poisoning (organophosphate) | Multi | 2 |
| Dystocia | Cattle, goat | 2 |
| Snake envenomation | Multi | 2 |
| Flood exposure hypothermia | Multi | 6 |

**Chunk policy:** `EMERGENCY_BY_ACTION` — **no overlap**; one action per chunk.

**Vet approval:** **Mandatory** for all MVP emergency entities; dual sign-off for zoonotic emergencies.

**Assistant unlock:** **First domain required for farmer-facing emergency assistant** — empty pack = BLOCK today.

---

### 8. Clinical Protocols

**Purpose:** Doctor-facing SOPs; AI Doctor professional mode; biosecurity grounding.

| Tier | Entity counts | Entity types |
|------|---------------|--------------|
| **MVP** | 8 `TreatmentPathway` + 6 `DiagnosticWorkup` + 4 `SOP` + 4 `BiosecurityMeasure` | |
| **Growth** | +20 protocols | Poultry biosecurity depth |
| **Full** | BVC-aligned protocol library | |

**MVP protocols:**

| Protocol | Linked MVP diseases |
|----------|---------------------|
| Mastitis treatment pathway | mastitis |
| HS / FMD field response SOP | HS, FMD |
| ND flock response | newcastle-disease |
| Anthrax carcass handling | anthrax |
| Brucellosis suspect workup | brucellosis |
| PPR field protocol | ppr |
| Coccidiosis treatment pathway | coccidiosis |
| Post-AI breeding check | (reproduction link) |

**Chunk policy:** `PROTOCOL_BY_STEP` — one step per chunk.

**Vet approval:** **Mandatory** — BVC-licensed reviewer; `TreatmentPathway` = HIGH risk.

**Audience:** Primarily `DOCTOR`; farmer-safe summaries required on any excerpt used in farmer chat retrieval profiles.

**Assistant unlock:** AI Doctor professional mode; optional farmer chat if `farmerSafeSummaryBn` present.

---

## Minimum viable corpus (MVC)

### MVC definition

The **Minimum Viable Corpus** is the smallest **published, RAG-indexed, vet-approved** set that simultaneously:

1. Covers **≥80%** of the top-50 Bangladesh farmer query intents (weighted P0 species).  
2. Passes **G1 golden eval** (`precision@4 ≥ 0.70` on `farmer-bn-g1-v1` expanded to 90 queries).  
3. Unblocks **fail-closed assistants** (Emergency, Prescription) without unsafe degradation.  
4. Achieves citation and confidence floors defined below.

### MVC aggregate targets

| Metric | MVC target |
|--------|------------|
| **Knowledge entities** (stable `entityId`) | **175** |
| **Published versions** | **175** (one current published version per entity at MVC) |
| **Published chunks** (RAG-indexed) | **850 – 1,050** |
| **Graph edges** (`VkKnowledgeLink`) | **≥400** |
| **Symptom links** (`HAS_SYMPTOM`) | **≥120** (from MVP diseases) |
| **Registered sources** | **≥10** BD-authoritative sources |
| **BN locale completeness** | 100% farmer-facing entities |
| **Regulatory overlay entities** | **≥25** (registration + withdrawal + banned) |

### MVC by domain

| Domain | Entities | Published chunks (est.) | Vet-approved entity % |
|--------|----------|---------------------------|------------------------|
| Disease | 48 | 240 – 320 | 100% (treatment-bearing) |
| Medicine | 45 | 180 – 220 | 100% |
| Vaccine | 24 | 70 – 95 | 100% (schedules) |
| Feed & Nutrition | 44 | 110 – 140 | 20% (toxic alerts only) |
| Breed | 16 | 45 – 60 | 0% (editorial) |
| Reproduction | 23 | 55 – 75 | 40% (parturition/dystocia) |
| Emergency | 43 | 90 – 115 | 100% |
| Clinical Protocol | 18 | 55 – 75 | 100% |
| **Regulatory (BD)** *(overlay)* | 25 | 40 – 55 | 100% |
| **Total** | **~286*** | **885 – 1,155** | — |

\* *Regulatory entities overlap via `GOVERNED_BY` links — counted separately for operational tracking.*

### Growth tier (post-MVC, 90-day horizon)

| Metric | Growth target |
|--------|---------------|
| Entities | +200 (total ~475) |
| Chunks | +600 (total ~1,500 – 1,700) |
| G2 golden set | 250 queries, `precision@4 ≥ 0.78` |
| Species | P2 sheep; expand duck depth |

### Full tier (regional reference)

| Metric | Full target |
|--------|-------------|
| Entities | 800+ |
| Chunks | 4,000+ |
| G3 regression | 500 queries, `precision@4 ≥ 0.85` |
| Cross-border | Optional `regionScope=IN` overlays — **not before MVC + Growth** |

---

## Population waves and sequencing

Population executes in **waves** aligned with editorial/vet capacity and assistant unlock order.

```
Wave 0: Source registry + taxonomy
    │
    ▼
Wave 1: Emergency + Triage (fail-closed assistant)
    │
    ▼
Wave 2: Core diseases + symptom graph links
    │
    ├──► Wave 3a: Medicine + Regulatory BD (prescription assistant)
    │
    └──► Wave 3b: Vaccine schedules (vaccine assistant)
              │
              ▼
Wave 4: Feed + Breed (feed advisor)
    │
    ▼
Wave 5: Reproduction + Clinical protocols (breeding + doctor depth)
    │
    ▼
Wave 6: Growth tier expansion + G2 golden set
```

### Wave calendar (operational plan)

Assumes **2 content editors**, **1 domain lead**, **2 licensed vet reviewers**, **1 BN locale reviewer** (part-time).

| Wave | Duration | Primary deliverable | Assistant gate |
|------|----------|-------------------|----------------|
| **0** | 2 weeks | 10+ sources registered; slug taxonomy; symptom node gap analysis | — |
| **1** | 3 weeks | Emergency MVC published | Emergency assistant farmer beta |
| **2** | 4 weeks | Disease MVC + symptom links | AI Doctor partial G1 |
| **3a** | 4 weeks | Medicine + regulatory MVC | Prescription assistant controlled beta |
| **3b** | 2 weeks (parallel) | Vaccine MVC | Vaccine assistant beta |
| **4** | 3 weeks | Feed + breed MVC | Feed advisor beta |
| **5** | 3 weeks | Reproduction + protocols MVC | Breeding advisor; doctor professional |
| **6** | Ongoing | Growth tier | Full G2 eval |

**Critical path:** Wave 1 → 2 → 3a. Waves 3b, 4 may parallelize after Wave 2 disease slugs exist for cross-links.

### Intake modality by wave

| Wave | Primary intake | Rationale |
|------|----------------|-----------|
| 0 | Manual source registration | Legal/trust foundation |
| 1–2 | KIP CSV + PDF (DLS, BVC) | Structured emergency/disease sections |
| 3a | CSV + DGD index PDF | Formulary precision |
| 3b | CSV schedule rows | One row per species-age |
| 4 | CSV + feed catalog sync | Structured nutrient numbers |
| 5 | Mixed CSV + editorial authoring | Reproduction prose-heavy |

---

## Editorial strategy

### Operating model

Population content flows through **Knowledge Control Center** stages defined in Phase 6B.4:

```
KIP import / editorial draft
        → Draft (BN+EN, citations, structuredJson)
        → Review (domain + locale)
        → Vet Review (if HIGH/CRITICAL)
        → Approval
        → Publish → CCE chunk promote → RAG embed
```

### Team roles and throughput

| Role | MVC weekly capacity | Responsibilities |
|------|---------------------|------------------|
| **Content Editor** | 8–10 entity drafts | Extraction cleanup, BN farmer voice, colloquial terms |
| **Domain Lead** | 15 reviews/week | Schema completeness, link integrity, evidence assignment |
| **BN Locale Reviewer** | 10 reviews/week | Readability, colloquial accuracy, no clinical ambiguity |
| **EN Clinical Reviewer** | 10 reviews/week | Terminology, structured field precision |
| **Vet Reviewer** | 12 approvals/week | Clinical sign-off, dose/schedule verification |
| **CVQ** | 3 co-signs/week | New molecules, contested edges, zoonotic emergency |

**MVC editorial duration estimate:** ~14–16 weeks at above capacity (matches wave calendar with parallelization).

### Authoring standards (Bangladesh-first)

| Standard | Rule |
|----------|------|
| **BN canonical** | Farmer `bodyBn` is authoritative for retrieval; EN mirrors meaning, not machine translation of BN idiom |
| **Colloquial map** | Minimum 5 `colloquialBn[]` per MVP disease; source from field interviews + DLS glossary |
| **Structured first** | Doses, schedules, nutrients in `structuredJson` — never prose-only for numbers |
| **Link on draft** | Editors wire `TREATED_WITH`, `PREVENTED_BY`, `HAS_SYMPTOM` before submit |
| **No orphan publish** | Domain lead rejects publish if required relationships missing |
| **AI-assisted drafts** | Allowed with `AI_GENERATED` flag; **never** bypass human editor or vet gates |
| **Regulatory freshness** | Medicine/vaccine drafts cite `asOfDate` for DGD row |

### Quality gates at submit (Draft → Review)

| Gate | Automated | Human |
|------|-----------|-------|
| JSON Schema validation | ✅ | — |
| ≥1 citation, trustTier ≤ 2 for clinical | ✅ | — |
| BN + EN title/summary/body present | ✅ | — |
| Species tagged P0–P1 for MVP | — | ✅ Domain lead |
| Colloquial BN minimum | — | ✅ Locale reviewer |
| Duplicate slug / dedup key | ✅ | Merge triage |

### Expedited paths (LOW risk only)

| Domain / entity type | Vet review skipped? |
|----------------------|---------------------|
| `FeedIngredient` composition | Yes — domain lead only |
| `BreedStandard` weights | Yes |
| `EstrusSign` (no treatment) | Yes |
| `HousingStandard` (future farm mgmt) | Yes |

Everything in **Medicine, Emergency, TreatmentPathway, VaccinationSchedule, ToxicFeedAlert** requires vet review.

---

## Vet approval strategy

### Approval tiers

| Tier | Entity types | Reviewers | SLA (from 6A) |
|------|--------------|-----------|---------------|
| **T1 — Critical** | `EmergencyCondition`, `TriageRule`, zoonotic `Disease` | Licensed vet + CVQ dual sign-off | 24 h |
| **T2 — High** | `Drug`, `Formulation`, `WithdrawalRule`, `TreatmentPathway` | Licensed vet; CVQ for new molecules | 72 h |
| **T3 — Medium** | `Disease` (treatment), `VaccinationSchedule`, `ParturitionGuide` | Licensed vet | 7 d |
| **T4 — Low** | Feed, breed, estrus signs | Domain lead (no vet license) | 14 d |

### Vet reviewer pool requirements (MVC)

| Requirement | Minimum |
|-------------|---------|
| BVC-licensed vets | 2 FTE equivalents |
| Large animal specialization | ≥1 reviewer |
| Poultry specialization | ≥1 reviewer |
| CVQ / senior sign-off | 1 part-time |
| `approvalScope` domains | Each vet scoped to ≥2 domains |
| License verification | 100% before queue access |

### Approval workflow mechanics

1. **Queue routing:** KIP routes HIGH/CRITICAL imports directly to vet queue post-validation (6B.2).  
2. **Checklist:** Vet uses domain checklist — dose matrix species match, withdrawal present, BD registration link.  
3. **Digital sign-off:** `VkKnowledgeApproval` with `licenseNo` snapshot, `validUntil` = 12 months.  
4. **Conflict resolution:** Contradictory `INTERACTS_WITH` edge → CVQ arbitration (6B.4).  
5. **Re-review triggers:** DGD edition change, `nextReviewDueAt` elapsed, G1 eval retrieval failure on clinical query.  
6. **Dual regulatory:** `DrugRegistration` + vet reviewer for regulatory entities.

### Vet capacity vs MVC load

| Tier | MVC entities requiring vet | Est. vet hours |
|------|----------------------------|----------------|
| T1 | 25 | 50 h |
| T2 | 70 | 140 h |
| T3 | 55 | 82 h |
| **Total** | **~150** | **~272 h (~7 vet-weeks)** |

Plan **2 vets × 12 approvals/week × 14 weeks** = 336 approval slots (20% buffer for rework).

### Fail-closed alignment

| Assistant | Vet approval requirement |
|-----------|-------------------------|
| Prescription | 100% MVP drugs vet-approved; no PROCEED without structured dose fact |
| Emergency | 100% MVP emergency entities; dual sign-off zoonotic |
| Vaccine | 100% schedule rows |
| AI Doctor (clinical claims) | Retrieved chunks must be vet-approved versions |

---

## Chunk targets

### Corpus-level chunk targets

| Tier | Published chunks | Avg chunks / entity | Embedding index size (est.) |
|------|------------------|---------------------|------------------------------|
| **MVC** | 850 – 1,055 | 3.0 – 3.7 | ~1M vectors (with locale/metadata) |
| **Growth** | 1,500 – 1,700 | 3.2 | ~1.8M |
| **Full** | 4,000+ | 4.0 | Scale per 6C.13 pgvector plan |

### Domain chunk targets (MVC)

| Domain | chunkPolicyId | MVC chunks | Avg tokens/chunk | Overlap |
|--------|---------------|------------|------------------|---------|
| Disease | `DISEASE_BY_HEADING` | 280 | 300 – 450 | 50 tokens (narrative) |
| Medicine | `MEDICINE_BY_SECTION` | 200 | 200 – 350 | None |
| Vaccine | `VACCINE_BY_SCHEDULE_ROW` | 85 | 100 – 200 | None |
| Feed | `FEED_BY_NUTRIENT_BLOCK` | 125 | 200 – 400 | None |
| Breed | `BREED_BY_SECTION` | 50 | 300 – 400 | 50 tokens |
| Reproduction | `GENERIC_BY_PARAGRAPH` / `STRUCTURED_BY_KEY` | 65 | 250 – 350 | 25 tokens |
| Emergency | `EMERGENCY_BY_ACTION` | 105 | 150 – 250 | None |
| Clinical Protocol | `PROTOCOL_BY_STEP` | 65 | 150 – 300 | None |
| Regulatory BD | `REGULATORY_BY_RECORD` | 50 | 100 – 180 | None |

### Chunk quality KPIs

| KPI | MVC target | Measurement |
|-----|------------|-------------|
| Orphan chunks (no span ref) | 0% clinical; ≤2% LOW | CCE validation report |
| Token policy violations | <1% | Automated bounds check |
| Structured overlay presence (medicine dose) | 100% dose sections | CCE metadata |
| STAGING → PUBLISHED promotion success | 100% on publish | Publish workflow |
| Tombstone lag on deprecate | <24 h | RAG index sync |
| BN+EN chunk parity | 100% | Locale field audit |

### Re-chunk policy during population

| Scenario | Action |
|----------|--------|
| Source edition update | New version fork + full re-chunk |
| Editor fixes typo in BN | Section-level chunk diff |
| `chunkPolicyId` change | Full re-chunk + re-embed (6C.13 cost gate) |
| Structured JSON dose change | `STRUCTURED_BY_KEY` partial re-chunk + **mandatory vet re-approval** |

---

## Citation targets

### Attribution requirements (from Phase 6A — operationalized for population)

| Entity class | Min citations / version | trustTier requirement | Span locator requirement |
|--------------|---------------------------|----------------------|----------------------------|
| HIGH / CRITICAL clinical | ≥2 | ≥1 with tier ≤ 2 | 100% chunks mapped |
| MEDIUM clinical | ≥1 | tier ≤ 2 | ≥95% chunks |
| LOW (breed, feed ingredient) | ≥1 | tier ≤ 3 | ≥90% chunks |
| Regulatory primary | ≥1 | tier 1 (statutory) | Full record locator |

### Corpus-level citation KPIs

| KPI | MVC target |
|-----|------------|
| Published entities with ≥1 citation | **100%** |
| Published clinical entities with ≥2 citations | **≥80%** |
| Chunks with L0 span ref | **≥95%** clinical; **≥90%** all |
| Average citations per clinical entity | **1.8 – 2.5** |
| Manufacturer-only sources (no corroboration) | **0%** for off-label species dosing |
| Human-readable BN citation on mobile detail | **100%** |

### Citation layering (6B.3)

| Layer | Population deliverable |
|-------|------------------------|
| **L0 — Span ref** | Every KIP import row includes `SourceSpanRef` (page, section, table row) |
| **L1 — Human citation** | BN/EN APA-like strings from registered sources |
| **L2 — Inline chunk citation** | RAG tokens `[sourceKey\|p.N]` on every clinical chunk |
| **L3 — Pack attribution** | `KnowledgeContextPack.citationBlock` populated for eval queries |

### Source diversity rules

| Domain | Minimum source diversity |
|--------|-------------------------|
| Disease treatment | Primary clinical source + DLS or BVC corroboration |
| Medicine dose | DGD label or BAU handbook + DGD registration |
| Vaccine schedule | DLS calendar + manufacturer PI for storage |
| Emergency | BVC protocol + DLS extension (dual for zoonotic) |
| Feed composition | BAU table + secondary NRC/FAO |

---

## Confidence targets

### Publish-time confidence floors (population minimum)

These are **floors at publish** — distinct from retrieval **gates** (Phase 6A). Entities below floor may not publish.

| Domain | clinicalRiskTier | Min evidence | Min confidence at publish |
|--------|------------------|--------------|---------------------------|
| Emergency | CRITICAL | L2 (L1 + dual vet for SOP-only) | **0.70** |
| Medicine | HIGH | L2 (L5 for label-primary) | **0.75** |
| Disease (treatment) | MEDIUM–HIGH | L2 | **0.65** |
| Vaccine schedule | HIGH | L2 | **0.70** |
| Clinical protocol | HIGH | L2 | **0.72** |
| Feed toxic alert | HIGH | L2 | **0.68** |
| Feed ingredient | LOW | L2 | **0.55** |
| Breed | LOW | L1 | **0.50** |
| Reproduction | MEDIUM | L2 | **0.60** |

### Retrieval gate compliance (post-publish)

All published MVC entities must **meet or exceed** Phase 6A retrieval gates for their primary profile:

| profileId | minConfidence | minEvidence | MVC compliance target |
|-----------|---------------|-------------|------------------------|
| `emergency-v1` | 0.60 | L1/L2 | 100% emergency chunks |
| `prescription-v1` | 0.75 | L2 | 100% MVP drugs |
| `ai-doctor-v1` | 0.55 | L2 | ≥95% disease treatment chunks |
| `feed-advisor-v1` | 0.65 | L2 | 100% toxic alerts |
| `farmer-chat-v1` | 0.40 | L1 | ≥90% MVP corpus |

### Confidence composition targets

| Component | Population guidance |
|-----------|---------------------|
| `evidenceLevelScore` | Assign at domain lead review — do not default to L1 for treatment content |
| `sourceTrustScore` | Prefer tier 1–2 BD government sources for MVC |
| `recencyScore` | Set `lastReviewedAt` at publish; schedule 12-month re-review |
| `reviewCompletenessScore` | 100% checklist for HIGH/CRITICAL |
| `graphConnectivityScore` | Require minimum links before publish (see domain specs) |

### Provisional cap during Draft/Review

Ingested drafts remain capped at **0.65 confidence** until vet approval (6B.3) — population teams should not optimize prose to inflate provisional scores; finalize through evidence + vet path.

---

## Golden-set generation

### Purpose

Golden sets are the **acceptance tests for population**. They encode expected retrieval behavior per assistant profile and drive wave prioritization from failed queries.

### Tier structure (extends Phase 6C.13)

| Tier | Query count | Locale mix | Use | Population gate |
|------|-------------|------------|-----|-----------------|
| **G0 — Smoke** | 15 – 20 | BN-heavy | CI on every PR | Infrastructure only |
| **G1 — MVC** | 90 | 55 BN / 35 EN | MVC release | **Must pass before farmer beta** |
| **G2 — Growth** | 250 | 60% BN | Growth tier | Growth wave complete |
| **G3 — Full** | 500 | 60% BN | Production SLA | Full tier |

Existing seed: `eval/corpora/farmer-bn-smoke-v1.json`, `eval/corpora/farmer-bn-g1-v1.json` — expand to full G1 composition below.

### G1 composition (90 queries) — aligned to MVC domains

| Domain / intent | Queries | Profile(s) | Colloquial BN |
|-----------------|---------|------------|---------------|
| Disease (medical) | 20 | `farmer-chat-v1`, `ai-doctor-v1` | ≥10 |
| Medicine / prescription | 10 | `prescription-v1` | ≥4 |
| Emergency | 10 | `emergency-v1` | ≥8 |
| Vaccine / schedule | 8 | `vaccine-advisor-v1` | ≥5 |
| Feed / nutrition | 8 | `feed-advisor-v1` | ≥4 |
| Breed / performance | 6 | `breeding-advisor-v1`, `farmer-chat-v1` | ≥3 |
| Reproduction | 8 | `breeding-advisor-v1` | ≥5 |
| Clinical / triage crossover | 10 | `ai-doctor-v1`, `emergency-v1` | ≥5 |
| Negative / must-not-retrieve | 10 | all | — |

**Species distribution in G1:** 40% cattle, 25% poultry, 15% goat, 10% buffalo, 10% duck/multi.

### Golden query schema (normative)

```typescript
type GoldenQuery = {
  id: string;                          // e.g. "bn-g1-042"
  tier: 'G0' | 'G1' | 'G2' | 'G3';
  locale: 'bn' | 'en';
  query: string;
  profileId: string;
  taskType: AiDbTaskType;
  species?: LivestockSpecies;
  domain: VkKnowledgeDomain;
  intent: 'medical' | 'husbandry' | 'emergency' | 'prescription' | 'vaccine' | 'feed' | 'breeding' | 'general';
  colloquial: boolean;
  expectedRouting: 'PROCEED' | 'PROCEED_DEGRADED' | 'BLOCK' | 'ESCALATE';
  relevantEntities: Array<{
    entitySlug: string;
    minGrade: 2 | 3;                   // 3 = must appear in top 4
  }>;
  relevantChunks?: Array<{
    entitySlug: string;
    chunkIndex: number;
    grade: 0 | 1 | 2 | 3;
  }>;
  mustNotRetrieve?: string[];           // slugs forbidden in top 4
  requiredStructuredFacts?: string[];   // e.g. "dose:ivermectin:cattle"
  notes?: string;
};
```

### Generation methodology

```
┌─────────────────────────────────────────────────────────────────┐
│                 GOLDEN SET GENERATION PIPELINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. INTENT TAXONOMY                                              │
│     Top-50 farmer intents (BN) + doctor EN intents               │
│     └── species tags, domain mapping                             │
│                                                                  │
│  2. QUERY AUTHORING                                              │
│     Vet + domain lead author queries                             │
│     └── colloquial variants from field glossary                  │
│                                                                  │
│  3. RELEVANCE JUDGMENT                                           │
│     For each query: grade entity/chunk relevance 0–3             │
│     └── two raters; adjudicate if κ < 0.75                       │
│                                                                  │
│  4. ROUTING EXPECTATION                                          │
│     Set expectedRouting from confidence router rules             │
│     └── BLOCK queries for unpopulated domains (pre-MVC)          │
│                                                                  │
│  5. NEGATIVE CASES                                               │
│     mustNotRetrieve for deprecated slugs, wrong species          │
│                                                                  │
│  6. VERSION & BASELINE                                           │
│     Commit to eval/corpora/; bump corpus version                 │
│     Run vre:eval; store baseline precision@4                     │
│                                                                  │
│  7. FEEDBACK LOOP                                                │
│     Production retrieval failures → candidate new queries        │
│     Quarterly refresh                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Judgment grading rubric

| Grade | Definition |
|-------|------------|
| **3** | Essential — must appear in top 4 for PROCEED |
| **2** | Relevant — counts toward precision@4 |
| **1** | Marginal — should not rank top 4 |
| **0** | Irrelevant or harmful if retrieved |

### Inter-rater agreement

| Tier | κ target | Adjudicator |
|------|----------|-------------|
| G0 | ≥0.65 | Domain lead |
| G1 | ≥0.75 | CVQ |
| G2/G3 | ≥0.80 | CVQ + external vet consultant |

### Eval execution acceptance (MVC release)

| Metric | MVC threshold | Measurement |
|--------|---------------|-------------|
| `precision@4` (G1 overall) | **≥0.70** | `npm run vre:eval -- --corpus farmer-bn-g1-v1` |
| `precision@4` (emergency subset) | **≥0.80** | Subset filter |
| `precision@4` (prescription subset) | **≥0.75** | Subset filter |
| `mustNotRetrieve` violations | **0** | Hard fail |
| Medical PROCEED with groundable chunks | **100%** | Routing audit |
| p95 retrieval latency | **<400 ms** | 6C.13 budget |
| BLOCK rate on populated domains | **<5%** false BLOCK | Manual review |

### Production feedback → golden set

| Signal | Action |
|--------|--------|
| `retrievalMetadataJson.excludedCount > 0` on farmer chat | Sample for missing entity backlog |
| Escalation after AI Doctor session | Add emergency/disease query candidate |
| Prescription BLOCK (false) | Add drug slug + structured fact judgment |
| Farmer feedback “wrong advice” (future) | Priority G2 adjudication |

---

## Cross-domain graph population

MVC requires **linked knowledge**, not isolated articles.

### Minimum edge targets (MVC)

| Edge type | Count | Priority |
|-----------|-------|----------|
| `HAS_SYMPTOM` | 120+ | Wave 2 |
| `TREATED_WITH` | 80+ | Wave 3a |
| `PREVENTED_BY` | 40+ | Wave 3b |
| `DIFFERENTIAL_OF` | 60+ | Wave 2 |
| `INTERACTS_WITH` | 30+ | Wave 3a |
| `CONTRAINDICATES` | 25+ | Wave 3a |
| `REQUIRES_WITHDRAWAL` | 50+ | Wave 3a |
| `GOVERNED_BY` | 70+ | Wave 3a |
| `SCHEDULED_BY` | 35+ | Wave 3b |
| `PROTOCOL_FOR` | 20+ | Wave 5 |
| `ESCALATES_TO` | 25+ | Wave 1 |
| `NUTRIENT_FOR` | 15+ | Wave 4 |
| `BREED_OF` | 10+ | Wave 4 |

### Symptom graph integration program

| Step | Deliverable |
|------|-------------|
| 1 | Audit existing `AiSymptomNode` catalog vs MVP disease list |
| 2 | Gap-fill symptom nodes (BN colloquial + `redFlag` flags) |
| 3 | Create `HAS_SYMPTOM` edges with `weight` + evidence |
| 4 | Validate triage pipeline still scores correctly |
| 5 | Add G1 queries for top 20 symptom phrases |

---

## Regulatory overlay population (Bangladesh)

Regulatory content runs **in parallel with Medicine/Vaccine waves** — not deferred.

### MVC regulatory entities

| Entity type | Count | Source |
|-------------|-------|--------|
| `DrugRegistration` | 30 MVP drugs | DGD index |
| `BannedSubstance` | 10 | DGD/DoF banned antibiotic list |
| `SlaughterWithdrawal` | 25 | DoF circular + label |
| `ImportRule` | 5 | Critical biologics / vaccines |

**Retrieval rule:** `prescription-v1` and `vaccine-advisor-v1` profiles **must** inject active regulatory facts when `regionScope=BD`.

---

## Risk register

| ID | Risk | Mitigation |
|----|------|------------|
| R1 | Vet reviewer bottleneck | Wave sequencing; expedite LOW; CVQ only for T1/T2 |
| R2 | BN translation drift from EN source | BN-first authoring for farmer bodies; locale reviewer |
| R3 | DGD/regulatory edition change mid-wave | `effectiveFrom` dates; change detection on re-import (6B.2) |
| R4 | Duplicate entities across imports | Dedup keys on `diseaseCode`, `genericName`, `breedCode` |
| R5 | Chunk boundary splits doses | `MEDICINE_BY_SECTION` no overlap; CCE validation |
| R6 | Golden set overfit to lexical search | Colloquial BN + semantic paraphrases; G2 expansion |
| R7 | Feed catalog / VKL drift | Wave 4 explicit entity mapping audit |
| R8 | Premature farmer launch | **G1 pass + MVC checklist** gate per assistant |

---

## Success metrics (Phase 6E)

| Metric | MVC | Growth | Full |
|--------|-----|--------|------|
| Top-50 intent coverage | ≥80% | ≥92% | ≥98% |
| Published entities | ~286 | ~475 | 800+ |
| Published chunks | ~950 | ~1,600 | 4,000+ |
| G1 precision@4 | ≥0.70 | ≥0.78 (G2) | ≥0.85 (G3) |
| Citation completeness (clinical) | 100% | 100% | 100% |
| Vet approval compliance (HIGH/CRITICAL) | 100% | 100% | 100% |
| False BLOCK rate (populated domains) | <5% | <3% | <2% |
| Stale review backlog | <5% corpus | <5% | <3% |
| Symptom-linked MVP diseases | 100% | 100% | 100% |

---

## Dependencies and handoffs

| Downstream | Handoff from 6E |
|------------|-----------------|
| **Phase 6C RAG** | Published chunk corpus for embedding; G1 baseline file |
| **Phase 6D assistants** | Per-assistant MVC gate checklist |
| **Phase 6C.13 VRE** | Full G1/G2 corpora; fusion weight calibration subsets |
| **Knowledge Control Center UI** | Coverage dashboards vs MVC targets |
| **Mobile apps** | Feature flags per assistant after G1 pass |

**No implementation in Phase 6E scope.** Execution begins with Wave 0 source registration and G1 corpus completion alongside first emergency ingest batch.

---

## Appendix A — MVC entity backlog template

Use per-entity tracking (spreadsheet or admin coverage module):

| Field | Example |
|-------|---------|
| `slug` | `mastitis` |
| `domain` | DISEASE |
| `entityType` | Disease |
| `wave` | 2 |
| `species[]` | COW, BUFFALO |
| `endemicBd` | true |
| `clinicalRiskTier` | MEDIUM |
| `primarySourceKey` | `bau-vet-medicine-handbook` |
| `requiredLinks` | HAS_SYMPTOM×3, TREATED_WITH×2, PREVENTED_BY×1 |
| `vetRequired` | yes |
| `goldenQueryIds` | bn-g1-001, bn-g1-002 |
| `publishStatus` | draft / in_review / published |

---

## Appendix B — G1 query examples (Bangladesh livestock)

| ID | Query (BN) | Domain | Expected slug (grade 3) |
|----|------------|--------|-------------------------|
| bn-g1-001 | গরুর mastitis লক্ষণ কী | DISEASE | `mastitis` |
| bn-g1-E01 | গরু হঠাৎ ফুলে গেল — কী করব | EMERGENCY | `acute-bloat` |
| bn-g1-P01 | গরুর জন্য ivermectin dose | MEDICINE | `ivermectin` |
| bn-g1-V01 | গরুর FMD vaccine কখন দেব | VACCINE | `fmd-vaccine-schedule` |
| bn-g1-F01 | ভুট্টা ভুষির পুষ্টিমান | FEED | `maize-germ-meal` |
| bn-g1-B01 | Red Chittagong গরু দুধ দেয় কত | BREED | `red-chittagong` |
| bn-g1-R01 | গরু গরমে কখন | REPRODUCTION | `cattle-estrus-signs` |
| bn-g1-N01 | Newcastle রোগে কী করব | CLINICAL_PROTOCOL | `nd-flock-response` |

---

## Appendix C — Assistant release checklist (MVC)

| Assistant | Required domains published | G1 subset | Special |
|-----------|---------------------------|-----------|---------|
| AI Emergency | Emergency MVC | emergency 10/10 pass | Dual sign-off zoonotic |
| AI Prescription | Medicine + Regulatory MVC | prescription 10/10 pass | Structured dose facts |
| AI Vaccine | Vaccine MVC | vaccine 8/8 pass | DLS schedule cited |
| AI Feed Advisor | Feed MVC | feed 8/8 pass | Toxic alerts |
| AI Breeding | Reproduction + Breed MVC | breeding 8/8 pass | Dystocia escalate queries |
| AI Doctor | Disease + Protocol partial | disease 20/20 pass | Symptom links live |

---

## Appendix D — Glossary

| Term | Definition |
|------|------------|
| **MVC** | Minimum Viable Corpus — smallest publish set meeting safety and eval gates |
| **Population wave** | Sequenced ingest/review/publish batch with assistant unlock |
| **Golden set** | Versioned eval query corpus with relevance judgments |
| **Trust tier** | Source authority rank (1 = highest) from source registry |
| **Fail-closed** | Assistant blocks LLM path without sufficient grounded retrieval |
| **Colloquial BN** | Farmer-spoken terms mapped in `colloquialBn[]` |

---

**Document owner:** Principal Veterinary Knowledge Architect  
**Next review:** Upon Wave 1 (Emergency MVC) publish readiness or G1 corpus expansion completion, whichever is earlier
