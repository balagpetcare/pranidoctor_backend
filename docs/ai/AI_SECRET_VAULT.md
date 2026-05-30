# AI Secret Vault

**Status:** Implemented  
**Related:** [AI_DATABASE_FOUNDATION.md](./AI_DATABASE_FOUNDATION.md), [AI_ECOSYSTEM_MASTER_PLAN.md](./AI_ECOSYSTEM_MASTER_PLAN.md)

---

## Overview

Provider API keys are stored **encrypted in PostgreSQL** (`ai_api_keys`). Plaintext secrets exist only in memory during:

- Admin create/update/rotate (request body → encrypt → DB)
- Runtime LLM calls (DB → decrypt → provider HTTP request)

`OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `.env` are **no longer read** at runtime.

---

## Architecture

```
Admin API ──▶ AiSecretService ──▶ EncryptionService ──▶ ai_api_keys (ciphertext)
                                    │
Runtime LLM ◀── decrypt ────────────┘
  OpenAI / Anthropic providers
```

| Service | Responsibility |
|---------|----------------|
| `EncryptionService` | AES-256-GCM encrypt/decrypt via `AI_VAULT_MASTER_KEY` |
| `AiSecretService` | CRUD, resolve secrets, audit log, config cache |
| `KeyRotationService` | Mark old key ROTATED, create new ACTIVE key |

**Location:** `src/modules/ai/vault/`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AI_VAULT_MASTER_KEY` | Yes (when `AI_LLM_REQUIRED=true`) | 32-byte base64 key or passphrase |
| `AI_VAULT_KEY_ID` | No | Logical key version label (default `vault:v1`) |
| `AI_VAULT_IMPORT_ENV_KEYS` | No | One-time seed: import `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` into vault |

Generate a master key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Model names remain in env: `OPENAI_MODEL`, `ANTHROPIC_MODEL`.

---

## Encryption Format

Ciphertext stored in `ai_api_keys.encryptedSecret`:

```
v1:{iv_base64}:{auth_tag_base64}:{ciphertext_base64}
```

- Algorithm: `aes-256-gcm`
- Master key: `AI_VAULT_MASTER_KEY` (base64 32 bytes or scrypt-derived passphrase)
- Never log decrypted values

---

## Admin API

Base path: `/api/admin/ai-ops/secrets`  
Auth: Admin session (legacy BFF) or internal Express token  
Roles:

| Action | Role |
|--------|------|
| List keys | ADMIN, SUPER_ADMIN |
| Test key | ADMIN, SUPER_ADMIN |
| Add / update / rotate | SUPER_ADMIN only |
| Disable | ADMIN, SUPER_ADMIN |

### Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/admin/ai-ops/secrets` | List keys (no plaintext) |
| POST | `/api/admin/ai-ops/secrets` | Add key |
| PUT | `/api/admin/ai-ops/secrets/:id` | Update name/secret/expiry |
| POST | `/api/admin/ai-ops/secrets/:id/disable` | Revoke key |
| POST | `/api/admin/ai-ops/secrets/:id/test` | Live provider connectivity test |
| POST | `/api/admin/ai-ops/secrets/:id/rotate` | Rotate key |
| GET | `/api/admin/ai-ops/secrets/:id/audit` | Audit log for key |

### Add key (POST)

```json
{
  "providerKey": "openai",
  "name": "production-primary",
  "secret": "sk-...",
  "expiresAt": "2027-01-01T00:00:00.000Z",
  "reason": "Initial production key"
}
```

### Rotate key (POST)

```json
{
  "secret": "sk-new-...",
  "reason": "Scheduled quarterly rotation"
}
```

Response includes `previousKeyId` and `newKeyId` — old key status becomes `ROTATED`.

---

## Audit Log

Every key lifecycle event writes to `ai_api_key_audit_logs`:

| Action | When |
|--------|------|
| CREATED | Add key / rotation successor |
| UPDATED | Name, expiry, or secret change |
| DISABLED | Revoke |
| ROTATED | Previous key marked rotated |
| TESTED | Admin test call |

Fields: `actorUserId`, `actorRole`, `reason`, `metadataJson`, `ipAddress`, `createdAt`.

---

## Runtime Resolution

```typescript
const secret = await getAiSecretService().resolveProviderSecret('openai');
```

1. Find active `ai_api_keys` row for provider + scope
2. Decrypt ciphertext
3. Update `lastUsedAt`
4. Return plaintext to provider adapter (never persisted)

`isProviderConfigured('openai')` reads an in-memory cache refreshed at bootstrap and after every key mutation.

---

## Bootstrap & Validation

On startup (`bootstrapAiPlatform`):

1. Validate `AI_VAULT_MASTER_KEY` when LLM required
2. `refreshConfigurationCache()` — load active providers from DB
3. Fail if no active vault keys when `AI_LLM_REQUIRED=true`

Warn if legacy `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` env vars are still set.

---

## Migration from .env Keys

1. Set `AI_VAULT_MASTER_KEY`
2. Ensure providers exist: `npm run db:seed:ai-management`
3. One-time import:

```bash
AI_VAULT_IMPORT_ENV_KEYS=true OPENAI_API_KEY=sk-... npm run db:seed:ai-management
```

4. Verify: `npx tsx scripts/live-llm-connectivity-verify.ts`
5. Remove `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` from `.env`

Or use admin API to add keys manually.

---

## Web BFF Proxies

Next.js admin proxies at `pranidoctor-web/src/app/api/admin/ai-ops/secrets/**` mirror backend routes.

---

## Tests

```bash
npm test -- src/modules/ai/vault
```

- `encryption.service.test.ts` — round-trip, placeholder rejection
- `ai-secret.service.test.ts` — encrypt on save, audit, resolve
- `key-rotation.service.test.ts` — ROTATED + new ACTIVE

---

## Security Notes

- Decrypted secrets must never appear in logs, API responses, or audit metadata
- API list responses expose `secretHint` only (last 4 chars)
- Use SUPER_ADMIN for key mutations in production
- Rotate master key (`AI_VAULT_MASTER_KEY`) requires re-encrypting all rows (future tooling)

---

**Last updated:** 2026-05-30
