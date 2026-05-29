export const InventoryEventAction = {
  ITEM_CREATED: 'ITEM_CREATED',
  ITEM_UPDATED: 'ITEM_UPDATED',
  ITEM_SOFT_DELETED: 'ITEM_SOFT_DELETED',
  STOCK_RECEIPT: 'STOCK_RECEIPT',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  STOCK_CONSUMPTION: 'STOCK_CONSUMPTION',
  STOCK_RESERVED: 'STOCK_RESERVED',
  STOCK_RESERVE_RELEASED: 'STOCK_RESERVE_RELEASED',
  STOCK_VOID: 'STOCK_VOID',
  LOW_STOCK_DETECTED: 'LOW_STOCK_DETECTED',
} as const;

export type InventoryEventActionType =
  (typeof InventoryEventAction)[keyof typeof InventoryEventAction];

export type InventoryDomainEvent = {
  action: InventoryEventActionType;
  customerId: string;
  inventoryItemId?: string;
  payload?: Record<string, unknown>;
  actorUserId?: string;
};
