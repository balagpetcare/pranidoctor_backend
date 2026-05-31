import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getContractAuditService } from '../../../../../../../../../modules/ai/medicine/contracts/contract-audit.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string }> };

const QuerySchema = z.object({
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.read');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const query = QuerySchema.parse({
      limit: searchParams.get('limit') ?? 50,
      offset: searchParams.get('offset') ?? 0,
    });

    const service = getContractAuditService();
    const result = await service.getAuditHistory(id, {
      limit: query.limit,
      offset: query.offset,
    });

    return jsonOk(result);
  } catch (error) {
    console.error('[medicine/contracts/[id]/audit GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
