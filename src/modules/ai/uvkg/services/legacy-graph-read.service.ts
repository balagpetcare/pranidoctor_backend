import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { getDiseaseIntelligenceRepository } from '../../disease-intelligence/disease-intelligence.repository.js';
import { getFeedKnowledgeRepository } from '../../feed-knowledge/feed-knowledge.repository.js';
import { getMedicineKnowledgeRepository } from '../../medicine/knowledge/medicine-knowledge.repository.js';
import {
  mapDiseaseEdgeType,
  mapFeedEdgeType,
  mapMedicineEdgeType,
} from '../uvkg.edge-mapping.js';
import type { UvkgNormalizedEdge } from '../uvkg.types.js';

function edgeKey(edgeType: string, neighborRefId: string): string {
  return `${edgeType}:${neighborRefId}`;
}

export class LegacyGraphReadService {
  readonly name = 'LegacyGraphReadService';

  async diseaseNeighbors(params: {
    diseaseSlug: string;
    edgeTypes?: string[];
    species?: LivestockSpecies;
  }): Promise<UvkgNormalizedEdge[]> {
    const repo = getDiseaseIntelligenceRepository();
    const edges = await repo.listGraphNeighbors({
      nodeRef: params.diseaseSlug,
      nodeKind: 'DISEASE',
      edgeTypes: params.edgeTypes,
      species: params.species,
    });

    return edges.map((e) => {
      const mapped = mapDiseaseEdgeType(e.edgeType);
      return {
        edgeType: mapped.uvkgEdgeType,
        neighborRefId: e.toNode.refId,
        direction: 'outbound' as const,
      };
    });
  }

  async medicineNeighbors(params: {
    genericSlug: string;
    edgeTypes?: string[];
  }): Promise<UvkgNormalizedEdge[]> {
    const repo = getMedicineKnowledgeRepository();
    const legacyTypes = params.edgeTypes?.length
      ? params.edgeTypes.map((t) => this.uvkgToMedicineEdgeType(t))
      : undefined;

    const edges = await repo.getGraphEdges({
      fromEntitySlug: params.genericSlug,
      edgeType: legacyTypes?.[0] as never,
      limit: 100,
    });

    const out: UvkgNormalizedEdge[] = [];
    for (const e of edges) {
      const mapped = mapMedicineEdgeType(e.edgeType);
      if (params.edgeTypes?.length && !params.edgeTypes.includes(mapped.uvkgEdgeType)) {
        continue;
      }
      out.push({
        edgeType: mapped.uvkgEdgeType,
        neighborRefId: e.toEntitySlug,
        direction: 'outbound',
      });
    }

    const fromEdges = await repo.getGraphEdges({
      toEntitySlug: params.genericSlug,
      limit: 100,
    });
    for (const e of fromEdges) {
      const mapped = mapMedicineEdgeType(e.edgeType);
      if (params.edgeTypes?.length && !params.edgeTypes.includes(mapped.uvkgEdgeType)) {
        continue;
      }
      out.push({
        edgeType: mapped.uvkgEdgeType,
        neighborRefId: e.fromEntitySlug,
        direction: 'inbound',
      });
    }

    return out;
  }

  async feedNeighbors(params: {
    ingredientSlug: string;
    edgeTypes?: string[];
  }): Promise<UvkgNormalizedEdge[]> {
    const repo = getFeedKnowledgeRepository();
    const legacyTypes = params.edgeTypes?.map((t) => this.uvkgToFeedEdgeType(t));

    const edges = await repo.getGraphEdges({
      fromEntitySlug: params.ingredientSlug,
      limit: 100,
    });

    const out: UvkgNormalizedEdge[] = [];
    for (const e of edges) {
      const mapped = mapFeedEdgeType(e.edgeType);
      if (params.edgeTypes?.length && !params.edgeTypes.includes(mapped.uvkgEdgeType)) {
        continue;
      }
      out.push({
        edgeType: mapped.uvkgEdgeType,
        neighborRefId: e.toEntitySlug,
        direction: 'outbound',
      });
    }

    const inbound = await repo.getGraphEdges({
      toEntitySlug: params.ingredientSlug,
      limit: 100,
    });
    for (const e of inbound) {
      const mapped = mapFeedEdgeType(e.edgeType);
      if (legacyTypes?.length && !params.edgeTypes?.includes(mapped.uvkgEdgeType)) {
        continue;
      }
      out.push({
        edgeType: mapped.uvkgEdgeType,
        neighborRefId: e.fromEntitySlug,
        direction: 'inbound',
      });
    }

    return out;
  }

  toEdgeSet(edges: UvkgNormalizedEdge[]): Set<string> {
    return new Set(edges.map((e) => edgeKey(e.edgeType, e.neighborRefId)));
  }

  private uvkgToMedicineEdgeType(uvkg: string): string {
    const map: Record<string, string> = {
      CONTRAINDICATES: 'CONTRAINDICATED_WITH',
      INTERACTS_WITH: 'INTERACTS_WITH',
      BRAND_OF: 'BRAND_OF_GENERIC',
      TREATED_WITH: 'SUBSTITUTES_FOR',
    };
    return map[uvkg] ?? uvkg;
  }

  private uvkgToFeedEdgeType(uvkg: string): string {
    const map: Record<string, string> = {
      TOXIC_TO: 'TOXICITY_OF',
      NUTRIENT_FOR: 'NUTRIENT_FOR',
      CONTAINS: 'CONTAINS',
      CONTRAINDICATES_FEED: 'RESTRICTED_FOR',
    };
    return map[uvkg] ?? uvkg;
  }
}

let legacy: LegacyGraphReadService | undefined;

export function getLegacyGraphReadService(): LegacyGraphReadService {
  legacy ??= new LegacyGraphReadService();
  return legacy;
}

export function resetLegacyGraphReadServiceForTests(): void {
  legacy = undefined;
}
