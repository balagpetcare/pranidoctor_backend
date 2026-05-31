import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getContractService } from '../../../../../../../../../modules/ai/medicine/contracts/contract.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string }> };

const AddBrandSchema = z.object({
  brandId: z.string().min(1),
  boostScore: z.number().min(0).max(100).default(10),
  notes: z.string().optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.read');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const service = getContractService();
    const brands = await service.getContractBrands(id);

    return jsonOk({ items: brands, total: brands.length });
  } catch (error) {
    console.error('[medicine/contracts/[id]/brands GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.write');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = AddBrandSchema.parse(body);

    const service = getContractService();
    await service.addBrand(id, input.brandId, input.boostScore, auth.actor.id);

    return jsonOk({ success: true });
  } catch (error) {
    console.error('[medicine/contracts/[id]/brands POST]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
