import type { AiKnowledgeContentType } from '../../../../generated/prisma/index.js';
import type { ChunkPolicyId, StagedChunk } from '../knowledge-ingestion.types.js';

const DEFAULT_POLICY: ChunkPolicyId = 'GENERIC_BY_PARAGRAPH';

const CONTENT_TYPE_POLICY: Partial<Record<AiKnowledgeContentType, ChunkPolicyId>> = {
  DISEASE: 'DISEASE_BY_HEADING',
  MEDICINE: 'MEDICINE_BY_SECTION',
  VACCINE: 'SCHEDULE_BY_ROW',
  FEED: 'FEED_BY_INGREDIENT',
  FARM_MGMT: 'GOVT_BY_SECTION',
  EMERGENCY: 'EMERGENCY_BY_ACTION',
};

function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).filter(Boolean).length * 1.3);
}

function splitByHeadings(text: string): Array<{ heading?: string; body: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading?: string; body: string }> = [];
  let currentHeading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (!body) return;
    if (currentHeading) sections.push({ heading: currentHeading, body });
    else sections.push({ body });
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = /^#{1,4}\s+(.+)$/.exec(line.trim());
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (sections.length === 0 && text.trim()) {
    return [{ body: text.trim() }];
  }
  return sections;
}

function makeChunk(
  chunkIndex: number,
  chunkPolicyId: ChunkPolicyId,
  contentBn: string,
  contentEn: string,
  heading?: string,
): StagedChunk {
  const chunk: StagedChunk = {
    chunkIndex,
    chunkPolicyId,
    contentBn,
    contentEn,
    tokenEstimate: Math.max(estimateTokens(contentBn), estimateTokens(contentEn)),
  };
  if (heading) chunk.headingPath = heading;
  return chunk;
}

function isChunkPolicyId(value: string): value is ChunkPolicyId {
  return [
    'DISEASE_BY_HEADING',
    'MEDICINE_BY_SECTION',
    'PROTOCOL_BY_STEP',
    'SCHEDULE_BY_ROW',
    'FEED_BY_INGREDIENT',
    'BREED_BY_SECTION',
    'EMERGENCY_BY_ACTION',
    'REGULATORY_BY_RECORD',
    'GOVT_BY_SECTION',
    'GENERIC_BY_PARAGRAPH',
  ].includes(value);
}

export function resolveChunkPolicyId(
  contentType: AiKnowledgeContentType,
  override?: string,
): ChunkPolicyId {
  if (override && isChunkPolicyId(override)) return override;
  return CONTENT_TYPE_POLICY[contentType] ?? DEFAULT_POLICY;
}

function packSectionsBnEn(
  bnSections: Array<{ heading?: string; body: string }>,
  enSections: Array<{ heading?: string; body: string }>,
  policyId: ChunkPolicyId,
): StagedChunk[] {
  const count = Math.max(bnSections.length, enSections.length, 1);
  const chunks: StagedChunk[] = [];

  for (let i = 0; i < count; i++) {
    const bnBody = bnSections[i]?.body ?? bnSections[0]?.body ?? '';
    const enBody = enSections[i]?.body ?? enSections[0]?.body ?? '';
    const heading = bnSections[i]?.heading ?? enSections[i]?.heading;
    chunks.push(makeChunk(i, policyId, bnBody, enBody, heading));
  }

  return chunks.length > 0 ? chunks : [makeChunk(0, policyId, '', '', undefined)];
}

export function buildChunksForEntry(params: {
  titleBn: string;
  titleEn: string;
  bodyBn: string;
  bodyEn: string;
  contentType: AiKnowledgeContentType;
  chunkPolicyId?: string;
}): StagedChunk[] {
  const policyId = resolveChunkPolicyId(params.contentType, params.chunkPolicyId);
  const bnSections = splitByHeadings(params.bodyBn || params.titleBn);
  const enSections = splitByHeadings(params.bodyEn || params.titleEn);
  const merged = packSectionsBnEn(bnSections, enSections, policyId);

  if (merged.length === 1 && !merged[0]?.contentBn && !merged[0]?.contentEn) {
    return [
      makeChunk(
        0,
        policyId,
        params.bodyBn || params.titleBn,
        params.bodyEn || params.titleEn,
        params.titleBn,
      ),
    ];
  }

  return merged;
}
