import { z } from 'zod';
import { AiPromptStatus } from '../../../generated/prisma/index.js';
import { omitUndefined } from '../../../shared/types/object.utils.js';
import { getAiPromptManagementService } from '../prompts/management/ai-prompt-management.service.js';
import type { AiAdminActor } from './ai-admin.guard.js';
import { actorContext } from './ai-admin.guard.js';

export async function listPromptsAdmin(request: Request) {
  const url = new URL(request.url);
  const statusRaw = url.searchParams.get('status')?.toUpperCase();
  const status =
    statusRaw && (Object.values(AiPromptStatus) as string[]).includes(statusRaw)
      ? (statusRaw as (typeof AiPromptStatus)[keyof typeof AiPromptStatus])
      : undefined;

  return getAiPromptManagementService().list(
    omitUndefined({
      kind:
        url.searchParams.get('kind') === 'system' || url.searchParams.get('kind') === 'feature'
          ? (url.searchParams.get('kind') as 'system' | 'feature')
          : undefined,
      taskType: url.searchParams.get('taskType') ?? undefined,
      promptKey: url.searchParams.get('promptKey') ?? undefined,
      status,
      includeArchived: url.searchParams.get('includeArchived') === 'true',
    }),
  );
}

export async function getPromptAdmin(id: string) {
  return getAiPromptManagementService().getById(id);
}

export async function listPromptVersionsAdmin(promptKey: string) {
  return getAiPromptManagementService().listVersions(promptKey);
}

export async function createPromptDraftFromPublishedAdmin(
  request: Request,
  actor: AiAdminActor,
  promptKey: string,
) {
  return getAiPromptManagementService().createDraftFromPublished(promptKey, {
    actor: actorContext(request, actor),
  });
}

const createPromptBodySchema = z.object({
  key: z.string().min(1).max(64),
  promptKey: z.string().min(1).max(64).optional(),
  name: z.string().min(1).max(128),
  description: z.string().max(500).optional(),
  kind: z.enum(['system', 'feature']).optional(),
  taskType: z.string().max(64).optional(),
  systemBn: z.string().min(1),
  systemEn: z.string().min(1),
  userTemplateBn: z.string().optional(),
  userTemplateEn: z.string().optional(),
  trafficPercent: z.number().int().min(0).max(100).optional(),
});

export async function createPromptAdmin(request: Request, actor: AiAdminActor, body: unknown) {
  const parsed = createPromptBodySchema.parse(body);
  return getAiPromptManagementService().createDraft(
    omitUndefined({
      promptKey: parsed.promptKey ?? parsed.key,
      name: parsed.name,
      description: parsed.description,
      kind: parsed.kind,
      taskType: parsed.taskType,
      systemBn: parsed.systemBn,
      systemEn: parsed.systemEn,
      userTemplateBn: parsed.userTemplateBn,
      userTemplateEn: parsed.userTemplateEn,
      trafficPercent: parsed.trafficPercent,
      actor: actorContext(request, actor),
    }),
  );
}

const updatePromptBodySchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(500).nullable().optional(),
  taskType: z.string().max(64).nullable().optional(),
  systemBn: z.string().min(1).optional(),
  systemEn: z.string().min(1).optional(),
  userTemplateBn: z.string().nullable().optional(),
  userTemplateEn: z.string().nullable().optional(),
  trafficPercent: z.number().int().min(0).max(100).optional(),
});

export async function updatePromptAdmin(
  request: Request,
  actor: AiAdminActor,
  id: string,
  body: unknown,
) {
  const parsed = updatePromptBodySchema.parse(body);
  return getAiPromptManagementService().updateDraft(
    id,
    omitUndefined({
      ...parsed,
      actor: actorContext(request, actor),
    }),
  );
}

export async function publishPromptAdmin(request: Request, actor: AiAdminActor, id: string) {
  return getAiPromptManagementService().publish(id, actorContext(request, actor));
}

export async function rollbackPromptAdmin(request: Request, actor: AiAdminActor, id: string) {
  return getAiPromptManagementService().rollback(id, actorContext(request, actor));
}

export async function deletePromptDraftAdmin(request: Request, actor: AiAdminActor, id: string) {
  await getAiPromptManagementService().softDeleteDraft(id, actorContext(request, actor));
  return { deleted: true, id };
}
