import {
  VoiceBandwidthMode,
  VoiceSessionStatus,
} from '../../generated/prisma/index.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors/http.errors.js';

import { getAiVeterinaryCoreService } from '../ai-veterinary-core/ai-veterinary-core.service.js';
import { resolveNavigationCommand } from './navigation/voice-navigation.engine.js';
import { getVoiceRepository } from './repository/voice.repository.js';
import { getSttAdapter } from './stt/stt.adapter.js';
import { getTtsAdapter } from './tts/tts.adapter.js';
import type {
  SttRequest,
  SttResponse,
  VoiceChatRequest,
  VoiceChatResponse,
  VoiceLocale,
  VoiceNavigationAction,
  VoiceNavigationRequest,
  VoiceNavigationResponse,
  VoiceSessionDto,
} from './voice-assistant.types.js';
import { VOICE_MAX_RETRIES as MAX_RETRIES } from './voice-assistant.types.js';

export class VoiceAssistantService {
  readonly name = 'VoiceAssistantService';

  async stt(userId: string, input: SttRequest): Promise<SttResponse> {
    const repo = getVoiceRepository();
    const locale: VoiceLocale = input.locale ?? 'bn';
    const confidence = input.confidence ?? 0.75;

    if (input.caseId && !(await repo.customerOwnsCase(userId, input.caseId))) {
      throw new ForbiddenError('CASE_ACCESS_DENIED', 'Case not accessible');
    }

    let session = input.sessionId
      ? await repo.findSessionForUser(input.sessionId, userId)
      : null;

    if (input.sessionId && !session) {
      throw new NotFoundError('VOICE_SESSION_NOT_FOUND', 'Voice session not found');
    }

    if (!session) {
      session = await repo.createSession({
        userId,
        locale,
        ...(input.caseId !== undefined ? { caseId: input.caseId } : {}),
      });
    }

    const sttOut = getSttAdapter().transcribe({
      transcript: input.transcript,
      locale,
      confidence,
    });

    let retryCount = session.retryCount;
    if (sttOut.retrySuggested) {
      retryCount += 1;
      await repo.updateSession(session.id, { retryCount });
    }

    const transcript = await repo.addTranscript({
      sessionId: session.id,
      normalizedText: sttOut.normalizedText,
      rawHint: input.transcript.trim(),
      confidence: sttOut.confidence,
      sttMode: input.mode,
      partial: input.partial ?? false,
      locale,
      retrySuggested: sttOut.retrySuggested && retryCount < MAX_RETRIES,
      ...(input.audioMetadata?.durationMs !== undefined
        ? { durationMs: input.audioMetadata.durationMs }
        : {}),
      ...(input.audioMetadata?.sizeBytes !== undefined
        ? { audioSizeBytes: input.audioMetadata.sizeBytes }
        : {}),
      ...(input.audioMetadata?.codec !== undefined ? { codec: input.audioMetadata.codec } : {}),
    });

    return {
      sessionId: session.id,
      transcriptId: transcript.id,
      normalizedText: sttOut.normalizedText,
      confidence: sttOut.confidence,
      partial: transcript.partial,
      retrySuggested: transcript.retrySuggested,
      retryCount,
      fallbackHint: sttOut.fallbackHint,
    };
  }

