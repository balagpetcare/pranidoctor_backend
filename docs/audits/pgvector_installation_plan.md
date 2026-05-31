# pgvector Installation Plan — PraniDoctor Development Environment

**Analysis date:** 2026-06-01  
**Scope:** Read-only environment audit + installation/rollback procedures (no database changes performed during this audit)  
**Target migration:** `20260617120000_ai_phase6c13_rag_optimization`  
**Database:** `pranidoctor_db` @ `localhost:5432`

---

## 1. Environment Detection

| Item | Detected value |
|------|----------------|
| **Operating system** | Microsoft Windows 11 Pro (`10.0.26200`) |
| **Architecture** | x86_64 (64-bit) |
| **PostgreSQL version** | **18.4** (`PostgreSQL 18.4 on x86_64-windows, compiled by msvc-19.44.35226, 64-bit`) |
| **PostgreSQL branding** | PostgreSQL 18 (EDB-style Windows stack) |
| **Windows service** | `postgresql-x64-18` — **Running** |
| **Install root (`PGROOT`)** | `D:\postgres\data` |
| **Binaries** | `D:\postgres\data\bin\` (`psql.exe`, `pg_config.exe`, …) |
| **Libraries** | `D:\postgres\data\lib\` |
| **Extension catalog** | `D:\postgres\data\share\extension\` (62 `.control` files) |
| **Data directory** | `D:\postgres\data\data` (from registry) |
| **Registry key** | `HKLM\SOFTWARE\PostgreSQL\Installations\postgresql-x64-18` |
| **C++ build tools** | Visual Studio Build Tools **18** at `C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools` |
| **Git** | `C:\Program Files\Git\cmd\git.exe` |
| **`nmake`** | **Not on PATH** (expected; invoked from VS Native Tools prompt) |

### `pg_config` paths (authoritative for this install)

```
PostgreSQL 18.4
bindir:    D:/postgres/data/bin
libdir:    D:/postgres/data/lib
sharedir:  D:/postgres/data/share
pkglibdir: D:/postgres/data/lib
includedir-server: D:/postgres/data/include/server
```

---

## 2. pgvector Verification (Current State)

### 2.1 Extension availability in PostgreSQL

```sql
SELECT name, default_version, installed_version
FROM pg_available_extensions
WHERE name = 'vector';
-- Result: 0 rows (extension not packaged with this server)
```

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- Result: 0 rows (not installed in database)
```

### 2.2 Filesystem artifacts

| Expected artifact | Path | Present? |
|-------------------|------|----------|
| Extension control | `D:\postgres\data\share\extension\vector.control` | **No** |
| Extension SQL | `D:\postgres\data\share\extension\vector--*.sql` | **No** |
| Shared library | `D:\postgres\data\lib\vector.dll` | **No** |

**Conclusion:** pgvector is **not installed** on the PostgreSQL server. This matches the migration error:

```
ERROR: extension "vector" is not available
HINT: The extension must first be installed on the system where PostgreSQL is running.
```

---

## 3. Migration Compatibility Assessment

### 3.1 Migration SQL requirements

| Step | SQL | Requires pgvector? | Current DB state |
|------|-----|-------------------|------------------|
| 1 | `CREATE EXTENSION IF NOT EXISTS vector` | **Yes** | Extension missing |
| 2 | `ADD COLUMN metadataSidecarJson JSONB` | No | Column **exists** |
| 3 | `ADD COLUMN embeddingVector vector(1536)` | **Yes** | Column **missing** |
| 4 | `ADD COLUMN retrievalMetadataJson JSONB` | No | Column **exists** |
| 5 | B-tree index on `(active, modelKey, dimensions, embeddedAt DESC)` | No | Index **missing** |
| 6 | HNSW index `USING hnsw (embeddingVector vector_cosine_ops)` | **Yes** (needs column + extension) | Index **missing** |

### 3.2 pgvector feature compatibility (PostgreSQL 18.4)

| Feature | Required by migration | pgvector support |
|---------|----------------------|------------------|
| `vector(1536)` type | Yes | Supported (well below dimension limits) |
| `vector_cosine_ops` | Yes | Supported |
| `USING hnsw` | Yes | Supported in pgvector **≥ 0.5.0** (use **v0.8.2** for PG 18) |

**Recommended pgvector version:** **v0.8.2** (official tag; documented for PostgreSQL 18 on Windows).

### 3.3 Idempotency after install

The migration uses `IF NOT EXISTS` for columns and indexes. After pgvector is installed:

- Steps 2 and 4 will **no-op** safely (columns already present).
- Steps 1, 3, 5, and 6 will **apply** the remaining objects.

### 3.4 Schema drift note (Prisma)

