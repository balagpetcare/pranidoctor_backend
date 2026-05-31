import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';
import {
  getMedicineAdminService,
  updateCompanySchema,
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
    const data = await getMedicineAdminService().getCompany(id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get company';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 404);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.company.manage');
  if (denied) return denied;

  const { id } = await context.params;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  try {
    const body = updateCompanySchema.parse(json);
    const data = await getMedicineAdminService().updateCompany(id, body);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update company';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}
