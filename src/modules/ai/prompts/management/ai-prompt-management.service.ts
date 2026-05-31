import { AiPromptStatus } from '../../../../generated/prisma/index.js';
import type { Prisma } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { toInputJson, toNullableInputJson } from '../../../../shared/database/prisma-json.js';
import { omitUndefined } from '../../../../shared/types/object.utils.js';
import { logAiExecution } from '../../../../shared/monitoring/structured-logging.js';
import {
  PromptNotDraftError,
  PromptNotFoundError,
  PromptPublishError,
  PromptRollbackError,
} from './prompt-management.errors.js';
import type {
  CreatePromptInput,
  PromptListFilters,
  PromptView,
  ResolvedPrompt,
  UpdatePromptDraftInput,
} from './prompt-management.types.js';
import {
  buildMetadataJson,
  normalizePromptKey,
  resolveAimsPromptKey,
  resolveLegacyPromptKey,
  toPromptView,
  toResolvedPrompt,
} from './prompt-management.util.js';
import { getPromptVersionService } from './prompt-version.service.js';

export class AiPromptManagementService {
  readonly name = 'AiPromptManagementService';

  private readonly versions = getPromptVersionService();

  async list(filters: PromptListFilters = {}): Promise<PromptView[]> {
    const prisma = getPrisma();
    const scopeKey = this.versions.scopeKey({ scopeKey: filters.scopeKey });

    const rows = await prisma.aiPrompt.findMany({
      where: {
        scopeKey,
        deletedAt: null,
        ...(filters.status ? { status: filters.status } : {}),
        ...(!filters.status && !filters.includeArchived
          ? { status: { not: AiPromptStatus.ARCHIVED } }
          : {}),
        ...(filters.taskType ? { taskType: filters.taskType } : {}),
        ...(filters.promptKey ? { promptKey: normalizePromptKey(filters.promptKey) } : {}),
      },
      orderBy: [{ promptKey: 'asc' }, { version: 'desc' }],
    });

    const filtered = rows.filter((row) => {
      if (filters.kind === 'system') return !row.taskType;
      if (filters.kind === 'feature') return Boolean(row.taskType);
      return true;
    });

    return filtered.map(toPromptView);
  }

  async getById(id: string): Promise<PromptView> {
    const row = await this.findRow(id);
    return toPromptView(row);
  }

  async listVersions(promptKey: string, scopeKey?: string): Promise<PromptView[]> {
    const scope = this.versions.scopeKey({ scopeKey });
    const rows = await this.versions.listVersions(scope, normalizePromptKey(promptKey));
    return rows.map(toPromptView);
  }

  async createDraft(input: CreatePromptInput): Promise<PromptView> {
    const prisma = getPrisma();
    const scopeKey = this.versions.scopeKey(input);
    const promptKey = normalizePromptKey(input.promptKey);
    const version = await this.versions.nextVersion(scopeKey, promptKey);
    const kind = input.kind ?? (input.taskType ? 'feature' : 'system');

    const row = await prisma.aiPrompt.create({
      data: {
        scopeKey,
        tenantId: input.tenantId ?? null,
        branchId: input.branchId ?? null,
        promptKey,
        version,
        taskType: input.taskType ?? null,
        name: input.name,
        description: input.description ?? null,
        systemBn: input.systemBn,
        systemEn: input.systemEn,
        userTemplateBn: input.userTemplateBn ?? null,
        userTemplateEn: input.userTemplateEn ?? null,
        status: AiPromptStatus.DRAFT,
        trafficPercent: input.trafficPercent ?? 100,
        ...(input.variablesSchemaJson != null
          ? { variablesSchemaJson: toInputJson(input.variablesSchemaJson) }
          : {}),
        ...(input.testCasesJson != null ? { testCasesJson: toInputJson(input.testCasesJson) } : {}),
        metadataJson: toInputJson(buildMetadataJson({ kind, metadataJson: input.metadataJson })),
        createdByUserId: input.actor?.userId ?? null,
        updatedByUserId: input.actor?.userId ?? null,
      },
    });

    logAiExecution('ai_prompt_draft_created', { promptKey, version, scopeKey });
    return toPromptView(row);
  }

  /** Clone the published prompt into a new draft version for safe editing. */
  async createDraftFromPublished(
    promptKey: string,
    options?: { scopeKey?: string; actor?: { userId?: string } },
  ): Promise<PromptView> {
    const scopeKey = this.versions.scopeKey(options);
    const normalizedKey = normalizePromptKey(promptKey);
    const published = await this.versions.getPublished(scopeKey, normalizedKey);
    if (!published) {
      throw new PromptNotFoundError(`No published prompt for key "${normalizedKey}"`);
    }

    return this.createDraft(
      omitUndefined({
        promptKey: normalizedKey,
        name: published.name,
        description: published.description ?? undefined,
        kind: (published.taskType ? 'feature' : 'system') as 'feature' | 'system',
        taskType: published.taskType ?? undefined,
        systemBn: published.systemBn,
        systemEn: published.systemEn,
        userTemplateBn: published.userTemplateBn ?? undefined,
        userTemplateEn: published.userTemplateEn ?? undefined,
        scopeKey,
        tenantId: published.tenantId ?? undefined,
        branchId: published.branchId ?? undefined,
        trafficPercent: published.trafficPercent,
        variablesSchemaJson: published.variablesSchemaJson ?? undefined,
        testCasesJson: published.testCasesJson ?? undefined,
        metadataJson: published.metadataJson ?? undefined,
        actor: options?.actor,
      }),
    );
  }

