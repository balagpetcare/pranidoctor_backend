import { createHash } from 'node:crypto';

import type {
  AiKnowledgeClinicalRiskTier,
  VkKnowledgeCitation,
  VkKnowledgeVersion,
} from '../../../generated/prisma/index.js';

export type CitationTrustCitation = {
  pageRef: string | null;
  sectionRef: string | null;
  sourceTrustTier: number;
};

export type CitationTrustValidationResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

/** Appendix B trust rules — lower trustTier = higher authority (1 best, 4 weakest). */
export function evaluateCitationTrustRules(params: {
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  citations: CitationTrustCitation[];
}): CitationTrustValidationResult {
  const { clinicalRiskTier, citations } = params;
  const minCount =
    clinicalRiskTier === 'HIGH' || clinicalRiskTier === 'CRITICAL' ? 2 : 1;

  if (citations.length < minCount) {
    return {
      ok: false,
      code: 'CITATION_COUNT_INSUFFICIENT',
      message: `At least ${minCount} citation(s) required for ${clinicalRiskTier} risk tier`,
    };
  }

  const maxAllowedTrustTier = clinicalRiskTier === 'LOW' ? 3 : 2;
  const hasQualifyingSource = citations.some((c) => c.sourceTrustTier <= maxAllowedTrustTier);
  if (!hasQualifyingSource) {
    return {
      ok: false,
      code: 'CITATION_TRUST_INSUFFICIENT',
      message: `At least one citation must reference a source with trust tier ≤ ${maxAllowedTrustTier}`,
    };
  }

  if (clinicalRiskTier === 'HIGH' || clinicalRiskTier === 'CRITICAL') {
    const missingLocator = citations.some(
      (c) => !c.pageRef?.trim() && !c.sectionRef?.trim(),
    );
    if (missingLocator) {
      return {
        ok: false,
        code: 'CITATION_LOCATOR_REQUIRED',
        message: 'Page or section locator required on all citations for HIGH/CRITICAL versions',
      };
    }
  }

  return { ok: true };
}

/** Version-level citations only — per-chunk citations are added after vet sign-off prep. */
export function filterVersionLevelSignOffCitations<
  T extends Pick<VkKnowledgeCitation, 'chunkId'>,
>(citations: T[]): T[] {
  return citations.filter((c) => c.chunkId == null);
}

export function computeVersionSignOffHash(
  version: Pick<
    VkKnowledgeVersion,
    'id' | 'titleBn' | 'titleEn' | 'bodyBn' | 'bodyEn' | 'structuredJson' | 'clinicalRiskTier'
  >,
  citations: Pick<VkKnowledgeCitation, 'id' | 'inlineCitationKey' | 'pageRef' | 'sectionRef'>[],
): string {
  const payload = JSON.stringify({
    versionId: version.id,
    titleBn: version.titleBn,
    titleEn: version.titleEn,
    bodyBn: version.bodyBn,
    bodyEn: version.bodyEn,
    structuredJson: version.structuredJson ?? null,
    clinicalRiskTier: version.clinicalRiskTier,
    citations: citations
      .map((c) => ({
        id: c.id,
        key: c.inlineCitationKey,
        pageRef: c.pageRef,
        sectionRef: c.sectionRef,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
  return createHash('sha256').update(payload).digest('hex');
}

export function defaultInlineCitationKey(sourceKey: string, pageRef?: string): string {
  return pageRef ? `[${sourceKey}|${pageRef}]` : `[${sourceKey}]`;
}
