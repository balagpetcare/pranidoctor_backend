/**
 * Compare two schema snapshots (read-only analysis).
 * @param {object} expected — typically "canonical" or newer env
 * @param {object} actual — env under test
 */
export function compareSchemaSnapshots(expected, actual) {
  const missingTables = expected.tables.filter((t) => !actual.tables.includes(t));
  const extraTables = actual.tables.filter((t) => !expected.tables.includes(t));

  const expectedColKey = (c) => `${c.table}.${c.column}`;
  const actualColMap = new Map(actual.columns.map((c) => [expectedColKey(c), c]));
  const expectedCols = expected.columns;

  /** @type {Array<{ table: string, column: string, issue: string }>} */
  const columnIssues = [];

  for (const col of expectedCols) {
    const key = expectedColKey(col);
    const other = actualColMap.get(key);
    if (!other) {
      columnIssues.push({ table: col.table, column: col.column, issue: 'missing_column' });
      continue;
    }
    if (other.udt !== col.udt && other.type !== col.type) {
      columnIssues.push({
        table: col.table,
        column: col.column,
        issue: `type_mismatch expected=${col.udt} actual=${other.udt}`,
      });
    }
    if (other.nullable !== col.nullable) {
      columnIssues.push({
        table: col.table,
        column: col.column,
        issue: `nullability_mismatch expected=${col.nullable} actual=${other.nullable}`,
      });
    }
  }

  const expectedIdx = new Set(expected.indexes.map((i) => i.name));
  const actualIdx = new Set(actual.indexes.map((i) => i.name));
  const missingIndexes = [...expectedIdx].filter((n) => !actualIdx.has(n));
  const extraIndexes = [...actualIdx].filter((n) => !expectedIdx.has(n));

  const enumIssues = [];
  for (const [name, values] of Object.entries(expected.enums)) {
    const other = actual.enums[name];
    if (!other) {
      enumIssues.push({ enum: name, issue: 'missing_enum' });
      continue;
    }
    for (const v of values) {
      if (!other.includes(v)) enumIssues.push({ enum: name, issue: `missing_value:${v}` });
    }
  }

  const driftDetected =
    missingTables.length > 0 ||
    columnIssues.length > 0 ||
    missingIndexes.length > 0 ||
    enumIssues.length > 0;

  return {
    expectedLabel: expected.label,
    actualLabel: actual.label,
    driftDetected,
    missingTables,
    extraTables,
    columnIssues,
    missingIndexes: missingIndexes.slice(0, 50),
    extraIndexes: extraIndexes.slice(0, 50),
    enumIssues,
    summary: {
      missingTableCount: missingTables.length,
      extraTableCount: extraTables.length,
      columnIssueCount: columnIssues.length,
      missingIndexCount: missingIndexes.length,
      enumIssueCount: enumIssues.length,
    },
  };
}
