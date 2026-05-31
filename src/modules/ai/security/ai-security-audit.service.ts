import { getPrisma } from '../../../shared/database/prisma.js';
import { logAiPlatformEvent } from '../../../shared/monitoring/structured-logging.js';
import type { PromptRiskAssessment } from './prompt-risk.scorer.js';

export class AiSecurityAuditService {
  readonly name = 'AiSecurityAuditService';

  async recordBlockedPrompt(params: {
    feature: string;
    userId?: string;
    customerId?: string;
    assessment: PromptRiskAssessment;
    inputHash: string;
  }): Promise<void> {
    logAiPlatformEvent('ai_prompt_blocked', {
      feature: params.feature,
      userId: params.userId,
      score: params.assessment.score,
      flags: params.assessment.flags,
      reasons: params.assessment.reasons,
    });

    try {
      await getPrisma().aiSafetyAuditLog.create({
        data: {
          userId: params.userId ?? null,
          action: 'PROMPT_BLOCKED',
          detailJson: {
            feature: params.feature,
            customerId: params.customerId ?? null,
            score: params.assessment.score,
            flags: params.assessment.flags,
            reasons: params.assessment.reasons,
            inputHash: params.inputHash,
          },
        },
      });
    } catch {
      // Table may be unavailable in some test environments.
    }
  }

  async listRecent(since: Date, limit = 100) {
    try {
      return await getPrisma().aiSafetyAuditLog.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    } catch {
      return [];
    }
  }
}

let service: AiSecurityAuditService | null = null;

export function getAiSecurityAuditService(): AiSecurityAuditService {
  if (!service) service = new AiSecurityAuditService();
  return service;
}

export function resetAiSecurityAuditServiceForTests(): void {
  service = null;
}
