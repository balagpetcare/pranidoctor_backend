import { getPrisma } from '../../../../shared/database/prisma.js';
import { getLogger } from '../../../../shared/logger/logger.js';
import type { AiUsageAttemptInput } from '../../usage/ai-usage.types.js';
import { AI_RATE_VERSION } from '../../usage/ai-usage.tokens.js';

export interface AimsUsageLogInput extends AiUsageAttemptInput {
  taskType?: string;
  routeId?: string;
  providerId?: string;
  modelId?: string;
  promptId?: string;
  failoverRuleId?: string;
  requestId?: string;
  correlationId?: string;
  scopeKey?: string;
  tenantId?: string;
}

function normalizeTaskType(feature: string, taskType?: string): string {
  if (taskType?.trim()) {
    const trimmed = taskType.trim();
    if (trimmed.includes('_')) return trimmed.toUpperCase();
    return trimmed.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
  }
  return feature.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

/** Append-only write to AIMS `ai_usage_logs` — non-blocking on failure. */
export async function writeAimsUsageLog(
  params: AimsUsageLogInput,
  costUsd: number,
  totalTokens: number,
): Promise<void> {
  try {
    const prisma = getPrisma();
    await prisma.aiUsageLog.create({
      data: {
        scopeKey: params.scopeKey ?? 'platform',
        tenantId: params.tenantId ?? params.organizationId ?? null,
        branchId: params.branchId ?? null,
        organizationId: params.organizationId ?? null,
        userId: params.userId ?? null,
        customerId: params.customerId ?? null,
        providerId: params.providerId ?? null,
        modelId: params.modelId ?? null,
        routeId: params.routeId ?? null,
        promptId: params.promptId ?? null,
        failoverRuleId: params.failoverRuleId ?? null,
        taskType: normalizeTaskType(params.feature, params.taskType),
        feature: params.feature,
        providerKey: params.provider,
        modelKey: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        totalTokens,
        costUsd,
        billable: params.success && totalTokens > 0,
        rateVersion: AI_RATE_VERSION,
        latencyMs: params.latencyMs,
        success: params.success,
        errorCode: params.errorCode ?? null,
        isFallback: params.isFallback ?? false,
        fromProviderKey: params.fromProvider ?? null,
        requestId: params.requestId ?? null,
        correlationId: params.correlationId ?? null,
      },
    });
  } catch (err) {
    getLogger().warn(
      { err, feature: params.feature, provider: params.provider },
      'Failed to write AIMS usage log',
    );
  }
}
