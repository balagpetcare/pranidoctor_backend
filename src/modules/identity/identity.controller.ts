import type { Request, Response } from 'express';

import { NotFoundError, UnauthorizedError } from '../../shared/errors/http.errors.js';
import { sendSuccess } from '../../shared/utils/response.js';
import { getUserService } from '../user/user.service.js';

import { resolveMobileBearerUserId } from './identity-auth.helper.js';
import { getLoginOrchestrator } from './login/login-orchestrator.service.js';
import { getProfileFacade } from './profile/profile-facade.service.js';
import { getSessionEngine } from './session/session-engine.service.js';

export class IdentityController {
  getCapabilities(_req: Request, res: Response): void {
    const capabilities = getLoginOrchestrator().getCapabilities();
    sendSuccess(res, capabilities);
  }

  async listDevices(req: Request, res: Response): Promise<void> {
    const userId = await resolveMobileBearerUserId(req);
    if (!userId) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Bearer token required');
    }

    const devices = await getSessionEngine().listDevices(userId);
    const activity = await getSessionEngine().getActivity(userId);
    sendSuccess(res, { devices, activity });
  }

  async revokeDevice(req: Request, res: Response): Promise<void> {
    const userId = await resolveMobileBearerUserId(req);
    if (!userId) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Bearer token required');
    }

    const rawDeviceId = req.params['deviceId'];
    const deviceId = Array.isArray(rawDeviceId) ? rawDeviceId[0] : rawDeviceId;
    if (!deviceId) {
      throw new UnauthorizedError('VALIDATION_ERROR', 'deviceId required');
    }

    const result = await getSessionEngine().revokeDevice(userId, deviceId);
    sendSuccess(res, result);
  }

  async getProfileSummary(req: Request, res: Response): Promise<void> {
    const userId = await resolveMobileBearerUserId(req);
    if (!userId) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Bearer token required');
    }

    const summary = await getProfileFacade().getSummary(userId);
    if (!summary) {
      throw new NotFoundError('PROFILE_NOT_FOUND', 'Customer profile not found');
    }

    sendSuccess(res, summary);
  }

  async getUserState(req: Request, res: Response): Promise<void> {
    const userId = await resolveMobileBearerUserId(req);
    if (!userId) {
      throw new UnauthorizedError('UNAUTHORIZED', 'Bearer token required');
    }

    const active = await getUserService().isCustomerActive(userId);
    sendSuccess(res, { userId, active });
  }
}
