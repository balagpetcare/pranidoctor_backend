import { AiMessageRole } from '../../../generated/prisma/index.js';
import type { LivestockSpecies } from '../../../generated/prisma/index.js';
import { NotFoundError } from '../../../shared/errors/http.errors.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getAiVeterinaryRepository } from '../../ai-veterinary-core/repository/ai-veterinary.repository.js';
import { getAiAuditService } from '../audit/ai-audit.service.js';
import { getAiRepository } from '../ai.repository.js';
import { getAiFoundationService } from '../foundation/ai-foundation.service.js';
import { resolveAiResponseDisclaimer } from '../disclaimer/ai-disclaimer.resolver.js';
import { getKnowledgeRetrievalService } from '../knowledge-retrieval/knowledge-retrieval.service.js';
import type { KnowledgeContextPack } from '../knowledge-retrieval/knowledge-retrieval.types.js';
import { buildEnrichedPromptContext } from '../knowledge-retrieval/grounding/grounding-engine.js';
import { getVeterinaryAssistantConfig } from './assistant-registry.js';
import type {
  VeterinaryAssistantId,
  VeterinaryAssistantRequest,
  VeterinaryAssistantResponse,
} from './veterinary-assistant.types.js';

function blockedMessage(locale: 'bn' | 'en', assistantId: VeterinaryAssistantId): string {
  if (assistantId === 'prescription') {
    return locale === 'bn'
      ? 'এই ওষুধ/মাত্রা সম্পর্কিত প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত তথ্য নেই। অনুগ্রহ করে লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের পরামর্শ নিন।'
      : 'Insufficient verified knowledge for this medicine or dosage question. Please consult a licensed veterinarian.';
  }
  if (assistantId === 'emergency') {
    return locale === 'bn'
      ? 'জরুরি অবস্থা — এখনই নিকটস্থ পশু চিকিৎসক বা ক্লিনিকে যোগাযোগ করুন। ফোনে জরুরি পশু চিকিৎসা সেবা খুঁজুন।'
      : 'Emergency — contact a veterinarian or clinic immediately. Use emergency veterinary services in your area.';
  }
  return locale === 'bn'
    ? 'এই প্রশ্নের জন্য পর্যাপ্ত যাচাইকৃত পশু চিকিৎসা তথ্য নেই। ওষুধ বা চিকিৎসা সংক্রান্ত পরামর্শের জন্য অনুগ্রহ করে লাইসেন্সপ্রাপ্ত পশু চিকিৎসকের সাথে যোগাযোগ করুন।'
    : 'Insufficient verified veterinary knowledge to answer this safely. Please contact a licensed veterinarian for medical or treatment advice.';
}

function emergencyHeader(locale: 'bn' | 'en'): string {
  return locale === 'bn'
    ? '⚠️ জরুরি: এখনই পশু চিকিৎসকের সাথে যোগাযোগ করুন।\n\n'
    : '⚠️ EMERGENCY: Contact a veterinarian immediately.\n\n';
}

function formatStructuredFactsBlock(
  facts: KnowledgeContextPack['structuredFacts'],
  locale: 'bn' | 'en',
): string {
  if (facts.length === 0) return '';
  const header = locale === 'bn' ? 'যাচাইকৃত তথ্য (শুধুমাত্র এগুলো ব্যবহার করুন):' : 'Verified facts (use ONLY these):';
  const lines = facts.map(
    (f) => `- ${f.factType}: ${f.value}${f.unit ? ` ${f.unit}` : ''} ${f.sourceCitation}`,
  );
  return [header, ...lines].join('\n');
}

export class VeterinaryAssistantService {
  readonly name = 'VeterinaryAssistantService';

