import { getPrisma } from '../../../../shared/database/prisma.js';

import { getKnowledgeGovernanceOrchestratorService } from '../../knowledge-governance/index.js';
import type {
  SeederApprovalStatusResult,
  SeederApprovalSubmitInput,
  SeederApprovalSubmitResult,
} from '../knowledge-seeder.types.js';
import { getSeederAuditService } from './seeder-audit.service.js';

export class SeederApprovalService {
  readonly name = 'SeederApprovalService';

  async submitForReview(input: SeederApprovalSubmitInput): Promise<SeederApprovalSubmitResult> {
    const versionIds = await this.resolveVersionIds(input);
    const governance = getKnowledgeGovernanceOrchestratorService();
    const submitted: string[] = [];
    const skipped: Array<{ versionId: string; reason: string }> = [];

    for (const versionId of versionIds) {
      const version = await getPrisma().vkKnowledgeVersion.findUnique({
        where: { id: versionId },
      });

      if (!version) {
        skipped.push({ versionId, reason: 'VERSION_NOT_FOUND' });
        continue;
      }

      if (version.status !== 'DRAFT' && version.status !== 'CHANGES_REQUESTED') {
        skipped.push({ versionId, reason: `INVALID_STATUS:${version.status}` });
        continue;
      }

      try {
        await governance.submitForReview(
          {
            versionId,
            ...(input.importRunId ? { importRunId: input.importRunId } : {}),
            queueSource: 'SEEDER',
          },
          { id: input.actorId, role: input.actorRole ?? 'KNOWLEDGE_SEEDER' },
        );
        submitted.push(versionId);
      } catch (error) {
        skipped.push({
          versionId,
          reason: error instanceof Error ? error.message : 'SUBMIT_FAILED',
        });
      }
    }

    await getSeederAuditService().record({
      eventType: 'SEEDER_APPROVAL_SUBMIT',
      actorId: input.actorId,
      detail: {
        submittedCount: submitted.length,
        skippedCount: skipped.length,
        ...(input.importRunId ? { importRunId: input.importRunId } : {}),
      },
    });

    return { submitted, skipped };
  }

  async getApprovalStatus(versionIds: string[]): Promise<SeederApprovalStatusResult[]> {
    const governance = getKnowledgeGovernanceOrchestratorService();
    const results: SeederApprovalStatusResult[] = [];

    for (const versionId of versionIds) {
      const version = await getPrisma().vkKnowledgeVersion.findUnique({
        where: { id: versionId },
        include: { entity: true },
      });
      if (!version) continue;

      const stage = await governance.getGovernanceStage(versionId);
      results.push({
        versionId,
        entitySlug: version.entity.slug,
        domain: version.entity.domain,
        governanceStage: stage,
        versionStatus: version.status,
        clinicalRiskTier: version.clinicalRiskTier,
      });
    }

    await getSeederAuditService().record({
      eventType: 'SEEDER_APPROVAL_STATUS',
      detail: { versionCount: results.length },
    });

    return results;
  }

  async listVersionsByImportRun(importRunId: string): Promise<string[]> {
    const versions = await getPrisma().vkKnowledgeVersion.findMany({
      where: { importRunId },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return versions.map((v) => v.id);
  }

  private async resolveVersionIds(input: SeederApprovalSubmitInput): Promise<string[]> {
    if (input.versionIds?.length) return input.versionIds;
    if (input.importRunId) return this.listVersionsByImportRun(input.importRunId);
    return [];
  }
}

let service: SeederApprovalService | null = null;

export function getSeederApprovalService(): SeederApprovalService {
  if (!service) service = new SeederApprovalService();
  return service;
}

export function resetSeederApprovalServiceForTests(): void {
  service = null;
}
