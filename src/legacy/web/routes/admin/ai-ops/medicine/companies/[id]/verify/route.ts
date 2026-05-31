import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';
import { getMedicineAdminService } from '../../../../../../../../../modules/ai/medicine/index.js';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.company.manage');
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const data = await getMedicineAdminService().verifyCompany(id, auth.actor.userId);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to verify company';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.company.manage');
  if (denied) return denied;

  const { id } = await context.params;

  try {
    const data = await getMedicineAdminService().unverifyCompany(id);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to unverify company';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}
