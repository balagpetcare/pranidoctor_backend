import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminCapability } from '../../../../../../../modules/ai/admin/index.js';
import { getAiAdapterRegistry } from '../../../../../../../modules/ai/marketplace/adapter-registry.js';

export async function GET() {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  return jsonOk({ adapterTypes: getAiAdapterRegistry().listAdapterTypes() });
}
