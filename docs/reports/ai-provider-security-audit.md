# AI Provider Management — Security Audit Report

**Project:** Prani Doctor  
**Role:** Security QA Lead  
**Date:** 2026-05-31  
**Scope:** Phase 2 AI Provider Management (`docs/plans/ai-phase-2-provider-management.md`)  
**Repositories:** `pranidoctor-backend`, `pranidoctor-web` (BFF + admin UI)

---

## Executive summary

AI Provider Management implements **vault-first credential storage**, capability-based admin RBAC, and dual audit streams (platform + key lifecycle). The design aligns with the Phase 2 security plan and is suitable for **controlled production rollout** after migration deploy and vault key provisioning.

**Security score: 86 / 100** (post-remediation)

| Domain | Score | Status |
|--------|------:|--------|
| Encryption | 92 | Pass |
| Secret storage | 88 | Pass |
| API security | 84 | Pass |
| RBAC | 90 | Pass |
| Audit trails | 85 | Pass |
| Vulnerability posture | 82 | Pass (residual risks) |

**Automated tests:** 168 passed (`src/modules/ai/` + route parity).

---

## Verification methodology

1. Static review of vault, provider management services, admin routes, and BFF proxies  
2. RBAC matrix cross-check vs `ai-permissions.ts` and web `permissions-core.ts`  
3. Threat modeling against OWASP API Top 10 (auth, excessive data exposure, mass assignment)  
4. Remediation of safe findings during this audit (see **Fixes applied**)  
5. Test execution: `npx vitest run src/modules/ai/ src/modules/compat-web/ai-ops-route-parity.test.ts`

---

## Passed items

### Encryption

| Check | Result |
|-------|--------|
| Algorithm AES-256-GCM with random IV per encryption | Pass |
| Ciphertext format `v1:{iv}:{tag}:{data}` | Pass |
| Master key from `AI_VAULT_MASTER_KEY` (32-byte base64 or scrypt) | Pass |
| `encryptionKeyId` + `encryptionAlgorithm` stored per row | Pass |
| Decrypt only at runtime call sites; never logged | Pass |
| Production gate: key write blocked without master key | Pass (added in audit) |

### Secret storage

| Check | Result |
|-------|--------|
| Plaintext never persisted in DB | Pass |
| API responses expose `secretHint` only (`****abcd`) | Pass |
| New keys start `PENDING_TEST`; runtime uses `ACTIVE` + `isPrimary` | Pass |
| Partial unique index: one primary active key per provider/scope | Pass |
| Revoked keys clear `isPrimary` | Pass (added in audit) |
| Secret update resets to `PENDING_TEST` | Pass (added in audit) |
| Runtime resolves **primary ACTIVE key only** (no non-primary fallback) | Pass (added in audit) |

### API security

| Check | Result |
|-------|--------|
| All routes under `/api/admin/ai-ops/*` require admin session | Pass |
| Secret mutations require `SUPER_ADMIN` + `ai.secrets.manage` | Pass |
| Provider enable/disable gated (connection test + primary key + 24h freshness) | Pass |
| Zod validation on all mutation bodies | Pass |
| Connection test errors sanitized (no upstream body leak) | Pass (added in audit) |
| BFF parity with backend legacy routes | Pass |
| Farmer `/api/ai/*` does not expose vault endpoints | Pass |

### RBAC

| Capability | SUPER_ADMIN | ADMIN | Enforced on routes |
|------------|:-----------:|:-----:|-------------------|
| `ai.ops.view` | ✓ | ✓ | Provider list, status, dashboard |
| `ai.registry.manage` | ✓ | ✓ | Provider CRUD, enable/disable, priority |
| `ai.secrets.manage` | ✓ | ✗ | Secrets CRUD, test, rotate, primary |
| `ai.foundation.manage` | ✓ | ✗ | `sync-env` |

Provider list exposes **key hints** in `keySummary` to `ai.ops.view` (ADMIN). Acceptable for ops visibility; full key list requires `ai.secrets.manage`.

### Audit trails

