/**
 * Emergency E2E validation registry — maps plan journeys to automated checks.
 * See pranidoctor_user/docs/launch/e2e-emergency-validation-plan.md
 */

export type ValidationTier = 'P0' | 'P1' | 'P2';
export type ValidationMode = 'unit' | 'static' | 'integration-db' | 'manual-staging';

export type EmergencyValidationCase = {
  id: string;
  title: string;
  tier: ValidationTier;
  mode: ValidationMode;
  /** Vitest file pattern or script id */
  automatedBy: string;
  planRef: string;
};

export const EMERGENCY_VALIDATION_CASES: EmergencyValidationCase[] = [
  {
    id: 'E2E-EM-LIVESTOCK-01',
    title: 'Livestock emergency happy path',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'emergency-workflow.test.ts',
    planRef: 'J-01',
  },
  {
    id: 'E2E-EM-PET-01',
    title: 'Pet emergency happy path',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'emergency-workflow.test.ts',
    planRef: 'J-02',
  },
  {
    id: 'E2E-EM-DOC-ACCEPT-01',
    title: 'Doctor acceptance',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'doctor-workflow.test.ts',
    planRef: 'J-03',
  },
  {
    id: 'E2E-EM-DOC-REJECT-01',
    title: 'Doctor rejection',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'doctor-workflow.test.ts',
    planRef: 'J-04',
  },
  {
    id: 'E2E-EM-REASSIGN-01',
    title: 'Doctor reassignment',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'doctor-workflow.test.ts',
    planRef: 'J-05',
  },
  {
    id: 'E2E-EM-CANCEL-01',
    title: 'Emergency cancellation',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'emergency-workflow.test.ts',
    planRef: 'J-06',
  },
  {
    id: 'E2E-EM-CLOSE-01',
    title: 'Emergency closure timeline',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'audit-timeline.test.ts',
    planRef: 'J-07',
  },
  {
    id: 'E2E-EM-AI-01',
    title: 'AI emergency escalation signals',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'ai-escalation.test.ts',
    planRef: 'J-08',
  },
  {
    id: 'E2E-EM-LEGAL-01',
    title: 'Emergency limitation booking guard',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'emergency-workflow.test.ts',
    planRef: 'J-10',
  },
  {
    id: 'E-01',
    title: 'No doctor available (pending)',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'failure-scenarios.test.ts',
    planRef: 'E-01',
  },
  {
    id: 'E-02',
    title: 'Multiple doctor rejections',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'failure-scenarios.test.ts',
    planRef: 'E-02',
  },
  {
    id: 'E-04',
    title: 'Notification failure handling',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'notifications.test.ts',
    planRef: 'E-04',
  },
  {
    id: 'E-05',
    title: 'AI kill switch / rules-only',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'ai-escalation.test.ts',
    planRef: 'E-05',
  },
  {
    id: 'E-07',
    title: 'User cancellation',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'emergency-workflow.test.ts',
    planRef: 'E-07',
  },
  {
    id: 'NOTIF-SUBMIT',
    title: 'Submission notifications (in-app + SMS path)',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'notifications.test.ts',
    planRef: '§1.5',
  },
  {
    id: 'NOTIF-ACCEPT',
    title: 'Doctor accepted notification',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'notifications.test.ts',
    planRef: '§1.5',
  },
  {
    id: 'OPS-ESCALATION',
    title: 'Escalation monitoring cycle',
    tier: 'P1',
    mode: 'unit',
    automatedBy: 'failure-scenarios.test.ts',
    planRef: 'E-01 ops',
  },
  {
    id: 'STATIC-COPY',
    title: 'Notification copy legal-safe scan',
    tier: 'P0',
    mode: 'static',
    automatedBy: 'static-sources.test.ts',
    planRef: 'SC-02',
  },
  {
    id: 'AUDIT-CHAIN',
    title: 'Timeline audit chain',
    tier: 'P0',
    mode: 'unit',
    automatedBy: 'audit-timeline.test.ts',
    planRef: '§1.11',
  },
  {
    id: 'E-03',
    title: 'Network interruption / offline replay',
    tier: 'P1',
    mode: 'manual-staging',
    automatedBy: '—',
    planRef: 'E-03',
  },
  {
    id: 'E-06',
    title: 'System degraded mode',
    tier: 'P1',
    mode: 'integration-db',
    automatedBy: 'run-validation.mjs (health)',
    planRef: 'E-06',
  },
  {
    id: 'RR-01',
    title: 'Service restart / rollback',
    tier: 'P1',
    mode: 'manual-staging',
    automatedBy: '—',
    planRef: 'RR-01',
  },
];

export function countCasesByMode(mode: ValidationMode): number {
  return EMERGENCY_VALIDATION_CASES.filter((c) => c.mode === mode).length;
}

export function countAutomatedCases(): number {
  return EMERGENCY_VALIDATION_CASES.filter((c) => c.automatedBy !== '—').length;
}
