import { jsonError } from '../../legacy/web/lib/api-response.js';
import { guardFields, type GuardOutcome, type ViolationSource } from './service.js';

export function contactBlockedResponse(o: GuardOutcome): Response {
  return jsonError(o.code, o.messageBn, o.suspended ? 403 : 422);
}

/** Returns a Response when blocked, else null. Never throws on guard failure of the DB (fail-open is logged by caller). */
export async function guardRequestBody(
  userId: string,
  source: ViolationSource,
  fields: Record<string, unknown>,
  ctx: { entityType?: string; entityId?: string } = {},
): Promise<Response | null> {
  const out = await guardFields(userId, source, fields, ctx);
  return out ? contactBlockedResponse(out) : null;
}
