import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminActor } from '../../../../../../../../modules/ai/admin/ai-admin.guard.js';
import { getVeterinaryModelService } from '../../../../../../../../modules/ai/marketplace/veterinary-model.service.js';

export async function GET() {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  try {
    const data = await getVeterinaryModelService().listVeterinaryModels();
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list veterinary models';
    return jsonError('AI_MARKETPLACE_ERROR', message, 500);
  }
}
