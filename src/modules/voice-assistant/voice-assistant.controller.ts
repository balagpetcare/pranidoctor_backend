import type { Request, Response } from 'express';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';

import { getVoiceAssistantService } from './voice-assistant.service.js';

const sttSchema = z.object({
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  mode: z.enum(['STREAMING', 'UPLOAD']),
  partial: z.boolean().optional(),
  transcript: z.string().min(1),
  locale: z.enum(['bn', 'en']).optional(),
  confidence: z.number().min(0).max(1).optional(),
  audioMetadata: z
    .object({
      durationMs: z.number().int().optional(),
      sizeBytes: z.number().int().optional(),
      codec: z.string().optional(),
      bitrateKbps: z.number().optional(),
    })
    .optional(),
});

const chatSchema = z.object({
  sessionId: z.string().min(1),
  transcriptId: z.string().min(1),
  interrupt: z.boolean().optional(),
  resume: z.boolean().optional(),
  lowTokenMode: z.boolean().optional(),
  bandwidthMode: z.enum(['FULL', 'LOW', 'TRANSCRIPT_ONLY']).optional(),
});

const navigationSchema = z.object({
  sessionId: z.string().min(1),
  utterance: z.string().min(1),
  locale: z.enum(['bn', 'en']).optional(),
});

function userId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  }
  return req.user.id;
}

export class VoiceAssistantController {
  async stt(req: Request, res: Response): Promise<void> {
    const body = sttSchema.parse(req.body);
    const result = await getVoiceAssistantService().stt(userId(req), {
      mode: body.mode,
      transcript: body.transcript,
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.partial !== undefined ? { partial: body.partial } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
      ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
      ...(body.audioMetadata !== undefined
        ? {
            audioMetadata: {
              ...(body.audioMetadata.durationMs !== undefined
                ? { durationMs: body.audioMetadata.durationMs }
                : {}),
              ...(body.audioMetadata.sizeBytes !== undefined
                ? { sizeBytes: body.audioMetadata.sizeBytes }
                : {}),
              ...(body.audioMetadata.codec !== undefined
                ? { codec: body.audioMetadata.codec }
                : {}),
              ...(body.audioMetadata.bitrateKbps !== undefined
                ? { bitrateKbps: body.audioMetadata.bitrateKbps }
                : {}),
            },
          }
        : {}),
    });
    sendCreated(res, result);
  }

  async chat(req: Request, res: Response): Promise<void> {
    const body = chatSchema.parse(req.body);
    const result = await getVoiceAssistantService().chat(userId(req), {
      sessionId: body.sessionId,
      transcriptId: body.transcriptId,
      ...(body.interrupt !== undefined ? { interrupt: body.interrupt } : {}),
      ...(body.resume !== undefined ? { resume: body.resume } : {}),
      ...(body.lowTokenMode !== undefined ? { lowTokenMode: body.lowTokenMode } : {}),
      ...(body.bandwidthMode !== undefined ? { bandwidthMode: body.bandwidthMode } : {}),
    });
    sendCreated(res, result);
  }

  async navigation(req: Request, res: Response): Promise<void> {
    const body = navigationSchema.parse(req.body);
    const result = await getVoiceAssistantService().navigation(userId(req), {
      sessionId: body.sessionId,
      utterance: body.utterance,
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });
    sendSuccess(res, result);
  }

  async getSession(req: Request, res: Response): Promise<void> {
    const raw = req.query.sessionId;
    const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!id || typeof id !== 'string') {
      throw new ValidationError('VALIDATION_FAILED', 'sessionId query required');
    }
    const result = await getVoiceAssistantService().getSession(userId(req), id);
    sendSuccess(res, result);
  }
}
