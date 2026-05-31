import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminCapability, getAiRegistryAdminService } from '../../../../../../modules/ai/admin/index.js';

export async function GET() {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiRegistryAdminService().getHealthDashboard();
    return jsonOk(data);
  } catch {
    return jsonError('AI_ADMIN_ERROR', 'Failed to load AI health dashboard', 500);
  }
}
