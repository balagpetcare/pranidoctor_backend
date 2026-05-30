import pg from 'pg';

const { Client } = pg;

/**
 * Read-only schema snapshot from PostgreSQL catalog.
 * @param {string} databaseUrl
 * @param {string} label e.g. local, staging, production
 */
export async function introspectSchema(databaseUrl, label) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE '_prisma%'
      ORDER BY table_name
    `);

    const columns = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `);

    const indexes = await client.query(`
      SELECT tablename AS table_name, indexname AS index_name, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    const constraints = await client.query(`
      SELECT tc.table_name, tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_schema = 'public'
      ORDER BY tc.table_name, tc.constraint_name
    `);

    const enums = await client.query(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder
    `);

    const migrationStatus = await client.query(`
      SELECT migration_name, finished_at, applied_steps_count, logs
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC NULLS LAST
      LIMIT 20
    `).catch(() => ({ rows: [] }));

    const failedMigrations = await client.query(`
      SELECT migration_name, started_at, finished_at, logs
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL OR logs IS NOT NULL
      ORDER BY started_at DESC
    `).catch(() => ({ rows: [] }));

    const enumMap = new Map();
    for (const row of enums.rows) {
      if (!enumMap.has(row.enum_name)) enumMap.set(row.enum_name, []);
      enumMap.get(row.enum_name).push(row.enum_value);
    }

    return {
      label,
      capturedAt: new Date().toISOString(),
      tableCount: tables.rows.length,
      tables: tables.rows.map((r) => r.table_name),
      columns: columns.rows.map((r) => ({
        table: r.table_name,
        column: r.column_name,
        type: r.data_type,
        udt: r.udt_name,
        nullable: r.is_nullable === 'YES',
        default: r.column_default,
      })),
      indexes: indexes.rows.map((r) => ({
        table: r.table_name,
        name: r.index_name,
        def: r.indexdef,
      })),
      constraints: constraints.rows.map((r) => ({
        table: r.table_name,
        name: r.constraint_name,
        type: r.constraint_type,
      })),
      enums: Object.fromEntries(enumMap),
      prismaMigrations: {
        recent: migrationStatus.rows,
        failedOrIncomplete: failedMigrations.rows.filter(
          (r) => !r.finished_at || (r.logs && String(r.logs).length > 0),
        ),
      },
    };
  } finally {
    await client.end();
  }
}
