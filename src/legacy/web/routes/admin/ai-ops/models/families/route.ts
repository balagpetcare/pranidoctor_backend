import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  requireAiAdminCapability,
} from '../../../../../../../modules/ai/admin/index.js';

export async function GET(_request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiModelRegistryService().listFamilies();
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to load model families'),
      500,
    );
  }
}
