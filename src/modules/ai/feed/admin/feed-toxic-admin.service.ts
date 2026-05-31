import { VkVersionStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { FEED_ENTITY_TYPES } from '../../feed-knowledge/feed-knowledge.constants.js';
import { getFeedKnowledgeGovernanceService } from '../../feed-knowledge/feed-knowledge-governance.service.js';
import { recordFeedAdminAudit } from './feed-admin-audit.service.js';
import { buildFeedEntityListWhere } from './feed-admin-list.query.js';
import type {
  createToxicAlertSchema,
  listToxicAlertsQuerySchema,
  updateToxicAlertSchema,
} from './feed-admin.schemas.js';
import type { z } from 'zod';

const TOXIC_ENTITY_TYPE = FEED_ENTITY_TYPES[3];

type ListQuery = z.infer<typeof listToxicAlertsQuerySchema>;
type CreateInput = z.infer<typeof createToxicAlertSchema>;
type UpdateInput = z.infer<typeof updateToxicAlertSchema>;

export type ToxicAlertAdminListItem = {
  entityId: string;
  slug: string;
  substance: string;
  titleBn: string;
  titleEn: string;
  status: VkVersionStatus;
  versionId: string;
  versionNumber: number;
  vetRequired: boolean;
  publishedAt: string | null;
  updatedAt: string;
};

export type ToxicAlertAdminDetail = ToxicAlertAdminListItem & {
  commonNamesBn: string[];
  commonNamesEn: string[];
  speciesAffected: string[];
  toxicThreshold: string;
  lethalThreshold: string | null;
  clinicalSignsBn: string[];
  clinicalSignsEn: string[];
  immediateActionBn: string;
  immediateActionEn: string;
  bodyBn: string;
  bodyEn: string;
  relatedIngredientCodes: string[];
};

export class FeedToxicAdminService {
  readonly name = 'FeedToxicAdminService';
  private prisma = getPrisma();

  async list(params: ListQuery): Promise<{ items: ToxicAlertAdminListItem[]; total: number }> {
    const where = buildFeedEntityListWhere('TOXIC_FEED_ALERT', params);

    const [entities, total] = await Promise.all([
      this.prisma.vkKnowledgeEntity.findMany({
        where,
        include: {
          publishedVersion: { include: { toxicFeedAlerts: true } },
          draftVersion: { include: { toxicFeedAlerts: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.vkKnowledgeEntity.count({ where }),
    ]);

    const items: ToxicAlertAdminListItem[] = [];

    for (const entity of entities) {
      const version = entity.draftVersion ?? entity.publishedVersion;
      const alert = version?.toxicFeedAlerts[0];
      if (!version || !alert) continue;

      items.push({
        entityId: entity.id,
        slug: entity.slug,
        substance: alert.substance,
        titleBn: version.titleBn,
        titleEn: version.titleEn,
        status: version.status,
        versionId: version.id,
        versionNumber: version.versionNumber,
        vetRequired: alert.vetRequired,
        publishedAt: version.publishedAt?.toISOString() ?? null,
        updatedAt: entity.updatedAt.toISOString(),
      });
    }

    return { items, total };
  }

  async get(entityId: string): Promise<ToxicAlertAdminDetail> {
    const entity = await this.prisma.vkKnowledgeEntity.findFirst({
      where: { id: entityId, entityType: TOXIC_ENTITY_TYPE },
      include: {
        publishedVersion: { include: { toxicFeedAlerts: true } },
        draftVersion: { include: { toxicFeedAlerts: true } },
      },
    });
    if (!entity) throw new Error('Toxic feed alert not found');

    const version = entity.draftVersion ?? entity.publishedVersion;
    const alert = version?.toxicFeedAlerts[0];
    if (!version || !alert) throw new Error('Toxic alert version not found');

    return {
      entityId: entity.id,
      slug: entity.slug,
      substance: alert.substance,
      titleBn: version.titleBn,
      titleEn: version.titleEn,
      status: version.status,
      versionId: version.id,
      versionNumber: version.versionNumber,
      vetRequired: alert.vetRequired,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      updatedAt: entity.updatedAt.toISOString(),
      commonNamesBn: alert.commonNamesBn,
      commonNamesEn: alert.commonNamesEn,
      speciesAffected: alert.speciesAffected,
      toxicThreshold: alert.toxicThreshold,
      lethalThreshold: alert.lethalThreshold,
      clinicalSignsBn: alert.clinicalSignsBn,
      clinicalSignsEn: alert.clinicalSignsEn,
      immediateActionBn: alert.immediateActionBn,
      immediateActionEn: alert.immediateActionEn,
      bodyBn: version.bodyBn,
      bodyEn: version.bodyEn,
      relatedIngredientCodes: alert.relatedIngredientCodes,
    };
  }

  async create(input: CreateInput, actorId: string): Promise<{ entityId: string; versionId: string }> {
    const result = await getFeedKnowledgeGovernanceService().createToxicFeedAlertDraft({
      substance: input.substance,
      commonNamesBn: input.commonNamesBn,
      commonNamesEn: input.commonNamesEn,
      speciesAffected: input.speciesAffected,
      toxicThreshold: input.toxicThreshold,
      lethalThreshold: input.lethalThreshold,
      clinicalSignsBn: input.clinicalSignsBn,
      clinicalSignsEn: input.clinicalSignsEn,
      immediateActionBn: input.immediateActionBn,
      immediateActionEn: input.immediateActionEn,
      relatedIngredientCodes: input.relatedIngredientCodes,
      createdById: actorId,
      titleBn: input.titleBn,
      titleEn: input.titleEn,
      summaryBn: input.summaryBn,
      summaryEn: input.summaryEn,
      bodyBn: input.bodyBn,
      bodyEn: input.bodyEn,
      species: input.species,
      keywordsBn: input.keywordsBn,
      keywordsEn: input.keywordsEn,
      colloquialBn: input.colloquialBn,
    });

    await recordFeedAdminAudit({
      entityId: result.entityId,
      versionId: result.versionId,
      eventType: 'TOXIC_ALERT_CREATED',
      actorId,
      detail: { substance: input.substance },
    });

    return result;
  }

  async update(entityId: string, input: UpdateInput, actorId: string): Promise<ToxicAlertAdminDetail> {
    const entity = await this.prisma.vkKnowledgeEntity.findFirst({
      where: { id: entityId, entityType: TOXIC_ENTITY_TYPE },
      include: { draftVersion: { include: { toxicFeedAlerts: true } } },
    });
    if (!entity?.draftVersion?.toxicFeedAlerts[0]) {
      throw new Error('No editable draft version');
    }
    if (entity.draftVersion.status !== VkVersionStatus.DRAFT) {
      throw new Error('Only DRAFT versions can be edited');
    }

    const versionId = entity.draftVersion.id;
    const alert = entity.draftVersion.toxicFeedAlerts[0]!;

    await this.prisma.$transaction(async (tx) => {
      await tx.vkKnowledgeVersion.update({
        where: { id: versionId },
        data: {
          ...(input.titleBn && { titleBn: input.titleBn }),
          ...(input.titleEn && { titleEn: input.titleEn }),
          ...(input.summaryBn !== undefined && { summaryBn: input.summaryBn }),
          ...(input.summaryEn !== undefined && { summaryEn: input.summaryEn }),
          ...(input.bodyBn && { bodyBn: input.bodyBn }),
          ...(input.bodyEn && { bodyEn: input.bodyEn }),
          ...(input.species && { species: input.species }),
        },
      });

      await tx.vkToxicFeedAlert.update({
        where: { id: alert.id },
        data: {
          ...(input.substance && { substance: input.substance }),
          ...(input.commonNamesBn && { commonNamesBn: input.commonNamesBn }),
          ...(input.commonNamesEn && { commonNamesEn: input.commonNamesEn }),
          ...(input.speciesAffected && { speciesAffected: input.speciesAffected }),
          ...(input.toxicThreshold && { toxicThreshold: input.toxicThreshold }),
          ...(input.lethalThreshold !== undefined && { lethalThreshold: input.lethalThreshold }),
          ...(input.clinicalSignsBn && { clinicalSignsBn: input.clinicalSignsBn }),
          ...(input.clinicalSignsEn && { clinicalSignsEn: input.clinicalSignsEn }),
          ...(input.onsetTime !== undefined && { onsetTime: input.onsetTime }),
          ...(input.immediateActionBn && { immediateActionBn: input.immediateActionBn }),
          ...(input.immediateActionEn && { immediateActionEn: input.immediateActionEn }),
          ...(input.relatedIngredientCodes && {
            relatedIngredientCodes: input.relatedIngredientCodes,
          }),
        },
      });
    });

    await recordFeedAdminAudit({
      entityId,
      versionId,
      eventType: 'TOXIC_ALERT_UPDATED',
      actorId,
    });

    return this.get(entityId);
  }

  async submitForReview(entityId: string, actorId: string, notes?: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().submitForReview(entityId, actorId, notes);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'TOXIC_ALERT_SUBMITTED',
      actorId,
      detail: { notes },
    });
  }

  async review(entityId: string, actorId: string, approved: boolean, notes?: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().completeEditorialReview(
      entityId,
      actorId,
      approved,
      notes,
    );
    await recordFeedAdminAudit({
      entityId,
      eventType: approved ? 'TOXIC_ALERT_REVIEW_APPROVED' : 'TOXIC_ALERT_REVIEW_REJECTED',
      actorId,
      detail: { notes },
    });
  }

  async approve(entityId: string, actorId: string, notes?: string): Promise<void> {
    const entity = await this.prisma.vkKnowledgeEntity.findUnique({
      where: { id: entityId },
      include: { draftVersion: true },
    });
    if (!entity?.draftVersion) throw new Error('No draft version');

    if (entity.draftVersion.status !== VkVersionStatus.VET_APPROVAL) {
      throw new Error('Alert must complete editorial review before vet approval');
    }

    await this.prisma.vkKnowledgeApproval.create({
      data: {
        versionId: entity.draftVersion.id,
        approverVetId: actorId,
        approvalScope: ['FEED', 'TOXIC'],
        notes,
      },
    });

    await recordFeedAdminAudit({
      entityId,
      versionId: entity.draftVersion.id,
      eventType: 'TOXIC_ALERT_VET_APPROVED',
      actorId,
      detail: { notes },
    });
  }

  async publish(entityId: string, actorId: string, notes?: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().approveAndPublish(entityId, actorId, notes);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'TOXIC_ALERT_PUBLISHED',
      actorId,
      detail: { notes },
    });
  }

  async reject(entityId: string, actorId: string, reason: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().rejectVersion(entityId, actorId, reason);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'TOXIC_ALERT_REJECTED',
      actorId,
      detail: { reason },
    });
  }
}

let toxicService: FeedToxicAdminService | undefined;

export function getFeedToxicAdminService(): FeedToxicAdminService {
  if (!toxicService) toxicService = new FeedToxicAdminService();
  return toxicService;
}

export function resetFeedToxicAdminServiceForTests(): void {
  toxicService = undefined;
}
