import type { Request, Response } from 'express';
import { z } from 'zod';

import { UnauthorizedError } from '../../shared/errors/http.errors.js';
import { sendCreated, sendSuccess } from '../../shared/utils/response.js';

import { getOfflineArchitectureService } from './offline-architecture.service.js';

const syncItemSchema = z.object({
  idempotencyKey: z.string().min(1),
  entityType: z.enum([
    'AUTH_SNAPSHOT',
    'AREA_DATA',
    'CASE_DRAFT',
    'VOICE_DRAFT',
    'PROFILE',
    'OFFLINE_LEAD',
  ]),
  operation: z.enum(['UPSERT', 'DELETE']).optional(),
  payload: z.record(z.unknown()),
  clientSequence: z.number().int().nonnegative(),
  clientVersion: z.string().optional(),
  serverVersion: z.string().optional(),
});

const syncSchema = z.object({
  deviceId: z.string().optional(),
  connectivityMode: z.enum(['ONLINE', 'DEGRADED', 'OFFLINE']).optional(),
  manualOverride: z.boolean().optional(),
  mode: z.enum(['foreground', 'background', 'delta', 'batch']).optional(),
  since: z.string().optional(),
  items: z.array(syncItemSchema).max(25).optional(),
});

const retrySchema = z.object({
  idempotencyKeys: z.array(z.string()).optional(),
  includeDead: z.boolean().optional(),
  pause: z.boolean().optional(),
  resume: z.boolean().optional(),
});

function userId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError('AUTH_REQUIRED', 'Authentication required');
  }
  return req.user.id;
}

export class SyncController {
  async status(req: Request, res: Response): Promise<void> {
    const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : undefined;
    const result = await getOfflineArchitectureService().getStatus(userId(req), deviceId);
    sendSuccess(res, result);
  }

  async sync(req: Request, res: Response): Promise<void> {
    const body = syncSchema.parse(req.body);
    const items = body.items?.map((item) => ({
      idempotencyKey: item.idempotencyKey,
      entityType: item.entityType,
      payload: item.payload,
      clientSequence: item.clientSequence,
      ...(item.operation !== undefined ? { operation: item.operation } : {}),
      ...(item.clientVersion !== undefined ? { clientVersion: item.clientVersion } : {}),
      ...(item.serverVersion !== undefined ? { serverVersion: item.serverVersion } : {}),
    }));
    const result = await getOfflineArchitectureService().sync(userId(req), {
      ...(body.deviceId !== undefined ? { deviceId: body.deviceId } : {}),
      ...(body.connectivityMode !== undefined ? { connectivityMode: body.connectivityMode } : {}),
      ...(body.manualOverride !== undefined ? { manualOverride: body.manualOverride } : {}),
      ...(body.mode !== undefined ? { mode: body.mode } : {}),
      ...(body.since !== undefined ? { since: body.since } : {}),
      ...(items !== undefined ? { items } : {}),
    });
    sendCreated(res, result);
  }

  async retry(req: Request, res: Response): Promise<void> {
    const body = retrySchema.parse(req.body ?? {});
    const result = await getOfflineArchitectureService().retry(userId(req), {
      ...(body.idempotencyKeys !== undefined ? { idempotencyKeys: body.idempotencyKeys } : {}),
      ...(body.includeDead !== undefined ? { includeDead: body.includeDead } : {}),
      ...(body.pause !== undefined ? { pause: body.pause } : {}),
      ...(body.resume !== undefined ? { resume: body.resume } : {}),
    });
    sendSuccess(res, result);
  }
}

export class OfflineController {
  async queue(req: Request, res: Response): Promise<void> {
    const result = await getOfflineArchitectureService().getQueue(userId(req));
    sendSuccess(res, result);
  }
}
