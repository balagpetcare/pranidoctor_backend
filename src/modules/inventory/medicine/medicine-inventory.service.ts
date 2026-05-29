import { InventoryType } from '@/generated/prisma/client';

import type { InventoryListQuery } from '../inventory.schemas.js';
import { getInventoryService } from '../inventory.service.js';

export class MedicineInventoryService {
  constructor(private readonly inventory = getInventoryService()) {}

  list(customerId: string, query: InventoryListQuery) {
    return this.inventory.listByType(customerId, InventoryType.MEDICINE, query);
  }
}

let medicineSingleton: MedicineInventoryService | undefined;

export function getMedicineInventoryService(): MedicineInventoryService {
  if (!medicineSingleton) {
    medicineSingleton = new MedicineInventoryService();
  }
  return medicineSingleton;
}
