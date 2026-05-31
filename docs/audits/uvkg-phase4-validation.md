# UVKG Phase 4 Validation Report

**Generated:** 2026-05-31T23:01:07.686Z
**Readiness score:** 100/100
**Phase 5 readiness:** READY

## Executive summary

- **Total UVKG edges:** 15133
- **Distinct endpoints / VKL entities:** 1843
- **Benchmarks met:** Yes
- **UVKG reads enabled:** No (required for Phase 4)
- **Legacy graphs retired:** No

## Population

- Completed: 2026-05-31T23:01:00.889Z
- Total links after population: 15133

| Source | Created | Updated | Skipped |
|--------|---------|---------|---------|

**Derived edges:**

## Edge coverage

| Category | Count | Minimum | Met |
|----------|-------|---------|-----|
| disease_symptom | 583 | 120 | ✅ |
| disease_medicine | 2080 | 80 | ✅ |
| disease_feed_restriction | 76 | 25 | ✅ |
| disease_vaccine | 522 | 40 | ✅ |
| medicine_contraindication | 1040 | 25 | ✅ |
| medicine_interaction | 172 | 30 | ✅ |
| feed_nutrient | 720 | 15 | ✅ |
| feed_disease | 76 | 15 | ✅ |
| species_disease | 353 | 50 | ✅ |
| region_outbreak | 465 | 10 | ✅ |

## Graph quality

| Issue kind | Count |
|------------|-------|
| BROKEN_LINK | 100 |
| DUPLICATE_EDGE | 50 |

### Sample repair suggestions

- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: acute-bloat — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: enterotoxemia — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: cattle-bloat — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: goat-enterotoxemia — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: poultry-newcastle — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: cattle-fmd-schedule — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: cattle-hs-bq-schedule — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: poultry-nd-schedule — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: goat-ppr-schedule — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: foot-and-mouth-disease — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: ketosis — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: mastitis — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: enterotoxemia-goat — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: anthrax — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity
- **BROKEN_LINK** (MEDIUM): Disease endpoint missing: blackleg — Create DiDiseaseRegistry row or map slug to VkKnowledgeEntity

## Governance validation

- Phase 4 population stores 15133 DRAFT edges; 0 PUBLISHED (governance promotion pending).
- UVKG_READ_ENABLED=false — production traversal uses legacy graphs only.
- Sample disease "mastitis": 0 PUBLISHED neighbors, 100 non-published (excluded from traversal contract).

| Status | Count |
|--------|-------|
| DRAFT | 15133 |
| IN_REVIEW | 0 |
| VET_REVIEW | 0 |
| CHANGES_REQUESTED | 0 |
| APPROVED | 0 |
| PUBLISHED | 0 |
| ARCHIVED | 0 |
| DEPRECATED | 0 |
| REJECTED | 0 |

## Analytics dashboard snapshot

- VKL entities: 84
- UVKG edges: 15133
- Open drift conflicts: 0

**Top connected entities:**
- KNOWLEDGE_ENTITY:bau-vet-medicine-handbook (degree 3417)
- KNOWLEDGE_ENTITY:bvc-clinical-protocols (degree 1666)
- REGION:BD (degree 625)
- KNOWLEDGE_ENTITY:dls-vaccination-calendar-bd (degree 529)
- KNOWLEDGE_ENTITY:bau-feed-composition-bd (degree 442)
- SPECIES:COW (degree 430)
- SPECIES:GOAT (degree 419)
- DISEASE:theileriosis (degree 351)
- DISEASE:ppr (degree 341)
- DISEASE:foot-and-mouth (degree 340)

## Performance benchmarks

| Operation | Avg (ms) | P95 (ms) | Target | Met |
|-----------|----------|----------|--------|-----|
| neighbor_lookup | 60.39 | 208.35 | 100 | ✅ |
| path_lookup_2hop | 14.95 | 50.37 | 100 | ✅ |
| cross_domain_traversal | 26.42 | 61.1 | 100 | ✅ |

## Drift

- Feed legacy: 0
- Medicine legacy: 0
- Disease legacy: 0
- UVKG total: 15133
- Missing in UVKG (sample): 0

## Phase 5 readiness criteria

| Criterion | Status |
|-----------|--------|
| ≥10,000 edges | ✅ |
| ≥1,000 entities | ✅ |
| Coverage categories | ✅ |
| Benchmarks <100ms avg | ✅ |
| UVKG_READ_ENABLED=false | ✅ (required) |
| Legacy graphs active | ✅ (required) |
