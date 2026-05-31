import type {
  AiKnowledgeClinicalRiskTier,
  VkKnowledgeDomain,
} from '../../../../generated/prisma/index.js';

export type ExpirationPolicy = {
  policyKey: string;
  domain?: VkKnowledgeDomain;
  clinicalRiskTier?: AiKnowledgeClinicalRiskTier;
  approvalValidityMonths: number;
  rerreviewGraceDays: number;
  draftStaleDays: number;
  hardBlockRetrievalAfterExpiry: boolean;
};

const DEFAULT_POLICIES: ExpirationPolicy[] = [
  {
    policyKey: 'clinical-default',
    approvalValidityMonths: 24,
    rerreviewGraceDays: 90,
    draftStaleDays: 90,
    hardBlockRetrievalAfterExpiry: false,
  },
  {
    policyKey: 'regulatory-bd',
    domain: 'REGULATORY_BD',
    approvalValidityMonths: 12,
    rerreviewGraceDays: 30,
    draftStaleDays: 60,
    hardBlockRetrievalAfterExpiry: true,
  },
  {
    policyKey: 'farm-low',
    domain: 'FARM_MGMT',
    clinicalRiskTier: 'LOW',
    approvalValidityMonths: 36,
    rerreviewGraceDays: 90,
    draftStaleDays: 90,
    hardBlockRetrievalAfterExpiry: false,
  },
  {
    policyKey: 'feed-low',
    domain: 'FEED',
    clinicalRiskTier: 'LOW',
    approvalValidityMonths: 36,
    rerreviewGraceDays: 90,
    draftStaleDays: 90,
    hardBlockRetrievalAfterExpiry: false,
  },
  {
    policyKey: 'vaccine-schedule',
    domain: 'VACCINE',
    approvalValidityMonths: 12,
    rerreviewGraceDays: 90,
    draftStaleDays: 90,
    hardBlockRetrievalAfterExpiry: false,
  },
];

export function resolveExpirationPolicy(params: {
  domain: VkKnowledgeDomain;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
}): ExpirationPolicy {
  const exact = DEFAULT_POLICIES.find(
    (p) => p.domain === params.domain && p.clinicalRiskTier === params.clinicalRiskTier,
  );
  if (exact) return exact;

  const byDomain = DEFAULT_POLICIES.find((p) => p.domain === params.domain && !p.clinicalRiskTier);
  if (byDomain) return byDomain;

  return DEFAULT_POLICIES[0]!;
}

export function computeApprovalValidUntil(params: {
  domain: VkKnowledgeDomain;
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  from?: Date;
}): Date {
  const policy = resolveExpirationPolicy(params);
  const base = params.from ?? new Date();
  const result = new Date(base);
  result.setMonth(result.getMonth() + policy.approvalValidityMonths);
  return result;
}

export function listExpirationPolicies(): ExpirationPolicy[] {
  return [...DEFAULT_POLICIES];
}
