import { randomUUID } from 'crypto';
import {
  VkKnowledgeDomain,
  VkReviewStage,
  VkVersionStatus,
  AiKnowledgeAudience,
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeEmbeddingStatus,
  AiKnowledgeReviewDecision,
  type LivestockSpecies,
  type ProductionStage,
  type BreedCategory,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import type {
  FeedIngredientInput,
  NutrientRequirementInput,
  ToxicFeedAlertInput,
  RationTemplateInput,
  SeasonalCalendarInput,
} from './feed-knowledge.types.js';
import { FEED_KNOWLEDGE_DOMAIN, FEED_ENTITY_TYPES } from './feed-knowledge.constants.js';

export type CreateFeedEntityInput<T> = T & {
  createdById?: string;
  titleBn: string;
  titleEn: string;
  summaryBn?: string;
  summaryEn?: string;
  bodyBn: string;
  bodyEn: string;
  species: LivestockSpecies[];
  audience?: AiKnowledgeAudience;
  regionScope?: string;
  keywordsBn?: string[];
  keywordsEn?: string[];
  colloquialBn?: string[];
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
};

/**
 * Feed Knowledge Governance Service
 * 
 * Implements proper VKL governance workflows for feed knowledge entities.
 * All feed knowledge must go through draft → review → publish workflow.
 */
export class FeedKnowledgeGovernanceService {
  private prisma = getPrisma();

  /**
   * Create a feed ingredient entity in DRAFT status (requires review/approval)
   */
  async createFeedIngredientDraft(
    input: CreateFeedEntityInput<FeedIngredientInput>,
  ): Promise<{ entityId: string; versionId: string }> {
    const slug = `feed-ingredient-${input.ingredientCode.toLowerCase()}`;
    
    return await this.prisma.$transaction(async (tx) => {
      // Check if entity already exists
      const existingEntity = await tx.vkKnowledgeEntity.findUnique({
        where: { slug },
      });

      if (existingEntity) {
        throw new Error(`Feed ingredient entity already exists: ${input.ingredientCode}`);
      }

      // Create knowledge entity
      const entity = await tx.vkKnowledgeEntity.create({
        data: {
          domain: VkKnowledgeDomain.FEED,
          entityType: FEED_ENTITY_TYPES.FEED_INGREDIENT,
          slug,
          createdById: input.createdById,
        },
      });

      // Create initial version in DRAFT status
      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId: entity.id,
          versionNumber: 1,
          status: VkVersionStatus.DRAFT,
          titleBn: input.titleBn,
          titleEn: input.titleEn,
          summaryBn: input.summaryBn,
          summaryEn: input.summaryEn,
          bodyBn: input.bodyBn,
          bodyEn: input.bodyEn,
          species: input.species,
          audience: input.audience ?? AiKnowledgeAudience.FARMER,
          regionScope: input.regionScope ?? 'BD',
          structuredJson: {
            entityType: FEED_ENTITY_TYPES.FEED_INGREDIENT,
            ingredientCode: input.ingredientCode,
            composition: input.composition,
            metadata: input.metadata,
          },
          keywordsBn: input.keywordsBn ?? [],
          keywordsEn: input.keywordsEn ?? [],
          colloquialBn: input.colloquialBn ?? [],
          clinicalRiskTier: input.clinicalRiskTier ?? AiKnowledgeClinicalRiskTier.LOW,
          embeddingStatus: AiKnowledgeEmbeddingStatus.NOT_APPLICABLE,
          createdById: input.createdById,
        },
      });

      // Create the actual feed ingredient record linked to the version
      await tx.vkFeedIngredient.create({
        data: {
          versionId: version.id,
          ingredientCode: input.ingredientCode,
          localNamesBn: input.localNamesBn ?? [],
          localNamesEn: input.localNamesEn ?? [],
          
          dmPercent: input.composition.dmPercent,
          cpPercent: input.composition.cpPercent,
          tdnPercent: input.composition.tdnPercent,
          ndfPercent: input.composition.ndfPercent,
          adfPercent: input.composition.adfPercent,
          meValueMjPerKg: input.composition.meValueMjPerKg,
          caPercent: input.composition.caPercent,
          pPercent: input.composition.pPercent,
          cfPercent: input.composition.cfPercent,
          eePercent: input.composition.eePercent,
          ashPercent: input.composition.ashPercent,

          bdAvailability: input.bdAvailability,
          seasonalityJson: input.seasonalAvailability ? JSON.stringify(input.seasonalAvailability) : null,
          avgPriceBdtPerKg: input.avgPriceBdtPerKg,
          priceVolatility: input.priceVolatility,
          lastPriceUpdateAt: input.lastPriceUpdateAt,

          speciesRestrictions: input.speciesRestrictions ?? [],
          antinutrientJson: input.antinutrients ? JSON.stringify(input.antinutrients) : null,
          maxInclusionJson: input.maxInclusions ? JSON.stringify(input.maxInclusions) : null,

          feedItemId: input.feedItemId,
          sourceAttributionsJson: input.sourceAttributions ? JSON.stringify(input.sourceAttributions) : null,
        },
      });

      // Update entity to point to this draft version
      await tx.vkKnowledgeEntity.update({
        where: { id: entity.id },
        data: { currentDraftVersionId: version.id },
      });

      return { entityId: entity.id, versionId: version.id };
    });
  }

  /**
   * Create a nutrient requirement entity in DRAFT status
   */
  async createNutrientRequirementDraft(
    input: CreateFeedEntityInput<NutrientRequirementInput>,
  ): Promise<{ entityId: string; versionId: string }> {
    const slug = `nutrient-req-${input.species}-${input.productionStage}-${input.breedCategory ?? 'all'}`.toLowerCase();
    
    return await this.prisma.$transaction(async (tx) => {
      // Check if entity already exists
      const existingEntity = await tx.vkKnowledgeEntity.findUnique({
        where: { slug },
      });

      if (existingEntity) {
        throw new Error(`Nutrient requirement entity already exists: ${slug}`);
      }

      // Create knowledge entity
      const entity = await tx.vkKnowledgeEntity.create({
        data: {
          domain: VkKnowledgeDomain.FEED,
          entityType: FEED_ENTITY_TYPES.NUTRIENT_REQUIREMENT,
          slug,
          createdById: input.createdById,
        },
      });

      // Create initial version in DRAFT status
      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId: entity.id,
          versionNumber: 1,
          status: VkVersionStatus.DRAFT,
          titleBn: input.titleBn,
          titleEn: input.titleEn,
          summaryBn: input.summaryBn,
          summaryEn: input.summaryEn,
          bodyBn: input.bodyBn,
          bodyEn: input.bodyEn,
          species: input.species,
          audience: input.audience ?? AiKnowledgeAudience.FARMER,
          regionScope: input.regionScope ?? 'BD',
          structuredJson: {
            entityType: FEED_ENTITY_TYPES.NUTRIENT_REQUIREMENT,
            species: input.species,
            productionStage: input.productionStage,
            breedCategory: input.breedCategory,
            requirements: input.requirements,
            metadata: input.metadata,
          },
          keywordsBn: input.keywordsBn ?? [],
          keywordsEn: input.keywordsEn ?? [],
          colloquialBn: input.colloquialBn ?? [],
          clinicalRiskTier: input.clinicalRiskTier ?? AiKnowledgeClinicalRiskTier.MEDIUM,
          embeddingStatus: AiKnowledgeEmbeddingStatus.NOT_APPLICABLE,
          createdById: input.createdById,
        },
      });

      // Create the actual nutrient requirement record
      await tx.vkNutrientRequirement.create({
        data: {
          versionId: version.id,
          species: input.species,
          breedCategory: input.breedCategory,
          productionStage: input.productionStage,
          weightRangeMinKg: input.weightRange?.minKg,
          weightRangeMaxKg: input.weightRange?.maxKg,

          dmIntakeKgPerDay: input.dmIntake?.kgPerDay,
          dmIntakePercentBw: input.dmIntake?.percentBw,
          cpPercentMin: input.requirements.cpPercent?.min,
          cpPercentMax: input.requirements.cpPercent?.max,
          tdnPercentMin: input.requirements.tdnPercentMin,
          meMinMjPerKg: input.requirements.meMinMjPerKg,
          ndfPercentMax: input.requirements.ndfPercentMax,
          caPercentMin: input.requirements.caPercentMin,
          pPercentMin: input.requirements.pPercentMin,

          milkYieldLiters: input.productionTargets?.milkYieldLiters,
          adgKg: input.productionTargets?.adgKg,

          sourceNotes: input.sourceNotes,
        },
      });

      // Update entity to point to this draft version
      await tx.vkKnowledgeEntity.update({
        where: { id: entity.id },
        data: { currentDraftVersionId: version.id },
      });

      return { entityId: entity.id, versionId: version.id };
    });
  }

  /**
   * Create a toxic feed alert entity in DRAFT status (REQUIRES VETERINARY APPROVAL)
   */
  async createToxicFeedAlertDraft(
    input: CreateFeedEntityInput<ToxicFeedAlertInput>,
  ): Promise<{ entityId: string; versionId: string }> {
    const slug = `toxic-alert-${input.substance.toLowerCase().replace(/\s+/g, '-')}`;
    
    return await this.prisma.$transaction(async (tx) => {
      // Check if entity already exists
      const existingEntity = await tx.vkKnowledgeEntity.findUnique({
        where: { slug },
      });

      if (existingEntity) {
        throw new Error(`Toxic feed alert entity already exists: ${input.substance}`);
      }

      // Create knowledge entity
      const entity = await tx.vkKnowledgeEntity.create({
        data: {
          domain: VkKnowledgeDomain.FEED,
          entityType: FEED_ENTITY_TYPES.TOXIC_FEED_ALERT,
          slug,
          createdById: input.createdById,
        },
      });

      // Create initial version in DRAFT status with HIGH clinical risk
      const version = await tx.vkKnowledgeVersion.create({
        data: {
          entityId: entity.id,
          versionNumber: 1,
          status: VkVersionStatus.DRAFT,
          titleBn: input.titleBn,
          titleEn: input.titleEn,
          summaryBn: input.summaryBn,
          summaryEn: input.summaryEn,
          bodyBn: input.bodyBn,
          bodyEn: input.bodyEn,
          species: input.species,
          audience: input.audience ?? AiKnowledgeAudience.FARMER,
          regionScope: input.regionScope ?? 'BD',
          structuredJson: {
            entityType: FEED_ENTITY_TYPES.TOXIC_FEED_ALERT,
            substance: input.substance,
            speciesAffected: input.speciesAffected,
            toxicThreshold: input.toxicThreshold,
            lethalThreshold: input.lethalThreshold,
          },
          keywordsBn: input.keywordsBn ?? [],
          keywordsEn: input.keywordsEn ?? [],
          colloquialBn: input.colloquialBn ?? [],
          clinicalRiskTier: AiKnowledgeClinicalRiskTier.HIGH, // Always HIGH for toxic alerts
          embeddingStatus: AiKnowledgeEmbeddingStatus.NOT_APPLICABLE,
          createdById: input.createdById,
        },
      });

      // Create the actual toxic feed alert record
      await tx.vkToxicFeedAlert.create({
        data: {
          versionId: version.id,
          substance: input.substance,
          commonNamesBn: input.commonNamesBn ?? [],
          commonNamesEn: input.commonNamesEn ?? [],
          speciesAffected: input.speciesAffected,

          toxicThreshold: input.toxicThreshold,
          lethalThreshold: input.lethalThreshold,

          clinicalSignsBn: input.clinicalSignsBn,
          clinicalSignsEn: input.clinicalSignsEn ?? [],
          onsetTime: input.onsetTime,

          immediateActionBn: input.immediateActionBn,
          immediateActionEn: input.immediateActionEn,
          vetRequired: input.vetRequired ?? true,

          relatedIngredientCodes: input.relatedIngredientCodes ?? [],
          sourceAttributionsJson: input.sourceAttributions ? JSON.stringify(input.sourceAttributions) : null,
        },
      });

      // Update entity to point to this draft version
      await tx.vkKnowledgeEntity.update({
        where: { id: entity.id },
        data: { currentDraftVersionId: version.id },
      });

      return { entityId: entity.id, versionId: version.id };
    });
  }

  /**
   * Submit a draft version for review
   */
  async submitForReview(
    entityId: string,
    submittedBy: string,
    reviewNotes?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.findUnique({
        where: { id: entityId },
        include: { draftVersion: true },
      });

      if (!entity || !entity.draftVersion) {
        throw new Error('No draft version found for entity');
      }

      if (entity.draftVersion.status !== VkVersionStatus.DRAFT) {
        throw new Error('Version is not in DRAFT status');
      }

      const submittedAt = new Date();
      await tx.vkKnowledgeVersion.update({
        where: { id: entity.draftVersion.id },
        data: {
          status: VkVersionStatus.IN_REVIEW,
          submittedAt,
        },
      });

      await tx.vkKnowledgeReview.create({
        data: {
          versionId: entity.draftVersion.id,
          stage:
            entity.draftVersion.clinicalRiskTier === AiKnowledgeClinicalRiskTier.HIGH
              ? 'VET'
              : 'DOMAIN_LEAD',
          reviewerId: submittedBy,
          comments: reviewNotes,
          queueSource: 'FEED_ADMIN',
        },
      });

      await tx.vkKnowledgeAuditEvent.create({
        data: {
          entityId,
          versionId: entity.draftVersion.id,
          eventType: 'SUBMITTED_FOR_REVIEW',
          actorId: submittedBy,
          detailJson: { reviewNotes },
        },
      });
    });
  }

  /**
   * Approve and publish a version (VET_APPROVAL required for HIGH risk)
   */
  async approveAndPublish(
    entityId: string,
    approvedBy: string,
    approvalNotes?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.findUnique({
        where: { id: entityId },
        include: { draftVersion: true, publishedVersion: true },
      });

      if (!entity || !entity.draftVersion) {
        throw new Error('No draft version found for entity');
      }

      const publishableStatuses: VkVersionStatus[] = [
        VkVersionStatus.IN_REVIEW,
        VkVersionStatus.VET_APPROVAL,
      ];
      if (!publishableStatuses.includes(entity.draftVersion.status)) {
        throw new Error('Version is not ready to publish');
      }

      if (entity.draftVersion.clinicalRiskTier === AiKnowledgeClinicalRiskTier.HIGH) {
        const approver = await tx.user.findUnique({
          where: { id: approvedBy },
          include: { doctorProfile: true },
        });
        if (!approver?.doctorProfile) {
          throw new Error('Veterinary approval required for HIGH risk feed knowledge');
        }
      }

      const now = new Date();

      const publishedVersion = await tx.vkKnowledgeVersion.update({
        where: { id: entity.draftVersion.id },
        data: {
          status: VkVersionStatus.PUBLISHED,
          publishedAt: now,
          publishedById: approvedBy,
        },
      });

      await tx.vkKnowledgeApproval.create({
        data: {
          versionId: publishedVersion.id,
          approverVetId: approvedBy,
          approvalScope: ['FEED'],
          notes: approvalNotes,
        },
      });

      // Deprecate previous published version if it exists
      if (entity.publishedVersion) {
        await tx.vkKnowledgeVersion.update({
          where: { id: entity.publishedVersion.id },
          data: {
            status: VkVersionStatus.DEPRECATED,
            deprecatedAt: now,
            deprecationReason: 'Superseded by new version',
          },
        });
      }

      // Update entity pointers
      await tx.vkKnowledgeEntity.update({
        where: { id: entityId },
        data: {
          currentPublishedVersionId: publishedVersion.id,
          currentDraftVersionId: null,
        },
      });

      await tx.vkKnowledgeAuditEvent.create({
        data: {
          entityId,
          versionId: publishedVersion.id,
          eventType: 'PUBLISHED',
          actorId: approvedBy,
          detailJson: {
            approvalNotes,
            clinicalRiskTier: entity.draftVersion.clinicalRiskTier,
            entityType: entity.entityType,
          },
        },
      });
    });
  }

  /**
   * Editorial / domain review — moves HIGH-risk drafts into vet approval queue.
   */
  async completeEditorialReview(
    entityId: string,
    reviewerId: string,
    approved: boolean,
    comments?: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.findUnique({
        where: { id: entityId },
        include: { draftVersion: true },
      });
      if (!entity?.draftVersion) throw new Error('No draft version found for entity');
      if (entity.draftVersion.status !== VkVersionStatus.IN_REVIEW) {
        throw new Error('Version is not in review');
      }

      await tx.vkKnowledgeReview.create({
        data: {
          versionId: entity.draftVersion.id,
          stage: VkReviewStage.DOMAIN_LEAD,
          decision: approved ? AiKnowledgeReviewDecision.APPROVE : AiKnowledgeReviewDecision.REJECT,
          reviewerId,
          comments,
          completedAt: new Date(),
          queueSource: 'FEED_ADMIN',
        },
      });

      if (!approved) {
        await tx.vkKnowledgeVersion.update({
          where: { id: entity.draftVersion.id },
          data: { status: VkVersionStatus.CHANGES_REQUESTED },
        });
        return;
      }

      const nextStatus =
        entity.draftVersion.clinicalRiskTier === AiKnowledgeClinicalRiskTier.HIGH
          ? VkVersionStatus.VET_APPROVAL
          : VkVersionStatus.IN_REVIEW;

      await tx.vkKnowledgeVersion.update({
        where: { id: entity.draftVersion.id },
        data: { status: nextStatus },
      });
    });
  }

  /**
   * Reject a submitted version
   */
  async rejectVersion(
    entityId: string,
    rejectedBy: string,
    rejectionReason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const entity = await tx.vkKnowledgeEntity.findUnique({
        where: { id: entityId },
        include: { draftVersion: true },
      });

      if (!entity || !entity.draftVersion) {
        throw new Error('No draft version found for entity');
      }

      const rejectable: VkVersionStatus[] = [
        VkVersionStatus.IN_REVIEW,
        VkVersionStatus.VET_APPROVAL,
        VkVersionStatus.CHANGES_REQUESTED,
      ];
      if (!rejectable.includes(entity.draftVersion.status)) {
        throw new Error('Version cannot be rejected in current status');
      }

      await tx.vkKnowledgeVersion.update({
        where: { id: entity.draftVersion.id },
        data: { status: VkVersionStatus.DRAFT, submittedAt: null },
      });

      await tx.vkKnowledgeReview.create({
        data: {
          versionId: entity.draftVersion.id,
          stage: VkReviewStage.EDITORIAL,
          decision: AiKnowledgeReviewDecision.REJECT,
          reviewerId: rejectedBy,
          comments: rejectionReason,
          completedAt: new Date(),
          queueSource: 'FEED_ADMIN',
        },
      });

      await tx.vkKnowledgeAuditEvent.create({
        data: {
          entityId,
          versionId: entity.draftVersion.id,
          eventType: 'REJECTED',
          actorId: rejectedBy,
          detailJson: { rejectionReason, entityType: entity.entityType },
        },
      });
    });
  }

  /**
   * Get entities pending review
   */
  async getEntitiesPendingReview(entityType?: string): Promise<Array<{
    entityId: string;
    entityType: string;
    slug: string;
    versionId: string;
    titleBn: string;
    titleEn: string;
    clinicalRiskTier: string;
    submittedAt: Date;
  }>> {
    const entities = await this.prisma.vkKnowledgeEntity.findMany({
      where: {
        domain: VkKnowledgeDomain.FEED,
        ...(entityType && { entityType }),
        draftVersion: {
          status: { in: [VkVersionStatus.IN_REVIEW, VkVersionStatus.VET_APPROVAL] },
        },
      },
      include: {
        draftVersion: {
          select: {
            id: true,
            titleBn: true,
            titleEn: true,
            clinicalRiskTier: true,
            submittedAt: true,
          },
        },
      },
      orderBy: {
        draftVersion: {
          submittedAt: 'asc',
        },
      },
    });

    return entities
      .filter(entity => entity.draftVersion)
      .map(entity => ({
        entityId: entity.id,
        entityType: entity.entityType,
        slug: entity.slug,
        versionId: entity.draftVersion!.id,
        titleBn: entity.draftVersion!.titleBn,
        titleEn: entity.draftVersion!.titleEn,
        clinicalRiskTier: entity.draftVersion!.clinicalRiskTier,
        submittedAt: entity.draftVersion!.submittedAt!,
      }));
  }
}

let service: FeedKnowledgeGovernanceService | undefined;

export function getFeedKnowledgeGovernanceService(): FeedKnowledgeGovernanceService {
  if (!service) {
    service = new FeedKnowledgeGovernanceService();
  }
  return service;
}