`prisma/schema.prisma` defines `metadataSidecarJson` on `AiKnowledgeEmbeddingChunk` but **does not** define `embeddingVector`. The migration adds a native `vector(1536)` column that Prisma will not manage until the schema is updated (e.g. `Unsupported("vector(1536)")`). This does **not** block the SQL migration but affects client codegen.

### 3.5 Prisma migration history state

`_prisma_migrations` contains **two** rows for this migration:

| started_at | finished_at | rolled_back_at | Status |
|------------|-------------|----------------|--------|
| 2026-05-31 18:46:59+06 | NULL | 2026-06-01 01:15:50+06 | Rolled back |
| 2026-06-01 01:16:01+06 | NULL | NULL | **Active failed** (blocks `migrate deploy`) |

**Post-install migration workflow** (documented only; do not run until pgvector is verified):

```powershell
cd D:\PraniDoctor\pranidoctor-backend

# After successful CREATE EXTENSION vector test (see §5.3)
npx prisma migrate resolve --rolled-back 20260617120000_ai_phase6c13_rag_optimization
npx prisma migrate deploy
```

If `deploy` still fails on duplicate objects, use `--applied` only after manual verification that all migration objects exist (see §3.1 table).

### 3.6 Why some columns exist despite failed migration

`metadataSidecarJson` and `retrievalMetadataJson` are present even though the migration fails on line 1. They are **not** defined in any earlier migration SQL. Likely causes:

- `prisma db push` or manual DDL aligned with `schema.prisma`
- A prior partial operational fix outside Prisma migrate

This does **not** satisfy Prisma’s migration tracker; `migrate deploy` still requires pgvector + resolving the failed migration row.

---

## 4. Installation Options

### Option A — Build from source (recommended, official)

