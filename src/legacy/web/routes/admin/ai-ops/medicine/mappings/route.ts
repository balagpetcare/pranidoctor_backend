import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getGenericBrandMappingService } from '../../../../../../../modules/ai/medicine/mapping/generic-brand-mapping.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';

const QuerySchema = z.object({
  genericCode: z.string().optional(),
  brandCode: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.knowledge.read');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      genericCode: searchParams.get('genericCode') ?? undefined,
      brandCode: searchParams.get('brandCode') ?? undefined,
    });

    const service = getGenericBrandMappingService();

    if (query.genericCode) {
      const mapping = await service.getFullMappingForGeneric(query.genericCode);
      return jsonOk(mapping);
    }

    if (query.brandCode) {
      const mapping = await service.getFullMappingForBrand(query.brandCode);
      return jsonOk(mapping);
    }

    const stats = await service.getMappingStats();
    return jsonOk(stats);
  } catch (error) {
    console.error('[medicine/mappings GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
