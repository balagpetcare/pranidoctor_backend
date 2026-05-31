# Feed Intelligence Admin API

**Base path (backend):** `/admin/ai-ops/feed`  
**BFF (web):** `/api/admin/ai-ops/feed`  
**Auth:** `requireAiAdminActor` + `ai.feed.*` capabilities  
**Implemented:** Phase 0–1 (2026-06-01)  
**GA remediation:** 2026-06-01 — Policy **A** (SUPPORT read-only)

---

## Capabilities

| Capability | Purpose | SUPER_ADMIN | ADMIN | SUPPORT |
|------------|---------|-------------|-------|---------|
| `ai.feed.view` | List and read VKL feed entities | ✓ | ✓ | ✓ |
| `ai.feed.manage` | Create, edit, submit, reject, archive, restore | ✓ | ✓ | — |
| `ai.feed.publish` | Publish ingredients; vet-approve and publish toxic alerts | ✓ | ✓ | — |
| `ai.feed.audit` | Read `VkKnowledgeAuditEvent` timeline per entity | ✓ | ✓ | ✓ |

**Auth:** `requireFeedAdmin` uses panel session (`requireAdminApiActor`) + matrix above. SUPPORT users may sign in to the admin panel (with `adminProfile`) for read/audit routes only.

---

## Feed ingredients (`VkFeedIngredient`)

### `GET /ingredients`

Query: `search`, `status` (`DRAFT` \| `IN_REVIEW` \| `PUBLISHED` \| `DEPRECATED` \| `ALL`), `bdAvailability`, `species`, `limit`, `offset`

Response: `{ items: FeedIngredientAdminListItem[], total: number }`

**Capability:** `ai.feed.view`

### `POST /ingredients`

Body: `createFeedIngredientSchema` — `ingredientCode`, `titleBn`, `titleEn`, `bodyBn`, `bodyEn`, `localNamesBn`, `species[]`, `composition`, `bdAvailability`, optional pricing fields.

Response: `{ entityId, versionId }` (201)

**Capability:** `ai.feed.manage`

### `GET /ingredients/:entityId`

**Capability:** `ai.feed.view`

### `PATCH /ingredients/:entityId`

Updates **DRAFT** version only.

**Capability:** `ai.feed.manage`

### `POST /ingredients/:entityId/submit`

Body: `{ notes?: string }` — moves draft → `IN_REVIEW`, creates `VkKnowledgeReview`.

**Capability:** `ai.feed.manage`

### `POST /ingredients/:entityId/publish`

Body: `{ notes?: string }` — publishes from `IN_REVIEW` or `VET_APPROVAL`.

**Capability:** `ai.feed.publish`

### `POST /ingredients/:entityId/reject`

Body: `{ reason: string }` — returns version to `DRAFT`.

**Capability:** `ai.feed.manage`

### `POST /ingredients/:entityId/archive`

Body: `{ reason?: string }` — deprecates published version.

**Capability:** `ai.feed.manage`

### `POST /ingredients/:entityId/restore`

Restores deprecated published version to `PUBLISHED`.

**Capability:** `ai.feed.manage`

### `GET /ingredients/:entityId/versions`

Response: `{ items: VersionHistoryItem[] }`

**Capability:** `ai.feed.view`

### `GET /ingredients/:entityId/audit`

Query: `limit` (default 50). Response: `{ items: VkKnowledgeAuditEvent[] }`

**Capability:** `ai.feed.audit`

---

## Toxic feed alerts (`VkToxicFeedAlert`)

### `GET /toxic-alerts`

Query: `search`, `status`, `species`, `limit`, `offset`

**Capability:** `ai.feed.view`

### `POST /toxic-alerts`

Body: `createToxicAlertSchema` — substance, thresholds, clinical signs, emergency actions, VKL metadata.

Creates entity with `clinicalRiskTier: HIGH`.

**Capability:** `ai.feed.manage`

### `GET /toxic-alerts/:entityId`

**Capability:** `ai.feed.view`

### `PATCH /toxic-alerts/:entityId`

Draft-only edits.

**Capability:** `ai.feed.manage`

### `POST /toxic-alerts/:entityId/submit`

**Capability:** `ai.feed.manage`

### `POST /toxic-alerts/:entityId/review`

Body: `{ approved: boolean, notes?: string }` — editorial review; HIGH risk → `VET_APPROVAL` when approved.

**Capability:** `ai.feed.manage`

### `POST /toxic-alerts/:entityId/approve`

Vet approval record (requires `VET_APPROVAL` status).

**Capability:** `ai.feed.publish`

### `POST /toxic-alerts/:entityId/publish`

Publishes after review/vet gates. HIGH risk requires approver with `doctorProfile`.

**Capability:** `ai.feed.publish`

### `POST /toxic-alerts/:entityId/reject`

Body: `{ reason: string }`

**Capability:** `ai.feed.manage`

### `GET /toxic-alerts/:entityId/audit`

**Capability:** `ai.feed.audit`

---

## Governance & audit

- All mutating admin actions append `VkKnowledgeAuditEvent` via `recordFeedAdminAudit`.
- Core lifecycle: `FeedKnowledgeGovernanceService` (`DRAFT` → `IN_REVIEW` → `VET_APPROVAL` → `PUBLISHED`).
- Platform VKL data is **not tenant-scoped**; operational Phase 4 `FeedItem` links via `VkFeedIngredient.feedItemId` only.

---

## Admin UI routes

| Page | Path |
|------|------|
| Overview | `/admin/ai-ops/feed-intelligence` |
| Ingredients | `/admin/ai-ops/feed-intelligence/ingredients` |
| Toxic alerts | `/admin/ai-ops/feed-intelligence/toxic-alerts` |

Nav: **Admin → AI Operations → Feed Intelligence** (`ai.feed.view`).

---

## Module layout

```
src/modules/ai/feed/admin/
  feed-ingredient-admin.service.ts
  feed-toxic-admin.service.ts
  feed-admin.schemas.ts
  feed-admin-audit.service.ts

src/legacy/web/routes/admin/ai-ops/feed/
```
