import type { GaChecklistItem } from './ga-launch.types.js';

/** Default GA gate checklist — synced with docs/launch/ga-checklist.md */
export function buildDefaultGaChecklist(): GaChecklistItem[] {
  const items: Omit<GaChecklistItem, 'status'>[] = [
    { id: 'H1', label: 'Production VPS + TLS', priority: 'P0' },
    { id: 'H2', label: 'Backup cron + offsite copy', priority: 'P0' },
    { id: 'H3', label: 'Restore drill logged', priority: 'P0' },
    { id: 'H4', label: 'Deploy E2E with rollback tag', priority: 'P0' },
    { id: 'H5', label: 'External uptime on /ready + BFF', priority: 'P0' },
    { id: 'H6', label: 'Sentry + webhook live', priority: 'P0' },
    { id: 'H7', label: 'Load test 20 RPS pass', priority: 'P0' },
    { id: 'H8', label: 'Migration validation ≥ 85', priority: 'P0' },
    { id: 'I1', label: 'Firebase + FCM production', priority: 'P0' },
    { id: 'I2', label: 'Play production track', priority: 'P0' },
    { id: 'I3', label: 'Play Data Safety complete', priority: 'P0' },
    { id: 'J1', label: 'Legal GA counsel sign-off', priority: 'P0' },
    { id: 'J2', label: 'Live privacy/terms/refund HTTP 200', priority: 'P0' },
    { id: 'K1', label: '≥ 15 doctors for soft launch', priority: 'P0' },
    { id: 'K4', label: 'AI kill switch drill (< 90 days)', priority: 'P0' },
    { id: 'L1', label: '24/7 on-call roster published', priority: 'P0' },
    { id: 'L4', label: 'GA war room dry-run complete', priority: 'P0' },
    { id: 'M1', label: 'Closed beta exit metrics met', priority: 'P0' },
    { id: 'M4', label: 'Launch Governance Board GO vote', priority: 'P0' },
    { id: 'I4', label: 'App Links / assetlinks.json', priority: 'P1' },
    { id: 'I5', label: 'BN critical screens QA', priority: 'P1' },
    { id: 'L2', label: 'Tiered SLA published', priority: 'P1' },
    { id: 'L3', label: 'Payment reconciliation SOP', priority: 'P1' },
  ];
  return items.map((item) => ({ ...item, status: 'open' as const }));
}
