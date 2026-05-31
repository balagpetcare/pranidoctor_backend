import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  createModelSchema,
  getAiModelRegistryService,
  modelFamilyParamSchema,
  requireAiAdminCapability,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const providerId = url.searchParams.get('providerId') ?? undefined;
  const familyRaw = url.searchParams.get('modelFamily') ?? url.searchParams.get('family');
  const enabledRaw = url.searchParams.get('enabled');
  try {
    let modelFamily: ReturnType<typeof modelFamilyParamSchema.parse> | undefined;
    if (familyRaw) {
      modelFamily = modelFamilyParamSchema.parse(familyRaw);
    }
    const enabled =
      enabledRaw === 'true' ? true : enabledRaw === 'false' ? false : undefined;
    const data = await getAiModelRegistryService().listModels({
      providerId,
      modelFamily,
      enabled,
    });
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to load models'),
      500,
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminCapability('ai.registry.manage');
  if (!auth.ok) return auth.response;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }
  try {
    const body = createModelSchema.parse(json);
    const data = await getAiModelRegistryService().createModel(body, auth.actor.id);
    return jsonOk(data);
  } catch (error) {
    return jsonError(
      'AI_ADMIN_ERROR',
      adminErrorMessage(error, 'Failed to create model'),
      400,
    );
  }
}
