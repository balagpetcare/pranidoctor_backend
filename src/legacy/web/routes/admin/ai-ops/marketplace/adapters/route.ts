import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../modules/ai/admin/ai-admin.guard.js';
import { getAiAdapterRegistry } from '../../../../../../../modules/ai/marketplace/adapter-registry.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  return jsonOk({ adapterTypes: getAiAdapterRegistry().listAdapterTypes() });
}
