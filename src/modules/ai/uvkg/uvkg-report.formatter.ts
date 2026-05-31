import type { UvkgPhase4ValidationReport } from './uvkg.types.js';

export function formatPhase4ValidationMarkdown(report: UvkgPhase4ValidationReport): string {
  const lines: string[] = [
    '# UVKG Phase 4 Validation Report',
    '',
    `**Generated:** ${report.generatedAt}`,
    `**Readiness score:** ${report.readinessScore}/100`,
    `**Phase 5 readiness:** ${report.readinessForPhase5}`,
    '',
    '## Executive summary',
    '',
    `- **Total UVKG edges:** ${report.coverage.totalEdges}`,
    `- **Distinct endpoints / VKL entities:** ${report.coverage.totalEntities}`,
    `- **Benchmarks met:** ${report.benchmarks.allMet ? 'Yes' : 'No'}`,
    `- **UVKG reads enabled:** No (required for Phase 4)`,
    `- **Legacy graphs retired:** No`,
    '',
  ];

  if (report.blockers.length > 0) {
    lines.push('### Blockers', '');
    for (const b of report.blockers) lines.push(`- ${b}`);
    lines.push('');
  }

  if (report.recommendations.length > 0) {
    lines.push('### Recommendations', '');
    for (const r of report.recommendations) lines.push(`- ${r}`);
    lines.push('');
  }

  lines.push('## Population', '');
  lines.push(`- Completed: ${report.population.completedAt}`);
  lines.push(`- Total links after population: ${report.population.totalLinksAfter}`);
  lines.push('');
  lines.push('| Source | Created | Updated | Skipped |');
  lines.push('|--------|---------|---------|---------|');
  for (const [name, r] of Object.entries(report.population.sources)) {
    lines.push(`| ${name} | ${r.created} | ${r.updated} | ${r.skipped} |`);
  }
  lines.push('');
  lines.push('**Derived edges:**');
  for (const [k, v] of Object.entries(report.population.derived)) {
    lines.push(`- ${k}: ${v}`);
  }
  lines.push('');

  lines.push('## Edge coverage', '');
  lines.push('| Category | Count | Minimum | Met |');
  lines.push('|----------|-------|---------|-----|');
  for (const c of report.coverage.categories) {
    lines.push(`| ${c.category} | ${c.count} | ${c.minimum} | ${c.met ? '✅' : '❌'} |`);
  }
  lines.push('');

  lines.push('## Graph quality', '');
  lines.push('| Issue kind | Count |');
  lines.push('|------------|-------|');
  for (const [kind, count] of Object.entries(report.quality.issueCounts)) {
    lines.push(`| ${kind} | ${count} |`);
  }
  lines.push('');
  if (report.quality.issues.length > 0) {
    lines.push('### Sample repair suggestions', '');
    for (const issue of report.quality.issues.slice(0, 15)) {
      lines.push(`- **${issue.kind}** (${issue.severity}): ${issue.message} — ${issue.repairSuggestion}`);
    }
    lines.push('');
  }

  lines.push('## Governance validation', '');
  for (const note of report.governance.notes) lines.push(`- ${note}`);
  lines.push('');
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  for (const [status, count] of Object.entries(report.governance.statusCounts)) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push('');

  lines.push('## Analytics dashboard snapshot', '');
  lines.push(`- VKL entities: ${report.analytics.entityCount}`);
  lines.push(`- UVKG edges: ${report.analytics.edgeCount}`);
  lines.push(`- Open drift conflicts: ${report.analytics.drift.openConflicts}`);
  lines.push('');
  lines.push('**Top connected entities:**');
  for (const t of report.analytics.topConnectedEntities.slice(0, 10)) {
    lines.push(`- ${t.refType}:${t.refId} (degree ${t.degree})`);
  }
  lines.push('');

  lines.push('## Performance benchmarks', '');
  lines.push('| Operation | Avg (ms) | P95 (ms) | Target | Met |');
  lines.push('|-----------|----------|----------|--------|-----|');
  for (const op of report.benchmarks.operations) {
    lines.push(
      `| ${op.operation} | ${op.avgMs} | ${op.p95Ms} | ${op.targetMs} | ${op.met ? '✅' : '❌'} |`,
    );
  }
  lines.push('');

  lines.push('## Drift', '');
  lines.push(`- Feed legacy: ${report.drift.feedLegacyCount}`);
  lines.push(`- Medicine legacy: ${report.drift.medicineLegacyCount}`);
  lines.push(`- Disease legacy: ${report.drift.diseaseLegacyCount}`);
  lines.push(`- UVKG total: ${report.drift.uvkgCount}`);
  lines.push(`- Missing in UVKG (sample): ${report.drift.missingInUvkg}`);
  lines.push('');

  lines.push('## Phase 5 readiness criteria', '');
  lines.push('| Criterion | Status |');
  lines.push('|-----------|--------|');
  lines.push(`| ≥10,000 edges | ${report.coverage.totalEdges >= 10_000 ? '✅' : '❌'} |`);
  lines.push(`| ≥1,000 entities | ${report.coverage.totalEntities >= 1_000 ? '✅' : '❌'} |`);
  lines.push(`| Coverage categories | ${report.coverage.categories.every((c) => c.met) ? '✅' : '❌'} |`);
  lines.push(`| Benchmarks <100ms avg | ${report.benchmarks.allMet ? '✅' : '❌'} |`);
  lines.push(`| UVKG_READ_ENABLED=false | ✅ (required) |`);
  lines.push(`| Legacy graphs active | ✅ (required) |`);
  lines.push('');

  return lines.join('\n');
}

