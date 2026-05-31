import {
  VkKnowledgeDomain,
  VkReviewStage,
  VkVersionStatus,
  type Prisma,
} from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import type { FeedIngredientInput } from '../../feed-knowledge/feed-knowledge.types.js';
import { getFeedKnowledgeGovernanceService } from '../../feed-knowledge/feed-knowledge-governance.service.js';
import { recordFeedAdminAudit } from './feed-admin-audit.service.js';
import { buildFeedEntityListWhere } from './feed-admin-list.query.js';
import type {
  createFeedIngredientSchema,
  listFeedIngredientsQuerySchema,
  updateFeedIngredientSchema,
} from './feed-admin.schemas.js';
import type { z } from 'zod';

type ListQuery = z.infer<typeof listFeedIngredientsQuerySchema>;
type CreateInput = z.infer<typeof createFeedIngredientSchema>;
type UpdateInput = z.infer<typeof updateFeedIngredientSchema>;

export type FeedIngredientAdminListItem = {
  entityId: string;
  slug: string;
  ingredientCode: string;
  titleBn: string;
  titleEn: string;
  status: VkVersionStatus;
  versionId: string;
  versionNumber: number;
  bdAvailability: string;
  publishedAt: string | null;
  updatedAt: string;
};

export type FeedIngredientAdminDetail = FeedIngredientAdminListItem & {
  localNamesBn: string[];
  localNamesEn: string[];
  composition: Record<string, number | undefined>;
  species: string[];
  bodyBn: string;
  bodyEn: string;
  draftVersionId: string | null;
  publishedVersionId: string | null;
};

function toIngredientPayload(body: CreateInput | UpdateInput): FeedIngredientInput | null {
  if (!body.ingredientCode || !body.composition || !body.localNamesBn || !body.bdAvailability) {
    return null;
  }
  return {
    ingredientCode: body.ingredientCode,
    localNamesBn: body.localNamesBn,
    localNamesEn: body.localNamesEn,
    composition: body.composition,
    bdAvailability: body.bdAvailability,
    avgPriceBdtPerKg: body.avgPriceBdtPerKg,
    priceVolatility: body.priceVolatility,
    speciesRestrictions: body.speciesRestrictions,
    feedItemId: body.feedItemId,
  };
}

export class FeedIngredientAdminService {
  readonly name = 'FeedIngredientAdminService';
  private prisma = getPrisma();

