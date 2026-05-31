import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';
import {
  getMedicineAdminService,
  listBrandsQuerySchema,
  createBrandSchema,
} from '../../../../../../../modules/ai/medicine/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const params = listBrandsQuerySchema.parse({
      isActive: url.searchParams.get('isActive') ?? undefined,
      genericId: url.searchParams.get('genericId') ?? undefined,
      companyId: url.searchParams.get('companyId') ?? undefined,
      form: url.searchParams.get('form') ?? undefined,
      bdAvailability: url.searchParams.get('bdAvailability') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });

    const data = await getMedicineAdminService().listBrands(params);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list brands';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.knowledge.write');
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError('INVALID_JSON', 'Request body must be JSON', 400);
  }

  try {
    const body = createBrandSchema.parse(json);
    const data = await getMedicineAdminService().createBrand(body);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create brand';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}
