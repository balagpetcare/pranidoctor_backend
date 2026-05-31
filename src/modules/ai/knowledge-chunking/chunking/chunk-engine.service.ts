import type { VkKnowledgeDomain } from '../../../../generated/prisma/index.js';
import {
  estimateTokens,
  type ChunkPolicyId,
  type StagedChunkDraft,
} from '../knowledge-chunking.types.js';
import { resolveChunkPolicyForDomain } from '../policies/chunk-policy.registry.js';

function splitByHeadings(text: string): Array<{ heading?: string; body: string }> {
  const lines = text.split('\n');
  const sections: Array<{ heading?: string; body: string }> = [];
  let currentHeading: string | undefined;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (!body) return;
    sections.push(currentHeading ? { heading: currentHeading, body } : { body });
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

function splitMedicineSections(bodyBn: string, bodyEn: string): Array<{ heading: string; bn: string; en: string }> {
  const markers = ['indication', 'dose', 'dosage', 'contraindication', 'withdrawal', 'side effect'];
  const enLines = bodyEn.split('\n');
  const bnLines = bodyBn.split('\n');
  const sections: Array<{ heading: string; bn: string; en: string }> = [];
  let current = { heading: 'overview', bn: '' as string, en: '' as string };

  const push = () => {
    if (current.bn.trim() || current.en.trim()) {
      sections.push({ ...current });
    }
  };

  for (let i = 0; i < Math.max(enLines.length, bnLines.length); i++) {
    const enLine = enLines[i] ?? '';
    const bnLine = bnLines[i] ?? '';
    const lower = enLine.toLowerCase();
    const marker = markers.find((m) => lower.includes(m) || lower.startsWith(`## ${m}`));
    if (marker) {
      push();
      current = { heading: marker, bn: bnLine, en: enLine };
    } else {
      current.bn += (current.bn ? '\n' : '') + bnLine;
      current.en += (current.en ? '\n' : '') + enLine;
    }
  }
  push();
  return sections.length > 0 ? sections : [{ heading: 'overview', bn: bodyBn, en: bodyEn }];
}

function chunksFromStructuredJson(
  structuredJson: Record<string, unknown>,
  policyId: ChunkPolicyId,
): StagedChunkDraft[] {
  const keys = Object.keys(structuredJson);
  return keys.map((key, index) => {
    const value = structuredJson[key];
    const serialized = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return {
      chunkIndex: index,
      chunkPolicyId: policyId,
      contentBn: serialized,
      contentEn: serialized,
      tokenEstimate: estimateTokens(serialized),
      headingPath: key,
      structuredOverlay: { [key]: value },
    };
  });
}

function makeChunk(
  chunkIndex: number,
  policyId: ChunkPolicyId,
  contentBn: string,
  contentEn: string,
  headingPath?: string,
  structuredOverlay?: Record<string, unknown>,
): StagedChunkDraft {
  const draft: StagedChunkDraft = {
    chunkIndex,
    chunkPolicyId: policyId,
    contentBn,
    contentEn,
    tokenEstimate: Math.max(estimateTokens(contentBn), estimateTokens(contentEn)),
  };
  if (headingPath) draft.headingPath = headingPath;
  if (structuredOverlay) draft.structuredOverlay = structuredOverlay;
  return draft;
}

function packSections(
  bnSections: Array<{ heading?: string; body: string }>,
  enSections: Array<{ heading?: string; body: string }>,
  policyId: ChunkPolicyId,
): StagedChunkDraft[] {
  const count = Math.max(bnSections.length, enSections.length, 1);
  const chunks: StagedChunkDraft[] = [];

  for (let i = 0; i < count; i++) {
    const bnBody = bnSections[i]?.body ?? bnSections[0]?.body ?? '';
    const enBody = enSections[i]?.body ?? enSections[0]?.body ?? '';
    const heading = bnSections[i]?.heading ?? enSections[i]?.heading;
    chunks.push(makeChunk(i, policyId, bnBody, enBody, heading));
  }

  return chunks.length > 0 ? chunks : [makeChunk(0, policyId, '', '', undefined)];
}

export class ChunkEngineService {
  readonly name = 'ChunkEngineService';

  buildChunks(params: {
    domain: VkKnowledgeDomain;
    titleBn: string;
    titleEn: string;
    bodyBn: string;
    bodyEn: string;
    structuredJson?: Record<string, unknown> | null;
    chunkPolicyId?: string | null;
  }): StagedChunkDraft[] {
    const policyId = resolveChunkPolicyForDomain(params.domain, params.chunkPolicyId);

    if (
      policyId === 'STRUCTURED_BY_KEY' ||
      (params.structuredJson &&
        Object.keys(params.structuredJson).length > 0 &&
        policyId === 'REGULATORY_BY_RECORD')
    ) {
      const structured = params.structuredJson ?? {};
      if (Object.keys(structured).length > 0) {
        return chunksFromStructuredJson(structured, policyId);
      }
    }

    if (policyId === 'MEDICINE_BY_SECTION') {
      const sections = splitMedicineSections(params.bodyBn, params.bodyEn);
      return sections.map((s, i) => makeChunk(i, policyId, s.bn, s.en, s.heading));
    }

    const bnSections = splitByHeadings(params.bodyBn || params.titleBn);
    const enSections = splitByHeadings(params.bodyEn || params.titleEn);
    const merged = packSections(bnSections, enSections, policyId);

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

    return merged.filter((c) => c.contentBn.trim() || c.contentEn.trim()).length > 0
      ? merged.filter((c) => c.contentBn.trim() || c.contentEn.trim())
      : [
          makeChunk(
            0,
            policyId,
            params.bodyBn || params.titleBn,
            params.bodyEn || params.titleEn,
            params.titleBn,
          ),
        ];
  }
}

let service: ChunkEngineService | null = null;

export function getChunkEngineService(): ChunkEngineService {
  if (!service) service = new ChunkEngineService();
  return service;
}

export function resetChunkEngineForTests(): void {
  service = null;
}
