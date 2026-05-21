import type { Prisma } from '../../../generated/prisma/index.js';
import {
  AiAssistantStatus,
  AiEscalationReason,
  AiEscalationStatus,
  AiMemoryKind,
  AiMessageRole,
  type AiAssistantMemory,
  type AiAssistantSession,
  type AiEscalationRecord,
  type AiSafetyAuditLog,
  type AiTriageRecord,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import type { AiLocale } from '../ai-veterinary-core.types.js';

export class AiVeterinaryRepository {
  readonly name = 'AiVeterinaryRepository';

  async createSession(userId: string, locale: AiLocale, caseId?: string): Promise<AiAssistantSession> {
    return getPrisma().aiAssistantSession.create({
      data: {
        userId,
        locale,
        ...(caseId ? { caseId } : {}),
        status: AiAssistantStatus.ACTIVE,
      },
    });
  }

  async findSessionForUser(sessionId: string, userId: string): Promise<AiAssistantSession | null> {
    return getPrisma().aiAssistantSession.findFirst({
      where: { id: sessionId, userId },
    });
  }

  async addMessage(params: {
    sessionId: string;
    role: AiMessageRole;
    content: string;
    locale?: AiLocale;
    inputJson?: Prisma.InputJsonValue;
    outputJson?: Prisma.InputJsonValue;
    refused?: boolean;
  }) {
    return getPrisma().aiAssistantMessage.create({
      data: {
        sessionId: params.sessionId,
        role: params.role,
        content: params.content,
        refused: params.refused ?? false,
        ...(params.locale !== undefined ? { locale: params.locale } : {}),
        ...(params.inputJson !== undefined ? { inputJson: params.inputJson } : {}),
        ...(params.outputJson !== undefined ? { outputJson: params.outputJson } : {}),
      },
    });
  }

  async getRecentMessages(sessionId: string, take = 10) {
    return getPrisma().aiAssistantMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async upsertMemory(params: {
    userId: string;
    kind: AiMemoryKind;
    key: string;
    valueJson: Prisma.InputJsonValue;
    sessionId?: string;
    expiresAt?: Date | null;
  }): Promise<AiAssistantMemory> {
    return getPrisma().aiAssistantMemory.upsert({
      where: {
        userId_kind_key: {
          userId: params.userId,
          kind: params.kind,
          key: params.key,
        },
      },
      create: {
        userId: params.userId,
        kind: params.kind,
        key: params.key,
        valueJson: params.valueJson,
        sessionId: params.sessionId ?? null,
        expiresAt: params.expiresAt ?? null,
      },
      update: {
        valueJson: params.valueJson,
        sessionId: params.sessionId ?? null,
        expiresAt: params.expiresAt ?? null,
      },
    });
  }

  async listMemory(userId: string, kind?: AiMemoryKind, key?: string) {
    return getPrisma().aiAssistantMemory.findMany({
      where: {
        userId,
        ...(kind ? { kind } : {}),
        ...(key ? { key } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async deleteMemory(userId: string, kind?: AiMemoryKind, key?: string): Promise<number> {
    const result = await getPrisma().aiAssistantMemory.deleteMany({
      where: {
        userId,
        ...(kind ? { kind } : {}),
        ...(key ? { key } : {}),
      },
    });
    return result.count;
  }

  async createTriage(params: {
    userId: string;
    sessionId?: string;
    caseId?: string;
    riskBucket: AiTriageRecord['riskBucket'];
    urgencyLevel: number;
    recommendation: string;
    escalationRequired: boolean;
    symptomsJson?: Prisma.InputJsonValue;
    mediaMetadataJson?: Prisma.InputJsonValue;
  }): Promise<AiTriageRecord> {
    return getPrisma().aiTriageRecord.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId ?? null,
        caseId: params.caseId ?? null,
        riskBucket: params.riskBucket,
        urgencyLevel: params.urgencyLevel,
        recommendation: params.recommendation,
        escalationRequired: params.escalationRequired,
        ...(params.symptomsJson !== undefined ? { symptomsJson: params.symptomsJson } : {}),
        ...(params.mediaMetadataJson !== undefined ? { mediaMetadataJson: params.mediaMetadataJson } : {}),
      },
    });
  }

  async createEscalation(params: {
    userId: string;
    sessionId?: string;
    caseId?: string;
    reason: AiEscalationReason;
    handoffNote?: string;
    status?: AiEscalationStatus;
  }): Promise<AiEscalationRecord> {
    return getPrisma().aiEscalationRecord.create({
      data: {
        userId: params.userId,
        sessionId: params.sessionId ?? null,
        caseId: params.caseId ?? null,
        reason: params.reason,
        handoffNote: params.handoffNote ?? null,
        status: params.status ?? AiEscalationStatus.PENDING_REVIEW,
      },
    });
  }

  async markSessionEscalated(sessionId: string): Promise<void> {
    await getPrisma().aiAssistantSession.update({
      where: { id: sessionId },
      data: { status: AiAssistantStatus.ESCALATED },
    });
  }

  async writeAudit(params: {
    userId?: string;
    sessionId?: string;
    action: string;
    detailJson?: Prisma.InputJsonValue;
  }): Promise<AiSafetyAuditLog> {
    return getPrisma().aiSafetyAuditLog.create({
      data: {
        userId: params.userId ?? null,
        sessionId: params.sessionId ?? null,
        action: params.action,
        ...(params.detailJson !== undefined ? { detailJson: params.detailJson } : {}),
      },
    });
  }

  async customerOwnsCase(userId: string, caseId: string): Promise<boolean> {
    const profile = await getPrisma().customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) return false;
    const row = await getPrisma().serviceRequest.findFirst({
      where: { id: caseId, customerId: profile.id },
      select: { id: true },
    });
    return Boolean(row);
  }
}

let repository: AiVeterinaryRepository | null = null;

export function getAiVeterinaryRepository(): AiVeterinaryRepository {
  if (!repository) repository = new AiVeterinaryRepository();
  return repository;
}
