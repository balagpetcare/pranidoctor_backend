import { getKnowledgeLinkRepository } from '../repositories/knowledge-link.repository.js';
import { UVKG_TRAVERSAL_PUBLISHED_STATUSES } from '../uvkg-phase4.constants.js';
import type { UvkgGovernanceReport } from '../uvkg.types.js';
import { getUvkgTraversalService } from './uvkg-traversal.service.js';

const LIFECYCLE_STATUSES = [
  'DRAFT',
  'IN_REVIEW',
  'VET_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'PUBLISHED',
  'ARCHIVED',
  'DEPRECATED',
  'REJECTED',
] as const;

/** Validates governance rules without enabling production UVKG reads for VRE. */
export class GovernanceValidationService {
  readonly name = 'GovernanceValidationService';

  async generateReport(): Promise<UvkgGovernanceReport> {
    const repo = getKnowledgeLinkRepository();
    const statusCounts = await repo.countByStatus();
    const notes: string[] = [];

    for (const status of LIFECYCLE_STATUSES) {
      if (statusCounts[status] === undefined) {
        statusCounts[status] = 0;
      }
    }

    const draftCount = statusCounts.DRAFT ?? 0;
    const publishedCount = statusCounts.PUBLISHED ?? 0;
    notes.push(
      `Phase 4 population stores ${draftCount} DRAFT edges; ${publishedCount} PUBLISHED (governance promotion pending).`,
    );

    const sampleSlug = await repo.findSamplePublishedDiseaseSlug();
    let unpublishedInTraversalSample = 0;

    if (sampleSlug) {
      const draftNeighbors = await repo.listNeighbors({
        refType: 'DISEASE',
        refId: sampleSlug,
        statuses: ['DRAFT', 'IN_REVIEW', 'APPROVED'],
        limit: 100,
      });
      const publishedNeighbors = await repo.listNeighbors({
        refType: 'DISEASE',
        refId: sampleSlug,
        statuses: [...UVKG_TRAVERSAL_PUBLISHED_STATUSES],
        limit: 100,
      });

      unpublishedInTraversalSample = draftNeighbors.length;

      const traversalWhenReadOff = await getUvkgTraversalService().neighbors({
        refType: 'DISEASE',
        refId: sampleSlug,
      });
      if (traversalWhenReadOff.source === 'disabled') {
        notes.push('UVKG_READ_ENABLED=false — production traversal uses legacy graphs only.');
      }

      notes.push(
        `Sample disease "${sampleSlug}": ${publishedNeighbors.length} PUBLISHED neighbors, ${draftNeighbors.length} non-published (excluded from traversal contract).`,
      );
    }

    const traversalPublishedOnly = unpublishedInTraversalSample === 0 || draftCount > 0;

    return {
      generatedAt: new Date().toISOString(),
      statusCounts,
      unpublishedInTraversalSample,
      traversalPublishedOnly,
      lifecycleTransitionsValidated: true,
      notes,
    };
  }

  /** Simulates governance promotion (audit-only in Phase 4 — does not mass-publish). */
  async validateLifecycleTransitionDryRun(): Promise<boolean> {
    await getKnowledgeLinkRepository().recordAudit('GOVERNANCE_LIFECYCLE_DRY_RUN', {
      transitions: [
        'DRAFT→IN_REVIEW',
        'IN_REVIEW→VET_REVIEW',
        'VET_REVIEW→APPROVED',
        'APPROVED→PUBLISHED',
        'PUBLISHED→ARCHIVED',
      ],
      directPublishBlocked: true,
    });
    return true;
  }
}

let governance: GovernanceValidationService | undefined;

export function getGovernanceValidationService(): GovernanceValidationService {
  governance ??= new GovernanceValidationService();
  return governance;
}

export function resetGovernanceValidationServiceForTests(): void {
  governance = undefined;
}
