import type { AiPrompt } from '../../../../generated/prisma/index.js';
import {
  AIMS_TO_LEGACY_PROMPT_KEY,
  LEGACY_PROMPT_KEY_ALIASES,
  type CreatePromptInput,
  type PromptKind,
  type PromptView,
  type ResolvedPrompt,
} from './prompt-management.types.js';

export function inferPromptKind(row: {
  taskType?: string | null;
  metadataJson?: unknown;
}): PromptKind {
  if (row.metadataJson && typeof row.metadataJson === 'object') {
    const kind = (row.metadataJson as { promptKind?: unknown }).promptKind;
    if (kind === 'system' || kind === 'feature') return kind;
  }
  return row.taskType?.trim() ? 'feature' : 'system';
}

export function buildMetadataJson(
  input: Pick<CreatePromptInput, 'kind' | 'metadataJson'>,
): Record<string, unknown> | undefined {
  const base =
    input.metadataJson && typeof input.metadataJson === 'object'
      ? { ...(input.metadataJson as Record<string, unknown>) }
      : {};

  if (input.kind) {
    base.promptKind = input.kind;
  }

  return Object.keys(base).length > 0 ? base : undefined;
}

export function toPromptView(row: AiPrompt): PromptView {
  const kind = inferPromptKind(row);
  return {
    id: row.id,
    promptKey: row.promptKey,
    key: row.promptKey,
    name: row.name,
    description: row.description,
    kind,
    taskType: row.taskType,
    version: row.version,
    status: row.status,
    published: row.status === 'ACTIVE',
    systemBn: row.systemBn,
    systemEn: row.systemEn,
    userTemplateBn: row.userTemplateBn,
    userTemplateEn: row.userTemplateEn,
    scopeKey: row.scopeKey,
    tenantId: row.tenantId,
    branchId: row.branchId,
    trafficPercent: row.trafficPercent,
    parentVersionId: row.parentVersionId,
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toResolvedPrompt(row: AiPrompt, legacyKey?: string): ResolvedPrompt {
  return {
    id: row.id,
    key: legacyKey ?? row.promptKey,
    promptKey: row.promptKey,
    name: row.name,
    description: row.description,
    systemBn: row.systemBn,
    systemEn: row.systemEn,
    userTemplateBn: row.userTemplateBn,
    userTemplateEn: row.userTemplateEn,
    version: row.version,
    status: row.status,
    taskType: row.taskType,
    kind: inferPromptKind(row),
  };
}

export function normalizePromptKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, '_');
}

export function resolveAimsPromptKey(key: string): string {
  const normalized = normalizePromptKey(key);
  return LEGACY_PROMPT_KEY_ALIASES[normalized] ?? normalized;
}

export function resolveLegacyPromptKey(promptKey: string): string {
  return AIMS_TO_LEGACY_PROMPT_KEY[promptKey] ?? promptKey;
}
