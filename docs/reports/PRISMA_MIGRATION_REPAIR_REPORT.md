# Prisma Migration Repair Report

**Project:** pranidoctor-backend  
**Date:** 2026-05-30  
**Engineer action:** Orphan migration cleanup (repair)  
**Prior investigation:** [PRISMA_MIGRATION_CORRUPTION_REPORT.md](./PRISMA_MIGRATION_CORRUPTION_REPORT.md)  
**Database:** `pranidoctor_db` @ `localhost:5432`

---

## Executive summary

| Check | Before repair | After repair |
|-------|---------------|--------------|
| Migration folders on disk | 59 | 58 |
| Folders missing `migration.sql` | 1 | **0** |
| P3015 error on `migrate status` | Yes | **No** |
| Applied migrations in DB | 54 | 54 |
| Pending migrations | 5 (1 broken + 4 valid) | **4** (all valid) |

**Repair outcome:** Success. The corrupt orphan folder was removed. All remaining migration directories contain `migration.sql`. Pending migrations were **not** applied (awaiting explicit approval).

---

## Broken migrations found

| Migration folder | `migration.sql` | In `_prisma_migrations` | Applied | Git history | Action |
|------------------|-----------------|---------------------------|---------|-------------|--------|
| `20260530180000_user_consent_registry` | Missing (empty dir) | No | No | Never committed | **Removed** |

### Pre-removal verification (`20260530180000_user_consent_registry`)

| Check | Result |
|-------|--------|
| Folder contents | 0 files |
| `_prisma_migrations` query | No row returned |
| `git log --all` | No commits |
| `git ls-files` | Not tracked |
| Sibling at same timestamp | `20260530180000_legal_consent` — applied, SQL intact |

Criteria for safe removal (all met):

- No `migration.sql`
- Not applied to database
- Not present in git history

---

## Removed folders

| Path | Removed at | Reason |
|------|------------|--------|
| `prisma/migrations/20260530180000_user_consent_registry/` | 2026-05-30 | Empty orphan; caused P3015; never applied or versioned |

**Command used:**

```powershell
Remove-Item -Recurse -Force "prisma/migrations/20260530180000_user_consent_registry"
```

No database records were modified. No git-tracked files were deleted.

---

## Verification results

### 1. Filesystem scan

```
Total migration folders: 58
Folders missing migration.sql: 0
```

### 2. `pnpm prisma migrate status`

```
58 migrations found in prisma/migrations

Following migrations have not yet been applied:
20260530190000_vet_disclaimer
20260601120000_ai_governance_scopes
20260601180000_legal_document_registry
20260601200000_emergency_limitation

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.
```

| Verification | Result |
|--------------|--------|
| P3015 (`Could not find the migration file at migration.sql`) | **Resolved — not present** |
| Migration inventory readable | Yes — 58 folders discovered |
| Exit code | `1` — expected when unapplied migrations remain (not a corruption error) |

### 3. Success criteria

| Criterion | Status |
|-----------|--------|
| No migration directory missing `migration.sql` | **Pass** |
| `prisma migrate status` runs without P3015 | **Pass** |
| No automatic application of pending migrations | **Pass** |

---

## Remaining pending migrations

These four migrations are valid (each has `migration.sql`) and are **not yet applied** on the local database. They were **not** applied during this repair.

| Migration | Purpose (summary) |
|-----------|-------------------|
| `20260530190000_vet_disclaimer` | Adds `VET_ADVICE` consent type; vet disclaimer columns on `MobileUserSettings` |
| `20260601120000_ai_governance_scopes` | Creates `AiGovernanceScope` table; extends governance history |
| `20260601180000_legal_document_registry` | Creates `LegalDocument` and `LegalAcceptanceEvent` tables |
| `20260601200000_emergency_limitation` | Adds `EMERGENCY_SERVICE` consent type; emergency acceptance columns |

To apply when approved:

```bash
# Development
pnpm prisma migrate dev

# Staging / production (with backup + guard)
npm run db:migrate:deploy
```

---

## Risk assessment

| Risk | Level | Notes |
|------|-------|-------|
| Data loss from removal | **None** | Orphan was empty and never applied |
| Schema drift | **Low** | 4 pending migrations align with `schema.prisma`; apply when ready |
| Production deploy | **Improved** | P3015 would have blocked `migrate deploy`; now clear |
| Wrong deletion | **None** | Only folder meeting all three safe-removal criteria was removed |
| Duplicate timestamps | **Informational** | 4 remaining timestamp collisions; all siblings have valid SQL |

---

## Recommended next steps

1. **Approve and apply** the four pending migrations on each environment that needs them.
2. **Optional:** Add CI guard in `npm run db:audit` to fail if any migration folder lacks `migration.sql`.
3. **Optional:** Fix `npm run db:validate` script error (`run-validation.mjs:162`) — unrelated to this repair but blocks full validation.

---

## References

- Prior audit: [PRISMA_MIGRATION_CORRUPTION_REPORT.md](./PRISMA_MIGRATION_CORRUPTION_REPORT.md)
- Migration docs: `prisma/migrations/README.md`
