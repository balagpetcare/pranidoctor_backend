import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { resolveUvkgConfig } from '../config/uvkg-config.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import {
  CLINICAL_TRAVERSAL_EDGE_CLASSES,
  PROFILE_EDGE_ALLOWLIST,
} from '../uvkg.edge-mapping.js';
import type { UvkgNeighborView, UvkgTraversalResult } from '../uvkg.types.js';

const MAX_NEIGHBORS = 50;

/** Phase 1 read API — disabled by default (`UVKG_READ_ENABLED=false`); legacy graphs remain in use. */
export class UvkgTraversalService {
  readonly name = 'UvkgTraversalService';

  async neighbors(params: {
    refType: string;
    refId: string;
    edgeTypes?: string[];
    species?: LivestockSpecies;
    statuses?: string[];
    limit?: number;
  }, options?: { forceRead?: boolean }): Promise<UvkgTraversalResult> {
    const config = resolveUvkgConfig();
    const allowRead = options?.forceRead === true || config.readEnabled;

    if (!allowRead) {
      return { neighbors: [], source: 'disabled' };
    }

    const defaultStatuses = config.shadowReadEnabled && config.shadowIncludeDraft
      ? ['PUBLISHED', 'APPROVED', 'DRAFT']
      : ['PUBLISHED'];

    const links = await getKnowledgeLinkRepository().listNeighbors({
      refType: params.refType,
      refId: params.refId,
      edgeTypes: params.edgeTypes,
      statuses: params.statuses ?? defaultStatuses,
      edgeClasses: CLINICAL_TRAVERSAL_EDGE_CLASSES,
      limit: Math.min(params.limit ?? MAX_NEIGHBORS, MAX_NEIGHBORS),
    });

    const neighbors: UvkgNeighborView[] = [];
    for (const link of links) {
      const outbound = link.fromRefId === params.refId && link.fromRefType === params.refType;
      neighbors.push({
        edgeType: link.edgeType,
        weight: link.weight,
        direction: outbound ? 'outbound' : 'inbound',
        refType: outbound ? link.toRefType : link.fromRefType,
        refId: outbound ? link.toRefId : link.fromRefId,
        entityId: null,
        labelBn: null,
        labelEn: null,
      });
    }

    return { neighbors, source: 'uvkg' };
  }

  async expandForRetrieval(params: {
    profileId: string;
    refType: string;
    refId: string;
  }, options?: { forceRead?: boolean }): Promise<{
    slugBoosts: Map<string, number>;
    hints: Array<{ edgeType: string; fromSlug: string; toSlug: string; label: string }>;
    source: 'uvkg' | 'disabled';
  }> {
    const config = resolveUvkgConfig();
    const allowRead =
      options?.forceRead === true ||
      config.readEnabled ||
      config.shadowReadEnabled;

    if (!allowRead) {
      return { slugBoosts: new Map(), hints: [], source: 'disabled' };
    }

    const allowlist = PROFILE_EDGE_ALLOWLIST[params.profileId];
    const traversal = await this.neighbors(
      {
        refType: params.refType,
        refId: params.refId,
        edgeTypes: allowlist,
      },
      { forceRead: true },
    );

    const slugBoosts = new Map<string, number>();
    const hints: Array<{ edgeType: string; fromSlug: string; toSlug: string; label: string }> = [];

    for (const n of traversal.neighbors) {
      const boost = Math.min(0.25, n.weight * 0.15);
      slugBoosts.set(n.refId, Math.max(slugBoosts.get(n.refId) ?? 0, boost));
      hints.push({
        edgeType: n.edgeType,
        fromSlug: params.refId,
        toSlug: n.refId,
        label: n.edgeType,
      });
    }

    return { slugBoosts, hints, source: 'uvkg' };
  }
}

let traversal: UvkgTraversalService | undefined;

export function getUvkgTraversalService(): UvkgTraversalService {
  traversal ??= new UvkgTraversalService();
  return traversal;
}

export function resetUvkgTraversalServiceForTests(): void {
  traversal = undefined;
}
