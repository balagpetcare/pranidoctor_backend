import { getPrisma } from '../../../../shared/database/prisma.js';

import type { RawExtract } from '../knowledge-import.types.js';

export type ChangeDetectionResult = {
  added: RawExtract[];
  modified: RawExtract[];
  removed: string[];
  unchanged: RawExtract[];
};

export class ChangeDetectionService {
  readonly name = 'ChangeDetectionService';

  async detectDocumentChanges(params: {
    sourceId: string;
    documentId: string;
    currentExtracts: RawExtract[];
  }): Promise<ChangeDetectionResult> {
    const priorRun = await getPrisma().aiKnowledgeImportRun.findFirst({
      where: {
        sourceId: params.sourceId,
        documentId: params.documentId,
        status: { in: ['COMPLETED', 'PARTIAL'] },
      },
      orderBy: { completedAt: 'desc' },
      skip: 1,
    });

    if (!priorRun?.statsJson) {
      return {
        added: params.currentExtracts,
        modified: [],
        removed: [],
        unchanged: [],
      };
    }

    const priorHashes = extractHashMapFromStats(priorRun.statsJson);
    const added: RawExtract[] = [];
    const modified: RawExtract[] = [];
    const unchanged: RawExtract[] = [];
    const currentKeys = new Set<string>();

    for (const extract of params.currentExtracts) {
      const key = `${extract.slug}:${extract.sectionHash ?? ''}`;
      currentKeys.add(key);
      const priorHash = priorHashes.get(extract.slug);
      if (!priorHash) {
        added.push(extract);
      } else if (priorHash !== extract.sectionHash) {
        modified.push(extract);
      } else {
        unchanged.push(extract);
      }
    }

    const removed: string[] = [];
    for (const slug of priorHashes.keys()) {
      const stillPresent = params.currentExtracts.some((e) => e.slug === slug);
      if (!stillPresent) removed.push(slug);
    }

    return { added, modified, removed, unchanged };
  }
}

function extractHashMapFromStats(statsJson: unknown): Map<string, string> {
  const map = new Map<string, string>();
  if (!statsJson || typeof statsJson !== 'object') return map;
  const sectionHashes = (statsJson as { sectionHashes?: Record<string, string> }).sectionHashes;
  if (sectionHashes) {
    for (const [slug, hash] of Object.entries(sectionHashes)) {
      map.set(slug, hash);
    }
  }
  return map;
}

let service: ChangeDetectionService | null = null;

export function getChangeDetectionService(): ChangeDetectionService {
  if (!service) service = new ChangeDetectionService();
  return service;
}

export function resetChangeDetectionForTests(): void {
  service = null;
}
