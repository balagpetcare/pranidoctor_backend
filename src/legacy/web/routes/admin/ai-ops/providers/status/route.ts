import { jsonError, jsonOk } from '@/lib/api-response';
import {
  adminErrorMessage,
  getAiProviderManagementService,
  requireAiAdminCapability,
} from '../../../../../../modules/ai/admin/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminCapability('ai.ops.view');
  if (!auth.ok) return auth.response;
  try {
    const url = new URL(request.url);
    const scopeKey = url.searchParams.get('scopeKey') ?? undefined;
    const data = await getAiProviderManagementService().getStatusBoard(scopeKey ?? undefined);
    return jsonOk(data);
  } catch (error) {
    return jsonError('AI_ADMIN_ERROR', adminErrorMessage(error, 'Failed to load provider status'), 500);
  }
}
