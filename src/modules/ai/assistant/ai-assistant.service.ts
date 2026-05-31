import { AiMessageRole } from '../../../generated/prisma/index.js';
import { NotFoundError, ValidationError } from '../../../shared/errors/http.errors.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval/knowledge-retrieval.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';
import { buildEnrichedPromptContext } from '../knowledge-retrieval/grounding/grounding-engine.js';
import { detectMedicalIntent } from '../knowledge-retrieval/grounding/medical-safety.service.js';
import { getPostLlmValidatorService } from '../knowledge-retrieval/validation/post-llm-validator.service.js';
import { resolveVreConfig } from '../knowledge-retrieval/config/vre-config.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiRepository } from '../ai.repository.js';
import { getAiVeterinaryCoreService } from '../../ai-veterinary-core/ai-veterinary-core.service.js';
import { getAiVeterinaryRepository } from '../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import type { AiChatRequest, AiChatResponse } from '../../ai-veterinary-core/ai-veterinary-core.types.js';

function blockedMessage(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? 'এই প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত পশু চিকিৎসা তথ্য নেই। ওষুধ বা চিকিৎসা সংক্রান্ত পরামর্শের জন্য অনুগ্রহ করে লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
    : 'Insufficient verified veterinary knowledge to answer this safely. Please contact a licensed veterinarian for medical or treatment advice.';
}

export class AiAssistantService {
  readonly name = 'AiAssistantService';

  async chat(userId: string, input: AiChatRequest & { livestockId?: string }): Promise<AiChatResponse> {
    const locale = input.locale ?? 'bn';
    const customerId = await getAiRepository().resolveCustomerId(userId);

    let contextBlock = '';
    let species: import('../../../generated/prisma/index.js').LivestockSpecies | undefined;
    if (input.livestockId && customerId) {
      const animal = await getAiRepository().assertCustomerOwnedLivestock(
        customerId,
        input.livestockId,
      );
      if (animal) {
        contextBlock = `Animal species: ${animal.species}, health status: ${animal.healthStatus}.`;
        species = animal.species;
      }
    }

    const pack = await getKnowledgeRetrievalService().retrieve({
      query: input.message,
      locale,
      taskType: 'GENERAL_CHAT',
      feature: 'AI_ASSISTANT_CHAT',
      ...(species ? { species } : {}),
    });

    if (pack.routingDecision.action === 'BLOCK') {
      return this.respondBlocked(userId, input, locale, pack);
    }

    if (detectMedicalIntent(input.message) && pack.chunks.length === 0) {
      return this.respondBlocked(userId, input, locale, {
        ...pack,
        routingDecision: {
          action: 'BLOCK',
          reason: 'Medical query requires grounded knowledge',
          failClosed: true,
          disclaimerLevel: 'blocking',
          medicalRiskTier: 'HIGH',
        },
      });
    }

    const referenceBlock =
      pack.citationBlock.trim().length > 0 || pack.chunks.length > 0
        ? buildEnrichedPromptContext(pack)
        : '';

    const enrichedMessage = [contextBlock, referenceBlock, input.message]
      .filter(Boolean)
      .join('\n\n');

    const coreResponse = await getAiVeterinaryCoreService().chat(userId, {
      ...input,
      message: enrichedMessage,
    });

    const validation = getPostLlmValidatorService().validate({
      llmOutput: coreResponse.content,
      pack,
      taskType: 'GENERAL_CHAT',
    });

    if (validation.action === 'BLOCK') {
      return this.respondBlocked(userId, input, locale, {
        ...pack,
        routingDecision: {
          action: 'BLOCK',
          reason: validation.failures.map((f) => f.code).join(', ') || 'post_llm_validation',
          failClosed: true,
          disclaimerLevel: 'blocking',
          medicalRiskTier: pack.routingDecision.medicalRiskTier,
        },
      });
    }

    const finalContent =
      validation.action === 'SANITIZE' && validation.sanitizedOutput
        ? validation.sanitizedOutput
        : coreResponse.content;

    await getAiAuditService().write({
      userId,
      sessionId: coreResponse.sessionId,
      action: 'PHASE8_CHAT_ENRICHED',
      detailJson: {
        hasRag: Boolean(pack.citationBlock),
        livestockId: input.livestockId ?? null,
        retrievalPackId: pack.packId,
        routingDecision: pack.routingDecision.action,
        medicalRiskTier: pack.routingDecision.medicalRiskTier,
        chunkCount: pack.chunks.length,
        grounded: pack.chunks.length > 0,
        postLlmValidation: validation.action,
        ...(pack.retrievalMetadata && resolveVreConfig().retrievalMetadataLoggingEnabled
          ? { retrievalMetadata: pack.retrievalMetadata }
          : {}),
      },
    });

    return { ...coreResponse, content: finalContent };
  }

  private async respondBlocked(
    userId: string,
    input: AiChatRequest,
    locale: 'bn' | 'en',
    pack: KnowledgeContextPack,
  ): Promise<AiChatResponse> {
    const repo = getAiVeterinaryRepository();
    let session = input.sessionId
      ? await repo.findSessionForUser(input.sessionId, userId)
      : null;

    if (input.sessionId && !session) {
      throw new NotFoundError('SESSION_NOT_FOUND', 'AI session not found');
    }

    if (!session) {
      session = await repo.createSession(userId, locale, input.caseId);
    }

    await repo.addMessage({
      sessionId: session.id,
      role: AiMessageRole.USER,
      content: input.message.trim(),
      locale,
      inputJson: { message: input.message, blockedRetrieval: true },
    });

    const content = blockedMessage(locale);
    const assistant = await repo.addMessage({
      sessionId: session.id,
      role: AiMessageRole.ASSISTANT,
      content,
      locale,
      refused: true,
      outputJson: {
        retrievalBlocked: true,
        packId: pack.packId,
        reason: pack.routingDecision.reason,
      },
    });

    await getAiAuditService().write({
      userId,
      sessionId: session.id,
      action: 'RETRIEVAL_FAIL_CLOSED',
      detailJson: {
        packId: pack.packId,
        reason: pack.routingDecision.reason,
        chunkCount: pack.chunks.length,
      },
    });

    return {
      sessionId: session.id,
      messageId: assistant.id,
      content,
      refused: true,
      humanRedirect: true,
      escalationRecommended: true,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
    };
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

    const llm = await getAiFoundationService().executePromptTask({
      promptKey: 'farm_assistant',
      userMessage: `${summary}\n\nTop tasks: ${dashboard.recommendations.map((r) => r.title).join('; ')}`,
      locale,
      feature: 'FARM_BRIEFING',
      taskType: 'GENERAL_CHAT',
      userId,
      customerId,
    });

    return {
      farmRef,
      summary,
      briefing: llm.content,
      dashboard,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
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

    const llm = await getAiFoundationService().executePromptTask({
      promptKey: 'farm_assistant',
      userMessage: `Farm data: ${JSON.stringify({
        livestockCount: dashboard.livestockCount,
        herdHealthScore: dashboard.herdHealthScore,
        recommendations: dashboard.recommendations.slice(0, 5),
      })}\n\nUser question: ${query}`,
      locale,
      feature: 'FARM_QUERY',
      taskType: 'GENERAL_CHAT',
      userId,
      customerId,
    });

    return {
      answer: llm.content,
      farmRef,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
    };
  }
}

let service: AiAssistantService | null = null;

export function getAiAssistantService(): AiAssistantService {
  if (!service) service = new AiAssistantService();
  return service;
}