import type { LivestockSpecies } from '../../../../generated/prisma/index.js';
import { resolveUvkgConfig } from '../config/uvkg-config.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import {
  mapDiseaseEdgeType,
  mapFeedEdgeType,
  mapMedicineEdgeType,
} from '../uvkg.edge-mapping.js';
import type { UvkgLinkUpsertInput } from '../uvkg.types.js';
import { getUvkgEndpointResolverService } from './endpoint-resolver.service.js';

/** Phase 3: mirror legacy graph writes into UVKG as DRAFT (legacy graphs remain authoritative). */
export class UvkgDualWriteService {
  readonly name = 'UvkgDualWriteService';

  private async write(input: UvkgLinkUpsertInput): Promise<string | null> {
    if (!resolveUvkgConfig().dualWriteEnabled) return null;
    try {
      const id = await getKnowledgeLinkRepository().upsertFromDualWrite(input);
      return id;
    } catch (error) {
      await getKnowledgeLinkRepository().recordAudit('DUAL_WRITE_FAILED', {
        edgeType: input.edgeType,
        sourceSystem: input.sourceSystem,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async afterFeedGraphEdge(params: {
    legacyEdgeId: string;
    edgeType: string;
    fromEntitySlug: string;
    toEntitySlug: string;
    weight?: number;
    labelBn?: string;
    labelEn?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!resolveUvkgConfig().dualWriteEnabled) return null;

    const mapped = mapFeedEdgeType(params.edgeType);
    const resolver = getUvkgEndpointResolverService();
    const from = await resolver.resolveFeedSlug(params.fromEntitySlug);
    const to = await resolver.resolveFeedSlug(params.toEntitySlug);

    return this.write({
      edgeType: mapped.uvkgEdgeType,
      edgeClass: mapped.edgeClass,
      fromRefType: from.refType,
      fromRefId: from.refId,
      toRefType: to.refType,
      toRefId: to.refId,
      fromEntityId: from.entityId ?? undefined,
      toEntityId: to.entityId ?? undefined,
      sourceSystem: 'FEED_GRAPH',
      sourceEdgeId: params.legacyEdgeId,
      weight: params.weight,
      status: 'DRAFT',
      labelBn: params.labelBn,
      labelEn: params.labelEn,
      metadata: params.metadata,
    });
  }

  async afterMedicineGraphEdge(params: {
    legacyEdgeId: string;
    edgeType: string;
    fromEntitySlug: string;
    toEntitySlug: string;
    weight?: number;
    labelBn?: string;
    labelEn?: string;
    metadata?: Record<string, unknown>;
  }): Promise<string | null> {
    if (!resolveUvkgConfig().dualWriteEnabled) return null;

    const mapped = mapMedicineEdgeType(params.edgeType);
    const resolver = getUvkgEndpointResolverService();
    const fromBrand = params.edgeType === 'BRAND_OF_GENERIC';
    const from = await resolver.resolveMedicineSlug(params.fromEntitySlug, fromBrand);
    const to = await resolver.resolveMedicineSlug(
      params.toEntitySlug,
      params.edgeType === 'MANUFACTURED_BY',
    );

    return this.write({
      edgeType: mapped.uvkgEdgeType,
      edgeClass: mapped.edgeClass,
      fromRefType: from.refType,
      fromRefId: from.refId,
      toRefType: to.refType,
      toRefId: to.refId,
      fromEntityId: from.entityId ?? undefined,
      toEntityId: to.entityId ?? undefined,
      sourceSystem: 'MEDICINE_GRAPH',
      sourceEdgeId: params.legacyEdgeId,
      weight: params.weight,
      status: 'DRAFT',
      labelBn: params.labelBn,
      labelEn: params.labelEn,
      metadata: params.metadata,
    });
  }

  async afterDiseaseGraphEdge(params: {
    legacyEdgeId: string;
    edgeType: string;
    fromNodeKind: string;
    fromRefId: string;
    toNodeKind: string;
    toRefId: string;
    weight?: number;
    species?: LivestockSpecies[];
    evidenceLevel?: string;
    vkVersionId?: string;
    legacyStatus?: string;
  }): Promise<string | null> {
    if (!resolveUvkgConfig().dualWriteEnabled) return null;

    const mapped = mapDiseaseEdgeType(params.edgeType);
    const resolver = getUvkgEndpointResolverService();

    const from =
      params.fromNodeKind === 'DISEASE'
        ? await resolver.resolveDisease(params.fromRefId)
        : params.fromNodeKind === 'SYMPTOM'
          ? await resolver.resolveSymptom(params.fromRefId)
          : {
              entityId: await resolver.resolveBySlug(params.fromRefId),
              refType: 'OTHER' as const,
              refId: params.fromRefId,
            };

    const to =
      params.toNodeKind === 'DISEASE'
        ? await resolver.resolveDisease(params.toRefId)
        : params.toNodeKind === 'SYMPTOM'
          ? await resolver.resolveSymptom(params.toRefId)
          : params.toNodeKind === 'MEDICINE_GENERIC'
            ? await resolver.resolveMedicineSlug(params.toRefId, false)
            : {
                entityId: await resolver.resolveBySlug(params.toRefId),
                refType: 'OTHER' as const,
                refId: params.toRefId,
              };

    return this.write({
      edgeType: mapped.uvkgEdgeType,
      edgeClass: mapped.edgeClass,
      fromRefType: from.refType,
      fromRefId: from.refId,
      toRefType: to.refType,
      toRefId: to.refId,
      fromEntityId: from.entityId ?? undefined,
      toEntityId: to.entityId ?? undefined,
      sourceSystem: 'DISEASE_GRAPH',
      sourceEdgeId: params.legacyEdgeId,
      weight: params.weight,
      species: params.species,
      evidenceLevel: params.evidenceLevel,
      vkVersionId: params.vkVersionId,
      status: 'DRAFT',
      metadata: { legacyGraphStatus: params.legacyStatus },
    });
  }
}

let dualWrite: UvkgDualWriteService | undefined;

export function getUvkgDualWriteService(): UvkgDualWriteService {
  dualWrite ??= new UvkgDualWriteService();
  return dualWrite;
}

export function resetUvkgDualWriteServiceForTests(): void {
  dualWrite = undefined;
}
