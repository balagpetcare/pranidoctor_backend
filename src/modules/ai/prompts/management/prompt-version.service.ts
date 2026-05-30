import { AiPromptStatus } from '../../../../generated/prisma/index.js';
import { getPrisma } from '../../../../shared/database/prisma.js';
import { PLATFORM_SCOPE_KEY } from './prompt-management.types.js';

export class PromptVersionService {
  readonly name = 'PromptVersionService';

  async nextVersion(scopeKey: string, promptKey: string): Promise<number> {
    const prisma = getPrisma();
    const latest = await prisma.aiPrompt.findFirst({
      where: { scopeKey, promptKey, deletedAt: null },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  async listVersions(scopeKey: string, promptKey: string) {
    const prisma = getPrisma();
    return prisma.aiPrompt.findMany({
      where: { scopeKey, promptKey, deletedAt: null },
      orderBy: [{ version: 'desc' }],
    });
  }

  async getPublished(scopeKey: string, promptKey: string) {
    const prisma = getPrisma();
    return prisma.aiPrompt.findFirst({
      where: {
        scopeKey,
        promptKey,
        status: AiPromptStatus.ACTIVE,
        deletedAt: null,
      },
      orderBy: { version: 'desc' },
    });
  }

  async archivePublished(scopeKey: string, promptKey: string, actorUserId?: string): Promise<number> {
    const prisma = getPrisma();
    const result = await prisma.aiPrompt.updateMany({
      where: {
        scopeKey,
        promptKey,
        status: AiPromptStatus.ACTIVE,
        deletedAt: null,
      },
      data: {
        status: AiPromptStatus.ARCHIVED,
        updatedByUserId: actorUserId ?? null,
      },
    });
    return result.count;
  }

  scopeKey(input?: { scopeKey?: string; tenantId?: string | null; branchId?: string | null }): string {
    if (input?.scopeKey?.trim()) return input.scopeKey.trim();
    if (input?.tenantId && input?.branchId) return `tenant:${input.tenantId}:branch:${input.branchId}`;
    if (input?.tenantId) return `tenant:${input.tenantId}`;
    return PLATFORM_SCOPE_KEY;
  }
}

let promptVersionService: PromptVersionService | null = null;

export function getPromptVersionService(): PromptVersionService {
  if (!promptVersionService) promptVersionService = new PromptVersionService();
  return promptVersionService;
}

export function resetPromptVersionServiceForTests(): void {
  promptVersionService = null;
}
