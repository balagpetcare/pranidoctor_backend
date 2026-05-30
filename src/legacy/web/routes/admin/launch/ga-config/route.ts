import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getGaLaunchConfig,
  parseGaLaunchConfig,
  saveGaLaunchConfig,
} from '../../../../../../shared/launch/ga-config.service.js';
import { gaLaunchConfigPatchSchema } from '../../../../../../shared/launch/ga.schemas.js';

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  try {
    const config = await getGaLaunchConfig();
    return jsonOk(config);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to load GA launch config', 500);
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
  const parsed = gaLaunchConfigPatchSchema.safeParse(json);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', parsed.error.message, 422);
  }
  try {
    const current = await getGaLaunchConfig();
    const patch = parsed.data;
    let gateChecklist = current.gateChecklist;
    if (patch.gateChecklist) {
      const byId = new Map(gateChecklist.map((i) => [i.id, i]));
      for (const update of patch.gateChecklist) {
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
    const next = parseGaLaunchConfig({
      ...current,
      ...patch,
      gateChecklist,
      ownership: patch.ownership
        ? { ...current.ownership, ...patch.ownership }
        : current.ownership,
      monitoringLinks: patch.monitoringLinks
        ? { ...current.monitoringLinks, ...patch.monitoringLinks }
        : current.monitoringLinks,
    });
    const saved = await saveGaLaunchConfig(next);
    return jsonOk(saved);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to save GA launch config', 500);
  }
}
