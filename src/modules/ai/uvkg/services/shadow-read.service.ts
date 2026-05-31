import { resolveUvkgConfig } from '../config/uvkg-config.js';
import type { UvkgNormalizedEdge, UvkgShadowCompareResult } from '../uvkg.types.js';
import { getLegacyGraphReadService } from './legacy-graph-read.service.js';
import { getUvkgTraversalService } from './uvkg-traversal.service.js';

function edgeKey(edgeType: string, neighborRefId: string): string {
  return `${edgeType}:${neighborRefId}`;
}

function computeParity(legacy: Set<string>, uvkg: Set<string>): {
  matched: number;
  ratio: number;
  legacyOnly: string[];
  uvkgOnly: string[];
} {
  let matched = 0;
  for (const k of legacy) {
    if (uvkg.has(k)) matched += 1;
  }
  const union = new Set([...legacy, ...uvkg]);
  const ratio = union.size === 0 ? 1 : matched / union.size;
  const legacyOnly = [...legacy].filter((k) => !uvkg.has(k)).slice(0, 10);
  const uvkgOnly = [...uvkg].filter((k) => !legacy.has(k)).slice(0, 10);
  return { matched, ratio, legacyOnly, uvkgOnly };
}

export class ShadowReadService {
  readonly name = 'ShadowReadService';

  async compareDiseaseTraversal(params: {
    feature: string;
    diseaseSlug: string;
    edgeTypes?: string[];
  }): Promise<UvkgShadowCompareResult> {
    const legacySvc = getLegacyGraphReadService();
    const traversal = getUvkgTraversalService();

    const legacyStart = performance.now();
    const legacyEdges = await legacySvc.diseaseNeighbors({
      diseaseSlug: params.diseaseSlug,
      edgeTypes: params.edgeTypes,
    });
    const legacyMs = performance.now() - legacyStart;

    const uvkgStart = performance.now();
    const uvkgResult = await traversal.neighbors(
      {
        refType: 'DISEASE',
        refId: params.diseaseSlug,
        edgeTypes: params.edgeTypes,
      },
      { forceRead: true },
    );
    const uvkgMs = performance.now() - uvkgStart;

    const legacySet = legacySvc.toEdgeSet(legacyEdges);
    const uvkgSet = this.uvkgNeighborsToSet(uvkgResult.neighbors, params.diseaseSlug, 'DISEASE');
    const { matched, ratio, legacyOnly, uvkgOnly } = computeParity(legacySet, uvkgSet);

    return {
      feature: params.feature,
      anchorRefType: 'DISEASE',
      anchorRefId: params.diseaseSlug,
      legacyCount: legacySet.size,
      uvkgCount: uvkgSet.size,
      matchedCount: matched,
      parityRatio: Math.round(ratio * 1000) / 1000,
      legacyOnly,
      uvkgOnly,
      legacyMs: Math.round(legacyMs * 100) / 100,
      uvkgMs: Math.round(uvkgMs * 100) / 100,
      legacyEmpty: legacySet.size === 0,
    };
  }

  async compareMedicineTraversal(params: {
    feature: string;
    genericSlug: string;
    edgeTypes?: string[];
  }): Promise<UvkgShadowCompareResult> {
    const legacySvc = getLegacyGraphReadService();
    const traversal = getUvkgTraversalService();

    const legacyStart = performance.now();
    const legacyEdges = await legacySvc.medicineNeighbors({
      genericSlug: params.genericSlug,
      edgeTypes: params.edgeTypes,
    });
    const legacyMs = performance.now() - legacyStart;

    const uvkgStart = performance.now();
    const uvkgResult = await traversal.neighbors(
      {
        refType: 'MEDICINE_GENERIC',
        refId: params.genericSlug,
        edgeTypes: params.edgeTypes,
      },
      { forceRead: true },
    );
    const uvkgMs = performance.now() - uvkgStart;

    const legacySet = legacySvc.toEdgeSet(legacyEdges);
    const uvkgSet = this.uvkgNeighborsToSet(
      uvkgResult.neighbors,
      params.genericSlug,
      'MEDICINE_GENERIC',
    );
    const { matched, ratio, legacyOnly, uvkgOnly } = computeParity(legacySet, uvkgSet);

    return {
      feature: params.feature,
      anchorRefType: 'MEDICINE_GENERIC',
      anchorRefId: params.genericSlug,
      legacyCount: legacySet.size,
      uvkgCount: uvkgSet.size,
      matchedCount: matched,
      parityRatio: ratio,
      legacyOnly,
      uvkgOnly,
      legacyMs: Math.round(legacyMs * 100) / 100,
      uvkgMs: Math.round(uvkgMs * 100) / 100,
      legacyEmpty: legacySet.size === 0,
    };
  }

  async compareFeedTraversal(params: {
    feature: string;
    ingredientSlug: string;
    edgeTypes?: string[];
  }): Promise<UvkgShadowCompareResult> {
    const legacySvc = getLegacyGraphReadService();
    const traversal = getUvkgTraversalService();

    const legacyStart = performance.now();
    const legacyEdges = await legacySvc.feedNeighbors({
      ingredientSlug: params.ingredientSlug,
      edgeTypes: params.edgeTypes,
    });
    const legacyMs = performance.now() - legacyStart;

    const uvkgStart = performance.now();
    const uvkgResult = await traversal.neighbors(
      {
        refType: 'FEED_INGREDIENT',
        refId: params.ingredientSlug,
        edgeTypes: params.edgeTypes,
      },
      { forceRead: true },
    );
    const uvkgMs = performance.now() - uvkgStart;

    const legacySet = legacySvc.toEdgeSet(legacyEdges);
    const uvkgSet = this.uvkgNeighborsToSet(
      uvkgResult.neighbors,
      params.ingredientSlug,
      'FEED_INGREDIENT',
    );
    const { matched, ratio, legacyOnly, uvkgOnly } = computeParity(legacySet, uvkgSet);

    return {
      feature: params.feature,
      anchorRefType: 'FEED_INGREDIENT',
      anchorRefId: params.ingredientSlug,
      legacyCount: legacySet.size,
      uvkgCount: uvkgSet.size,
      matchedCount: matched,
      parityRatio: ratio,
      legacyOnly,
      uvkgOnly,
      legacyMs: Math.round(legacyMs * 100) / 100,
      uvkgMs: Math.round(uvkgMs * 100) / 100,
      legacyEmpty: legacySet.size === 0,
    };
  }

  isShadowEnabled(): boolean {
    const config = resolveUvkgConfig();
    return config.shadowReadEnabled;
  }

  private uvkgNeighborsToSet(
    neighbors: Array<{
      edgeType: string;
      refId: string;
      direction: 'outbound' | 'inbound';
      refType: string;
    }>,
    anchorRefId: string,
    anchorRefType: string,
  ): Set<string> {
    const out = new Set<string>();
    for (const n of neighbors) {
      const isOutbound = n.direction === 'outbound';
      out.add(edgeKey(n.edgeType, n.refId));
      void anchorRefId;
      void anchorRefType;
      void isOutbound;
    }
    return out;
  }
}

let shadow: ShadowReadService | undefined;

export function getShadowReadService(): ShadowReadService {
  shadow ??= new ShadowReadService();
  return shadow;
}

export function resetShadowReadServiceForTests(): void {
  shadow = undefined;
}
