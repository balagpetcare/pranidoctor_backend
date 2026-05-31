import { jsonError } from '../../../legacy/web/lib/api-response.js';
import { requireAiAdminActor, type AiAdminActor, type AiAdminAuthResult } from './ai-admin.guard.js';

/** AI Control Center capability keys — aligned with pranidoctor-web permissions-core. */
export type AiAdminCapability =
  | 'ai.ops.view'
  | 'ai.registry.manage'
  | 'ai.settings.manage'
  | 'ai.secrets.view'
  | 'ai.secrets.manage'
  | 'ai.analytics.view'
  | 'ai.analytics.export'
  | 'ai.foundation.manage'
  | 'ai.medicine.knowledge.read'
  | 'ai.medicine.knowledge.write'
  | 'ai.medicine.contracts.read'
  | 'ai.medicine.contracts.write'
  | 'ai.medicine.recommendations.view'
  | 'ai.medicine.analytics.view'
  | 'ai.feed.view'
  | 'ai.feed.manage'
  | 'ai.feed.publish'
  | 'ai.feed.audit';

const ROLE_MATRIX: Record<string, Partial<Record<AiAdminCapability, true>>> = {
  SUPER_ADMIN: {
    'ai.ops.view': true,
    'ai.registry.manage': true,
    'ai.settings.manage': true,
    'ai.secrets.view': true,
    'ai.secrets.manage': true,
    'ai.analytics.view': true,
    'ai.analytics.export': true,
    'ai.foundation.manage': true,
    'ai.medicine.knowledge.read': true,
    'ai.medicine.knowledge.write': true,
    'ai.medicine.contracts.read': true,
    'ai.medicine.contracts.write': true,
    'ai.medicine.recommendations.view': true,
    'ai.medicine.analytics.view': true,
    'ai.feed.view': true,
    'ai.feed.manage': true,
    'ai.feed.publish': true,
    'ai.feed.audit': true,
  },
  ADMIN: {
    'ai.ops.view': true,
    'ai.registry.manage': true,
    'ai.settings.manage': true,
    'ai.secrets.view': true,
    'ai.analytics.view': true,
    'ai.analytics.export': true,
    'ai.medicine.knowledge.read': true,
    'ai.medicine.knowledge.write': true,
    'ai.medicine.contracts.read': true,
    'ai.medicine.contracts.write': true,
    'ai.medicine.recommendations.view': true,
    'ai.medicine.analytics.view': true,
    'ai.feed.view': true,
    'ai.feed.manage': true,
    'ai.feed.publish': true,
    'ai.feed.audit': true,
  },
  SUPPORT: {
    'ai.ops.view': true,
    'ai.analytics.view': true,
    'ai.feed.view': true,
    'ai.feed.audit': true,
  },
};

export function aiAdminCan(actor: AiAdminActor, capability: AiAdminCapability): boolean {
  return Boolean(ROLE_MATRIX[actor.role]?.[capability]);
}

export function assertAiAdminCan(
  actor: AiAdminActor,
  capability: AiAdminCapability,
): Response | null {
  if (aiAdminCan(actor, capability)) return null;
  return jsonError('FORBIDDEN', `Missing capability: ${capability}`, 403);
}

export function getAiAdminCapabilityMatrix(): typeof ROLE_MATRIX {
  return ROLE_MATRIX;
}

/** Authenticate AI admin and enforce a single capability in one step. */
export async function requireAiAdminCapability(
  capability: AiAdminCapability,
): Promise<AiAdminAuthResult> {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth;
  const denied = assertAiAdminCan(auth.actor, capability);
  if (denied) return { ok: false, response: denied };
  return auth;
}
