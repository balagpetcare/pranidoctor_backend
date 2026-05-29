import type { Request, Response } from 'express';

import { AiAdminController } from './ai.controller.js';

let controller: AiAdminController | null = null;

export function getAiAdminController(): AiAdminController {
  if (!controller) controller = new AiAdminController();
  return controller;
}

/** Bridge Express handlers for admin-ai-ops module mount. */
export async function adminOverview(_req: Request, res: Response) {
  await getAiAdminController().overview(_req, res);
}

export async function adminRiskMonitoring(_req: Request, res: Response) {
  await getAiAdminController().riskMonitoring(_req, res);
}

export async function adminListKnowledge(_req: Request, res: Response) {
  await getAiAdminController().listKnowledge(_req, res);
}

export async function adminCreateKnowledge(req: Request, res: Response) {
  await getAiAdminController().createKnowledge(req, res);
}

export async function adminPublishKnowledge(req: Request, res: Response) {
  await getAiAdminController().publishKnowledge(req, res);
}

export async function adminListPrompts(_req: Request, res: Response) {
  await getAiAdminController().listPrompts(_req, res);
}

export async function adminCreatePrompt(req: Request, res: Response) {
  await getAiAdminController().createPrompt(req, res);
}

export async function adminActivatePrompt(req: Request, res: Response) {
  await getAiAdminController().activatePrompt(req, res);
}

export async function adminListEscalations(_req: Request, res: Response) {
  await getAiAdminController().listEscalations(_req, res);
}

export async function adminAuditLog(req: Request, res: Response) {
  await getAiAdminController().auditLog(req, res);
}

export async function adminKillSwitch(req: Request, res: Response) {
  await getAiAdminController().killSwitch(req, res);
}
