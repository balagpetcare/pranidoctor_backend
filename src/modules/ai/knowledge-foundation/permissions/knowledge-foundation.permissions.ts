import type { AiAdminCapability } from '../../admin/ai-permissions.js';
import { aiAdminCan } from '../../admin/ai-permissions.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';

export type KnowledgeFoundationCapability =
  | 'ai.knowledge.view'
  | 'ai.knowledge.edit'
  | 'ai.knowledge.review'
  | 'ai.knowledge.approve'
  | 'ai.knowledge.publish'
  | 'ai.knowledge.sources.manage'
  | 'ai.knowledge.audit.export';

const KNOWLEDGE_CAPABILITY_MAP: Record<KnowledgeFoundationCapability, AiAdminCapability | null> = {
  'ai.knowledge.view': 'ai.ops.view',
  'ai.knowledge.edit': 'ai.registry.manage',
  'ai.knowledge.review': 'ai.registry.manage',
  'ai.knowledge.approve': 'ai.registry.manage',
  'ai.knowledge.publish': 'ai.foundation.manage',
  'ai.knowledge.sources.manage': 'ai.registry.manage',
  'ai.knowledge.audit.export': 'ai.analytics.export',
};

const SUPER_ADMIN_KNOWLEDGE: KnowledgeFoundationCapability[] = [
  'ai.knowledge.view',
  'ai.knowledge.edit',
  'ai.knowledge.review',
  'ai.knowledge.approve',
  'ai.knowledge.publish',
  'ai.knowledge.sources.manage',
  'ai.knowledge.audit.export',
];

const ADMIN_KNOWLEDGE: KnowledgeFoundationCapability[] = [
  'ai.knowledge.view',
  'ai.knowledge.edit',
  'ai.knowledge.review',
  'ai.knowledge.sources.manage',
];

export function knowledgeFoundationCan(
  actor: AiAdminActor,
  capability: KnowledgeFoundationCapability,
): boolean {
  if (actor.role === 'SUPER_ADMIN') {
    return SUPER_ADMIN_KNOWLEDGE.includes(capability);
  }
  if (actor.role === 'ADMIN') {
    return ADMIN_KNOWLEDGE.includes(capability);
  }
  const mapped = KNOWLEDGE_CAPABILITY_MAP[capability];
  if (!mapped) return false;
  return aiAdminCan(actor, mapped);
}

export function assertKnowledgeFoundationCan(
  actor: AiAdminActor,
  capability: KnowledgeFoundationCapability,
): void {
  if (!knowledgeFoundationCan(actor, capability)) {
    throw new Error(`Missing knowledge capability: ${capability}`);
  }
}
