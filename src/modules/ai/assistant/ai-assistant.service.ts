import { ValidationError } from '../../../shared/errors/http.errors.js';
import { getAiKnowledgeService } from '../knowledge/ai-knowledge.service.js';
import { getAiOrchestratorService } from '../orchestrator/ai-orchestrator.service.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiRepository } from '../ai.repository.js';
import { getAiVeterinaryCoreService } from '../../ai-veterinary-core/ai-veterinary-core.service.js';
import type { AiChatRequest, AiChatResponse } from '../../ai-veterinary-core/ai-veterinary-core.types.js';

export class AiAssistantService {
  readonly name = 'AiAssistantService';

  async chat(userId: string, input: AiChatRequest & { livestockId?: string }): Promise<AiChatResponse> {
    const locale = input.locale ?? 'bn';
    const customerId = await getAiRepository().resolveCustomerId(userId);

    let contextBlock = '';
    if (input.livestockId && customerId) {
      const animal = await getAiRepository().assertCustomerOwnedLivestock(
        customerId,
        input.livestockId,
      );
      if (animal) {
        contextBlock = `Animal species: ${animal.species}, health status: ${animal.healthStatus}.`;
      }
    }

    const rag = await getAiKnowledgeService().retrieveForRag({
      query: input.message,
      locale,
    });

    const enrichedMessage = [contextBlock, rag ? `Reference:\n${rag}` : '', input.message]
      .filter(Boolean)
      .join('\n\n');

    const coreResponse = await getAiVeterinaryCoreService().chat(userId, {
      ...input,
      message: enrichedMessage,
    });

    await getAiAuditService().write({
      userId,
      sessionId: coreResponse.sessionId,
      action: 'PHASE8_CHAT_ENRICHED',
      detailJson: { hasRag: Boolean(rag), livestockId: input.livestockId ?? null },
    });

    return coreResponse;
  }

  async farmBriefing(userId: string, farmRef: string, locale: 'bn' | 'en' = 'bn') {
    const customerId = await getAiRepository().resolveCustomerId(userId);
    if (!customerId) throw new ValidationError('CUSTOMER_REQUIRED', 'Customer profile required');
    await getAiRepository().assertCustomerOwnedFarm(customerId, farmRef);

    const { getFarmHealthService } = await import('../farm-health/farm-health.service.js');
    const dashboard = await getFarmHealthService().getDashboard(customerId, farmRef, locale);

    const summary =
      locale === 'bn'
        ? `খামার: ${dashboard.livestockCount}টি পশু, ঝিড় স্বাস্থ্য স্কোর ${dashboard.herdHealthScore}/100, ঝুঁকি ${dashboard.farmRiskScore}/100.`
        : `Farm summary: ${dashboard.livestockCount} animals, herd health ${dashboard.herdHealthScore}/100, risk ${dashboard.farmRiskScore}/100.`;

    const llm = await getAiOrchestratorService().completeWithPromptKey({
      promptKey: 'farm_assistant',
      userMessage: `${summary}\n\nTop tasks: ${dashboard.recommendations.map((r) => r.title).join('; ')}`,
      locale,
      feature: 'FARM_BRIEFING',
      userId,
      customerId,
    });

    return {
      farmRef,
      summary,
      briefing: llm.content,
      dashboard,
      disclaimer:
        locale === 'bn'
          ? 'এটি সহায়ক তথ্য — চিকিৎসা নির্ণয় নয়।'
          : 'Assistive information only — not a diagnosis.',
    };
  }

  async farmQuery(
    userId: string,
    query: string,
    farmRef: string,
    locale: 'bn' | 'en' = 'bn',
  ) {
    const customerId = await getAiRepository().resolveCustomerId(userId);
    if (!customerId) throw new ValidationError('CUSTOMER_REQUIRED', 'Customer profile required');
    await getAiRepository().assertCustomerOwnedFarm(customerId, farmRef);

    const { getFarmHealthService } = await import('../farm-health/farm-health.service.js');
    const dashboard = await getFarmHealthService().getDashboard(customerId, farmRef, locale);

    const llm = await getAiOrchestratorService().completeWithPromptKey({
      promptKey: 'farm_assistant',
      userMessage: `Farm data: ${JSON.stringify({
        livestockCount: dashboard.livestockCount,
        herdHealthScore: dashboard.herdHealthScore,
        recommendations: dashboard.recommendations.slice(0, 5),
      })}\n\nUser question: ${query}`,
      locale,
      feature: 'FARM_QUERY',
      userId,
      customerId,
    });

    return {
      answer: llm.content,
      farmRef,
      disclaimer:
        locale === 'bn'
          ? 'ডেটা-ভিত্তিক সহায়তা — গুরুত্বপূর্ণ সিদ্ধান্তে চিকিৎসক/consult করুন।'
          : 'Data-assisted guidance — consult a vet for critical decisions.',
    };
  }
}

let service: AiAssistantService | null = null;

export function getAiAssistantService(): AiAssistantService {
  if (!service) service = new AiAssistantService();
  return service;
}
