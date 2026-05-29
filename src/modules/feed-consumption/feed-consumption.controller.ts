import type {
  CreateFeedConsumptionBody,
  FeedConsumptionListQueryInput,
  UpdateFeedConsumptionBody,
} from './feed-consumption.validator.js';
import {
  FeedConsumptionService,
  getFeedConsumptionService,
} from './feed-consumption.service.js';

export class FeedConsumptionController {
  constructor(private readonly service = getFeedConsumptionService()) {}

  list(customerId: string, query: FeedConsumptionListQueryInput) {
    return this.service.list(customerId, {
      farmRef: query.farmRef,
      page: query.page,
      limit: query.limit,
      ...(query.livestockId ? { livestockId: query.livestockId } : {}),
      ...(query.from ? { from: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { to: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    });
  }

  create(
    customerId: string,
    body: CreateFeedConsumptionBody,
    idempotencyKey?: string,
  ) {
    return this.service.create(
      customerId,
      {
        farmRef: body.farmRef,
        amount: body.amount,
        unit: body.unit,
        deductStock: body.deductStock,
        recordedDate: body.recordedDate,
        ...(body.livestockId ? { livestockId: body.livestockId } : {}),
        ...(body.feedInventoryId ? { feedInventoryId: body.feedInventoryId } : {}),
        ...(body.feedItemId ? { feedItemId: body.feedItemId } : {}),
        ...(body.costBdt != null ? { costBdt: body.costBdt } : {}),
        ...(body.notes ? { notes: body.notes } : {}),
      },
      idempotencyKey,
    );
  }

  getById(customerId: string, id: string) {
    return this.service.getById(customerId, id);
  }

  update(customerId: string, id: string, body: UpdateFeedConsumptionBody) {
    const patch: Parameters<FeedConsumptionService['update']>[2] = {};
    if (body.farmRef != null) patch.farmRef = body.farmRef;
    if (body.livestockId !== undefined) patch.livestockId = body.livestockId;
    if (body.feedInventoryId !== undefined) patch.feedInventoryId = body.feedInventoryId;
    if (body.feedItemId !== undefined) patch.feedItemId = body.feedItemId;
    if (body.amount != null) patch.amount = body.amount;
    if (body.unit != null) patch.unit = body.unit;
    if (body.costBdt !== undefined) patch.costBdt = body.costBdt;
    if (body.deductStock != null) patch.deductStock = body.deductStock;
    if (body.recordedDate != null) patch.recordedDate = body.recordedDate;
    if (body.notes !== undefined) patch.notes = body.notes;
    return this.service.update(customerId, id, patch);
  }

  delete(customerId: string, id: string) {
    return this.service.delete(customerId, id);
  }
}

let controllerSingleton: FeedConsumptionController | undefined;

export function getFeedConsumptionController(): FeedConsumptionController {
  if (!controllerSingleton) {
    controllerSingleton = new FeedConsumptionController();
  }
  return controllerSingleton;
}
