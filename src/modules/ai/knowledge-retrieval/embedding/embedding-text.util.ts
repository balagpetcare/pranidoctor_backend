import type {
  AiKnowledgeClinicalRiskTier,
  AiKnowledgeContentType,
  AiKnowledgeEvidenceLevel,
} from '../../../../generated/prisma/index.js';

export function buildEmbeddingText(params: {
  contentType: AiKnowledgeContentType;
  species: string[];
  clinicalRiskTier: AiKnowledgeClinicalRiskTier;
  headingPath?: string | null;
  contentBn: string;
  contentEn: string;
  evidenceLevel?: AiKnowledgeEvidenceLevel | null;
  confidenceScore?: number | null;
  inlineCitation?: string | null;
}): string {
  const species = params.species.length > 0 ? params.species.join(',') : 'ALL';
  const evidence = params.evidenceLevel ? ` [evidence=${params.evidenceLevel}]` : '';
  const confidence =
    params.confidenceScore != null && Number.isFinite(params.confidenceScore)
      ? ` [confidence=${params.confidenceScore.toFixed(2)}]`
      : '';
  const heading = params.headingPath?.trim() ? `${params.headingPath.trim()}\n---\n` : '';
  const cite = params.inlineCitation?.trim() ? `\n[cite=${params.inlineCitation.trim()}]` : '';
  return `[domain=${params.contentType}] [species=${species}] [risk=${params.clinicalRiskTier}]${evidence}${confidence}\n${heading}${params.contentBn}\n---\n${params.contentEn}${cite}`;
}
