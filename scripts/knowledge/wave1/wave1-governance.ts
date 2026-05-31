import { getKnowledgeFoundationService } from '../../../src/modules/ai/knowledge-foundation/knowledge-foundation.service.js';
import { getKnowledgeGovernanceOrchestratorService } from '../../../src/modules/ai/knowledge-governance/index.js';
import { getKnowledgeReviewRepository } from '../../../src/modules/ai/knowledge-foundation/repositories/knowledge-review.repository.js';
import { getKnowledgeApprovalRepository } from '../../../src/modules/ai/knowledge-foundation/repositories/knowledge-approval.repository.js';
import { getKnowledgeCitationRepository } from '../../../src/modules/ai/knowledge-foundation/repositories/knowledge-citation.repository.js';
import {
  computeVersionSignOffHash,
  filterVersionLevelSignOffCitations,
} from '../../../src/modules/ai/knowledge-foundation/knowledge-foundation.util.js';
import { requiresVetReviewPath } from '../../../src/modules/ai/knowledge-governance/policy/vet-path.policy.js';
import { getPrisma } from '../../../src/shared/database/prisma.js';
import type { GovernanceStage } from '../../../src/modules/ai/knowledge-governance/knowledge-governance.types.js';

const ACTOR = { id: 'wave1-mvc-deploy', role: 'SUPER_ADMIN' };
const EDITORIAL_REVIEWER = 'wave1-editorial-lead';
const VET_REVIEWER = 'wave1-vet-reviewer';
const VET_LICENSE = 'BVC-WAVE1-2026';

export type FastTrackResult = {
  versionId: string;
  slug: string;
  published: boolean;
  error?: string;
};

async function completeOpenReviews(versionId: string): Promise<void> {
  const governance = getKnowledgeGovernanceOrchestratorService();
  const reviews = await getKnowledgeReviewRepository().listOpenForVersion(versionId);

  for (const review of reviews) {
    const reviewerId = review.stage === 'VET' ? VET_REVIEWER : EDITORIAL_REVIEWER;
    await governance.completeReview(
      {
        reviewId: review.id,
        decision: 'APPROVE',
        reviewerId,
        comments: 'Wave 1 MVC automated editorial/vet review path.',
      },
      ACTOR,
    );
  }
}

async function ensureVetApprovalCurrent(versionId: string): Promise<void> {
  const governance = getKnowledgeGovernanceOrchestratorService();
  const version = await getPrisma().vkKnowledgeVersion.findUnique({
    where: { id: versionId },
    include: { entity: true },
  });
  if (!version) return;

  if (
    !requiresVetReviewPath({
      clinicalRiskTier: version.clinicalRiskTier,
      domain: version.entity.domain,
    })
  ) {
    return;
  }

  const citations = filterVersionLevelSignOffCitations(
    await getKnowledgeCitationRepository().listByVersion(versionId),
  );
  const currentHash = computeVersionSignOffHash(version, citations);
  const approval = await getKnowledgeApprovalRepository().findLatestValid(versionId);
  if (approval?.signOffHash === currentHash) return;

  await completeOpenReviews(versionId);
  await governance.recordVetApproval(
    {
      versionId,
      approverVetId: VET_REVIEWER,
      vetLicenseNo: VET_LICENSE,
      approvalScope: [version.entity.domain],
    },
    ACTOR,
  );
}

async function advanceToApproval(versionId: string): Promise<GovernanceStage> {
  const governance = getKnowledgeGovernanceOrchestratorService();

  for (let step = 0; step < 12; step += 1) {
    const stage = await governance.getGovernanceStage(versionId);
    if (stage === 'APPROVAL' || stage === 'PUBLISHED') {
      await ensureVetApprovalCurrent(versionId);
      return stage;
    }

    if (stage === 'VET_REVIEW') {
      await ensureVetApprovalCurrent(versionId);
      continue;
    }

    await completeOpenReviews(versionId);
  }

  const finalStage = await governance.getGovernanceStage(versionId);
  if (finalStage === 'APPROVAL') {
    await ensureVetApprovalCurrent(versionId);
  }
  return finalStage;
}

export async function fastTrackPublishVersion(versionId: string): Promise<FastTrackResult> {
  const governance = getKnowledgeGovernanceOrchestratorService();
  const foundation = getKnowledgeFoundationService();

  const version = await getPrisma().vkKnowledgeVersion.findUnique({
    where: { id: versionId },
    include: { entity: true },
  });

  if (!version) {
    return { versionId, slug: 'unknown', published: false, error: 'VERSION_NOT_FOUND' };
  }

  if (version.status === 'PUBLISHED') {
    return { versionId, slug: version.entity.slug, published: true };
  }

  const entity = await getPrisma().vkKnowledgeEntity.findUnique({
    where: { id: version.entityId },
    select: { currentPublishedVersionId: true },
  });
  if (entity?.currentPublishedVersionId && entity.currentPublishedVersionId !== versionId) {
    const published = await getPrisma().vkKnowledgeVersion.findUnique({
      where: { id: entity.currentPublishedVersionId },
      select: { versionNumber: true },
    });
    if (published && published.versionNumber >= version.versionNumber) {
      return { versionId, slug: version.entity.slug, published: true };
    }
  }

  try {
    if (version.status === 'DRAFT' || version.status === 'CHANGES_REQUESTED') {
      await governance.submitForReview({ versionId, queueSource: 'SEEDER' }, ACTOR);
    }

    const stage = await advanceToApproval(versionId);
    if (stage !== 'APPROVAL') {
      return {
        versionId,
        slug: version.entity.slug,
        published: false,
        error: `STUCK_AT_${stage}`,
      };
    }

    const needsVet = requiresVetReviewPath({
      clinicalRiskTier: version.clinicalRiskTier,
      domain: version.entity.domain,
    });

    if (needsVet) {
      await foundation.publishVersion(versionId, ACTOR);
    } else {
      await governance.publish({ versionId }, ACTOR);
    }

    return { versionId, slug: version.entity.slug, published: true };
  } catch (error) {
    return {
      versionId,
      slug: version.entity.slug,
      published: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function fastTrackPublishAll(versionIds: string[]): Promise<FastTrackResult[]> {
  const results: FastTrackResult[] = [];
  for (const versionId of versionIds) {
    results.push(await fastTrackPublishVersion(versionId));
  }
  return results;
}
