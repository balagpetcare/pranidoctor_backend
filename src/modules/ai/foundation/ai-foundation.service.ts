import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getRequestContext, getRequestId, getTraceId } from '../../../shared/context/request-context.js';
import { getAiPromptService } from '../prompts/ai-prompt.service.js';
import { getAiOrchestratorService } from '../orchestrator/ai-orchestrator.service.js';
import { getAiSettingsService } from '../settings/ai-settings.service.js';
import { countActiveRoutes, getAiProviderRepository } from '../repositories/ai-platform.repository.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

import { resolveFoundationScope } from './ai-scope.util.js';
import { resolveTaskTypeForFeature } from './feature-task-map.js';
import type {
  AiFoundationStatusDto,
  AiPromptTaskRequest,
  AiTaskRequest,
  AiTaskResult,
} from './ai-foundation.types.js';

export class AiFoundationService {
  readonly name = 'AiFoundationService';

  async executeTask(request: AiTaskRequest): Promise<AiTaskResult> {
    const scope = resolveFoundationScope(request.scope);
    const taskType = resolveTaskTypeForFeature(request.feature, request.taskType);
    await getAiSettingsService().getSnapshot(scope);

    const ctx = getRequestContext();
    const requestId = getRequestId() ?? ctx?.requestId ?? 'unknown';
    const correlationId = getTraceId() ?? ctx?.traceId;

    const output = await getAiOrchestratorService().complete(
      omitUndefined({
        feature: request.feature,
        systemPrompt: request.systemPrompt,
        userMessage: request.userMessage,
        locale: request.locale,
        userId: request.userId,
        customerId: request.customerId,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
        taskType,
        scopeKey: scope.scopeKey,
        tenantId: scope.tenantId,
        branchId: scope.branchId,
        sessionId: request.sessionId,
        promptId: request.promptId,
        requestId,
        correlationId,
      }),
    );

    const costUsd = output.usage?.costUsd ?? 0;

    return {
      content: output.content,
      confidence: output.confidence,
      provider: output.provider,
      model: output.model,
      usage: {
        inputTokens: output.inputTokens,
        outputTokens: output.outputTokens,
        costUsd,
        latencyMs: output.latencyMs,
      },
      trace: omitUndefined({
        requestId,
        correlationId,
        routeId: output.trace?.routeId,
        providerId: output.trace?.providerId,
        modelId: output.trace?.modelId,
        taskType,
        isFallback: output.trace?.isFallback ?? false,
      }),
    };
  }

  async executePromptTask(request: AiPromptTaskRequest): Promise<AiTaskResult> {
    const prompt = await getAiPromptService().resolveActive(request.promptKey);
    const systemPrompt = request.locale === 'bn' ? prompt.systemBn : prompt.systemEn;

    let userMessage = request.userMessage;
    if (request.context) {
      for (const [key, value] of Object.entries(request.context)) {
        userMessage = userMessage.replaceAll(`{{${key}}}`, value);
      }
    }

    return this.executeTask(
      omitUndefined({
        feature: request.feature,
        taskType: request.taskType,
        locale: request.locale,
        systemPrompt,
        userMessage,
        userId: request.userId,
        customerId: request.customerId,
        sessionId: request.sessionId,
        scope: request.scope,
        promptId: prompt.id,
      }),
    );
  }

  async getStatus(scopeKey: string = PLATFORM_SCOPE_KEY): Promise<AiFoundationStatusDto> {
    const snapshot = await getAiSettingsService().getSnapshot({ scopeKey });
    const [providerCount, routeCount] = await Promise.all([
      getAiProviderRepository().countActive(scopeKey),
      countActiveRoutes(scopeKey),
    ]);

    return {
      registryOrchestratorEnabled: snapshot.routing.honorDbRoutes !== false,
      honorDbRoutes: snapshot.routing.honorDbRoutes !== false,
      dualUsageWrite: true,
      settingsSource: snapshot.resolvedFrom === 'environment' ? 'environment' : 'database',
      providerCount,
      routeCount,
      checkedAt: new Date().toISOString(),
    };
  }
}

let service: AiFoundationService | null = null;

export function getAiFoundationService(): AiFoundationService {
  if (!service) service = new AiFoundationService();
  return service;
}

export function resetAiFoundationServiceForTests(): void {
  service = null;
}