  async updateDraft(id: string, input: UpdatePromptDraftInput): Promise<PromptView> {
    const prisma = getPrisma();
    const existing = await this.findRow(id);
    if (existing.status !== AiPromptStatus.DRAFT) {
      throw new PromptNotDraftError();
    }

    const data: Prisma.AiPromptUncheckedUpdateInput = {
      updatedByUserId: input.actor?.userId ?? null,
    };
    if (input.name != null) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.taskType !== undefined) data.taskType = input.taskType;
    if (input.systemBn != null) data.systemBn = input.systemBn;
    if (input.systemEn != null) data.systemEn = input.systemEn;
    if (input.userTemplateBn !== undefined) data.userTemplateBn = input.userTemplateBn;
    if (input.userTemplateEn !== undefined) data.userTemplateEn = input.userTemplateEn;
    if (input.trafficPercent != null) data.trafficPercent = input.trafficPercent;
    if (input.variablesSchemaJson !== undefined) {
      data.variablesSchemaJson = toNullableInputJson(input.variablesSchemaJson);
    }
    if (input.testCasesJson !== undefined) {
      data.testCasesJson = toNullableInputJson(input.testCasesJson);
    }
    if (input.metadataJson !== undefined) {
      data.metadataJson = toNullableInputJson(input.metadataJson);
    }

    const row = await prisma.aiPrompt.update({
      where: { id },
      data,
    });

    return toPromptView(row);
  }

  async publish(id: string, actor?: { userId?: string }): Promise<PromptView> {
    const prisma = getPrisma();
    const draft = await this.findRow(id);
    if (draft.status !== AiPromptStatus.DRAFT) {
      throw new PromptPublishError('Only draft prompts can be published');
    }

    await prisma.$transaction(async (tx) => {
      await tx.aiPrompt.updateMany({
        where: {
          scopeKey: draft.scopeKey,
          promptKey: draft.promptKey,
          status: AiPromptStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: AiPromptStatus.ARCHIVED,
          updatedByUserId: actor?.userId ?? null,
        },
      });

      await tx.aiPrompt.update({
        where: { id },
        data: {
          status: AiPromptStatus.ACTIVE,
          approvedByUserId: actor?.userId ?? null,
          approvedAt: new Date(),
          updatedByUserId: actor?.userId ?? null,
        },
      });
    });

    logAiExecution('ai_prompt_published', {
      promptKey: draft.promptKey,
      version: draft.version,
      scopeKey: draft.scopeKey,
    });

    return toPromptView(await this.findRow(id));
  }

  async rollback(id: string, actor?: { userId?: string }): Promise<PromptView> {
    const prisma = getPrisma();
    const target = await this.findRow(id);
    if (target.status !== AiPromptStatus.ARCHIVED) {
      throw new PromptRollbackError('Only archived prompt versions can be rolled back');
    }

    await prisma.$transaction(async (tx) => {
      await tx.aiPrompt.updateMany({
        where: {
          scopeKey: target.scopeKey,
          promptKey: target.promptKey,
          status: AiPromptStatus.ACTIVE,
          deletedAt: null,
        },
        data: {
          status: AiPromptStatus.ARCHIVED,
          updatedByUserId: actor?.userId ?? null,
        },
      });

      await tx.aiPrompt.update({
        where: { id },
        data: {
          status: AiPromptStatus.ACTIVE,
          approvedByUserId: actor?.userId ?? null,
          approvedAt: new Date(),
          updatedByUserId: actor?.userId ?? null,
        },
      });
    });

    logAiExecution('ai_prompt_rollback', {
      promptKey: target.promptKey,
      version: target.version,
      scopeKey: target.scopeKey,
    });

    return toPromptView(await this.findRow(id));
  }

  async softDeleteDraft(id: string, actor?: { userId?: string }): Promise<void> {
    const prisma = getPrisma();
    const row = await this.findRow(id);
    if (row.status !== AiPromptStatus.DRAFT) {
      throw new PromptNotDraftError('Only draft prompts can be deleted');
    }

    await prisma.aiPrompt.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: actor?.userId ?? null,
      },
    });
  }

  async resolvePublished(key: string, scopeKey?: string): Promise<ResolvedPrompt> {
    const scope = this.versions.scopeKey({ scopeKey });
    const aimsKey = resolveAimsPromptKey(key);
    const published = await this.versions.getPublished(scope, aimsKey);
    if (!published) {
      throw new PromptNotFoundError(`Published prompt not found: ${key}`);
    }
    return toResolvedPrompt(published, resolveLegacyPromptKey(published.promptKey));
  }

  private async findRow(id: string) {
    const prisma = getPrisma();
    const row = await prisma.aiPrompt.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) throw new PromptNotFoundError();
    return row;
  }
}

let aiPromptManagementService: AiPromptManagementService | null = null;

export function getAiPromptManagementService(): AiPromptManagementService {
  if (!aiPromptManagementService) aiPromptManagementService = new AiPromptManagementService();
  return aiPromptManagementService;
}

export function resetAiPromptManagementServiceForTests(): void {
  aiPromptManagementService = null;
}
