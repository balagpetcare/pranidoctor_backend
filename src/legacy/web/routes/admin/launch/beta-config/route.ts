import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getClosedBetaConfig,
  parseClosedBetaConfig,
  saveClosedBetaConfig,
} from '../../../../../../shared/launch/closed-beta-config.service.js';
import { closedBetaConfigPatchSchema } from '../../../../../../shared/launch/closed-beta.schemas.js';

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  try {
    const config = await getClosedBetaConfig();
    return jsonOk(config);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to load closed beta config', 500);
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  const parsed = closedBetaConfigPatchSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 422);
  }
  try {
    const current = await getClosedBetaConfig();
    const next = parseClosedBetaConfig({ ...current, ...parsed.data });
    const saved = await saveClosedBetaConfig(next);
    return jsonOk(saved);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to save closed beta config', 500);
  }
}
