export {
  FEED_CONSUMPTION_DEFAULT_LIMIT,
  FEED_CONSUMPTION_DEFAULT_PAGE,
  FEED_CONSUMPTION_ERROR_CODES,
  FEED_CONSUMPTION_MAX_LIMIT,
} from './feed-consumption.constants.js';
export {
  FeedConsumptionController,
  getFeedConsumptionController,
} from './feed-consumption.controller.js';
export type {
  FeedConsumptionDto,
  FeedConsumptionListResponseDto,
} from './feed-consumption.dto.js';
export {
  createFeedConsumptionModule,
  FeedConsumptionModule,
} from './feed-consumption.module.js';
export { getFeedConsumptionRepository } from './feed-consumption.repository.js';
export {
  FeedConsumptionError,
  FeedConsumptionService,
  getFeedConsumptionService,
  mapFeedConsumptionError,
} from './feed-consumption.service.js';
export type {
  CreateFeedConsumptionInput,
  FeedConsumptionErrorCode,
  FeedConsumptionListQuery,
  UpdateFeedConsumptionInput,
} from './feed-consumption.types.js';
export {
  createFeedConsumptionBodySchema,
  feedConsumptionListQuerySchema,
  updateFeedConsumptionBodySchema,
} from './feed-consumption.validator.js';
export type {
  CreateFeedConsumptionBody,
  FeedConsumptionListQueryInput,
  UpdateFeedConsumptionBody,
} from './feed-consumption.validator.js';
