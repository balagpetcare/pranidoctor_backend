import { addDays } from 'date-fns';

import {
  AiEscalationReason,
  AiMemoryKind,
  AiMessageRole,
} from '../../generated/prisma/index.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/http.errors.js';

import type {
  AiChatRequest,
  AiChatResponse,
  AiEscalateRequest,
  AiEscalationDto,
  AiLocale,
  AiMemoryDeleteQuery,
  AiMemoryEntry,
  AiMemoryQuery,
  AiTriageRequest,
  AiTriageResponse,
} from './ai-veterinary-core.types.js';
import { AI_DISCLAIMER, AI_MEMORY_TTL_DAYS } from './ai-veterinary-core.types.js';
import { getAiVeterinaryRepository } from './repository/ai-veterinary.repository.js';
import { getAiProvider } from './provider/rules-based.provider.js';
import { getAiSafetyService } from './safety/ai-safety.service.js';

function memoryExpiry(kind: AiMemoryKind): Date {
  return addDays(new Date(), AI_MEMORY_TTL_DAYS[kind]);
}

function mapMemory(row: {
  id: string;
  kind: AiMemoryKind;
  key: string;
  valueJson: unknown;
  expiresAt: Date | null;
  updatedAt: Date;
}): AiMemoryEntry {
  return {
    id: row.id,
    kind: row.kind,
    key: row.key,
    value: row.valueJson,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapEscalation(row: {
  id: string;
  reason: AiEscalationDto['reason'];
  status: AiEscalationDto['status'];
  caseId: string | null;
  sessionId: string | null;
  handoffNote: string | null;
  flaggedAt: Date;
}): AiEscalationDto {
  return {
    id: row.id,
    reason: row.reason,
    status: row.status,
    caseId: row.caseId,
    sessionId: row.sessionId,
    handoffNote: row.handoffNote,
    flaggedAt: row.flaggedAt.toISOString(),
  };
}

export class AiVeterinaryCoreService {
  readonly name = 'AiVeterinaryCoreService';

  async chat(userId: string, input: AiChatRequest): Promise<AiChatResponse> {
    const repo = getAiVeterinaryRepository();
    const safety = getAiSafetyService();
    const locale: AiLocale = input.locale ?? 'bn';

    if (input.caseId && !(await repo.customerOwnsCase(userId, input.caseId))) {
      throw new ForbiddenError('CASE_ACCESS_DENIED', 'Case not accessible');
    }

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
      inputJson: { message: input.message, caseId: input.caseId ?? null },
    });

    const inputRefusal = safety.evaluateUserInput(input.message, locale);
    if (inputRefusal) {
      const assistant = await repo.addMessage({
        sessionId: session.id,
        role: AiMessageRole.ASSISTANT,
        content: inputRefusal.content,
        locale,
        refused: true,
        outputJson: { auditAction: inputRefusal.auditAction },
      });

      await repo.writeAudit({
        userId,
        sessionId: session.id,
        action: inputRefusal.auditAction,
        detailJson: { refused: true },
      });

      if (inputRefusal.escalationRecommended) {
        await this.createEscalationInternal(userId, {
          sessionId: session.id,
          reason: AiEscalationReason.POLICY_REFUSAL,
          handoffNote: 'Policy refusal during chat',
          ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
        });
      }

      return {
        sessionId: session.id,
        messageId: assistant.id,
        content: inputRefusal.content,
        refused: true,
        humanRedirect: inputRefusal.humanRedirect,
        escalationRecommended: inputRefusal.escalationRecommended,
        disclaimer: AI_DISCLAIMER[locale],
      };
    }

    const memories = await repo.listMemory(userId, AiMemoryKind.CASE_CONTEXT);
    const contextSummary = memories.map((m) => JSON.stringify(m.valueJson)).join('; ');

    const providerOut = await getAiProvider().complete({
      message: input.message,
      locale,
      ...(contextSummary ? { contextSummary } : {}),
    });

    const evaluated = safety.evaluateProviderOutput(providerOut, locale);

    const assistant = await repo.addMessage({
      sessionId: session.id,
      role: AiMessageRole.ASSISTANT,
      content: evaluated.content,
      locale,
      refused: evaluated.refused,
      outputJson: {
        confidence: evaluated.confidence,
        auditAction: evaluated.auditAction,
      },
    });

    await repo.upsertMemory({
      userId,
      sessionId: session.id,
      kind: AiMemoryKind.CONVERSATION,
      key: session.id,
      valueJson: { lastMessageAt: new Date().toISOString() },
      expiresAt: memoryExpiry(AiMemoryKind.CONVERSATION),
    });

    await repo.writeAudit({
      userId,
      sessionId: session.id,
      action: evaluated.auditAction,
      detailJson: {
        confidence: evaluated.confidence,
        refused: evaluated.refused,
      },
    });

    let escalationRecommended = evaluated.escalationRecommended;
    if (escalationRecommended) {
      await this.createEscalationInternal(userId, {
        sessionId: session.id,
        reason: AiEscalationReason.LOW_CONFIDENCE,
        handoffNote: 'Low confidence assistant output',
        ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
      });
    }

    return {
      sessionId: session.id,
      messageId: assistant.id,
      content: evaluated.content,
      refused: evaluated.refused,
      humanRedirect: evaluated.humanRedirect,
      escalationRecommended,
      disclaimer: AI_DISCLAIMER[locale],
    };
  }

  async triage(userId: string, input: AiTriageRequest): Promise<AiTriageResponse> {
    const repo = getAiVeterinaryRepository();
    const safety = getAiSafetyService();
    const locale: AiLocale = input.locale ?? 'bn';

    if (input.caseId && !(await repo.customerOwnsCase(userId, input.caseId))) {
      throw new ForbiddenError('CASE_ACCESS_DENIED', 'Case not accessible');
    }

    const assessment = safety.evaluateTriage(input.symptoms);

    const triage = await repo.createTriage({
      userId,
      riskBucket: assessment.bucket,
      urgencyLevel: assessment.urgencyLevel,
      recommendation: assessment.recommendation,
      escalationRequired: assessment.escalationRequired,
      symptomsJson: input.symptoms,
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
      ...(input.mediaMetadata !== undefined
        ? { mediaMetadataJson: input.mediaMetadata as never }
        : {}),
    });

    await repo.writeAudit({
      userId,
      action: assessment.auditAction,
      detailJson: {
        triageId: triage.id,
        riskBucket: assessment.bucket,
      },
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    });

    let escalationId: string | undefined;
    if (assessment.escalationRequired) {
      const reason =
        assessment.urgencyLevel >= 10
          ? AiEscalationReason.EMERGENCY_SYMPTOM
          : AiEscalationReason.HIGH_RISK;
      const escalation = await this.createEscalationInternal(userId, {
        reason,
        handoffNote: assessment.recommendation,
        ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
        ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
      });
      escalationId = escalation.id;
    }

    if (input.caseId) {
      await repo.upsertMemory({
        userId,
        kind: AiMemoryKind.CASE_CONTEXT,
        key: input.caseId,
        valueJson: {
          lastTriageAt: new Date().toISOString(),
          symptoms: input.symptoms,
          riskBucket: assessment.bucket,
        },
        expiresAt: memoryExpiry(AiMemoryKind.CASE_CONTEXT),
      });
    }

    return {
      triageId: triage.id,
      riskBucket: assessment.bucket,
      urgencyLevel: assessment.urgencyLevel,
      recommendation: assessment.recommendation,
      escalationRequired: assessment.escalationRequired,
      ...(escalationId ? { escalationId } : {}),
      disclaimer: AI_DISCLAIMER[locale],
    };
  }

  async listMemory(userId: string, query: AiMemoryQuery): Promise<AiMemoryEntry[]> {
    const rows = await getAiVeterinaryRepository().listMemory(userId, query.kind, query.key);
    return rows.map(mapMemory);
  }

  async deleteMemory(userId: string, query: AiMemoryDeleteQuery): Promise<{ deleted: number }> {
    if (query.all) {
      return { deleted: await getAiVeterinaryRepository().deleteMemory(userId) };
    }
    return {
      deleted: await getAiVeterinaryRepository().deleteMemory(userId, query.kind, query.key),
    };
  }

  async escalate(userId: string, input: AiEscalateRequest): Promise<AiEscalationDto> {
    if (input.caseId && !(await getAiVeterinaryRepository().customerOwnsCase(userId, input.caseId))) {
      throw new ForbiddenError('CASE_ACCESS_DENIED', 'Case not accessible');
    }

    const escalation = await this.createEscalationInternal(userId, input);
    return mapEscalation(escalation);
  }

  private async createEscalationInternal(userId: string, input: AiEscalateRequest) {
    const repo = getAiVeterinaryRepository();
    const escalation = await repo.createEscalation({
      userId,
      reason: input.reason,
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
      ...(input.handoffNote !== undefined ? { handoffNote: input.handoffNote } : {}),
    });

    if (input.sessionId) {
      await repo.markSessionEscalated(input.sessionId);
    }

    await repo.writeAudit({
      userId,
      action: 'ESCALATION_CREATED',
      detailJson: {
        escalationId: escalation.id,
        reason: input.reason,
        caseId: input.caseId ?? null,
      },
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    });

    return escalation;
  }
}

let service: AiVeterinaryCoreService | null = null;

export function getAiVeterinaryCoreService(): AiVeterinaryCoreService {
  if (!service) service = new AiVeterinaryCoreService();
  return service;
}
