import { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { UvkgLinkUpsertInput, UvkgLinkView } from '../uvkg.types.js';
import { buildSourceLinkKey, normalizeRefId, normalizeSourceEdgeId } from '../uvkg.util.js';

export class KnowledgeLinkRepository {
  private prisma = getPrisma();

  async upsertFromDualWrite(input: UvkgLinkUpsertInput): Promise<string> {
    const sourceEdgeId =
      input.sourceEdgeId != null ? normalizeSourceEdgeId(input.sourceEdgeId) : null;
    const fromRefId = normalizeRefId(input.fromRefId);
    const toRefId = normalizeRefId(input.toRefId);
    const linkKey =
      sourceEdgeId != null
        ? buildSourceLinkKey(input.sourceSystem, sourceEdgeId)
        : buildSourceLinkKey(
            input.sourceSystem,
            `${input.edgeType}:${fromRefId}:${toRefId}`,
          );

    const row = await this.prisma.vkKnowledgeLink.upsert({
      where: { linkKey },
      create: {
        linkKey,
        edgeType: input.edgeType,
        edgeClass: input.edgeClass,
        fromEntityId: input.fromEntityId ?? null,
        fromRefType: input.fromRefType,
        fromRefId,
        toEntityId: input.toEntityId ?? null,
        toRefType: input.toRefType,
        toRefId,
        direction: input.direction ?? 'DIRECTED',
        weight: input.weight ?? 0.5,
        species: input.species ?? [],
        regionScope: input.regionScope ?? ['BD'],
        evidenceLevel: input.evidenceLevel ?? 'L2',
        confidenceScore: input.confidenceScore ?? 0.8,
        clinicalRiskTier: input.clinicalRiskTier ?? 'LOW',
        status: input.status ?? 'DRAFT',
        vkVersionId: input.vkVersionId ?? null,
        sourceEdgeId,
        sourceSystem: input.sourceSystem,
        labelBn: input.labelBn ?? null,
        labelEn: input.labelEn ?? null,
        metadataJson: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
      update: {
        edgeType: input.edgeType,
        edgeClass: input.edgeClass,
        fromEntityId: input.fromEntityId ?? null,
        toEntityId: input.toEntityId ?? null,
        weight: input.weight ?? 0.5,
        species: input.species ?? [],
        evidenceLevel: input.evidenceLevel ?? 'L2',
        confidenceScore: input.confidenceScore ?? 0.8,
        labelBn: input.labelBn ?? null,
        labelEn: input.labelEn ?? null,
        metadataJson: input.metadata
          ? (JSON.parse(JSON.stringify(input.metadata)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        updatedAt: new Date(),
      },
    });

    return row.id;
  }

  async findByLinkKey(linkKey: string): Promise<UvkgLinkView | null> {
    const row = await this.prisma.vkKnowledgeLink.findUnique({ where: { linkKey } });
    return row ? this.toView(row) : null;
  }

  async listNeighbors(params: {
    refType: string;
    refId: string;
    edgeTypes?: string[];
    statuses?: string[];
    edgeClasses?: string[];
    limit?: number;
  }): Promise<UvkgLinkView[]> {
    const statusFilter = params.statuses ?? ['PUBLISHED'];
    const rows = await this.prisma.vkKnowledgeLink.findMany({
      where: {
        status: { in: statusFilter as never[] },
        ...(params.edgeClasses?.length ? { edgeClass: { in: params.edgeClasses as never[] } } : {}),
        ...(params.edgeTypes?.length ? { edgeType: { in: params.edgeTypes } } : {}),
        OR: [
          { fromRefType: params.refType as never, fromRefId: params.refId },
          { toRefType: params.refType as never, toRefId: params.refId },
        ],
      },
      take: params.limit ?? 50,
      orderBy: { weight: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async countBySource(): Promise<Record<string, number>> {
    const groups = await this.prisma.vkKnowledgeLink.groupBy({
      by: ['sourceSystem'],
      _count: { id: true },
    });
    const out: Record<string, number> = {};
    for (const g of groups) {
      out[g.sourceSystem] = g._count.id;
    }
    return out;
  }

  async countAll(): Promise<number> {
    return this.prisma.vkKnowledgeLink.count();
  }

  async countByEdgeType(): Promise<Record<string, number>> {
    const groups = await this.prisma.vkKnowledgeLink.groupBy({
      by: ['edgeType'],
      _count: { id: true },
    });
    const out: Record<string, number> = {};
    for (const g of groups) out[g.edgeType] = g._count.id;
    return out;
  }

  async countByStatus(): Promise<Record<string, number>> {
    const groups = await this.prisma.vkKnowledgeLink.groupBy({
      by: ['status'],
      _count: { id: true },
    });
    const out: Record<string, number> = {};
    for (const g of groups) out[g.status] = g._count.id;
    return out;
  }

  async countDistinctEndpointRefs(): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT endpoint)::bigint AS count
      FROM (
        SELECT CONCAT("fromRefType", ':', "fromRefId") AS endpoint FROM vk_knowledge_links
        UNION
        SELECT CONCAT("toRefType", ':', "toRefId") AS endpoint FROM vk_knowledge_links
      ) t
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async countVkKnowledgeEntities(): Promise<number> {
    return this.prisma.vkKnowledgeEntity.count();
  }

  async findLinksByEdgeTypes(edgeTypes: string[]): Promise<
    Array<{
      id: string;
      linkKey: string;
      edgeType: string;
      fromRefType: string;
      fromRefId: string;
      toRefType: string;
      toRefId: string;
      status: string;
    }>
  > {
    return this.prisma.vkKnowledgeLink.findMany({
      where: { edgeType: { in: edgeTypes } },
      select: {
        id: true,
        linkKey: true,
        edgeType: true,
        fromRefType: true,
        fromRefId: true,
        toRefType: true,
        toRefId: true,
        status: true,
      },
    });
  }

  async countByEdgeTypes(edgeTypes: string[]): Promise<number> {
    return this.prisma.vkKnowledgeLink.count({
      where: { edgeType: { in: edgeTypes } },
    });
  }

  async findDuplicateEdgeGroups(limit = 50): Promise<
    Array<{
      edgeType: string;
      fromRefId: string;
      toRefId: string;
      count: number;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{ edgeType: string; fromRefId: string; toRefId: string; count: bigint }>
    >`
      SELECT "edgeType", "fromRefId", "toRefId", COUNT(*)::bigint AS count
      FROM vk_knowledge_links
      GROUP BY "edgeType", "fromRefId", "toRefId"
      HAVING COUNT(*) > 1
      ORDER BY count DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      edgeType: r.edgeType,
      fromRefId: r.fromRefId,
      toRefId: r.toRefId,
      count: Number(r.count),
    }));
  }

  async getTopConnectedEndpoints(limit = 20): Promise<
    Array<{ refType: string; refId: string; degree: number }>
  > {
    const rows = await this.prisma.$queryRaw<
      Array<{ refType: string; refId: string; degree: bigint }>
    >`
      WITH endpoints AS (
        SELECT "fromRefType" AS ref_type, "fromRefId" AS ref_id FROM vk_knowledge_links
        UNION ALL
        SELECT "toRefType", "toRefId" FROM vk_knowledge_links
      )
      SELECT ref_type AS "refType", ref_id AS "refId", COUNT(*)::bigint AS degree
      FROM endpoints
      GROUP BY ref_type, ref_id
      ORDER BY degree DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      refType: r.refType,
      refId: r.refId,
      degree: Number(r.degree),
    }));
  }

  async listEndpointDegrees(): Promise<Map<string, number>> {
    const top = await this.getTopConnectedEndpoints(5000);
    const map = new Map<string, number>();
    for (const row of top) {
      map.set(`${row.refType}:${row.refId}`, row.degree);
    }
    return map;
  }

  async neighborsForBenchmark(params: {
    refType: string;
    refId: string;
    statuses: string[];
    limit: number;
  }): Promise<number> {
    const rows = await this.prisma.vkKnowledgeLink.findMany({
      where: {
        status: { in: params.statuses as never[] },
        OR: [
          { fromRefType: params.refType as never, fromRefId: params.refId },
          { toRefType: params.refType as never, toRefId: params.refId },
        ],
      },
      take: params.limit,
      select: { id: true },
    });
    return rows.length;
  }

  async findSamplePublishedDiseaseSlug(): Promise<string | null> {
    const row = await this.prisma.vkKnowledgeLink.findFirst({
      where: {
        status: 'PUBLISHED',
        fromRefType: 'DISEASE',
      },
      select: { fromRefId: true },
    });
    if (row) return row.fromRefId;
    const draft = await this.prisma.vkKnowledgeLink.findFirst({
      where: { fromRefType: 'DISEASE' },
      select: { fromRefId: true },
    });
    return draft?.fromRefId ?? null;
  }

  async recordAudit(eventType: string, detail: Record<string, unknown>, linkId?: string): Promise<void> {
    await this.prisma.vkKnowledgeLinkAuditEvent.create({
      data: {
        linkId: linkId ?? null,
        eventType,
        detailJson: detail as Prisma.InputJsonValue,
      },
    });
  }

  private toView(row: {
    id: string;
    linkKey: string;
    edgeType: string;
    edgeClass: UvkgLinkView['edgeClass'];
    fromRefType: UvkgLinkView['fromRefType'];
    fromRefId: string;
    toRefType: UvkgLinkView['toRefType'];
    toRefId: string;
    weight: number;
    status: UvkgLinkView['status'];
    sourceSystem: UvkgLinkView['sourceSystem'];
    sourceEdgeId: string | null;
  }): UvkgLinkView {
    return {
      id: row.id,
      linkKey: row.linkKey,
      edgeType: row.edgeType,
      edgeClass: row.edgeClass,
      fromRefType: row.fromRefType,
      fromRefId: row.fromRefId,
      toRefType: row.toRefType,
      toRefId: row.toRefId,
      weight: row.weight,
      status: row.status,
      sourceSystem: row.sourceSystem,
      sourceEdgeId: row.sourceEdgeId,
    };
  }
}

let repository: KnowledgeLinkRepository | undefined;

export function getKnowledgeLinkRepository(): KnowledgeLinkRepository {
  repository ??= new KnowledgeLinkRepository();
  return repository;
}

export function resetKnowledgeLinkRepositoryForTests(): void {
  repository = undefined;
}
