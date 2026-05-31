import type { Request, Response } from 'express';
import { z } from 'zod';

import { sendCreated, sendSuccess } from '../../../shared/utils/response.js';
import { requireInternalAdminAiOps } from '../ai-admin.middleware.js';
import { SOURCE_FAMILY_PROFILES } from './registry/source-family.profiles.js';
import { getKnowledgeImportOrchestratorService } from './pipeline/knowledge-import-orchestrator.service.js';
import type { ImportActor } from './knowledge-import.types.js';

function importActor(req: Request): ImportActor {
  const actorId =
    typeof req.headers['x-admin-user-id'] === 'string' ? req.headers['x-admin-user-id'] : 'internal-admin';
  const role =
    typeof req.headers['x-admin-role'] === 'string' ? req.headers['x-admin-role'] : 'INTERNAL';
  return { id: actorId, role };
}

export class KnowledgeImportController {
  async listProfiles(_req: Request, res: Response): Promise<void> {
    sendSuccess(res, { profiles: SOURCE_FAMILY_PROFILES });
  }

  async startImport(req: Request, res: Response): Promise<void> {
    const body = z
      .object({
        sourceId: z.string(),
        documentId: z.string().optional(),
        dryRun: z.boolean().optional(),
        mode: z.enum(['LIVE', 'DRY_RUN', 'REIMPORT_DIFF']).optional(),
        sync: z.boolean().optional(),
        rows: z.array(z.record(z.unknown())).min(1),
      })
      .parse(req.body);

    const result = await getKnowledgeImportOrchestratorService().startImport(
      {
        sourceId: body.sourceId,
        ...(body.documentId ? { documentId: body.documentId } : {}),
        rows: body.rows,
        ...(body.dryRun !== undefined ? { dryRun: body.dryRun } : {}),
        ...(body.mode ? { mode: body.mode } : {}),
        ...(body.sync !== undefined ? { sync: body.sync } : {}),
      },
      importActor(req),
    );
    sendCreated(res, result);
  }

  async getImportRun(req: Request, res: Response): Promise<void> {
    const id = z.string().parse(req.params.importRunId);
    const run = await getKnowledgeImportOrchestratorService().getImportRun(id);
    sendSuccess(res, run);
  }

  async listImportRuns(req: Request, res: Response): Promise<void> {
    const sourceId = typeof req.query.sourceId === 'string' ? req.query.sourceId : undefined;
    const runs = await getKnowledgeImportOrchestratorService().listImportRuns(sourceId);
    sendSuccess(res, { runs });
  }
}

let controller: KnowledgeImportController | null = null;

export function getKnowledgeImportController(): KnowledgeImportController {
  if (!controller) controller = new KnowledgeImportController();
  return controller;
}

export const knowledgeImportAdminGuard = requireInternalAdminAiOps;