export function formatPhase5ValidationMarkdown(report: import('./uvkg.types.js').UvkgPhase5ValidationReport): string {
  const lines: string[] = [];
  lines.push('# UVKG Phase 5 — Read Validation & Rollout Readiness', '');
  lines.push(`Generated: ${report.generatedAt}`, '');
  lines.push('## Executive summary', '');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Recommendation | **${report.recommendation}** |`);
  lines.push(`| Readiness score | ${report.readinessScore}/100 |`);
  lines.push(`| Overall parity | ${(report.overallParityRatio * 100).toFixed(1)}% |`);
  lines.push(`| Shadow samples | ${report.shadowReads.length} |`);
  lines.push(`| UVKG_READ_ENABLED | ${report.config.readEnabled} |`);
  lines.push(`| UVKG_SHADOW_READ_ENABLED | ${report.config.shadowReadEnabled} |`);
  lines.push(`| UVKG_READ_PERCENT | ${report.config.readPercent}% |`);
  lines.push('');

  lines.push('## Phase 5A — Shadow reads', '');
  lines.push('| Feature | Anchor | Legacy | UVKG | Parity | Legacy empty |');
  lines.push('|---------|--------|--------|------|--------|--------------|');
  for (const s of report.shadowReads) {
    lines.push(
      `| ${s.feature} | ${s.anchorRefId} | ${s.legacyCount} | ${s.uvkgCount} | ${(s.parityRatio * 100).toFixed(0)}% | ${s.legacyEmpty ? 'yes' : 'no'} |`,
    );
  }
  lines.push('');

  lines.push('## Phase 5B — Read accuracy', '');
  lines.push('| Category | Parity | Met | Legacy edges | UVKG edges |');
  lines.push('|----------|--------|-----|--------------|------------|');
  for (const r of report.readAccuracy) {
    lines.push(
      `| ${r.label} | ${(r.parityRatio * 100).toFixed(0)}% | ${r.met ? '✅' : '❌'} | ${r.legacyEdges} | ${r.uvkgEdges} |`,
    );
  }
  lines.push('');

  lines.push('## Phase 5C — AI retrieval validation', '');
  lines.push('| Feature | Hints | Boosts | Grounding | Consistency | Met |');
  lines.push('|---------|-------|--------|-----------|-------------|-----|');
  for (const a of report.aiValidation) {
    lines.push(
      `| ${a.feature} | ${a.avgHintCount} | ${a.avgSlugBoosts} | ${(a.groundingScore * 100).toFixed(0)}% | ${(a.consistencyScore * 100).toFixed(0)}% | ${a.met ? '✅' : '❌'} |`,
    );
  }
  lines.push('');

  lines.push('## Phase 5D — Performance', '');
  lines.push('| Operation | Legacy ms | UVKG ms | Ratio | Met |');
  lines.push('|-----------|-----------|---------|-------|-----|');
  for (const p of report.performance) {
    lines.push(
      `| ${p.operation} | ${p.legacyAvgMs} | ${p.uvkgAvgMs} | ${p.regressionRatio} | ${p.met ? '✅' : '❌'} |`,
    );
  }
  lines.push('');

  lines.push('## Phase 5E — Rollout buckets', '');
  for (const step of report.rollout) {
    lines.push(`- **${step.percent}%**: legacy=${step.bucketDistribution.legacy}, uvkg=${step.bucketDistribution.uvkg} ${step.valid ? '✅' : '❌'}`);
  }
  lines.push('');

  if (report.blockers.length) {
    lines.push('## Blockers', '');
    for (const b of report.blockers) lines.push(`- ${b}`);
    lines.push('');
  }

  if (report.recommendations.length) {
    lines.push('## Recommendations', '');
    for (const r of report.recommendations) lines.push(`- ${r}`);
    lines.push('');
  }

  lines.push('## Constraints', '');
  lines.push('- Legacy graphs **not** retired');
  lines.push('- Legacy reads **not** disabled for production');
  lines.push('- Shadow validation compares parallel reads without changing user-facing responses');
  lines.push('');

  return lines.join('\n');
}
