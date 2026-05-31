import type {
  AiKnowledgeClinicalRiskTier,
  VkKnowledgeDomain,
} from '../../../../generated/prisma/index.js';
import { requiresVetApproval } from '../../knowledge-foundation/knowledge-foundation.types.js';

const VET_MANDATORY_DOMAINS: VkKnowledgeDomain[] = [
  'MEDICINE',
  'EMERGENCY',
  'CLINICAL_PROTOCOL',
  'REGULATORY_BD',
];

const EXPEDITED_DOMAINS: VkKnowledgeDomain[] = ['FARM_MGMT', 'FEED'];

export function requiresVetReviewPath(params: {
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  domain: VkKnowledgeDomain;
}): boolean {
  if (requiresVetApproval(params.clinicalRiskTier)) return true;
  return VET_MANDATORY_DOMAINS.includes(params.domain);
}

export function isExpeditedEligible(params: {
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  domain: VkKnowledgeDomain;
}): boolean {
  return (
    params.clinicalRiskTier === 'LOW' &&
    EXPEDITED_DOMAINS.includes(params.domain) &&
    !requiresVetReviewPath(params)
  );
}

export function assertVetScope(params: {
  domain: VkKnowledgeDomain;
  approvalScope: string[];
}): boolean {
  return params.approvalScope.includes(params.domain);
}
