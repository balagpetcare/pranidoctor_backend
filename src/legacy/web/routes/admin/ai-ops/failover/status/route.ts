import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../modules/ai/admin/ai-admin.guard.js';
import { getAiRegistryAdminService } from '../../../../../../../modules/ai/admin/index.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiRegistryAdminService().getFailoverStatus();
    return jsonOk(data);
  } catch {
    return jsonError('AI_ADMIN_ERROR', 'Failed to load failover status', 500);
  }
}
