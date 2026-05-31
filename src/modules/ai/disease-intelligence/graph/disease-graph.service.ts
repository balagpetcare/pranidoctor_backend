import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { getDiseaseIntelligenceRepository } from '../disease-intelligence.repository.js';
import { DIE_GRAPH_EDGE_TYPES } from '../disease-intelligence.constants.js';

export type GraphNeighborView = {
  edgeType: string;
  weight: number;
  node: { kind: string; refId: string; labelBn: string | null; labelEn: string | null };
};

export class DiseaseGraphService {
  readonly name = 'DiseaseGraphService';

  async getNeighbors(params: {
    nodeRef: string;
    nodeKind: 'DISEASE' | 'SYMPTOM';
    edgeTypes?: string[];
    species?: LivestockSpecies;
  }): Promise<GraphNeighborView[]> {
    const edges = await getDiseaseIntelligenceRepository().listGraphNeighbors({
      ...params,
      status: 'PUBLISHED',
    });
    return edges.map((e) => ({
      edgeType: e.edgeType,
      weight: e.weight,
      node: {
        kind: e.toNode.nodeKind,
        refId: e.toNode.refId,
        labelBn: e.toNode.labelBn,
        labelEn: e.toNode.labelEn,
      },
    }));
  }

  async loadDifferentialPriors(symptomCodes: string[], species: LivestockSpecies) {
    const edges = await getDiseaseIntelligenceRepository().loadGraphDifferentialsBySymptomCodes(
      symptomCodes,
      species,
    );

    const map = new Map<
      string,
      {
        slug: string;
        titleBn: string;
        titleEn: string;
        weight: number;
        registryId?: string;
        supportingSymptoms: string[];
      }
    >();

    for (const edge of edges) {
      if (edge.edgeType !== DIE_GRAPH_EDGE_TYPES.HAS_SYMPTOM) continue;
      const disease = edge.fromNode.registry;
      const slug = edge.fromNode.refId;
      const existing = map.get(slug);
      const symptomCode = edge.toNode.refId;
      const weight = (existing?.weight ?? 0) + edge.weight;
      const symptoms = existing?.supportingSymptoms ?? [];
      if (!symptoms.includes(symptomCode)) symptoms.push(symptomCode);
      map.set(
        slug,
        omitUndefined({
          slug,
          titleBn: disease?.labelBn ?? edge.fromNode.labelBn ?? slug,
          titleEn: disease?.labelEn ?? edge.fromNode.labelEn ?? slug,
          weight,
          ...(disease?.id ? { registryId: disease.id } : {}),
          supportingSymptoms: symptoms,
        }),
      );
    }

    return [...map.values()].sort((a, b) => b.weight - a.weight);
  }
}

let service: DiseaseGraphService | undefined;

export function getDiseaseGraphService(): DiseaseGraphService {
  service ??= new DiseaseGraphService();
  return service;
}
