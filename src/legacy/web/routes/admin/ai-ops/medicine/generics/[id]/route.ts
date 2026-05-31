import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';
import {
  getMedicineAdminService,
  updateGenericSchema,
} from '../../../../../../../../modules/ai/medicine/index.js';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const url = new URL(request.url);
    const withBrands = url.searchParams.get('withBrands') === 'true';

    if (withBrands) {
      const data = await getMedicineAdminService().getGenericWithBrands(id);
      return jsonOk(data);
    }

    const data = await getMedicineAdminService().getGeneric(id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get generic';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 404);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.knowledge.write');
  if (denied) return denied;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  try {
    const body = updateGenericSchema.parse(json);

    if (body.isActive !== undefined) {
      await getMedicineAdminService().setGenericActive(id, body.isActive);
    }

    const { isActive, ...updateData } = body;
    if (Object.keys(updateData).length > 0) {
      const data = await getMedicineAdminService().updateGeneric(id, updateData);
      return jsonOk(data);
    }

    const data = await getMedicineAdminService().getGeneric(id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update generic';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}
