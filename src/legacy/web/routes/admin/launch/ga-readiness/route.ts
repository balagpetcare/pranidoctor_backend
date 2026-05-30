import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import {
  deriveGoNoGoVerdict,
  getGaLaunchConfig,
  saveGaLaunchConfig,
} from '../../../../../../shared/launch/ga-config.service.js';
import { buildGaReadinessSnapshot } from '../../../../../../shared/launch/ga-readiness.service.js';
import { gaGateReviewBodySchema } from '../../../../../../shared/launch/ga.schemas.js';

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  try {
    const snapshot = await buildGaReadinessSnapshot();
    return jsonOk(snapshot);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to build GA readiness snapshot', 500);
  }
}

/** Record gate review — updates checklist items and verdict without enabling GA. */
export async function POST(request: Request) {
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
  const parsed = gaGateReviewBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 422);
  }
  try {
    const current = await getGaLaunchConfig();
    let gateChecklist = current.gateChecklist;
    if (parsed.data.checklistUpdates) {
      const byId = new Map(gateChecklist.map((i) => [i.id, i]));
      for (const update of parsed.data.checklistUpdates) {
        const existing = byId.get(update.id);
        if (existing) {
          byId.set(update.id, {
            ...existing,
            status: update.status,
            ...(update.owner !== undefined ? { owner: update.owner } : {}),
            ...(update.evidence !== undefined ? { evidence: update.evidence } : {}),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      gateChecklist = Array.from(byId.values());
    }
    const merged = {
      ...current,
      gateChecklist,
      lastGateReviewAt: new Date().toISOString(),
      lastGateReviewBy: parsed.data.reviewer,
    };
    const derived = deriveGoNoGoVerdict(merged);
    merged.goNoGoVerdict = parsed.data.verdict ?? derived;
    await saveGaLaunchConfig(merged);
    const snapshot = await buildGaReadinessSnapshot();
    return jsonOk(snapshot);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to record gate review', 500);
  }
}
