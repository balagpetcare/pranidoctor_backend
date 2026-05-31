import type { VkReviewStage, VkVersionStatus } from '../../../../generated/prisma/index.js';
import type { GovernanceStage } from '../knowledge-governance.types.js';

export type StageResolutionInput = {
  status: VkVersionStatus;
  hasOpenReview: boolean;
  hasOpenVetReview: boolean;
  hasValidApproval: boolean;
  hasExpeditedApproval: boolean;
  hasEditorialApprovalReady?: boolean;
};

export function resolveGovernanceStage(input: StageResolutionInput): GovernanceStage {
  const { status } = input;
  const approvalReady =
    input.hasValidApproval ||
    input.hasExpeditedApproval ||
    input.hasEditorialApprovalReady === true;

  if (status === 'PUBLISHED') return 'PUBLISHED';
  if (status === 'DEPRECATED' || status === 'REJECTED') return 'ARCHIVED';
  if (status === 'DRAFT' || status === 'CHANGES_REQUESTED') return 'DRAFT';

  if (status === 'VET_APPROVAL') {
    if (approvalReady) return 'APPROVAL';
    return 'VET_REVIEW';
  }

  if (status === 'IN_REVIEW') {
    if (approvalReady) return 'APPROVAL';
    return 'REVIEW';
  }

  return 'DRAFT';
}

export function governanceStageLabel(stage: GovernanceStage): string {
  const labels: Record<GovernanceStage, string> = {
    DRAFT: 'Draft',
    REVIEW: 'Review',
    VET_REVIEW: 'Vet Review',
    APPROVAL: 'Approval',
    PUBLISHED: 'Published',
    ARCHIVED: 'Archived',
  };
  return labels[stage];
}

export function requiredReviewStages(params: {
  audience: string;
}): VkReviewStage[] {
  const stages: VkReviewStage[] = ['EDITORIAL'];
  if (params.audience === 'FARMER' || params.audience === 'BOTH') {
    stages.push('LANGUAGE_BN');
  }
  if (params.audience === 'DOCTOR' || params.audience === 'BOTH') {
    stages.push('LANGUAGE_EN');
  }
  stages.push('DOMAIN_LEAD');
  return stages;
}
