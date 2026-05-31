import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';
import { getContractService } from '../../../../../../../modules/ai/medicine/contracts/contract.service.js';
import { assertAiAdminCan, requireAiAdminActor } from '../../../../../../../modules/ai/admin/index.js';

const ListContractsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED', 'CANCELLED']).optional(),
  type: z.enum(['SPONSOR', 'CAMPAIGN', 'ORGANIZATION', 'REGIONAL']).optional(),
  sponsorCompanyId: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const CreateContractSchema = z.object({
  contractCode: z.string().min(1).max(64),
  titleBn: z.string().min(1),
  titleEn: z.string().min(1),
  contractType: z.enum(['SPONSOR', 'CAMPAIGN', 'ORGANIZATION', 'REGIONAL']),
  priorityScore: z.number().min(0).max(1000).default(100),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  budgetBdt: z.number().min(0).optional(),
  targetRegions: z.array(z.string()).optional(),
  targetOrganizationIds: z.array(z.string()).optional(),
  targetSpecies: z.array(z.string()).optional(),
  sponsorCompanyId: z.string().optional(),
  ruleJson: z.record(z.unknown()).optional(),
});

export async function GET(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.read');
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const query = ListContractsQuerySchema.parse({
      status: searchParams.get('status') ?? undefined,
      type: searchParams.get('type') ?? undefined,
      sponsorCompanyId: searchParams.get('sponsorCompanyId') ?? undefined,
      limit: searchParams.get('limit') ?? 50,
      offset: searchParams.get('offset') ?? 0,
    });

    const service = getContractService();
    const result = await service.list({
      status: query.status,
      contractType: query.type,
      sponsorCompanyId: query.sponsorCompanyId,
      limit: query.limit,
      offset: query.offset,
    });

    return jsonOk(result);
  } catch (error) {
    console.error('[medicine/contracts GET]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}

export async function POST(request: Request) {
  const auth = await requireAiAdminActor();
  if (!auth.ok) return auth.response;
  const denied = assertAiAdminCan(auth.actor, 'ai.medicine.contracts.write');
  if (denied) return denied;

  try {
    const body = await request.json();
    const input = CreateContractSchema.parse(body);

    const service = getContractService();
    const contract = await service.create(
      {
        contractCode: input.contractCode,
        titleBn: input.titleBn,
        titleEn: input.titleEn,
        contractType: input.contractType,
        priorityScore: input.priorityScore,
        effectiveDate: new Date(input.effectiveDate),
        expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
        budgetBdt: input.budgetBdt,
        targetRegions: input.targetRegions,
        targetOrganizationIds: input.targetOrganizationIds,
        targetSpecies: input.targetSpecies,
        sponsorCompanyId: input.sponsorCompanyId,
        ruleJson: input.ruleJson,
      },
      auth.actor.id,
    );

    return jsonOk(contract);
  } catch (error) {
    console.error('[medicine/contracts POST]', error);
    return jsonError('SERVER_ERROR', error instanceof Error ? error.message : 'Internal error');
  }
}
