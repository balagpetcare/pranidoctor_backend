import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { resolveUvkgConfig } from '../config/uvkg-config.js';
import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import { getKnowledgeLinkStagingRepository } from '../repositories/knowledge-link-staging.repository.js';
import {
  mapDiseaseEdgeType,
  mapFeedEdgeType,
  mapMedicineEdgeType,
} from '../uvkg.edge-mapping.js';
import type { UvkgLinkUpsertInput, UvkgSyncResult } from '../uvkg.types.js';
import { buildSourceLinkKey } from '../uvkg.util.js';
import { getUvkgDualWriteService } from './uvkg-dual-write.service.js';

/** Phase 2–3: sync legacy domain graphs → UVKG without retiring legacy stores. */
export class GraphSyncService {
  readonly name = 'GraphSyncService';

  private emptyResult(): UvkgSyncResult {
    return { created: 0, updated: 0, skipped: 0, conflicts: 0, errors: [] };
  }

  async syncAll(): Promise<UvkgSyncResult> {
    if (!resolveUvkgConfig().syncEnabled) return this.emptyResult();

    const feed = await this.syncFromFeedGraph();
    const medicine = await this.syncFromMedicineGraph();
    const disease = await this.syncFromDiseaseGraph();

    return {
      created: feed.created + medicine.created + disease.created,
      updated: feed.updated + medicine.updated + disease.updated,
      skipped: feed.skipped + medicine.skipped + disease.skipped,
      conflicts: feed.conflicts + medicine.conflicts + disease.conflicts,
      errors: [...feed.errors, ...medicine.errors, ...disease.errors],
    };
  }

  async syncFromFeedGraph(): Promise<UvkgSyncResult> {
    const result = this.emptyResult();
    const prisma = getPrisma();
    const edges = await prisma.vkFeedKnowledgeGraphEdge.findMany();
    const dualWrite = getUvkgDualWriteService();

    for (const edge of edges) {
      const existing = await getKnowledgeLinkRepository().findByLinkKey(
        buildSourceLinkKey('FEED_GRAPH', edge.id),
      );
      const id = await dualWrite.afterFeedGraphEdge({
        legacyEdgeId: edge.id,
        edgeType: edge.edgeType,
        fromEntitySlug: edge.fromEntitySlug,
        toEntitySlug: edge.toEntitySlug,
        weight: edge.weight,
        labelBn: edge.labelBn ?? undefined,
        labelEn: edge.labelEn ?? undefined,
        metadata:
          edge.metadataJson && typeof edge.metadataJson === 'object'
            ? (edge.metadataJson as Record<string, unknown>)
            : undefined,
      });
      if (!id) {
        result.skipped += 1;
        continue;
      }
      if (existing) result.updated += 1;
      else result.created += 1;
    }

    await getKnowledgeLinkRepository().recordAudit('SYNC_FEED_COMPLETE', {
      edgeCount: edges.length,
      ...result,
    });
    return result;
  }

  async syncFromMedicineGraph(): Promise<UvkgSyncResult> {
    const result = this.emptyResult();
    const edges = await getPrisma().vkMedicineKnowledgeGraphEdge.findMany();
    const dualWrite = getUvkgDualWriteService();

    for (const edge of edges) {
      const existing = await getKnowledgeLinkRepository().findByLinkKey(
        buildSourceLinkKey('MEDICINE_GRAPH', edge.id),
      );
      const id = await dualWrite.afterMedicineGraphEdge({
        legacyEdgeId: edge.id,
        edgeType: edge.edgeType,
        fromEntitySlug: edge.fromEntitySlug,
        toEntitySlug: edge.toEntitySlug,
        weight: edge.weight,
        labelBn: edge.labelBn ?? undefined,
        labelEn: edge.labelEn ?? undefined,
        metadata:
          edge.metadataJson && typeof edge.metadataJson === 'object'
            ? (edge.metadataJson as Record<string, unknown>)
            : undefined,
      });
      if (!id) {
        result.skipped += 1;
        continue;
      }
      if (existing) result.updated += 1;
      else result.created += 1;
    }

    await getKnowledgeLinkRepository().recordAudit('SYNC_MEDICINE_COMPLETE', {
      edgeCount: edges.length,
      ...result,
    });
    return result;
  }

  async syncFromDiseaseGraph(): Promise<UvkgSyncResult> {
    const result = this.emptyResult();
    const prisma = getPrisma();
    const edges = await prisma.diGraphEdge.findMany({
      include: { fromNode: true, toNode: true },
    });
    const dualWrite = getUvkgDualWriteService();

    for (const edge of edges) {
      const id = await dualWrite.afterDiseaseGraphEdge({
        legacyEdgeId: edge.id,
        edgeType: edge.edgeType,
        fromNodeKind: edge.fromNode.nodeKind,
        fromRefId: edge.fromNode.refId,
        toNodeKind: edge.toNode.nodeKind,
        toRefId: edge.toNode.refId,
        weight: edge.weight,
        species: edge.species,
        evidenceLevel: edge.evidenceLevel,
        vkVersionId: edge.vkVersionId ?? undefined,
        legacyStatus: edge.status,
      });
      if (!id) {
        result.skipped += 1;
        continue;
      }
      result.created += 1;
    }

    await getKnowledgeLinkRepository().recordAudit('SYNC_DISEASE_COMPLETE', {
      edgeCount: edges.length,
      ...result,
    });
    return result;
  }

