import {
  resolveUvkgConfig,
  shouldRouteToUvkgRead,
  type UvkgConfig,
} from '../config/uvkg-config.js';
import type { UvkgTraversalResult } from '../uvkg.types.js';
import { getShadowReadService } from './shadow-read.service.js';
import { getUvkgTraversalService } from './uvkg-traversal.service.js';

export type UvkgReadRouteResult<T> = {
  value: T;
  source: 'legacy' | 'uvkg' | 'legacy_with_shadow';
  shadowMismatch?: boolean;
};

/**
 * Phase 5 read router — production responses stay on legacy unless canary routes to UVKG.
 * Shadow mode compares in parallel without changing the returned payload.
 */
export class UvkgReadRouterService {
  readonly name = 'UvkgReadRouterService';

  resolveSource(requestKey: string, config: UvkgConfig = resolveUvkgConfig()): 'legacy' | 'uvkg' {
    if (shouldRouteToUvkgRead(requestKey, config)) return 'uvkg';
    return 'legacy';
  }

  async neighborsWithRouting(params: {
    requestKey: string;
    refType: string;
    refId: string;
    edgeTypes?: string[];
    legacyRead: () => Promise<UvkgTraversalResult['neighbors']>;
  }): Promise<UvkgReadRouteResult<UvkgTraversalResult['neighbors']>> {
    const config = resolveUvkgConfig();
    const source = this.resolveSource(params.requestKey, config);

    if (config.shadowReadEnabled) {
      const shadow = getShadowReadService();
      void this.runShadowInBackground(params, shadow).catch(() => undefined);
    }

    if (source === 'uvkg') {
      const uvkg = await getUvkgTraversalService().neighbors(
        {
          refType: params.refType,
          refId: params.refId,
          edgeTypes: params.edgeTypes,
        },
        { forceRead: true },
      );
      return { value: uvkg.neighbors, source: 'uvkg' };
    }

    const legacyNeighbors = await params.legacyRead();
    return { value: legacyNeighbors, source: config.shadowReadEnabled ? 'legacy_with_shadow' : 'legacy' };
  }

  private async runShadowInBackground(
    params: {
      refType: string;
      refId: string;
      edgeTypes?: string[];
    },
    shadow: ReturnType<typeof getShadowReadService>,
  ): Promise<void> {
    if (params.refType === 'DISEASE') {
      await shadow.compareDiseaseTraversal({
        feature: 'routed',
        diseaseSlug: params.refId,
        edgeTypes: params.edgeTypes,
      });
      return;
    }
    if (params.refType === 'MEDICINE_GENERIC') {
      await shadow.compareMedicineTraversal({
        feature: 'routed',
        genericSlug: params.refId,
        edgeTypes: params.edgeTypes,
      });
      return;
    }
    if (params.refType === 'FEED_INGREDIENT') {
      await shadow.compareFeedTraversal({
        feature: 'routed',
        ingredientSlug: params.refId,
        edgeTypes: params.edgeTypes,
      });
    }
  }
}

let router: UvkgReadRouterService | undefined;

export function getUvkgReadRouterService(): UvkgReadRouterService {
  router ??= new UvkgReadRouterService();
  return router;
}

export function resetUvkgReadRouterServiceForTests(): void {
  router = undefined;
}
