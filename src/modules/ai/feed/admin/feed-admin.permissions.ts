import { jsonError } from '../../../../legacy/web/lib/api-response.js';
import type { AiAdminActor } from '../../admin/ai-admin.guard.js';
import {
  aiAdminCan,
  type AiAdminCapability,
} from '../../admin/ai-permissions.js';

export type FeedAdminCapability = Extract<
  AiAdminCapability,
  'ai.feed.view' | 'ai.feed.manage' | 'ai.feed.publish' | 'ai.feed.audit'
>;

export function feedAdminCan(actor: AiAdminActor, capability: FeedAdminCapability): boolean {
  return aiAdminCan(actor, capability);
}

export function assertFeedAdminCan(
  actor: AiAdminActor,
  capability: FeedAdminCapability,
): Response | null {
  if (feedAdminCan(actor, capability)) return null;
  return jsonError('FORBIDDEN', `Missing capability: ${capability}`, 403);
}