Matches [pgvector Windows instructions](https://github.com/pgvector/pgvector#windows). Uses your detected `PGROOT` and VS Build Tools 18.

**Prerequisites**

- Run as **Administrator**
- Stop heavy DB load during install (service may keep running; `install` copies into `PGROOT`)
- Visual Studio **Desktop development with C++** / MSVC x64 tools (Build Tools 18 detected)

**Exact commands**

Open **x64 Native Tools Command Prompt for VS 2022** (or VS 18 Build Tools equivalent) **as Administrator**, then:

```bat
set "PGROOT=D:\postgres\data"

cd %TEMP%
git clone --branch v0.8.2 https://github.com/pgvector/pgvector.git
cd pgvector

nmake /F Makefile.win clean
nmake /F Makefile.win
nmake /F Makefile.win install
```

If `vcvars64.bat` is required first (when `nmake` fails to find the compiler):

```bat
call "C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
```

Then repeat the `nmake` steps above.

**Expected files after install**

```
D:\postgres\data\lib\vector.dll
D:\postgres\data\share\extension\vector.control
D:\postgres\data\share\extension\vector--0.8.2.sql
D:\postgres\data\share\extension\vector--*.sql
```

**Service note:** Usually **no restart** required for a new extension library on Windows, but if `CREATE EXTENSION` fails after install, restart once:

```powershell
Restart-Service postgresql-x64-18
```

---

### Option B — Unofficial prebuilt binary (faster, use with caution)

Community builds: [andreiramani/pgvector_pgsql_windows](https://github.com/andreiramani/pgvector_pgsql_windows) — release tag **`0.8.2_18.0.2`** targets PostgreSQL 18 on Windows x64.

**Not official pgvector/PostgreSQL distribution.** Use only if Option A cannot compile. Verify checksums and test on a non-production clone first.

**Typical steps (follow `readme.txt` inside the release archive):**

1. Download `0.8.2_18.0.2` asset from GitHub Releases.
2. Copy `vector.dll` → `D:\postgres\data\lib\`
3. Copy `vector.control` and `vector--*.sql` → `D:\postgres\data\share\extension\`
4. Restart service if extension is not visible.

---

### Option C — Docker / Linux sidecar (development alternative)

If Windows native install is blocked, run PostgreSQL 18 **with pgvector preinstalled** in Docker (e.g. `pgvector/pgvector:pg18`) and point `DATABASE_URL` at that instance for local dev. This avoids modifying `D:\postgres\data` but requires data migration or a fresh dev database.

**Not covered step-by-step here** — choose only if Options A/B are impractical.

---

## 5. Post-Install Verification (Read-Only Checks)

### 5.1 Filesystem

```powershell
Test-Path 'D:\postgres\data\lib\vector.dll'
Get-ChildItem 'D:\postgres\data\share\extension\vector*'
```

Both must return artifacts.

### 5.2 Extension catalog (no DB mutation beyond optional CREATE EXTENSION test)

**Catalog only (no extension create):**

```powershell
$line = (Get-Content D:\PraniDoctor\pranidoctor-backend\.env | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1)
# Parse and set PGPASSWORD as in your environment, then:
& 'D:\postgres\data\bin\psql.exe' -h localhost -p 5432 -U <user> -d pranidoctor_db -c `
  "SELECT name, default_version FROM pg_available_extensions WHERE name = 'vector';"
```

Expected: one row, e.g. `vector | 0.8.2`.

**Functional test (creates extension in DB — run only when ready to mutate):**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
```

### 5.3 Migration dry-run compatibility matrix

After `CREATE EXTENSION vector` succeeds:

| Migration statement | Expected outcome |
|---------------------|------------------|
| `CREATE EXTENSION IF NOT EXISTS vector` | Success (already created) |
| `ADD metadataSidecarJson` | No-op (`IF NOT EXISTS`) |
| `ADD embeddingVector vector(1536)` | **Adds column** |
| `ADD retrievalMetadataJson` | No-op |
| `CREATE INDEX ..._active_model_dims_idx` | **Creates index** |
| `CREATE INDEX ..._hnsw_idx` | **Creates HNSW index** (requires rows optional; empty table is fine) |

Then resolve Prisma failed migration and run `npx prisma migrate deploy` (§3.5).

---

## 6. Rollback Plan

### 6.1 Before `CREATE EXTENSION vector` in production DB

If install copied files but extension was never created in any database:

1. Stop PostgreSQL (optional, recommended):
   ```powershell
   Stop-Service postgresql-x64-18
   ```
2. Remove artifacts:
   ```powershell
   Remove-Item 'D:\postgres\data\lib\vector.dll' -ErrorAction SilentlyContinue
   Remove-Item 'D:\postgres\data\share\extension\vector*' -ErrorAction SilentlyContinue
   ```
3. Start service:
   ```powershell
   Start-Service postgresql-x64-18
   ```

### 6.2 After `CREATE EXTENSION vector` (and/or migration applied)

**Order matters.** Dropping the extension with dependent objects requires care.

```sql
-- Removes vector type columns/indexes that depend on the extension
DROP INDEX IF EXISTS "AiKnowledgeEmbeddingChunk_embedding_vector_hnsw_idx";
ALTER TABLE "AiKnowledgeEmbeddingChunk" DROP COLUMN IF EXISTS "embeddingVector";
DROP EXTENSION IF EXISTS vector CASCADE;
```

Then remove filesystem artifacts (§6.1) if uninstalling pgvector from the server entirely.

**Prisma migration tracker rollback (after DB rollback):**

```powershell
cd D:\PraniDoctor\pranidoctor-backend
npx prisma migrate resolve --rolled-back 20260617120000_ai_phase6c13_rag_optimization
```

### 6.3 Full restore fallback

If rollback is uncertain:

1. Restore PostgreSQL data directory from backup taken **before** pgvector install / migration apply.
2. Reconcile `_prisma_migrations` with backup state.
3. Do not copy `vector.dll` back into `lib`.

---

## 7. Production Guidance (Brief)

| Environment | Recommendation |
|-------------|----------------|
| **Linux production** | `sudo apt install postgresql-18-pgvector` (or vendor package) on same major PG version |
| **Managed Postgres** | Enable pgvector via provider (RDS, Neon, Supabase, etc.) |
| **Windows production** | Prefer official compile (Option A) or enterprise support; avoid unverified binaries without security review |

Always install pgvector on the **same major PostgreSQL version** as the running server (here: **18**).

---

## 8. Summary

| Question | Answer |
|----------|--------|
| Is pgvector installed? | **No** |
| Are extension files present? | **No** |
| Can migration run today? | **No** — blocked at `CREATE EXTENSION vector` |
| Will migration be safe after install? | **Yes** — `IF NOT EXISTS` handles existing JSONB columns |
| Minimum pgvector version | **0.5.0+** for HNSW; install **0.8.2** for PG 18 |
| Install path | `PGROOT=D:\postgres\data` |
| Preferred install method | **Option A** (source build with VS Build Tools 18) |

---

## 9. References

- pgvector repository: https://github.com/pgvector/pgvector  
- pgvector Windows build section (PG 18 example): https://github.com/pgvector/pgvector#windows  
- Prior audit: `docs/audits/migration_failure_analysis.md`  
- Failed migration SQL: `prisma/migrations/20260617120000_ai_phase6c13_rag_optimization/migration.sql`  
- Prisma migrate resolve: https://www.prisma.io/docs/guides/migrate/production-troubleshooting  

---

*This document was produced by automated environment inspection. No database or migration files were modified.*