| Event | Store | Result |
|-------|-------|--------|
| Key create / update / test / revoke | `AiApiKeyAuditLog` (append-only) | Pass |
| Key rotate | Key audit + platform `AI_SECRET_ROTATE` | Pass |
| Key add (admin) | Platform `AI_REGISTRY_CHANGE` | Pass (added in audit) |
| Provider enable / disable | Platform `AI_PROVIDER_ENABLED` / `_DISABLED` | Pass |
| Priority batch | Platform `AI_PROVIDER_PRIORITY_CHANGED` | Pass |
| Registry CRUD | Platform `AI_REGISTRY_CHANGE` | Pass |
| Actor + IP on key audit (`actorContext`) | Pass |
| Failed test records `lastConnectionTestOk: false` on provider | Pass (added in audit) |

---

## Failed / partial items (pre-remediation)

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| F1 | `POST …/toggle` bypassed enable gates via direct registry update | **High** | **Fixed** — routes through `enableProvider` / `disableProvider` |
| F2 | `PUT …/providers/[id]` could set `enabled: true` without connection test | **High** | **Fixed** — blocked; use enable endpoint |
| F3 | `hasPrimary` true for any ACTIVE key, not only `isPrimary` | **Medium** | **Fixed** |
| F4 | Runtime secret fallback to non-primary ACTIVE keys | **Medium** | **Fixed** — primary-only resolution |
| F5 | Secret update did not require re-test (`PENDING_TEST`) | **Medium** | **Fixed** |
| F6 | Revoked primary key retained `isPrimary` flag | **Low** | **Fixed** |
| F7 | Connection test returned raw upstream error bodies (200 chars) | **Low** | **Fixed** — sanitized messages |
| F8 | No production vault gate on `addKey` | **Medium** | **Fixed** |
| F9 | Env var fallback still available at runtime (`resolveProviderSecret` chain + `ai.config`) | **Medium** | Open — Phase 2.3 vault-first prod policy |
| F10 | No rate limiting on connection test endpoints | **Low** | Open — planned in Phase 2 plan |
| F11 | `governance/route.ts` not on capability matrix | **Low** | Open — out of provider scope |
| F12 | Rotated keys created as `ACTIVE` (zero-downtime) without mandatory re-test | **Low** | Accepted — rotation preserves primary; document in runbook |

---

## Vulnerability assessment

| Threat | Likelihood | Impact | Mitigation | Residual |
|--------|------------|--------|------------|----------|
| DB exfiltration | Medium | High | AES-256-GCM at rest | Low without master key |
| Insider ADMIN reads secrets | Low | High | ADMIN lacks `ai.secrets.manage` | Hints on provider list only |
| Privilege escalation via toggle/PUT | Medium | High | **Fixed** enable bypass paths | Low |
| Upstream error reflection | Low | Medium | **Fixed** sanitized probe messages | Low |
| Stale / invalid key in production | Medium | Medium | PENDING_TEST + enable gates | Env fallback remains |
| Audit gap on key add | Low | Medium | **Fixed** platform audit | Low |
| Test endpoint DoS | Low | Low | None yet | Rate limits pending |
| Master key compromise | Low | Critical | Single key; rotation job not implemented | P2 debt |

### OWASP API mapping

| Risk | Assessment |
|------|------------|
| Broken object level authorization | Provider/key IDs validated per request; no cross-tenant scope in UI yet |
| Broken authentication | Cookie session + role gate + capability matrix |
| Excessive data exposure | Public DTOs exclude ciphertext; hints only |
| Lack of resource limits | Batch priority max 100 items; audit list capped at 200 |
| Mass assignment | Zod schemas; `enabled` stripped from PUT |

---

## Technical debt (security)

| Priority | Item |
|----------|------|
| P1 | Disable env secret fallback in production (`security.vault.env_fallback_allowed=false`) |
| P1 | Deploy migration `20260606120000_ai_phase2_provider_management` |
| P2 | Rate limit connection test endpoints (per admin / per provider) |
| P2 | Master key rotation + re-encryption job |
| P2 | Dedicated audit action `AI_API_KEY_CREATED` vs generic `AI_REGISTRY_CHANGE` |
| P3 | Migrate `governance/route.ts` to capability matrix |
| P3 | Scope-aware authorization for tenant/branch keys |

---

## Fixes applied during this audit

