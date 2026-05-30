/**
 * Markdown report for emergency validation runs.
 */
export function emergencyValidationReport({ results, coverage }) {
  const lines = [
    '# Emergency E2E Validation Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `| Metric | Value |`,
    `|--------|------:|`,
    `| Vitest test files passed | ${results.passed}/${results.files} |`,
    `| Vitest tests passed | ${results.testsPassed}/${results.testsTotal} |`,
    `| Registry cases (automated) | ${coverage.automated}/${coverage.total} |`,
    `| Automated coverage (registry) | ${coverage.percent}% |`,
    `| P0 cases in registry | ${coverage.p0} |`,
    '',
    '## Result',
    '',
    results.ok ? '**PASS**' : '**FAIL**',
    '',
  ];

  if (results.stderr) {
    lines.push('## Vitest output (excerpt)', '', '```', results.stderr.slice(0, 4000), '```', '');
  }

  lines.push('## Workflows validated (automated)', '', ...coverage.validated.map((w) => `- ${w}`));
  lines.push('', '## Remaining gaps (manual / staging)', '', ...coverage.gaps.map((g) => `- ${g}`));

  return lines.join('\n');
}
