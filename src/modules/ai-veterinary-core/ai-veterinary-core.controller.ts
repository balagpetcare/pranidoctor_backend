import type { Request, Response } from 'express';
import { z } from 'zod';

import { UnauthorizedError, ValidationError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';

import { getAiVeterinaryCoreService } from './ai-veterinary-core.service.js';

const chatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  locale: z.enum(['bn', 'en']).optional(),
});

const triageSchema = z.object({
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  symptoms: z.array(z.string().min(1)).min(1),
  historySummary: z.string().optional(),
  mediaMetadata: z.array(z.record(z.string(), z.unknown())).optional(),
  locale: z.enum(['bn', 'en']).optional(),
});

const memoryQuerySchema = z.object({
  kind: z.enum(['CONVERSATION', 'CASE_CONTEXT', 'PREFERENCE']).optional(),
  key: z.string().optional(),
});

const memoryDeleteSchema = z.object({
  kind: z.enum(['CONVERSATION', 'CASE_CONTEXT', 'PREFERENCE']).optional(),
  key: z.string().optional(),
  all: z.coerce.boolean().optional(),
});

const escalateSchema = z.object({
  sessionId: z.string().optional(),
  caseId: z.string().optional(),
  reason: z.enum([
    'HIGH_RISK',
    'EMERGENCY_SYMPTOM',
    'LOW_CONFIDENCE',
    'DOCTOR_REQUEST',
    'POLICY_REFUSAL',
  ]),
  handoffNote: z.string().optional(),
});

function userId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  }
  return req.user.id;
}

export class AiVeterinaryCoreController {
  async chat(req: Request, res: Response): Promise<void> {
    const body = chatSchema.parse(req.body);
    const result = await getAiVeterinaryCoreService().chat(userId(req), {
      message: body.message,
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });
    sendCreated(res, result);
  }

  async triage(req: Request, res: Response): Promise<void> {
    const body = triageSchema.parse(req.body);
    const result = await getAiVeterinaryCoreService().triage(userId(req), {
      symptoms: body.symptoms,
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.historySummary !== undefined ? { historySummary: body.historySummary } : {}),
      ...(body.mediaMetadata !== undefined ? { mediaMetadata: body.mediaMetadata } : {}),
      ...(body.locale !== undefined ? { locale: body.locale } : {}),
    });
    sendCreated(res, result);
  }

  async listMemory(req: Request, res: Response): Promise<void> {
    const query = memoryQuerySchema.parse(req.query);
    const result = await getAiVeterinaryCoreService().listMemory(userId(req), {
      ...(query.kind !== undefined ? { kind: query.kind } : {}),
      ...(query.key !== undefined ? { key: query.key } : {}),
    });
    sendSuccess(res, result);
  }

  async deleteMemory(req: Request, res: Response): Promise<void> {
    const query = memoryDeleteSchema.parse(req.query);
    if (!query.all && !query.kind && !query.key) {
      throw new ValidationError('VALIDATION_FAILED', 'Provide kind, key, or all=true');
    }
    const result = await getAiVeterinaryCoreService().deleteMemory(userId(req), {
      ...(query.kind !== undefined ? { kind: query.kind } : {}),
      ...(query.key !== undefined ? { key: query.key } : {}),
      ...(query.all !== undefined ? { all: query.all } : {}),
    });
    sendSuccess(res, result);
  }

  async escalate(req: Request, res: Response): Promise<void> {
    const body = escalateSchema.parse(req.body);
    const result = await getAiVeterinaryCoreService().escalate(userId(req), {
      reason: body.reason,
      ...(body.sessionId !== undefined ? { sessionId: body.sessionId } : {}),
      ...(body.caseId !== undefined ? { caseId: body.caseId } : {}),
      ...(body.handoffNote !== undefined ? { handoffNote: body.handoffNote } : {}),
    });
    sendCreated(res, result);
  }
}
