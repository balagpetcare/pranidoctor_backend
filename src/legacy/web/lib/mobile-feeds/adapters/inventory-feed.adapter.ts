type InventoryModule = typeof import("@modules/inventory/index.js");

let cachedModule: InventoryModule | null | undefined;

async function loadInventoryModule(): Promise<InventoryModule | null> {
  if (cachedModule !== undefined) {
    return cachedModule;
  }
  try {
    cachedModule = await import("@modules/inventory/index.js");
    return cachedModule;
  } catch (err) {
    cachedModule = null;
    console.warn(
      "[mobile-feeds] Inventory module unavailable; stock deduction disabled",
      err,
    );
    return null;
  }
}

export type ConsumeForFeedRecordParams = {
  customerId: string;
  farmRef: string;
  inventoryItemId: string;
  quantity: number;
  feedRecordId: string;
  idempotencyKey?: string;
};

/**
 * Consumes feed inventory for a feed record (deductStock flow).
 * Throws if the inventory module cannot be loaded.
 */
export async function consumeInventoryForFeedRecord(
  params: ConsumeForFeedRecordParams,
): Promise<{ transactionId: string }> {
  const mod = await loadInventoryModule();
  if (!mod) {
    throw Object.assign(new Error("Inventory module unavailable"), {
      code: "INVENTORY_UNAVAILABLE",
    });
  }

  const result = await mod.getInventoryService().consumeForFeedRecord(params);
  return { transactionId: result.transactionId };
}