  async chat(userId: string, input: VoiceChatRequest): Promise<VoiceChatResponse> {
    const repo = getVoiceRepository();
    const session = await repo.findSessionForUser(input.sessionId, userId);
    if (!session) {
      throw new NotFoundError('VOICE_SESSION_NOT_FOUND', 'Voice session not found');
    }

    if (input.interrupt) {
      await repo.updateSession(session.id, {
        status: VoiceSessionStatus.INTERRUPTED,
        interruptedAt: new Date(),
      });
      return {
        sessionId: session.id,
        aiSessionId: session.aiSessionId ?? '',
        transcriptText: '',
        responseText:
          session.locale === 'bn' ? 'বিরতি দেওয়া হয়েছে' : 'Interrupted',
        responseAudio: {
          available: false,
          codec: null,
          bitrateKbps: null,
          transcriptOnly: true,
        },
        refused: false,
        humanRedirect: false,
        disclaimer: '',
        interrupted: true,
      };
    }

    if (input.resume && session.status === VoiceSessionStatus.INTERRUPTED) {
      await repo.updateSession(session.id, {
        status: VoiceSessionStatus.ACTIVE,
        interruptedAt: null,
      });
    }

    const transcript = await repo.getTranscript(input.transcriptId, session.id);
    if (!transcript) {
      throw new NotFoundError('TRANSCRIPT_NOT_FOUND', 'Final transcript not found');
    }

    if (transcript.retrySuggested) {
      throw new ForbiddenError('STT_RETRY_REQUIRED', 'Please repeat utterance');
    }

    const bandwidthMode = input.bandwidthMode ?? session.bandwidthMode;
    if (input.bandwidthMode) {
      await repo.updateSession(session.id, { bandwidthMode });
    }

    const aiResult = await getAiVeterinaryCoreService().chat(userId, {
      message: transcript.normalizedText,
      ...(session.aiSessionId ? { sessionId: session.aiSessionId } : {}),
      ...(session.caseId ? { caseId: session.caseId } : {}),
      locale: session.locale === 'en' ? 'en' : 'bn',
    });

    if (!session.aiSessionId) {
      await repo.updateSession(session.id, { aiSessionId: aiResult.sessionId });
    }

    const tts = getTtsAdapter().synthesize({
      text: aiResult.content,
      locale: session.locale === 'en' ? 'en' : 'bn',
      bandwidthMode,
      ...(input.lowTokenMode !== undefined ? { lowTokenMode: input.lowTokenMode } : {}),
    });

    return {
      sessionId: session.id,
      aiSessionId: aiResult.sessionId,
      transcriptText: transcript.normalizedText,
      responseText: tts.text,
      responseAudio: {
        available: tts.audioAvailable,
        codec: tts.codec,
        bitrateKbps: tts.bitrateKbps,
        transcriptOnly: tts.transcriptOnly,
      },
      refused: aiResult.refused,
      humanRedirect: aiResult.humanRedirect,
      disclaimer: aiResult.disclaimer,
      interrupted: false,
    };
  }

  async navigation(
    userId: string,
    input: VoiceNavigationRequest,
  ): Promise<VoiceNavigationResponse> {
    const repo = getVoiceRepository();
    const session = await repo.findSessionForUser(input.sessionId, userId);
    if (!session) {
      throw new NotFoundError('VOICE_SESSION_NOT_FOUND', 'Voice session not found');
    }

    const locale: VoiceLocale = input.locale ?? (session.locale === 'en' ? 'en' : 'bn');
    const resolved = resolveNavigationCommand(input.utterance, locale);

    await repo.addNavigationEvent({
      sessionId: session.id,
      utterance: input.utterance,
      action: resolved.action,
      success: resolved.success,
      ...(resolved.aliasMatched ? { aliasMatched: resolved.aliasMatched } : {}),
    });

    if (resolved.action === 'CANCEL') {
      await repo.updateSession(session.id, { status: VoiceSessionStatus.CLOSED });
    }

    return {
      action: resolved.action,
      aliasMatched: resolved.aliasMatched,
      message: resolved.message,
      success: resolved.success,
    };
  }

  async getSession(userId: string, sessionId: string): Promise<VoiceSessionDto> {
    const repo = getVoiceRepository();
    const session = await repo.findSessionForUser(sessionId, userId);
    if (!session) {
      throw new NotFoundError('VOICE_SESSION_NOT_FOUND', 'Voice session not found');
    }

    const transcripts = await repo.listTranscripts(session.id);
    const lastNav = await repo.lastNavigationAction(session.id);

    return {
      sessionId: session.id,
      status: session.status,
      locale: session.locale,
      bandwidthMode: session.bandwidthMode,
      aiSessionId: session.aiSessionId,
      caseId: session.caseId,
      retryCount: session.retryCount,
      interruptedAt: session.interruptedAt?.toISOString() ?? null,
      transcripts: transcripts.map((t) => ({
        id: t.id,
        normalizedText: t.normalizedText,
        confidence: t.confidence,
        partial: t.partial,
        createdAt: t.createdAt.toISOString(),
      })),
      lastNavigation: (lastNav as VoiceNavigationAction | null) ?? null,
    };
  }
}

let service: VoiceAssistantService | null = null;

export function getVoiceAssistantService(): VoiceAssistantService {
  if (!service) service = new VoiceAssistantService();
  return service;
}