  async list(params: ListQuery): Promise<{ items: FeedIngredientAdminListItem[]; total: number }> {
    const where = buildFeedEntityListWhere('FEED_INGREDIENT', params);

    const [entities, total] = await Promise.all([
      this.prisma.vkKnowledgeEntity.findMany({
        where,
        include: {
          publishedVersion: { include: { feedIngredients: true } },
          draftVersion: { include: { feedIngredients: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: params.limit,
        skip: params.offset,
      }),
      this.prisma.vkKnowledgeEntity.count({ where }),
    ]);

    const items: FeedIngredientAdminListItem[] = [];
    for (const entity of entities) {
      const version = entity.draftVersion ?? entity.publishedVersion;
      const feedIngredient = version?.feedIngredients[0];
      if (!version || !feedIngredient) continue;
      items.push({
        entityId: entity.id,
        slug: entity.slug,
        ingredientCode: feedIngredient.ingredientCode,
        titleBn: version.titleBn,
        titleEn: version.titleEn,
        status: version.status,
        versionId: version.id,
        versionNumber: version.versionNumber,
        bdAvailability: feedIngredient.bdAvailability,
        publishedAt: version.publishedAt?.toISOString() ?? null,
        updatedAt: entity.updatedAt.toISOString(),
      });
    }

    return { items, total };
  }

  async get(entityId: string): Promise<FeedIngredientAdminDetail> {
    const entity = await this.prisma.vkKnowledgeEntity.findFirst({
      where: {
        id: entityId,
        domain: VkKnowledgeDomain.FEED,
        entityType: 'FEED_INGREDIENT',
      },
      include: {
        publishedVersion: { include: { feedIngredients: true } },
        draftVersion: { include: { feedIngredients: true } },
      },
    });
    if (!entity) throw new Error('Feed ingredient not found');

    const version = entity.draftVersion ?? entity.publishedVersion;
    const ing = version?.feedIngredients[0];
    if (!ing) throw new Error('Feed ingredient version not found');
    return {
      entityId: entity.id,
      slug: entity.slug,
      ingredientCode: ing.ingredientCode,
      titleBn: version.titleBn,
      titleEn: version.titleEn,
      status: version.status,
      versionId: version.id,
      versionNumber: version.versionNumber,
      bdAvailability: ing.bdAvailability,
      publishedAt: version.publishedAt?.toISOString() ?? null,
      updatedAt: entity.updatedAt.toISOString(),
      localNamesBn: ing.localNamesBn,
      localNamesEn: ing.localNamesEn,
      composition: {
        dmPercent: Number(ing.dmPercent),
        cpPercent: ing.cpPercent != null ? Number(ing.cpPercent) : undefined,
        tdnPercent: ing.tdnPercent != null ? Number(ing.tdnPercent) : undefined,
        ndfPercent: ing.ndfPercent != null ? Number(ing.ndfPercent) : undefined,
        adfPercent: ing.adfPercent != null ? Number(ing.adfPercent) : undefined,
        meValueMjPerKg: ing.meValueMjPerKg != null ? Number(ing.meValueMjPerKg) : undefined,
        caPercent: ing.caPercent != null ? Number(ing.caPercent) : undefined,
        pPercent: ing.pPercent != null ? Number(ing.pPercent) : undefined,
        cfPercent: ing.cfPercent != null ? Number(ing.cfPercent) : undefined,
        eePercent: ing.eePercent != null ? Number(ing.eePercent) : undefined,
        ashPercent: ing.ashPercent != null ? Number(ing.ashPercent) : undefined,
      },
      species: version.species,
      bodyBn: version.bodyBn,
      bodyEn: version.bodyEn,
      draftVersionId: entity.currentDraftVersionId,
      publishedVersionId: entity.currentPublishedVersionId,
    };
  }

  async create(input: CreateInput, actorId: string): Promise<{ entityId: string; versionId: string }> {
    const payload = toIngredientPayload(input);
    if (!payload) throw new Error('Invalid ingredient payload');

    const result = await getFeedKnowledgeGovernanceService().createFeedIngredientDraft({
      ...payload,
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
      eventType: 'FEED_INGREDIENT_CREATED',
      actorId,
      detail: { ingredientCode: input.ingredientCode },
    });

    return result;
  }

  async update(entityId: string, input: UpdateInput, actorId: string): Promise<FeedIngredientAdminDetail> {
    const entity = await this.prisma.vkKnowledgeEntity.findFirst({
      where: { id: entityId, entityType: 'FEED_INGREDIENT' },
      include: { draftVersion: { include: { feedIngredients: true } } },
    });
    if (!entity?.draftVersion?.feedIngredients[0]) {
      throw new Error('No editable draft version; create a new draft from published content first');
    }
    if (entity.draftVersion.status !== VkVersionStatus.DRAFT) {
      throw new Error('Only DRAFT versions can be edited');
    }

    const versionId = entity.draftVersion.id;
    const ing = entity.draftVersion.feedIngredients[0]!;

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
          ...(input.keywordsBn && { keywordsBn: input.keywordsBn }),
          ...(input.keywordsEn && { keywordsEn: input.keywordsEn }),
          ...(input.colloquialBn && { colloquialBn: input.colloquialBn }),
        },
      });

      if (input.composition || input.bdAvailability || input.localNamesBn) {
        await tx.vkFeedIngredient.update({
          where: { id: ing.id },
          data: {
            ...(input.localNamesBn && { localNamesBn: input.localNamesBn }),
            ...(input.localNamesEn && { localNamesEn: input.localNamesEn }),
            ...(input.bdAvailability && { bdAvailability: input.bdAvailability }),
            ...(input.avgPriceBdtPerKg !== undefined && { avgPriceBdtPerKg: input.avgPriceBdtPerKg }),
            ...(input.priceVolatility && { priceVolatility: input.priceVolatility }),
            ...(input.speciesRestrictions && { speciesRestrictions: input.speciesRestrictions }),
            ...(input.feedItemId !== undefined && { feedItemId: input.feedItemId }),
            ...(input.composition?.dmPercent !== undefined && { dmPercent: input.composition.dmPercent }),
            ...(input.composition?.cpPercent !== undefined && { cpPercent: input.composition.cpPercent }),
            ...(input.composition?.tdnPercent !== undefined && { tdnPercent: input.composition.tdnPercent }),
            ...(input.composition?.ndfPercent !== undefined && { ndfPercent: input.composition.ndfPercent }),
            ...(input.composition?.adfPercent !== undefined && { adfPercent: input.composition.adfPercent }),
            ...(input.composition?.meValueMjPerKg !== undefined && {
              meValueMjPerKg: input.composition.meValueMjPerKg,
            }),
            ...(input.composition?.caPercent !== undefined && { caPercent: input.composition.caPercent }),
            ...(input.composition?.pPercent !== undefined && { pPercent: input.composition.pPercent }),
            ...(input.composition?.cfPercent !== undefined && { cfPercent: input.composition.cfPercent }),
            ...(input.composition?.eePercent !== undefined && { eePercent: input.composition.eePercent }),
            ...(input.composition?.ashPercent !== undefined && { ashPercent: input.composition.ashPercent }),
          },
        });
      }
    });

    await recordFeedAdminAudit({
      entityId,
      versionId,
      eventType: 'FEED_INGREDIENT_UPDATED',
      actorId,
    });

    return this.get(entityId);
  }

  async submitForReview(entityId: string, actorId: string, notes?: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().submitForReview(entityId, actorId, notes);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'FEED_INGREDIENT_SUBMITTED',
      actorId,
      detail: { notes },
    });
  }

  async publish(entityId: string, actorId: string, notes?: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().approveAndPublish(entityId, actorId, notes);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'FEED_INGREDIENT_PUBLISHED',
      actorId,
      detail: { notes },
    });
  }

  async reject(entityId: string, actorId: string, reason: string): Promise<void> {
    await getFeedKnowledgeGovernanceService().rejectVersion(entityId, actorId, reason);
    await recordFeedAdminAudit({
      entityId,
      eventType: 'FEED_INGREDIENT_REJECTED',
      actorId,
      detail: { reason },
    });
  }

  async archive(entityId: string, actorId: string, reason?: string): Promise<void> {
    const entity = await this.prisma.vkKnowledgeEntity.findUnique({
      where: { id: entityId },
      include: { publishedVersion: true },
    });
    if (!entity?.publishedVersion) throw new Error('No published version to archive');

    const now = new Date();
    await this.prisma.vkKnowledgeVersion.update({
      where: { id: entity.publishedVersion.id },
      data: {
        status: VkVersionStatus.DEPRECATED,
        deprecatedAt: now,
        deprecationReason: reason ?? 'Archived by admin',
      },
    });

    await recordFeedAdminAudit({
      entityId,
      versionId: entity.publishedVersion.id,
      eventType: 'FEED_INGREDIENT_ARCHIVED',
      actorId,
      detail: { reason },
    });
  }

  async restore(entityId: string, actorId: string): Promise<void> {
    const entity = await this.prisma.vkKnowledgeEntity.findUnique({
      where: { id: entityId },
      include: { publishedVersion: true },
    });
    if (!entity?.publishedVersion) throw new Error('No published version to restore');
    if (entity.publishedVersion.status !== VkVersionStatus.DEPRECATED) {
      throw new Error('Published version is not archived');
    }

    await this.prisma.vkKnowledgeVersion.update({
      where: { id: entity.publishedVersion.id },
      data: {
        status: VkVersionStatus.PUBLISHED,
        deprecatedAt: null,
        deprecationReason: null,
      },
    });

    await recordFeedAdminAudit({
      entityId,
      versionId: entity.publishedVersion.id,
      eventType: 'FEED_INGREDIENT_RESTORED',
      actorId,
    });
  }

  async getVersionHistory(entityId: string): Promise<
    Array<{
      versionId: string;
      versionNumber: number;
      status: VkVersionStatus;
      titleBn: string;
      titleEn: string;
      publishedAt: string | null;
      createdAt: string;
    }>
  > {
    const versions = await this.prisma.vkKnowledgeVersion.findMany({
      where: { entityId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        titleBn: true,
        titleEn: true,
        publishedAt: true,
        createdAt: true,
      },
    });
    return versions.map((v) => ({
      versionId: v.id,
      versionNumber: v.versionNumber,
      status: v.status,
      titleBn: v.titleBn,
      titleEn: v.titleEn,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  }
}

let service: FeedIngredientAdminService | undefined;

export function getFeedIngredientAdminService(): FeedIngredientAdminService {
  if (!service) service = new FeedIngredientAdminService();
  return service;
}

export function resetFeedIngredientAdminServiceForTests(): void {
  service = undefined;
}
