import { createHash } from 'node:crypto';

import { ValidationError } from '../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getAiSecurityAuditService } from './ai-security-audit.service.js';
import { assessPromptRisk, sanitizeAiRequestInput, sanitizeAiResponseOutput } from './prompt-risk.scorer.js';

export type AiPromptSecurityContext = {
  feature: string;
  userId?: string;
  customerId?: string;
};

export function assertAiPromptAllowed(
  rawInput: string,
  context: AiPromptSecurityContext,
): string {
  const sanitized = sanitizeAiRequestInput(rawInput);
  const assessment = assessPromptRisk(sanitized);

  if (assessment.block) {
    const inputHash = createHash('sha256').update(sanitized).digest('hex').slice(0, 16);
    void getAiSecurityAuditService().recordBlockedPrompt(
      omitUndefined({
        feature: context.feature,
        userId: context.userId,
        customerId: context.customerId,
        assessment,
        inputHash,
      }),
    );
    throw new ValidationError(
      'AI_PROMPT_BLOCKED',
      'Your message could not be processed for safety reasons. Please rephrase your question about animal health.',
      { score: assessment.score, flags: assessment.flags },
    );
  }

  return sanitized;
}

export function filterAiResponseOutput(rawOutput: string): string {
  return sanitizeAiResponseOutput(rawOutput);
}