  async syncForPublishedVersion(versionId: string): Promise<UvkgSyncResult> {
    if (!resolveUvkgConfig().syncEnabled) return this.emptyResult();

    const version = await getPrisma().vkKnowledgeVersion.findUnique({
      where: { id: versionId },
      include: { entity: { select: { slug: true, domain: true } } },
    });
    if (!version || version.status !== 'PUBLISHED') {
      return this.emptyResult();
    }

    const slug = version.entity.slug;
    const result = this.emptyResult();

    if (version.entity.domain === 'FEED') {
      const feedEdges = await getPrisma().vkFeedKnowledgeGraphEdge.findMany({
        where: {
          OR: [{ fromEntitySlug: slug }, { toEntitySlug: slug }],
        },
      });
      for (const edge of feedEdges) {
        await getUvkgDualWriteService().afterFeedGraphEdge({
          legacyEdgeId: edge.id,
          edgeType: edge.edgeType,
          fromEntitySlug: edge.fromEntitySlug,
          toEntitySlug: edge.toEntitySlug,
          weight: edge.weight,
        });
        result.updated += 1;
      }
    }

    await getKnowledgeLinkRepository().recordAudit('SYNC_VERSION_PUBLISH', {
      versionId,
      slug,
      domain: version.entity.domain,
      ...result,
    });
    return result;
  }

  async rebuildStaging(): Promise<{ batchId: string; staged: number }> {
    const batchId = randomUUID();
    const staging = getKnowledgeLinkStagingRepository();
    await staging.clearBatch(batchId);

    const inputs: UvkgLinkUpsertInput[] = [];
    const prisma = getPrisma();

    for (const edge of await prisma.vkFeedKnowledgeGraphEdge.findMany()) {
      const mapped = mapFeedEdgeType(edge.edgeType);
      inputs.push({
        edgeType: mapped.uvkgEdgeType,
        edgeClass: mapped.edgeClass,
        fromRefType: 'FEED_INGREDIENT',
        fromRefId: edge.fromEntitySlug,
        toRefType: 'FEED_INGREDIENT',
        toRefId: edge.toEntitySlug,
        sourceSystem: 'FEED_GRAPH',
        sourceEdgeId: edge.id,
        weight: edge.weight,
        status: 'DRAFT',
      });
    }

    for (const edge of await prisma.vkMedicineKnowledgeGraphEdge.findMany()) {
      const mapped = mapMedicineEdgeType(edge.edgeType);
      inputs.push({
        edgeType: mapped.uvkgEdgeType,
        edgeClass: mapped.edgeClass,
        fromRefType: 'MEDICINE_GENERIC',
        fromRefId: edge.fromEntitySlug,
        toRefType: 'MEDICINE_GENERIC',
        toRefId: edge.toEntitySlug,
        sourceSystem: 'MEDICINE_GRAPH',
        sourceEdgeId: edge.id,
        weight: edge.weight,
        status: 'DRAFT',
      });
    }

    for (const edge of await prisma.diGraphEdge.findMany({
      include: { fromNode: true, toNode: true },
    })) {
      const mapped = mapDiseaseEdgeType(edge.edgeType);
      inputs.push({
        edgeType: mapped.uvkgEdgeType,
        edgeClass: mapped.edgeClass,
        fromRefType: edge.fromNode.nodeKind === 'SYMPTOM' ? 'SYMPTOM' : 'DISEASE',
        fromRefId: edge.fromNode.refId,
        toRefType: edge.toNode.nodeKind === 'SYMPTOM' ? 'SYMPTOM' : 'DISEASE',
        toRefId: edge.toNode.refId,
        sourceSystem: 'DISEASE_GRAPH',
        sourceEdgeId: edge.id,
        weight: edge.weight,
        species: edge.species,
        status: 'DRAFT',
      });
    }

    const staged = await staging.insertBatch(batchId, inputs);
    await getKnowledgeLinkRepository().recordAudit('REBUILD_STAGING', { batchId, staged });
    return { batchId, staged };
  }

  async repairSync(): Promise<UvkgSyncResult> {
    const full = await this.syncAll();
    await getKnowledgeLinkRepository().recordAudit('REPAIR_SYNC', full);
    return full;
  }

  async recordWeightConflict(params: {
    linkKey: string;
    sourceSystem: 'FEED_GRAPH' | 'MEDICINE_GRAPH' | 'DISEASE_GRAPH';
    sourceEdgeId: string;
    legacyWeight: number;
    uvkgWeight: number;
  }): Promise<void> {
    const prisma = getPrisma();
    const existing = await prisma.uvkgSyncConflict.findFirst({
      where: { linkKey: params.linkKey, status: 'OPEN' },
    });
    if (existing) return;

    await prisma.uvkgSyncConflict.create({
      data: {
        linkKey: params.linkKey,
        sourceSystem: params.sourceSystem,
        sourceEdgeId: params.sourceEdgeId,
        conflictType: 'WEIGHT_MISMATCH',
        legacySnapshot: { weight: params.legacyWeight } as Prisma.InputJsonValue,
        uvkgSnapshot: { weight: params.uvkgWeight } as Prisma.InputJsonValue,
        status: 'OPEN',
      },
    });
  }
}

let graphSync: GraphSyncService | undefined;

export function getGraphSyncService(): GraphSyncService {
  graphSync ??= new GraphSyncService();
  return graphSync;
}

export function resetGraphSyncServiceForTests(): void {
  graphSync = undefined;
}
