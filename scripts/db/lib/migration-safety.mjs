/** @typedef {'P0' | 'P1' | 'P2' | 'P3'} RiskLevel */

const RULES = [
  {
    id: 'DROP_TABLE',
    severity: 'P0',
    pattern: /\bDROP\s+TABLE\b/i,
    category: 'table_drop',
    message: 'Drops a table — irreversible without backup restore',
  },
  {
    id: 'DROP_COLUMN',
    severity: 'P1',
    pattern: /\bDROP\s+COLUMN\b/i,
    category: 'column_drop',
    message: 'Drops column(s) — data loss',
  },
  {
    id: 'DELETE_ROWS',
    severity: 'P1',
    pattern: /\bDELETE\s+FROM\b/i,
    category: 'data_delete',
    message: 'Deletes rows in migration — verify counts on staging',
  },
  {
    id: 'DROP_CONSTRAINT',
    severity: 'P2',
    pattern: /\bDROP\s+CONSTRAINT\b/i,
    category: 'constraint_change',
    message: 'Drops constraint — may affect integrity',
  },
  {
    id: 'ALTER_TYPE',
    severity: 'P1',
    pattern: /\bALTER\s+COLUMN\b[^;]*\bTYPE\b/i,
    category: 'type_change',
    message: 'Column type change — may fail or truncate data',
  },
  {
    id: 'SET_NOT_NULL',
    severity: 'P2',
    pattern: /\bALTER\s+COLUMN\b[^;]*\bSET\s+NOT\s+NULL\b/i,
    category: 'nullability',
    message: 'SET NOT NULL — fails if nulls exist',
  },
  {
    id: 'DROP_INDEX',
    severity: 'P3',
    pattern: /\bDROP\s+INDEX\b/i,
    category: 'index_change',
    message: 'Drops index — performance impact',
  },
  {
    id: 'CREATE_INDEX',
    severity: 'P3',
    pattern: /\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i,
    category: 'index_change',
    message: 'Creates index — may lock large tables',
  },
  {
    id: 'ENUM_ADD',
    severity: 'P3',
    pattern: /\bADD\s+VALUE\b/i,
    category: 'enum_change',
    message: 'Adds enum value — generally safe on PostgreSQL',
  },
];

const SEVERITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 };

/**
 * @param {string} sql
 * @param {string} folder
 */
export function analyzeMigrationSql(sql, folder) {
  /** @type {Array<{ id: string, severity: RiskLevel, category: string, message: string }>} */
  const findings = [];

  for (const rule of RULES) {
    if (rule.pattern.test(sql)) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        category: rule.category,
        message: rule.message,
      });
    }
  }

  let maxSeverity = 'P3';
  for (const f of findings) {
    if (SEVERITY_ORDER[f.severity] < SEVERITY_ORDER[maxSeverity]) {
      maxSeverity = f.severity;
    }
  }
  if (findings.length === 0) maxSeverity = 'P3';

  const nonReversible = findings.some((f) =>
    ['DROP_TABLE', 'DROP_COLUMN', 'DELETE_ROWS', 'ALTER_TYPE'].includes(f.id),
  );

  return {
    folder,
    findings,
    maxSeverity: findings.length ? maxSeverity : 'P3',
    nonReversible,
    reversible: !nonReversible,
  };
}

export { RULES };
