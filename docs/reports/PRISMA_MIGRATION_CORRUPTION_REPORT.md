# Prisma Migration Corruption Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Database:** `pranidoctor_db` @ `localhost:5432` (from local `.env`)  
**Investigation scope:** `prisma/migrations/` vs `"_prisma_migrations"` table  
**Action taken:** Read-only audit — no migrations, folders, or database records were modified.

---

## Executive summary

| Metric | Value |
|--------|-------|
| Migration folders on disk | 59 |
| Folders with valid `migration.sql` | 58 |
| **Broken folders (missing `migration.sql`)** | **1** |
| Migrations recorded in `_prisma_migrations` | 54 |
| DB records with no on-disk folder | 0 |
| Pending migrations (on disk, not in DB) | 5 |

**Verdict:** One local orphan migration folder is corrupt. It was never applied to the database, never committed to git, and can be safely deleted. No applied migration is missing its SQL file — git restoration is **not required**.

The remaining four pending migrations are valid (they have `migration.sql`) and are simply unapplied on this database.

---

## Broken migrations

### `20260530180000_user_consent_registry`

| Field | Finding |
|-------|---------|
| **Path** | `prisma/migrations/20260530180000_user_consent_registry/` |
| **`migration.sql` present** | No — folder is completely empty (0 files) |
| **In `_prisma_migrations`** | No |
| **Applied to database** | **Not applied** |
| **Git history** | Never committed — `git log --all` returns no entries for this path |
| **Git tracked** | No (`git ls-files` empty) |
| **Local creation** | 2026-05-30 01:37:08 (filesystem metadata) |
| **Duplicate timestamp** | Shares `20260530180000` with `20260530180000_legal_consent` |

#### Likely cause

An aborted or renamed `prisma migrate dev` run left an empty directory after the migration was finalized under a different name (`legal_consent`). The canonical migration `20260530180000_legal_consent` **was** applied successfully:

- `_prisma_migrations.finished_at`: `2026-05-29T21:07:49.555Z`
- Checksum: `3bf11ff2bd5d64c35026b8f1d6ae0e14abdbe47795cc3cf69d8762a03ed1f1ba`

Objects from `legal_consent` are present in the database (`LegalConsentEvent` table, `LegalConsentType` enum values `PRIVACY` / `TERMS` / `AI_PROCESSING`, `MobileUserSettings.aiAcceptedVersion`).

There is no evidence that `user_consent_registry` ever contained SQL or was deployed anywhere.

#### Recommended fix

**Safe deletion** of the empty folder:

```powershell
Remove-Item -Recurse -Force "prisma/migrations/20260530180000_user_consent_registry"
```

After removal:

```bash
npx prisma migrate status   # should list 4 pending (not 5)
npm run db:audit            # filesystem inventory should show 58 folders, 0 missing SQL
```

**Do not** attempt git restoration — the file never existed in version control.

#### Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Data loss | **None** | Migration never ran; no schema objects reference this name |
| Production impact | **None** | Folder is untracked and absent from remote |
| Deploy blocker | **Low → resolved after delete** | Empty folder causes Prisma to count 59 migrations; `migrate deploy` will attempt to apply a migration with no SQL |
| Wrong fix (restore from git) | **N/A** | No git source exists |

---

## Filesystem vs database reconciliation

### On disk, not in `_prisma_migrations` (5)

| Migration folder | `migration.sql` | Applied | Notes |
|------------------|-----------------|---------|-------|
| `20260530180000_user_consent_registry` | **Missing** | No | **Broken — delete** |
| `20260530190000_vet_disclaimer` | Present | No | Valid pending migration |
| `20260601120000_ai_governance_scopes` | Present | No | Valid pending migration |
| `20260601180000_legal_document_registry` | Present | No | Valid pending migration |
| `20260601200000_emergency_limitation` | Present | No | Valid pending migration |

### In `_prisma_migrations`, not on disk (0)

None. Every applied migration has a corresponding folder.

### Applied migration with missing SQL (0)

None. All 54 applied migrations have intact `migration.sql` files on disk.

---

## Pending migration schema verification

Objects from the four **valid** pending migrations were checked against the live database. None of their target objects exist yet — confirming they are genuinely unapplied, not a ledger drift:

| Pending migration | Key objects | Present in DB? |
|-------------------|-------------|----------------|
| `vet_disclaimer` | `LegalConsentType.VET_ADVICE`, `MobileUserSettings.vetAcceptedVersion` | No |
| `ai_governance_scopes` | `AiGovernanceScope` table | No |
| `legal_document_registry` | `LegalDocument`, `LegalAcceptanceEvent` | No |
| `emergency_limitation` | `LegalConsentType.EMERGENCY_SERVICE`, `MobileUserSettings.emergencyAcceptedVersion` | No |

After deleting the orphan folder, apply the remaining four with:

```bash
npm run db:migrate          # development
# or
npm run db:migrate:deploy   # staging/production (with guard + backup)
```

---

## Duplicate timestamps (informational)

Five timestamp collisions exist in the migration chain. These are **not** corruption — each sibling folder has a valid `migration.sql`, and Prisma orders by full folder name:

| Timestamp | Folders |
|-----------|---------|
| `20260509120000` | `knowledge_hub_content`, `service_request_booking_enums_fields` |
| `20260523120000` | `animal_photo_upload_purpose`, `phase1_fattening_batches` |
| `20260529120000` | `notification_user_created_index`, `phase4_livestock_feed_ecosystem` |
| `20260530180000` | `legal_consent` ✓ applied, `user_consent_registry` ✗ broken orphan |
| `20260601120000` | `ai_governance_scopes` pending, `phase8_ai_ecosystem` ✓ applied |

Note: `20260601120000_phase8_ai_ecosystem` is applied while `20260601120000_ai_governance_scopes` is not — Prisma applies migrations in lexicographic folder-name order, so this is expected.

---

## Tooling observations

| Command | Result |
|---------|--------|
| `npx prisma migrate status` | Exit 1 — reports 5 pending migrations (includes broken orphan) |
| `npm run db:audit` | Exit 0 — 59 folders inventoried; schema valid |
| `npm run db:validate` | Exit 1 — script bug (`Assignment to constant variable` at `run-validation.mjs:162`); unrelated to migration corruption |

---

## Recommended action plan

1. **Delete** `prisma/migrations/20260530180000_user_consent_registry/` (empty, unapplied, untracked).
2. **Verify** with `npx prisma migrate status` — expect 4 pending migrations.
3. **Apply** the four valid pending migrations on each environment that needs them.
4. **Optional:** Add a pre-commit or CI check that fails when any migration folder lacks `migration.sql` (extend existing `npm run db:audit` inventory).

---

## Appendix: last applied migration

The most recently applied migration in `_prisma_migrations`:

```
20260530180000_legal_consent
finished_at: 2026-05-29T21:07:49.555Z
applied_steps_count: 1
rolled_back_at: null
```

Total applied: **54** of **58** valid on-disk migrations (after orphan removal).
