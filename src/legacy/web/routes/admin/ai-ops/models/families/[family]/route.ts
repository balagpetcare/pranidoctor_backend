import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiModelRegistryService,
  modelFamilyParamSchema,
  requireAiAdminCapability,
} from '../../../../../../../../modules/ai/admin/index.js';

export async function GET(
  _request: Request,
  context: { params: Promise<{ family: string }> },
) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const { family: familyRaw } = await context.params;
  try {
    const family = modelFamilyParamSchema.parse(familyRaw);
    const data = await getAiModelRegistryService().listModelsByFamily(family);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to load family models'),
      400,
    );
  }
}
