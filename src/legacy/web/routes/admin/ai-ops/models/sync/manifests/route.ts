import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  requireAiAdminCapability,
} from '../../../../../../../../modules/ai/admin/index.js';

export async function POST(_request: Request) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  try {
    const data = await getAiModelRegistryService().syncFromManifests(auth.actor);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to sync model manifests'),
      500,
    );
  }
}
