# AI Vault — Placeholder Key UX Improvement Report

**Date:** 2026-06-01  
**Scope:** Seed/demo API key placeholders (`ENC:PLACEHOLDER:*`, `ENC:SEED:*`)  
**Constraint:** No changes to `EncryptionService.decrypt` — protection preserved

---

## Summary

Operators testing seeded API keys previously received a **400** error (`AI_ADMIN_ERROR: Seed placeholder cannot be decrypted`). The flow now detects placeholders **before decrypt**, returns a **200** test result with a clear message, and surfaces **`isPlaceholder`** in list APIs so the admin UI can badge, disable Test, and prompt **Replace key**.

---

## Files changed

### Backend (`pranidoctor-backend`)

| File | Change |
|------|--------|
| `src/modules/ai/vault/placeholder-secret.util.ts` | **New** — `isPlaceholderCiphertext()`, `PLACEHOLDER_KEY_USER_MESSAGE` |
| `src/modules/ai/vault/placeholder-secret.util.test.ts` | **New** — unit tests for detection |
| `src/modules/ai/vault/ai-secret.types.ts` | `AiApiKeyPublic.isPlaceholder: boolean` |
| `src/modules/ai/vault/ai-secret.service.ts` | `toPublic` sets `isPlaceholder`; `testKey` short-circuits placeholders; `validatePlaintextSecret` rejects placeholder plaintext |
| `src/modules/ai/vault/ai-secret.service.test.ts` | Tests for `testKey` placeholder path and `listKeys` flag |

### Web (`pranidoctor-web`)

| File | Change |
|------|--------|
| `src/components/admin/ai-ops/ai-admin-badges.tsx` | `PlaceholderKeyBadge` component |
| `src/components/admin/ai-ops/ApiKeysPanel.tsx` | Badge, disabled Test, Replace key / Rotate flow |

### Unchanged (by design)

| File | Reason |
|------|--------|
| `src/modules/ai/vault/encryption.service.ts` | Decrypt guard unchanged |
| `src/legacy/web/routes/admin/ai-ops/secrets/[id]/test/route.ts` | Still returns `jsonOk` on success; placeholder tests no longer throw |

---

## UX improvements

| Before | After |
|--------|--------|
| Test → **400** `AI_ADMIN_ERROR: Seed placeholder cannot be decrypted` | Test disabled in UI; if called, **200** with `ok: false` and friendly message |
| Status shows Enabled / pending test | Placeholder rows show **Placeholder Key** amber badge |
| Rotate only on `ACTIVE` | **Replace key** on placeholders; **Rotate** on real keys |
| Cryptic client log “error envelope” | Message: *This is a seed/demo key. Replace it with a real provider API key before testing.* |
| Two-step rotate unclear for seeds | **Replace key** → password field → **Save replacement** |

---

## API behavior

### `GET /api/admin/ai-ops/secrets`

Each key includes:

```json
{
  "isPlaceholder": true,
  "status": "ACTIVE",
  ...
}
```

Derived from `encryptedSecret` prefix only — **no decryption**.

### `POST /api/admin/ai-ops/secrets/:id/test`

**Placeholder:**

- HTTP **200**
- Body: `{ "ok": true, "data": { "ok": false, "errorCode": "VAULT_PLACEHOLDER_SECRET", "message": "This is a seed/demo key...", "latencyMs": 0, "providerKey": "openai" } }`
- Audit log: `TESTED` with `metadataJson.placeholder: true`
- **Does not** call `EncryptionService.decrypt` or external provider

**Real key:** unchanged (decrypt → `testProviderApiKey`).

---

## Security model (preserved)

| Path | Placeholder behavior |
|------|---------------------|
| `EncryptionService.decrypt` | Still throws `VAULT_PLACEHOLDER_SECRET` |
| `resolveProviderSecret` (runtime) | Still cannot load placeholder secrets |
| `testKey` | Detects prefix **before** decrypt |
| `addKey` / rotate plaintext | Rejects pasted `ENC:PLACEHOLDER` / `ENC:SEED` strings |

---

## Validation results

| Check | Result |
|-------|--------|
| `placeholder-secret.util.test.ts` | ✅ 4/4 passed |
| `ai-secret.service.test.ts` | ✅ 6/6 passed (incl. placeholder `testKey`, `listKeys.isPlaceholder`) |
| `encryption.service.test.ts` | ✅ unchanged — still rejects decrypt of placeholders |
| Lint (edited files) | ✅ No issues |

**Manual verification (recommended):**

1. Open `/admin/ai-ops/api-keys` with seeded keys.
2. Confirm **Placeholder Key** badge on seed rows.
3. Confirm **Test** disabled with tooltip.
4. Click **Replace key** → paste real secret → **Save replacement** → **Test** enabled.

---

## Exact operator fix (unchanged)

Replace seed ciphertext with a real provider secret via **Replace key** (rotate) or **Add key**, then run **Test** to activate (`PENDING_TEST` → `ACTIVE`).