  async ask(input: VeterinaryAssistantRequest): Promise<VeterinaryAssistantResponse> {
    const config = getVeterinaryAssistantConfig(input.assistantId);
    const locale = input.locale ?? 'bn';
    const customerId =
      input.customerId ?? (await getAiRepository().resolveCustomerId(input.userId)) ?? undefined;

    let contextBlock = '';
    let species: LivestockSpecies | undefined;
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
      taskType: config.taskType,
      feature: config.featureKey,
      profileId: config.retrievalProfileId,
      ...(species ? { species } : {}),
    });

    if (pack.routingDecision.action === 'BLOCK') {
      return this.respondBlocked(input, locale, config.assistantId, pack);
    }

    if (config.assistantId === 'emergency' && pack.chunks.length === 0) {
      return this.respondBlocked(input, locale, config.assistantId, pack, true);
    }

    if (config.assistantId === 'prescription' && pack.structuredFacts.length === 0) {
      return this.respondBlocked(input, locale, config.assistantId, pack);
    }

    let referenceBlock = '';
    if (pack.citationBlock.trim().length > 0 || pack.chunks.length > 0) {
      referenceBlock = buildEnrichedPromptContext(pack);
      if (config.assistantId === 'emergency') {
        referenceBlock = emergencyHeader(locale) + referenceBlock;
      }
    }

    const factsBlock = formatStructuredFactsBlock(pack.structuredFacts, locale);
    const enrichedMessage = [contextBlock, factsBlock, referenceBlock, input.message]
      .filter(Boolean)
      .join('\n\n');

    const llm = await getAiFoundationService().executePromptTask(
      omitUndefined({
        promptKey: config.promptKey,
        userMessage: enrichedMessage,
        locale,
        feature: config.featureKey,
        taskType: config.taskType,
        userId: input.userId,
        customerId,
        sessionId: input.sessionId,
      }),
    );

    const session = await this.persistExchange(input, locale, enrichedMessage, llm.content, pack, false);

    await getAiAuditService().write({
      userId: input.userId,
      sessionId: session.sessionId,
      action: `ASSISTANT_${config.assistantId.toUpperCase().replace(/-/g, '_')}`,
      detailJson: {
        assistantId: config.assistantId,
        packId: pack.packId,
        routingDecision: pack.routingDecision.action,
        chunkCount: pack.chunks.length,
        provider: llm.provider,
        model: llm.model,
        taskType: config.taskType,
      },
    });

    const humanRedirect =
      pack.routingDecision.action === 'PROCEED_DEGRADED' ||
      config.assistantId === 'emergency' ||
      config.assistantId === 'prescription';

    return {
      assistantId: config.assistantId,
      sessionId: session.sessionId,
      messageId: session.messageId,
      content: llm.content,
      refused: false,
      humanRedirect,
      escalationRecommended: humanRedirect,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
      retrieval: {
        packId: pack.packId,
        profileId: pack.retrievalProfileId,
        routingDecision: pack.routingDecision.action,
        retrievalMode: pack.retrievalMode,
        chunkCount: pack.chunks.length,
        citationBlock: pack.citationBlock,
      },
      structuredFacts: pack.structuredFacts,
      pack,
    };
  }

  private async respondBlocked(
    input: VeterinaryAssistantRequest,
    locale: 'bn' | 'en',
    assistantId: VeterinaryAssistantId,
    pack: KnowledgeContextPack,
    forceEscalation = false,
  ): Promise<VeterinaryAssistantResponse> {
    const content = blockedMessage(locale, assistantId);
    const session = await this.persistExchange(input, locale, input.message, content, pack, true);

    await getAiAuditService().write({
      userId: input.userId,
      sessionId: session.sessionId,
      action: 'RETRIEVAL_FAIL_CLOSED',
      detailJson: {
        assistantId,
        packId: pack.packId,
        reason: pack.routingDecision.reason,
        chunkCount: pack.chunks.length,
        forceEscalation,
      },
    });

    return {
      assistantId,
      sessionId: session.sessionId,
      messageId: session.messageId,
      content,
      refused: true,
      humanRedirect: true,
      escalationRecommended: true,
      disclaimer: await resolveAiResponseDisclaimer('advisory', locale),
      retrieval: {
        packId: pack.packId,
        profileId: pack.retrievalProfileId,
        routingDecision: pack.routingDecision.action,
        retrievalMode: pack.retrievalMode,
        chunkCount: pack.chunks.length,
        citationBlock: pack.citationBlock,
      },
      structuredFacts: pack.structuredFacts,
      pack,
    };
  }

  private async persistExchange(
    input: VeterinaryAssistantRequest,
    locale: 'bn' | 'en',
    _userContent: string,
    assistantContent: string,
    pack: KnowledgeContextPack,
    refused: boolean,
  ): Promise<{ sessionId: string; messageId: string }> {
    const repo = getAiVeterinaryRepository();
    let session = input.sessionId
      ? await repo.findSessionForUser(input.sessionId, input.userId)
      : null;

    if (input.sessionId && !session) {
      throw new NotFoundError('SESSION_NOT_FOUND', 'AI session not found');
    }

    if (!session) {
      session = await repo.createSession(input.userId, locale, input.caseId);
    }

    await repo.addMessage({
      sessionId: session.id,
      role: AiMessageRole.USER,
      content: input.message.trim(),
      locale,
      inputJson: {
        message: input.message,
        assistantId: input.assistantId,
        packId: pack.packId,
      },
    });

    const assistant = await repo.addMessage({
      sessionId: session.id,
      role: AiMessageRole.ASSISTANT,
      content: assistantContent,
      locale,
      refused,
      outputJson: {
        assistantId: input.assistantId,
        packId: pack.packId,
        routingDecision: pack.routingDecision.action,
        retrievalProfileId: pack.retrievalProfileId,
      },
    });

    return { sessionId: session.id, messageId: assistant.id };
  }
}

let service: VeterinaryAssistantService | null = null;

export function getVeterinaryAssistantService(): VeterinaryAssistantService {
  if (!service) service = new VeterinaryAssistantService();
  return service;
}

export function resetVeterinaryAssistantServiceForTests(): void {
  service = null;
}
