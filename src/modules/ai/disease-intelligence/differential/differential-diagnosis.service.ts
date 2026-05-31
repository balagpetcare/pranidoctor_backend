import type { GroundedDifferential } from '../../ai-doctor/ai-doctor.types.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import {
  fuseDifferentials,
  graphRowToDifferential,
  loadGraphDifferentials,
} from '../../ai-doctor/engines/differential-diagnosis.engine.js';
import { getKnowledgeRetrievalService } from '../../knowledge-retrieval/knowledge-retrieval.service.js';
import { AI_DOCTOR_MAX_DIFFERENTIALS } from '../../ai-doctor/ai-doctor.constants.js';
import {
  DIE_FUSION_WEIGHTS,
  DIE_MAX_DIFFERENTIALS_FARMER,
  DIE_MODEL_VERSION,
  DIE_RETRIEVAL_PROFILES,
} from '../disease-intelligence.constants.js';
import { getDiseaseGraphService } from '../graph/disease-graph.service.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { getSpeciesIntelligenceService } from '../species/species-intelligence.service.js';
import { getOutbreakIntelligenceService } from '../outbreak/outbreak-intelligence.service.js';
import { shouldUseRulesOnlyForFeature } from '../../governance/ai-governance.enforcement.js';
import { DISEASE_INTELLIGENCE_FEATURE } from '../disease-intelligence.constants.js';
import { getDiseaseAnalyticsService } from '../analytics/disease-analytics.service.js';
import type { DiePersona, DifferentialComputeInput, DifferentialComputeResult } from '../disease-intelligence.types.js';

function maxForPersona(persona: DiePersona): number {
  if (persona === 'vet') return 15;
  if (persona === 'paravet') return 8;
  return DIE_MAX_DIFFERENTIALS_FARMER;
}

export class DifferentialDiagnosisService {
  readonly name = 'DifferentialDiagnosisService';

  async compute(input: DifferentialComputeInput): Promise<DifferentialComputeResult> {
    const persona = input.persona ?? 'farmer';
    const query = input.symptomCodes.join(' ');

    const diePriors = await getDiseaseGraphService().loadDifferentialPriors(
      input.symptomCodes,
      input.species,
    );

    let graphRows = diePriors.map((p) => ({
      knowledgeEntryId: p.registryId ?? p.slug,
      slug: p.slug,
      titleBn: p.titleBn,
      titleEn: p.titleEn,
      weight: p.weight,
      evidenceLevel: 'L2',
      supportingSymptoms: p.supportingSymptoms,
    }));

    if (graphRows.length === 0) {
      const legacy = await loadGraphDifferentials({
        symptomCodes: input.symptomCodes,
        species: input.species,
      });
      graphRows = legacy;
    }

    const graphSliceLimit = maxForPersona(persona);
    let differentials: GroundedDifferential[];
    if (shouldUseRulesOnlyForFeature(DISEASE_INTELLIGENCE_FEATURE)) {
      differentials = graphRows
        .slice(0, graphSliceLimit)
        .map((row, index) => graphRowToDifferential(row, index + 1));
    } else {
      const pack = await getKnowledgeRetrievalService().retrieve({
        query,
        taskType: 'DISEASE_ANALYSIS',
        profileId: DIE_RETRIEVAL_PROFILES.DIFFERENTIAL,
        locale: input.locale,
        species: input.species,
        feature: DISEASE_INTELLIGENCE_FEATURE,
      });
      differentials = fuseDifferentials({
        graphRows,
        pack,
        locale: input.locale,
      });
    }

    const registryIds = diePriors.map((p) => p.registryId).filter((id): id is string => !!id);
    if (registryIds.length > 0) {
      const prevalence = await getSpeciesIntelligenceService().prevalenceBoosts(
        omitUndefined({
          registryIds,
          species: input.species,
          divisionId: input.divisionId,
        }),
      );
      const outbreak = await getOutbreakIntelligenceService().outbreakBoostsForSlugs(
        differentials.map((d) => d.slug),
        input.divisionId,
      );
      differentials = differentials.map((d) => {
        const regId = diePriors.find((p) => p.slug === d.slug)?.registryId;
        const pBoost = regId ? (prevalence.get(regId) ?? 0) : 0;
        const oBoost = outbreak.get(d.slug) ?? 0;
        const boost = pBoost * DIE_FUSION_WEIGHTS.prevalence + oBoost * DIE_FUSION_WEIGHTS.outbreak;
        return {
          ...d,
          confidenceScore: Math.min(0.99, d.confidenceScore + boost),
          reasonCodes: [
            ...(d.reasonCodes ?? []),
            ...(pBoost > 0 ? ['PREVALENCE_MODIFIER'] : []),
            ...(oBoost > 0 ? ['OUTBREAK_SIGNAL'] : []),
          ],
        };
      });
      differentials.sort((a, b) => b.confidenceScore - a.confidenceScore);
      differentials = differentials.map((d, i) => ({ ...d, rank: i + 1 }));
    }

    const limit = Math.min(maxForPersona(persona), AI_DOCTOR_MAX_DIFFERENTIALS);
    differentials = differentials.slice(0, limit);

    const run = await getDiseaseIntelligenceRepository().saveDifferentialRun(
      omitUndefined({
        caseId: input.caseId,
        inputs: input,
        output: { differentials },
        candidates: differentials.map((d, i) => {
        const registryId = diePriors.find((p) => p.slug === d.slug)?.registryId;
        return omitUndefined({
          ...(registryId ? { registryId } : {}),
          slug: d.slug,
          rank: i + 1,
          score: d.confidenceScore,
          reasonCodes: d.reasonCodes ?? ['FUSED'],
          citations: d.citations,
        });
        }),
      }),
    );

    void getDiseaseAnalyticsService().track(
      'DIFFERENTIAL_COMPUTE',
      omitUndefined({
        caseId: input.caseId,
        metadata: { count: differentials.length, runId: run.id },
      }),
    );

    return {
      runId: run.id,
      differentials,
      modelVersion: DIE_MODEL_VERSION,
    };
  }

  /** Re-export for tests — graph-only path */
  computeFromPackOnly(params: {
    graphRows: Awaited<ReturnType<typeof loadGraphDifferentials>>;
    pack: Awaited<ReturnType<ReturnType<typeof getKnowledgeRetrievalService>['retrieve']>>;
    locale: 'bn' | 'en';
  }): GroundedDifferential[] {
    return fuseDifferentials(params);
  }
}

let service: DifferentialDiagnosisService | undefined;

export function getDifferentialDiagnosisService(): DifferentialDiagnosisService {
  service ??= new DifferentialDiagnosisService();
  return service;
}
