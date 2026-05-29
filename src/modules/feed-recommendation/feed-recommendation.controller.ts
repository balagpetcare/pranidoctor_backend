import type {
  AcceptRecommendationBody,
  DailyRecommendationQuery,
  PreviewRecommendationBody,
} from './feed-recommendation.validator.js';
import { getFeedRecommendationService } from './feed-recommendation.service.js';

export class FeedRecommendationController {
  constructor(private readonly service = getFeedRecommendationService()) {}

  getDailyRecommendation(
    customerId: string,
    livestockId: string,
    query: DailyRecommendationQuery,
  ) {
    return this.service.getDailyRecommendation(
      customerId,
      livestockId,
      query.planDate,
    );
  }

  previewRecommendation(customerId: string, body: PreviewRecommendationBody) {
    return this.service.previewRecommendation(customerId, body);
  }

  acceptRecommendation(
    customerId: string,
    livestockId: string,
    body: AcceptRecommendationBody,
  ) {
    return this.service.acceptRecommendation(
      customerId,
      livestockId,
      body.planDate,
      body.logId,
    );
  }
}

let controllerSingleton: FeedRecommendationController | undefined;

export function getFeedRecommendationController(): FeedRecommendationController {
  if (!controllerSingleton) {
    controllerSingleton = new FeedRecommendationController();
  }
  return controllerSingleton;
}
