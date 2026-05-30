import { requireAdminApiActor } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import { buildGaDashboardMetrics } from '../../../../../../shared/launch/ga-metrics.service.js';

export async function GET() {
  const auth = await requireAdminApiActor();
  if (!auth.ok) return auth.response;
  if (auth.actor.role !== 'SUPER_ADMIN' && auth.actor.role !== 'ADMIN') {
    return jsonError('FORBIDDEN', 'Admin role required', 403);
  }
  try {
    const metrics = await buildGaDashboardMetrics();
    return jsonOk(metrics);
  } catch {
    return jsonError('DATABASE_ERROR', 'Failed to load GA dashboard metrics', 500);
  }
}
