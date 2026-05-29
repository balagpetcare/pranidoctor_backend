import { assertLivestockOwned, OwnershipError } from '../phase4-shared/ownership.js';

import { RULE_VERSION } from './feed-recommendation.constants.js';
import { toFeedRecommendationDto } from './feed-recommendation.dto.js';
import { getFeedRecommendationRepository } from './feed-recommendation.repository.js';
import {
  buildRecommendationEngineInput,
  resolveEngineWeightKg,
} from './recommendation.engine.js';
import { runIntelligenceEngine } from './intelligence.engine.js';
import type {
  FeedRecommendationErrorCode,
  RecommendationEngineInput,
  RecommendationResult,
} from './feed-recommendation.types.js';
import type { PreviewRecommendationBody } from './feed-recommendation.validator.js';

export class FeedRecommendationError extends Error {
  constructor(
    readonly code: FeedRecommendationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FeedRecommendationError';
  }
}

function parsePlanDate(value?: string): Date {
  const raw = value ?? new Date().toISOString().slice(0, 10);
  const [y, m, d] = raw.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function logToResult(row: {
  ruleVersion: string;
  planDate: Date;
  itemsJson: unknown;
  totalsJson: unknown;
  warningsJson: unknown;
}): RecommendationResult {
  return {
    ruleVersion: row.ruleVersion,
    planDate: row.planDate.toISOString().slice(0, 10),
    items: row.itemsJson as RecommendationResult['items'],
    totals: row.totalsJson as RecommendationResult['totals'],
    warnings: (row.warningsJson as string[] | null) ?? [],
    disclaimerBn: 'এটি সাধারণ নির্দেশিকা মাত্র; পশুচিকিৎসকের পরামর্শের বিকল্প নয়।',
  };
}

export class FeedRecommendationService {
  readonly name = 'FeedRecommendationService';

  constructor(private readonly repo = getFeedRecommendationRepository()) {}

  private async buildFromEngineInput(
    input: RecommendationEngineInput,
    planDate: Date,
    livestockId?: string,
  ): Promise<RecommendationResult> {
    const feedItems = await this.repo.listActiveFeedItems();
    if (feedItems.length === 0) {
      throw new FeedRecommendationError(
        'NO_FEED_ITEMS',
        'No active feed items in catalog',
      );
    }

    const context = livestockId
      ? await this.repo.getLivestockIntelligenceContext(livestockId)
      : undefined;

    return runIntelligenceEngine({
      input,
      ...(context ? { context } : {}),
      feedItems,
      planDate,
    });
  }

  async getDailyRecommendation(
    customerId: string,
    livestockId: string,
    planDate?: string,
  ) {
    const date = parsePlanDate(planDate);
    const livestock = await assertLivestockOwned(customerId, livestockId);

    const engineInput = buildRecommendationEngineInput({
      species: livestock.species,
      gender: livestock.gender,
      weightKg: livestock.weightKg != null ? Number(livestock.weightKg) : null,
      dateOfBirth: livestock.dateOfBirth,
      purpose: livestock.purpose,
      pregnancyStatus: livestock.pregnancyStatus,
      healthStatus: livestock.healthStatus,
      planDate: date,
    });

    const result = await this.buildFromEngineInput(engineInput, date, livestockId);
    return toFeedRecommendationDto(result, { livestockId });
  }

  async previewRecommendation(
    _customerId: string,
    body: PreviewRecommendationBody,
  ) {
    const date = parsePlanDate(body.planDate);
    const engineInput: RecommendationEngineInput = {
      species: body.species,
      gender: body.gender,
      weightKg: body.weightKg ?? 0,
      ageMonths: body.ageMonths ?? null,
      purpose: body.purpose ?? null,
      pregnancyStatus: body.pregnancyStatus ?? null,
      healthStatus: body.healthStatus,
    };

    if (engineInput.weightKg <= 0) {
      engineInput.weightKg = resolveEngineWeightKg(body.species, body.weightKg);
    }

    const result = await this.buildFromEngineInput(engineInput, date);
    return toFeedRecommendationDto(result);
  }

  async acceptRecommendation(
    customerId: string,
    livestockId: string,
    planDate: string,
    logId?: string,
  ) {
    const date = parsePlanDate(planDate);
    await assertLivestockOwned(customerId, livestockId);

    let result: RecommendationResult;
    let savedLogId: string;

    if (logId) {
      const existing = await this.repo.findLogById(customerId, logId);
      if (!existing || existing.livestockId !== livestockId) {
        throw new FeedRecommendationError('NOT_FOUND', 'Recommendation log not found');
      }
      result = logToResult(existing);
      const updated = await this.repo.markAccepted(logId);
      savedLogId = updated.id;
    } else {
      const daily = await this.getDailyRecommendation(customerId, livestockId, planDate);
      result = {
        ruleVersion: daily.ruleVersion,
        planDate: daily.planDate,
        items: daily.items,
        totals: daily.totals,
        warnings: daily.warnings,
        disclaimerBn: daily.disclaimerBn,
      };
      const created = await this.repo.createLog({
        customerId,
        livestockId,
        planDate: date,
        ruleVersion: RULE_VERSION,
        result,
        accepted: true,
      });
      savedLogId = created.id;
    }

    return toFeedRecommendationDto(result, {
      livestockId,
      logId: savedLogId,
      accepted: true,
    });
  }
}

let serviceSingleton: FeedRecommendationService | undefined;

export function getFeedRecommendationService(): FeedRecommendationService {
  if (!serviceSingleton) {
    serviceSingleton = new FeedRecommendationService();
  }
  return serviceSingleton;
}

export function mapFeedRecommendationError(
  e: unknown,
): { code: string; status: number; message: string } | null {
  if (e instanceof FeedRecommendationError) {
    switch (e.code) {
      case 'NOT_FOUND':
        return { code: 'NOT_FOUND', status: 404, message: e.message };
      case 'NO_FEED_ITEMS':
        return { code: 'NO_FEED_ITEMS', status: 503, message: e.message };
      default:
        return { code: 'VALIDATION_ERROR', status: 400, message: e.message };
    }
  }
  if (e instanceof OwnershipError) {
    return {
      code: e.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'FORBIDDEN',
      status: e.code === 'NOT_FOUND' ? 404 : 403,
      message: e.message,
    };
  }
  return null;
}
