import pg from 'pg';

const { Client } = pg;

/** Expected reference data (read-only counts). */
export const SEED_EXPECTATIONS = {
  roles: ['USER', 'SUPPORT', 'TECHNICIAN', 'DOCTOR', 'ADMIN', 'SUPER_ADMIN'],
  settingsKeys: ['mobile.legal.config', 'mobile.ai.disclaimer.config'],
  optionalMasters: {
    FeedItem: { minCount: 0, label: 'feed catalog' },
    SemenProvider: { minCount: 0, label: 'semen providers' },
  },
};

/**
 * Validate seed/reference data presence (SELECT only).
 * @param {string} databaseUrl
 */
export async function validateSeedData(databaseUrl) {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  const findings = [];
  let ok = true;

  try {
    const roles = await client.query(`SELECT name FROM "Role" ORDER BY name`);
    const roleNames = roles.rows.map((r) => r.name);
    for (const expected of SEED_EXPECTATIONS.roles) {
      if (!roleNames.includes(expected)) {
        findings.push({ type: 'missing_role', expected, severity: 'P1' });
        ok = false;
      }
    }

    const settings = await client.query(
      `SELECT key FROM "Setting" WHERE key = ANY($1::text[])`,
      [SEED_EXPECTATIONS.settingsKeys],
    );
    const foundKeys = new Set(settings.rows.map((r) => r.key));
    for (const key of SEED_EXPECTATIONS.settingsKeys) {
      if (!foundKeys.has(key)) {
        findings.push({ type: 'missing_setting', key, severity: 'P2' });
      }
    }

    for (const [table, spec] of Object.entries(SEED_EXPECTATIONS.optionalMasters)) {
      const q = await client.query(`SELECT count(*)::int AS n FROM "${table}"`);
      const n = q.rows[0]?.n ?? 0;
      if (n < spec.minCount) {
        findings.push({
          type: 'optional_master_low',
          table,
          count: n,
          minCount: spec.minCount,
          label: spec.label,
          severity: 'P3',
        });
      }
    }

    const legalDocs = await client.query(`SELECT count(*)::int AS n FROM "LegalDocument"`).catch(() => ({
      rows: [{ n: -1 }],
    }));
    if (legalDocs.rows[0]?.n === 0) {
      findings.push({
        type: 'legal_document_empty',
        message: 'LegalDocument empty — run seedLegalDocuments on boot or legal seed',
        severity: 'P2',
      });
    }
  } finally {
    await client.end();
  }

  return { ok, findings, checkedAt: new Date().toISOString() };
}
