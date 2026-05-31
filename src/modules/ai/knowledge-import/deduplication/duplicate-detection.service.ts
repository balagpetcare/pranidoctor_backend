import { getPrisma } from '../../../../shared/database/prisma.js';

import type { DedupResult, NormalizedEntityDraft } from '../knowledge-import.types.js';

export class DuplicateDetectionService {
  readonly name = 'DuplicateDetectionService';

  async detect(
    draft: NormalizedEntityDraft,
    context: {
      importRunId: string;
      documentChecksum?: string;
      seenKeys: Set<string>;
    },
  ): Promise<DedupResult> {
    if (context.seenKeys.has(draft.dedupKey)) {
      return { decision: 'SKIP_DUPLICATE' };
    }
    context.seenKeys.add(draft.dedupKey);

    const existingEntity = await getPrisma().vkKnowledgeEntity.findUnique({
      where: { slug: draft.slug },
      include: {
        publishedVersion: true,
        draftVersion: true,
      },
    });

    if (!existingEntity) {
      return { decision: 'CREATE_NEW' };
    }

    if (existingEntity.publishedVersion) {
      const publishedBody = existingEntity.publishedVersion.bodyEn;
      if (hasDoseConflict(draft.bodyEn, publishedBody, draft.clinicalRiskTier)) {
        return {
          decision: 'QUARANTINE_CONFLICT',
          existingEntityId: existingEntity.id,
          existingSlug: existingEntity.slug,
          conflictFields: ['bodyEn'],
        };
      }
      return {
        decision: 'SUPERSEDE',
        existingEntityId: existingEntity.id,
        existingSlug: existingEntity.slug,
      };
    }

    if (existingEntity.draftVersion) {
      return {
        decision: 'MERGE_FIELDS',
        existingEntityId: existingEntity.id,
        existingSlug: existingEntity.slug,
      };
    }

    return {
      decision: 'SUPERSEDE',
      existingEntityId: existingEntity.id,
      existingSlug: existingEntity.slug,
    };
  }
}

function hasDoseConflict(a: string, b: string, riskTier: string): boolean {
  if (riskTier !== 'HIGH' && riskTier !== 'CRITICAL') return false;
  const dosePattern = /\d+\s*(mg|ml|mcg)/gi;
  const dosesA = a.match(dosePattern)?.sort().join(',') ?? '';
  const dosesB = b.match(dosePattern)?.sort().join(',') ?? '';
  return dosesA.length > 0 && dosesB.length > 0 && dosesA !== dosesB;
}

let service: DuplicateDetectionService | null = null;

export function getDuplicateDetectionService(): DuplicateDetectionService {
  if (!service) service = new DuplicateDetectionService();
  return service;
}

export function resetDuplicateDetectionForTests(): void {
  service = null;
}
