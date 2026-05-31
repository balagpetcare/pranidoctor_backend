import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getVetRecommendationService } from '../../../../../../../../modules/ai/medicine/vet-layer/vet-recommendation.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

const PreviewSchema = z.object({
  genericCode: z.string().min(1),
  species: z.string().optional(),
  region: z.string().optional(),
  organizationId: z.string().optional(),
  customerId: z.string().optional(),
});

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.recommendations.view');
  if (denied) return denied;

  try {
    const body = await request.json();
    const input = PreviewSchema.parse(body);

    const service = getVetRecommendationService();
    const result = await service.getRecommendation({
      query: input.genericCode,
      genericCode: input.genericCode,
      species: input.species as 'CATTLE' | 'GOAT' | 'SHEEP' | 'POULTRY' | 'DUCK' | 'FISH' | undefined,
      region: input.region,
      organizationId: input.organizationId,
      customerId: input.customerId,
      sessionId: `admin-preview-${Date.now()}`,
    });

    return jsonOk(result);
  } catch (error) {
    console.error('[medicine/recommendations/preview POST]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
