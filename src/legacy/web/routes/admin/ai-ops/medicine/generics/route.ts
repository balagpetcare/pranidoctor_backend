import { jsonError, jsonOk } from '@/lib/api-response';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';
import {
  getMedicineAdminService,
  listGenericsQuerySchema,
  createGenericSchema,
} from '../../../../../../../modules/ai/medicine/index.js';

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.ops.view');
  if (denied) return denied;

  try {
    const url = new URL(request.url);
    const params = listGenericsQuerySchema.parse({
      isActive: url.searchParams.get('isActive') ?? undefined,
      species: url.searchParams.get('species') ?? undefined,
      drugClass: url.searchParams.get('drugClass') ?? undefined,
      therapeuticCategory: url.searchParams.get('therapeuticCategory') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      bannedSubstance: url.searchParams.get('bannedSubstance') ?? undefined,
      controlledSubstance: url.searchParams.get('controlledSubstance') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });

    const data = await getMedicineAdminService().listGenerics(params);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list generics';
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
    const body = createGenericSchema.parse(json);
    const data = await getMedicineAdminService().createGeneric(body);
    return jsonOk(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create generic';
    return jsonError('MEDICINE_ADMIN_ERROR', message, 400);
  }
}
