import { describe, expect, it } from 'vitest';

import { analyzeMigrationSql } from './lib/migration-safety.mjs';

describe('analyzeMigrationSql', () => {
  it('flags DROP TABLE as P0', () => {
    const r = analyzeMigrationSql('DROP TABLE "Foo";', 'test');
    expect(r.maxSeverity).toBe('P0');
    expect(r.nonReversible).toBe(true);
  });

  it('flags DELETE FROM as P1', () => {
    const r = analyzeMigrationSql('DELETE FROM "WeightRecord" w USING x;', 'test');
    expect(r.findings.some((f) => f.id === 'DELETE_ROWS')).toBe(true);
    expect(r.nonReversible).toBe(true);
  });

  it('passes benign CREATE TABLE', () => {
    const r = analyzeMigrationSql('CREATE TABLE "Foo" ( "id" TEXT PRIMARY KEY );', 'test');
    expect(r.findings.filter((f) => f.severity === 'P0' || f.severity === 'P1')).toHaveLength(0);
    expect(r.reversible).toBe(true);
  });
});
