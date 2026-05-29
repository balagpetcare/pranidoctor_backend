# FIX_FEED_INVENTORY_OPTIONAL_STOCK_AND_MULTI_SELECT_PAYLOAD_V1

## Root cause

`POST /api/mobile/inventory/add` rejected multi-select catalog creates because:

1. **Zod** required `feedUnit` on every `CREATE_ITEM` for `FEED`, even when `feedCatalogId` was sent (unit is resolved server-side from catalog).
2. **Flutter** sent **N separate** single-item requests without `feedUnit`, failing validation each time with `Invalid inventory add payload`.

## Payload diff

### Before (per item, invalid)

```json
{
  "farmRef": "...",
  "inventoryType": "FEED",
  "operation": "CREATE_ITEM",
  "feedCatalogId": "cuid...",
  "quantity": null
}
```

Missing `feedUnit` → 422.

### After (batch, valid)

```json
{
  "farmRef": "...",
  "inventoryType": "FEED",
  "operation": "CREATE_ITEM",
  "items": [
    {
      "feedId": "cuid...",
      "openingQuantity": null,
      "lowStockLevel": null
    }
  ]
}
```

- `feedId` = `FeedCatalog.id`
- `openingQuantity` / `lowStockLevel` optional (`null` = not set)
- Response: `{ items: [...], count: N }`

## Files changed

### Backend
- `src/modules/inventory/inventory.schemas.ts` — `items[]`, relaxed `feedUnit`
- `src/modules/inventory/inventory.service.ts` — batch create loop
- `src/modules/inventory/inventory.dto.ts` — `AddStockBatchResultDto`

### Flutter
- `lib/features/inventory/data/inventory_dto.dart` — batch types
- `lib/features/inventory/data/inventory_repository.dart` — `addFeedCatalogBatch`
- `lib/features/inventory/data/inventory_repository_contract.dart`
- `lib/features/inventory/presentation/inventory_feed_create_page.dart` — toggle UI, validation
- `assets/i18n/en.json`, `assets/i18n/bn.json`

## Verification

- [ ] Feed only (no stock toggle)
- [ ] Feed + opening quantity
- [ ] Feed + low stock alert
- [ ] Multi-select batch save
