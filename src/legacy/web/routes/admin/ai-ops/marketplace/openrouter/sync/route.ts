import { z } from 'zod';
import { jsonError, jsonOk } from '@/lib/api-response';
import { requireAiAdminCapability } from '../../../../../../../../modules/ai/admin/index.js';
import { getOpenRouterCatalogService } from '../../../../../../../../modules/ai/marketplace/openrouter-catalog.service.js';

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
    const body = z
      .object({
        modelIds: z.array(z.string().min(1)).min(1),
        defaultCategory: z.string().max(64).optional(),
      })
      .parse(json);
    const data = await getOpenRouterCatalogService().syncSelectedModels(body);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OpenRouter sync failed';
    return jsonError('AI_MARKETPLACE_ERROR', message, 400);
  }
}
