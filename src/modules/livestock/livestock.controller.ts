import { OwnershipError } from '../phase4-shared/ownership.js';
import type {
  CreateLivestockBody,
  CreateLivestockImageBody,
  ListLivestockQuery,
  UpdateLivestockBody,
} from './livestock.validator.js';
import {
  getLivestockService,
  LivestockError,
} from './livestock.service.js';

export class LivestockController {
  private readonly livestock = getLivestockService();

  create(customerId: string, body: CreateLivestockBody, actorUserId?: string) {
    return this.livestock.create(customerId, body, actorUserId);
  }

  getById(customerId: string, id: string) {
    return this.livestock.getById(customerId, id);
  }

  list(customerId: string, query: ListLivestockQuery) {
    return this.livestock.list(customerId, query);
  }

  update(
    customerId: string,
    id: string,
    body: UpdateLivestockBody,
    actorUserId?: string,
  ) {
    return this.livestock.update(customerId, id, body, actorUserId);
  }

  softDelete(customerId: string, id: string, actorUserId?: string) {
    return this.livestock.softDelete(customerId, id, actorUserId);
  }

  addImage(customerId: string, livestockId: string, body: CreateLivestockImageBody) {
    return this.livestock.addImage(customerId, livestockId, body);
  }

  listImages(customerId: string, livestockId: string) {
    return this.livestock.listImages(customerId, livestockId);
  }

  deleteImage(customerId: string, livestockId: string, imageId: string) {
    return this.livestock.deleteImage(customerId, livestockId, imageId);
  }
}

let controllerSingleton: LivestockController | undefined;

export function getLivestockController(): LivestockController {
  if (!controllerSingleton) {
    controllerSingleton = new LivestockController();
  }
  return controllerSingleton;
}

export function mapLivestockError(
  error: unknown,
): { code: string; status: number; message: string } | null {
  if (error instanceof OwnershipError) {
    return {
      code: error.code === 'NOT_FOUND' ? 'LIVESTOCK_NOT_FOUND' : 'FORBIDDEN',
      status: error.code === 'NOT_FOUND' ? 404 : 403,
      message: error.message,
    };
  }

  if (!(error instanceof LivestockError)) {
    return null;
  }

  switch (error.code) {
    case 'DUPLICATE_EAR_TAG':
      return { code: 'DUPLICATE_EAR_TAG', status: 409, message: error.message };
    case 'NOT_FOUND':
      return { code: 'LIVESTOCK_NOT_FOUND', status: 404, message: error.message };
    default:
      return { code: error.code, status: 400, message: error.message };
  }
}