| Fix | File(s) |
|-----|---------|
| Toggle route uses gated enable/disable | `providers/[id]/toggle/route.ts` |
| Block `enabled: true` via PUT; route disable via PUT | `ai-provider-management.service.ts` |
| `hasPrimary` requires `isPrimary === true` | `ai-provider-management.service.ts` |
| Primary-only runtime secret resolution | `ai-secret.service.ts` |
| Secret update → `PENDING_TEST` | `ai-secret.service.ts` |
| Revoke clears `isPrimary` | `ai-secret.service.ts` |
| Production vault gate on `addKey` | `ai-secret.service.ts` |
| Failed test sets `lastConnectionTestOk: false` | `ai-secret.service.ts` |
| Sanitized connection test error messages | `provider-key-test.ts` |
| Platform audit on vault key add | `ai-vault-admin.service.ts` |
| Test mock updated for primary-only resolve | `ai-secret.service.test.ts` |

---

## Production readiness gates

| Gate | Requirement |
|------|-------------|
| Migration | `npx prisma migrate deploy` |
| Master key | `AI_VAULT_MASTER_KEY` set in production secrets manager |
| Vault-first | Import keys via admin UI; disable env-only bootstrap |
| RBAC | Only SUPER_ADMIN holds `ai.secrets.manage` |
| Enable flow | Test key → test connection → enable provider |
| Monitoring | Alert on `lastConnectionTestOk: false` + provider DISABLED |

---

## Score breakdown

```
Category weights (total 100):
  Encryption ................ 20  → 18.5
  Secret storage ............ 20  → 17.5
  API security .............. 20  → 16.5
  RBAC ...................... 15  → 13.5
  Audit trails .............. 15  → 12.5
  Vulnerability posture ..... 10  →  7.5
                                    ─────────
                              Total  86.0 / 100
```

### Recommendation

**Approve for staging immediately.** Production go-live after migration deploy, vault master key provisioning, and confirmation that env-based secret fallback is disabled in production settings.

---

## Appendix — Route security matrix

| Route | Method | Capability | SUPER_ADMIN | Notes |
|-------|--------|------------|:-----------:|-------|
| `/providers` | GET | `ai.ops.view` | — | Enriched DTO, hints in summary |
| `/providers` | POST | `ai.registry.manage` | — | Creates disabled by default |
| `/providers/[id]` | PUT | `ai.registry.manage` | — | Cannot set `enabled: true` |
| `/providers/[id]/enable` | POST | `ai.registry.manage` | — | Gated |
| `/providers/[id]/disable` | POST | `ai.registry.manage` | — | Audited |
| `/providers/[id]/toggle` | POST | `ai.registry.manage` | — | Uses enable/disable gates |
| `/providers/priority` | PUT | `ai.registry.manage` | — | Batch max 100 |
| `/providers/[id]/test-connection` | POST | `ai.secrets.manage` | Required | Probe only |
| `/providers/status` | GET | `ai.ops.view` | — | Status board |
| `/secrets` | GET | `ai.secrets.manage` | Required | Masked list |
| `/secrets` | POST | `ai.secrets.manage` | Required | PENDING_TEST |
| `/secrets/[id]/test` | POST | `ai.secrets.manage` | Required | Promotes to ACTIVE |
| `/secrets/[id]/rotate` | POST | `ai.secrets.manage` | Required | Platform audit |
| `/secrets/[id]/primary` | PUT | `ai.secrets.manage` | Required | Primary flip |
| `/secrets/[id]/disable` | POST | `ai.secrets.manage` | Required | Revoke |

---

## Appendix — Key file index

| Area | Path |
|------|------|
| Plan | `docs/plans/ai-phase-2-provider-management.md` |
| Encryption | `src/modules/ai/vault/encryption.service.ts` |
| Secrets | `src/modules/ai/vault/ai-secret.service.ts` |
| Connection test | `src/modules/ai/vault/provider-key-test.ts` |
| Provider management | `src/modules/ai/admin/ai-provider-management.service.ts` |
| Vault admin | `src/modules/ai/admin/ai-vault-admin.service.ts` |
| Permissions | `src/modules/ai/admin/ai-permissions.ts` |
| Migration | `prisma/migrations/20260606120000_ai_phase2_provider_management/` |
| Admin UI | `pranidoctor-web/src/components/admin/ai-ops/ProviderPanel.tsx`, `ApiKeysPanel.tsx` |

---

*End of security audit report.*
