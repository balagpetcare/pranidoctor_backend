import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getContractService } from '../../../../../../../../modules/ai/medicine/contracts/contract.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../../modules/ai/admin/index.js';

type RouteContext = { params: Promise<{ id: string }> };

const UpdateContractSchema = z.object({
  titleBn: z.string().min(1).optional(),
  titleEn: z.string().min(1).optional(),
  priorityScore: z.number().min(0).max(1000).optional(),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  budgetBdt: z.number().min(0).optional(),
  targetRegions: z.array(z.string()).optional(),
  targetOrganizationIds: z.array(z.string()).optional(),
  targetSpecies: z.array(z.string()).optional(),
  ruleJson: z.record(z.unknown()).optional(),
});

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.read');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const service = getContractService();
    const contract = await service.getById(id);

    if (!contract) {
      return jsonError('NOT_FOUND', 'Contract not found', 404);
    }

    return jsonOk(contract);
  } catch (error) {
    console.error('[medicine/contracts/[id] GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.write');
  if (denied) return denied;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const input = UpdateContractSchema.parse(body);

    const service = getContractService();
    const updated = await service.update(
      id,
      {
        titleBn: input.titleBn,
        titleEn: input.titleEn,
        priorityScore: input.priorityScore,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        budgetBdt: input.budgetBdt,
        targetRegions: input.targetRegions,
        targetOrganizationIds: input.targetOrganizationIds,
        targetSpecies: input.targetSpecies,
        ruleJson: input.ruleJson,
      },
      auth.actor.id,
    );

    return jsonOk(updated);
  } catch (error) {
    console.error('[medicine/contracts/[id] PUT]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
