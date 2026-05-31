import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';
import { getMedicineAdminService, livestockSpeciesSchema } from '../../../../../../../modules/ai/medicine/index.js';
import { z } from 'zod';

const searchQuerySchema = z.object({
  q: z.string().min(1),
  species: livestockSpeciesSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const params = searchQuerySchema.parse({
      q: url.searchParams.get('q') ?? '',
      species: url.searchParams.get('species') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });

    const data = await getMedicineAdminService().searchMedicines(params.q, {
      species: params.species,
      limit: params.limit,
    });

    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to search medicines';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 500);
  }
}
