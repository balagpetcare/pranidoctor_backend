import { getRequestContext } from '../../../shared/context/request-context.js';
import { getAiPlatformConfig } from '../config/ai.config.js';
import { PLATFORM_SCOPE_KEY } from '../prompts/management/prompt-management.types.js';

import type { AiFoundationScope } from './ai-foundation.types.js';

export function buildScopeKey(
  tenantId?: string | null,
  branchId?: string | null,
): string {
  if (tenantId?.trim() && branchId?.trim()) {
    return `tenant:${tenantId.trim()}:branch:${branchId.trim()}`;
  }
  if (tenantId?.trim()) return `tenant:${tenantId.trim()}`;
  return PLATFORM_SCOPE_KEY;
}

export function resolveFoundationScope(input?: AiFoundationScope): {
  scopeKey: string;
  tenantId?: string;
  branchId?: string;
} {
  if (input?.scopeKey?.trim()) {
    return {
      scopeKey: input.scopeKey.trim(),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
    };
  }

  const ctx = getRequestContext();
  const config = getAiPlatformConfig();
  const tenantId = input?.tenantId ?? ctx?.tenantId ?? config.organizationId;
  const branchId = input?.branchId ?? config.branchId;

  return {
    scopeKey: buildScopeKey(tenantId, branchId),
    ...(tenantId ? { tenantId } : {}),
    ...(branchId ? { branchId } : {}),
  };
}

export function scopeKeysForHierarchy(scopeKey: string, tenantId?: string, branchId?: string): string[] {
  const keys: string[] = [];
  if (tenantId && branchId) {
    keys.push(buildScopeKey(tenantId, branchId));
  }
  if (tenantId) {
    keys.push(buildScopeKey(tenantId));
  }
  if (scopeKey !== PLATFORM_SCOPE_KEY) {
    keys.push(scopeKey);
  }
  keys.push(PLATFORM_SCOPE_KEY);
  return [...new Set(keys)];
}
