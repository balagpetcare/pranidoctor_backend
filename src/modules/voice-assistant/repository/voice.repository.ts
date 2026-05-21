import {
  VoiceBandwidthMode,
  VoiceSessionStatus,
  VoiceSttMode,
  type VoiceSession,
  type VoiceTranscript,
} from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';

import type { VoiceLocale } from '../voice-assistant.types.js';

export class VoiceRepository {
  readonly name = 'VoiceRepository';

  async createSession(params: {
    userId: string;
    locale: VoiceLocale;
    caseId?: string;
    bandwidthMode?: VoiceBandwidthMode;
  }): Promise<VoiceSession> {
    return getPrisma().voiceSession.create({
      data: {
        userId: params.userId,
        locale: params.locale,
        bandwidthMode: params.bandwidthMode ?? VoiceBandwidthMode.FULL,
        status: VoiceSessionStatus.ACTIVE,
        ...(params.caseId ? { caseId: params.caseId } : {}),
      },
    });
  }

  async findSessionForUser(sessionId: string, userId: string): Promise<VoiceSession | null> {
    return getPrisma().voiceSession.findFirst({
      where: { id: sessionId, userId },
    });
  }

  async updateSession(
    sessionId: string,
    data: Partial<{
      aiSessionId: string;
      status: VoiceSessionStatus;
      bandwidthMode: VoiceBandwidthMode;
      interruptedAt: Date | null;
      retryCount: number;
    }>,
  ): Promise<VoiceSession> {
    return getPrisma().voiceSession.update({
      where: { id: sessionId },
      data,
    });
  }

  async addTranscript(params: {
    sessionId: string;
    normalizedText: string;
    rawHint?: string;
    confidence: number;
    sttMode: VoiceSttMode;
    partial: boolean;
    locale: VoiceLocale;
    durationMs?: number;
    audioSizeBytes?: number;
    codec?: string;
    retrySuggested: boolean;
  }): Promise<VoiceTranscript> {
    return getPrisma().voiceTranscript.create({
      data: {
        sessionId: params.sessionId,
        normalizedText: params.normalizedText,
        confidence: params.confidence,
        sttMode: params.sttMode,
        partial: params.partial,
        locale: params.locale,
        retrySuggested: params.retrySuggested,
        retainAudio: false,
        ...(params.rawHint !== undefined ? { rawHint: params.rawHint } : {}),
        ...(params.durationMs !== undefined ? { durationMs: params.durationMs } : {}),
        ...(params.audioSizeBytes !== undefined ? { audioSizeBytes: params.audioSizeBytes } : {}),
        ...(params.codec !== undefined ? { codec: params.codec } : {}),
      },
    });
  }

  async getTranscript(transcriptId: string, sessionId: string): Promise<VoiceTranscript | null> {
    return getPrisma().voiceTranscript.findFirst({
      where: { id: transcriptId, sessionId, partial: false },
    });
  }

  async listTranscripts(sessionId: string) {
    return getPrisma().voiceTranscript.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addNavigationEvent(params: {
    sessionId: string;
    utterance: string;
    aliasMatched?: string;
    action: string;
    success: boolean;
  }) {
    return getPrisma().voiceNavigationEvent.create({
      data: {
        sessionId: params.sessionId,
        utterance: params.utterance,
        action: params.action,
        success: params.success,
        ...(params.aliasMatched !== undefined ? { aliasMatched: params.aliasMatched } : {}),
      },
    });
  }

  async lastNavigationAction(sessionId: string): Promise<string | null> {
    const row = await getPrisma().voiceNavigationEvent.findFirst({
      where: { sessionId, success: true },
      orderBy: { createdAt: 'desc' },
    });
    return row?.action ?? null;
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

let repository: VoiceRepository | null = null;

export function getVoiceRepository(): VoiceRepository {
  if (!repository) repository = new VoiceRepository();
  return repository;
}
