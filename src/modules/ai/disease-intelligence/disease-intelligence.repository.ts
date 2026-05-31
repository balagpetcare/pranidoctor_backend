import { createHash } from 'node:crypto';

import type { Prisma } from '../../../generated/prisma/index.js';
import type {
  DiAnalyticsEventType,
  DiDiseaseStatus,
  DiGraphEdgeStatus,
  DiSafetyDecisionAction,
  DiVetReviewStatus,
  LivestockSpecies,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';

type PrismaClient = ReturnType<typeof getPrisma>;

export class DiseaseIntelligenceRepository {
  constructor(private readonly prisma: PrismaClient = getPrisma()) {}

  async searchRegistry(params: {
    q?: string;
    species?: LivestockSpecies;
    status?: DiDiseaseStatus;
    take?: number;
    skip?: number;
  }) {
    const where: Prisma.DiDiseaseRegistryWhereInput = {
      status: params.status ?? 'ACTIVE',
    };
    if (params.species) {
      where.speciesMatrix = { some: { species: params.species } };
    }
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { labelBn: { contains: q, mode: 'insensitive' } },
        { labelEn: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    return this.prisma.diDiseaseRegistry.findMany({
      where,
      include: { speciesMatrix: true, aliases: true },
      orderBy: { labelEn: 'asc' },
      take: params.take ?? 50,
      skip: params.skip ?? 0,
    });
  }

  async getRegistryByCode(code: string) {
    return this.prisma.diDiseaseRegistry.findUnique({
      where: { code },
      include: { speciesMatrix: true, aliases: true, versionPointers: { orderBy: { effectiveFrom: 'desc' }, take: 1 } },
    });
  }

  async getRegistryBySlug(slug: string) {
    return this.prisma.diDiseaseRegistry.findUnique({
      where: { slug },
      include: { speciesMatrix: true, aliases: true },
    });
  }

  async createRegistry(data: Prisma.DiDiseaseRegistryCreateInput) {
    return this.prisma.diDiseaseRegistry.create({ data });
  }

  async updateRegistry(id: string, data: Prisma.DiDiseaseRegistryUpdateInput) {
    return this.prisma.diDiseaseRegistry.update({ where: { id }, data });
  }

  async listGraphNeighbors(params: {
    nodeRef: string;
    nodeKind: 'DISEASE' | 'SYMPTOM';
    edgeTypes?: string[];
    species?: LivestockSpecies;
    status?: DiGraphEdgeStatus;
  }) {
    const node = await this.prisma.diGraphNode.findUnique({
      where: { nodeKind_refId: { nodeKind: params.nodeKind, refId: params.nodeRef } },
    });
    if (!node) return [];

    const edgeWhere: Prisma.DiGraphEdgeWhereInput = {
      status: params.status ?? 'PUBLISHED',
      fromNodeId: node.id,
    };
    if (params.edgeTypes?.length) edgeWhere.edgeType = { in: params.edgeTypes };
    if (params.species) {
      edgeWhere.OR = [{ species: { isEmpty: true } }, { species: { has: params.species } }];
    }

    return this.prisma.diGraphEdge.findMany({
      where: edgeWhere,
      include: { toNode: true, evidence: true },
      take: 100,
    });
  }

  async loadGraphDifferentialsBySymptomCodes(symptomCodes: string[], species: LivestockSpecies) {
    const symptomNodes = await this.prisma.diGraphNode.findMany({
      where: { nodeKind: 'SYMPTOM', refId: { in: symptomCodes } },
    });
    if (symptomNodes.length === 0) return [];

    const edges = await this.prisma.diGraphEdge.findMany({
      where: {
        edgeType: 'HAS_SYMPTOM',
        status: 'PUBLISHED',
        toNodeId: { in: symptomNodes.map((n) => n.id) },
        OR: [{ species: { isEmpty: true } }, { species: { has: species } }],
      },
      include: {
        fromNode: { include: { registry: true } },
        toNode: true,
      },
    });

    return edges;
  }

  async upsertSymptomFromLegacy(node: {
    id: string;
    code: string;
    species: LivestockSpecies[];
    bodySystem: string;
    labelBn: string;
    labelEn: string;
    redFlag: boolean;
    weight: number;
  }) {
    return this.prisma.diSymptomTaxonomy.upsert({
      where: { code: node.code },
      create: {
        code: node.code,
        species: node.species,
        bodySystem: node.bodySystem,
        labelBn: node.labelBn,
        labelEn: node.labelEn,
        redFlag: node.redFlag,
        weight: node.weight,
        legacyNodeId: node.id,
      },
      update: {
        labelBn: node.labelBn,
        labelEn: node.labelEn,
        redFlag: node.redFlag,
        weight: node.weight,
      },
    });
  }

  async searchSymptoms(params: { q?: string; species: LivestockSpecies }) {
    const where: Prisma.DiSymptomTaxonomyWhereInput = {
      species: { has: params.species },
    };
    if (params.q?.trim()) {
      const q = params.q.trim();
      where.OR = [
        { labelBn: { contains: q, mode: 'insensitive' } },
        { labelEn: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { colloquials: { some: { phrase: { contains: q, mode: 'insensitive' } } } },
      ];
    }
    return this.prisma.diSymptomTaxonomy.findMany({
      where,
      orderBy: [{ bodySystem: 'asc' }, { labelEn: 'asc' }],
      take: 50,
    });
  }

  async getSymptomTaxonomyBySpecies(species: LivestockSpecies) {
    return this.prisma.diSymptomTaxonomy.findMany({
      where: { species: { has: species } },
      orderBy: [{ bodySystem: 'asc' }, { labelEn: 'asc' }],
    });
  }

  async resolveSymptomCodesFromText(phrases: string[], locale: string) {
    if (phrases.length === 0) return [];
    const found = await this.prisma.diSymptomColloquial.findMany({
      where: {
        locale,
        OR: phrases.map((p) => ({ phrase: { contains: p.trim(), mode: 'insensitive' } })),
      },
      select: { symptomCode: true },
    });
    return [...new Set(found.map((f) => f.symptomCode))];
  }

  async getPrevalenceModifiers(registryIds: string[], species: LivestockSpecies, divisionId?: string) {
    return this.prisma.diPrevalenceTable.findMany({
      where: {
        registryId: { in: registryIds },
        species,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        ...(divisionId ? { OR: [{ divisionId }, { divisionId: null }] } : {}),
      },
    });
  }

  async listOutbreakSignals(params: { diseaseSlug?: string; divisionId?: string; since?: Date }) {
    return this.prisma.diOutbreakSignal.findMany({
      where: {
        ...(params.diseaseSlug ? { diseaseSlug: params.diseaseSlug } : {}),
        ...(params.divisionId ? { divisionId: params.divisionId } : {}),
        ...(params.since ? { effectiveDate: { gte: params.since } } : {}),
      },
      orderBy: { effectiveDate: 'desc' },
      take: 100,
      include: { registry: true },
    });
  }

  async createOutbreakSignal(data: Prisma.DiOutbreakSignalCreateInput) {
    return this.prisma.diOutbreakSignal.create({ data });
  }

  async getActiveSafetyPolicy() {
    return this.prisma.diSafetyPolicy.findUnique({
      where: { version: 'die-v1' },
    });
  }

  async logSafetyEvaluation(params: {
    caseId?: string;
    policyVersion: string;
    action: DiSafetyDecisionAction;
    reasonCodes: string[];
  }) {
    return this.prisma.diSafetyEvaluationLog.create({
      data: omitUndefined({
        caseId: params.caseId,
        policyVersion: params.policyVersion,
        action: params.action,
        reasonCodesJson: params.reasonCodes,
      }),
    });
  }

  async createCaseSession(data: Prisma.DiCaseSessionCreateInput) {
    return this.prisma.diCaseSession.create({ data });
  }

  async getCaseSession(id: string, userId: string) {
    return this.prisma.diCaseSession.findFirst({
      where: { id, userId },
      include: { turns: { orderBy: { turnIndex: 'asc' } }, escalations: true },
    });
  }

  async updateCaseSession(id: string, data: Prisma.DiCaseSessionUpdateInput) {
    return this.prisma.diCaseSession.update({ where: { id }, data });
  }

  async findSymptomsByCodes(codes: string[], species: LivestockSpecies) {
    return this.prisma.diSymptomTaxonomy.findMany({
      where: { code: { in: codes }, species: { has: species } },
    });
  }

  async appendCaseTurn(params: {
    caseId: string;
    turnIndex: number;
    retrievalPackId?: string;
    routingJson?: unknown;
    inputJson?: unknown;
    outputJson?: unknown;
    safetyAction?: DiSafetyDecisionAction;
  }) {
    return this.prisma.diCaseTurn.create({
      data: omitUndefined({
        caseId: params.caseId,
        turnIndex: params.turnIndex,
        retrievalPackId: params.retrievalPackId,
        routingJson: params.routingJson as Prisma.InputJsonValue | undefined,
        inputJson: params.inputJson as Prisma.InputJsonValue | undefined,
        outputJson: params.outputJson as Prisma.InputJsonValue | undefined,
        safetyAction: params.safetyAction,
      }),
    });
  }

  async saveDifferentialRun(params: {
    caseId?: string;
    inputs: unknown;
    output: unknown;
    candidates: Array<{
      registryId?: string;
      slug: string;
      rank: number;
      score: number;
      reasonCodes: string[];
      citations: string[];
    }>;
  }) {
    const inputsHash = createHash('sha256').update(JSON.stringify(params.inputs)).digest('hex').slice(0, 64);
    return this.prisma.diDifferentialRun.create({
      data: omitUndefined({
        caseId: params.caseId,
        inputsHash,
        outputJson: params.output as Prisma.InputJsonValue,
        candidates: {
          create: params.candidates.map((c) =>
            omitUndefined({
              ...(c.registryId ? { registryId: c.registryId } : {}),
              slug: c.slug,
              rank: c.rank,
              score: c.score,
              reasonCodesJson: c.reasonCodes,
              citationsJson: c.citations,
            }),
          ),
        },
      }),
      include: { candidates: true },
    });
  }

  async ingestAnalyticsEvent(params: {
    eventType: DiAnalyticsEventType;
    caseId?: string;
    registryId?: string;
    metadata?: unknown;
  }) {
    return this.prisma.diAnalyticsEvent.create({
      data: omitUndefined({
        eventType: params.eventType,
        caseId: params.caseId,
        registryId: params.registryId,
        metadataJson: params.metadata as Prisma.InputJsonValue | undefined,
      }),
    });
  }

  async listVetReviewQueue(vetId: string, status?: DiVetReviewStatus) {
    return this.prisma.diVetCaseReview.findMany({
      where: { vetId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { case: true },
    });
  }

  async createVetReview(caseId: string, vetId: string) {
    return this.prisma.diVetCaseReview.create({
      data: { caseId, vetId, status: 'PENDING' },
    });
  }

  async createCorpusGapTicket(params: {
    queryText: string;
    locale: string;
    species?: LivestockSpecies;
    metadata?: unknown;
  }) {
    return this.prisma.diCorpusGapTicket.create({
      data: omitUndefined({
        queryText: params.queryText,
        locale: params.locale,
        species: params.species,
        metadataJson: params.metadata as Prisma.InputJsonValue | undefined,
      }),
    });
  }

  async syncLegacyOutbreakSignals() {
    const legacy = await this.prisma.regionalOutbreakSignal.findMany({ take: 500 });
    for (const row of legacy) {
      const existing = await this.prisma.diOutbreakSignal.findUnique({
        where: { legacyRegionalId: row.id },
      });
      if (existing) continue;
      const registry = await this.prisma.diDiseaseRegistry.findUnique({ where: { slug: row.diseaseSlug } });
      await this.prisma.diOutbreakSignal.create({
        data: omitUndefined({
          diseaseSlug: row.diseaseSlug,
          ...(registry?.id ? { registryId: registry.id } : {}),
          ...(row.divisionId ? { divisionId: row.divisionId } : {}),
          ...(row.districtId ? { districtId: row.districtId } : {}),
          riskIndex: row.riskIndex,
          effectiveDate: row.effectiveDate,
          source: 'LEGACY' as const,
          ...(row.notes ? { notes: row.notes } : {}),
          legacyRegionalId: row.id,
        }),
      });
    }
    return legacy.length;
  }

  async migrateSymptomGraphFromLegacy() {
    const legacyNodes = await this.prisma.aiSymptomNode.findMany({
      include: { diseaseLinks: { include: { knowledgeEntry: true } } },
    });
    let edgeCount = 0;
    for (const node of legacyNodes) {
      await this.upsertSymptomFromLegacy(node);
      const symptomGraphNode = await this.prisma.diGraphNode.upsert({
        where: { nodeKind_refId: { nodeKind: 'SYMPTOM', refId: node.code } },
        create: {
          nodeKind: 'SYMPTOM',
          refId: node.code,
          labelBn: node.labelBn,
          labelEn: node.labelEn,
          legacySymptomNodeId: node.id,
        },
        update: { labelBn: node.labelBn, labelEn: node.labelEn },
      });

      for (const link of node.diseaseLinks) {
        if (link.knowledgeEntry.status !== 'PUBLISHED') continue;
        let registry = await this.prisma.diDiseaseRegistry.findUnique({
          where: { slug: link.knowledgeEntry.slug },
        });
        if (!registry) {
          registry = await this.prisma.diDiseaseRegistry.create({
            data: {
              code: link.knowledgeEntry.slug.toUpperCase().replace(/-/g, '_').slice(0, 32),
              slug: link.knowledgeEntry.slug,
              labelBn: link.knowledgeEntry.titleBn,
              labelEn: link.knowledgeEntry.titleEn,
              category: 'OTHER',
              status: 'ACTIVE',
              legacyKnowledgeEntryId: link.knowledgeEntryId,
            },
          });
        }
        const diseaseNode = await this.prisma.diGraphNode.upsert({
          where: { nodeKind_refId: { nodeKind: 'DISEASE', refId: registry.slug } },
          create: {
            nodeKind: 'DISEASE',
            refId: registry.slug,
            labelBn: registry.labelBn,
            labelEn: registry.labelEn,
            registryId: registry.id,
          },
          update: { registryId: registry.id },
        });

        const graphEdge = await this.prisma.diGraphEdge.upsert({
          where: {
            fromNodeId_toNodeId_edgeType: {
              fromNodeId: diseaseNode.id,
              toNodeId: symptomGraphNode.id,
              edgeType: 'HAS_SYMPTOM',
            },
          },
          create: {
            fromNodeId: diseaseNode.id,
            toNodeId: symptomGraphNode.id,
            edgeType: 'HAS_SYMPTOM',
            weight: link.edgeWeight * node.weight,
            species: node.species,
            status: 'PUBLISHED',
          },
          update: { weight: link.edgeWeight * node.weight, status: 'PUBLISHED' },
          include: { fromNode: true, toNode: true },
        });

        const { getUvkgDualWriteService } = await import('../uvkg/services/uvkg-dual-write.service.js');
        void getUvkgDualWriteService()
          .afterDiseaseGraphEdge(
            omitUndefined({
              legacyEdgeId: graphEdge.id,
              edgeType: graphEdge.edgeType,
              fromNodeKind: graphEdge.fromNode.nodeKind,
              fromRefId: graphEdge.fromNode.refId,
              toNodeKind: graphEdge.toNode.nodeKind,
              toRefId: graphEdge.toNode.refId,
              weight: graphEdge.weight,
              species: graphEdge.species,
              evidenceLevel: graphEdge.evidenceLevel,
              vkVersionId: graphEdge.vkVersionId ?? undefined,
              legacyStatus: graphEdge.status,
            }),
          )
          .catch(() => undefined);

        edgeCount += 1;
      }
    }
    return { nodes: legacyNodes.length, edges: edgeCount };
  }
}

let repository: DiseaseIntelligenceRepository | undefined;

export function getDiseaseIntelligenceRepository(): DiseaseIntelligenceRepository {
  repository ??= new DiseaseIntelligenceRepository();
  return repository;
}
