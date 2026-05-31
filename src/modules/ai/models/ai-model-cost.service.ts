import type { AiModel, Prisma } from '../../../generated/prisma/index.js';
import { getPrisma } from '../../../shared/database/prisma.js';
import { getAiCostRateService } from '../usage/ai-cost-rate.service.js';
import type { AiModelRateHistoryDto } from './ai-model.types.js';

export type UpdateModelRatesInput = {
  inputCostPerToken: number;
  outputCostPerToken: number;
  cachedInputCostPerToken?: number | null;
  batchInputCostPerToken?: number | null;
  batchOutputCostPerToken?: number | null;
  currency?: string;
  changeReason?: string;
  source?: string;
};

function toHistoryDto(row: {
  id: string;
  rateVersion: number;
  inputCostPerToken: Prisma.Decimal;
  outputCostPerToken: Prisma.Decimal;
  cachedInputCostPerToken: Prisma.Decimal | null;
  batchInputCostPerToken: Prisma.Decimal | null;
  batchOutputCostPerToken: Prisma.Decimal | null;
  currency: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  changeReason: string | null;
  source: string;
}): AiModelRateHistoryDto {
  return {
    id: row.id,
    rateVersion: row.rateVersion,
    inputCostPerToken: Number(row.inputCostPerToken),
    outputCostPerToken: Number(row.outputCostPerToken),
    cachedInputCostPerToken: row.cachedInputCostPerToken != null ? Number(row.cachedInputCostPerToken) : null,
    batchInputCostPerToken: row.batchInputCostPerToken != null ? Number(row.batchInputCostPerToken) : null,
    batchOutputCostPerToken: row.batchOutputCostPerToken != null ? Number(row.batchOutputCostPerToken) : null,
    currency: row.currency,
    effectiveFrom: row.effectiveFrom.toISOString(),
    effectiveTo: row.effectiveTo?.toISOString() ?? null,
    changeReason: row.changeReason,
    source: row.source,
  };
}

export class AiModelCostService {
  readonly name = 'AiModelCostService';

  async listRateHistory(modelId: string): Promise<AiModelRateHistoryDto[]> {
    const prisma = getPrisma();
    const rows = await prisma.aiModelRateHistory.findMany({
      where: { modelId },
      orderBy: [{ rateVersion: 'desc' }, { effectiveFrom: 'desc' }],
    });
    return rows.map(toHistoryDto);
  }

  async updateRates(
    model: AiModel,
    input: UpdateModelRatesInput,
    actorUserId?: string,
  ): Promise<{ rateVersion: number }> {
    const prisma = getPrisma();
    const nextVersion = model.rateVersion + 1;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.aiModelRateHistory.updateMany({
        where: { modelId: model.id, effectiveTo: null },
        data: { effectiveTo: now },
      });

      await tx.aiModelRateHistory.create({
        data: {
          modelId: model.id,
          rateVersion: nextVersion,
          inputCostPerToken: input.inputCostPerToken,
          outputCostPerToken: input.outputCostPerToken,
          cachedInputCostPerToken: input.cachedInputCostPerToken ?? null,
          batchInputCostPerToken: input.batchInputCostPerToken ?? null,
          batchOutputCostPerToken: input.batchOutputCostPerToken ?? null,
          currency: input.currency ?? model.currency,
          changedByUserId: actorUserId ?? null,
          changeReason: input.changeReason ?? null,
          source: input.source ?? 'admin',
        },
      });

      await tx.aiModel.update({
        where: { id: model.id },
        data: {
          inputCostPerToken: input.inputCostPerToken,
          outputCostPerToken: input.outputCostPerToken,
          cachedInputCostPerToken: input.cachedInputCostPerToken ?? null,
          batchInputCostPerToken: input.batchInputCostPerToken ?? null,
          batchOutputCostPerToken: input.batchOutputCostPerToken ?? null,
          currency: input.currency ?? model.currency,
          rateVersion: nextVersion,
          updatedByUserId: actorUserId ?? null,
        },
      });
    });

    getAiCostRateService().invalidateCache();
    return { rateVersion: nextVersion };
  }

  estimateCostUsd(
    model: Pick<AiModel, 'inputCostPerToken' | 'outputCostPerToken'>,
    inputTokens: number,
    outputTokens: number,
  ): number {
    return (
      inputTokens * Number(model.inputCostPerToken) +
      outputTokens * Number(model.outputCostPerToken)
    );
  }
}

let costService: AiModelCostService | null = null;

export function getAiModelCostService(): AiModelCostService {
  if (!costService) costService = new AiModelCostService();
  return costService;
}

export function resetAiModelCostServiceForTests(): void {
  costService = null;
}
