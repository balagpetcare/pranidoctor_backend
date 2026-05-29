import {
  sendCriticalAlert,
  sendInformationalAlert,
  sendWarningAlert,
} from '../alerting/alert-service.js';

import { ESCALATION_RUNBOOK } from './escalation-config.js';
import { formatSampleIds, minutesWaiting } from './escalation.helpers.js';
import type { StaleServiceRequestRow } from './escalation.helpers.js';

function sampleMeta(rows: StaleServiceRequestRow[]) {
  return {
    count: rows.length,
    sampleIds: formatSampleIds(rows),
    samples: rows.slice(0, 5).map((r) => ({
      id: r.id,
      priority: r.priority,
      serviceType: r.serviceType,
      minutesWaiting: minutesWaiting(r.assignedAt ?? r.startedAt ?? r.submittedAt),
    })),
  };
}

export function alertPendingBacklog(count: number, oldestMinutes: number): void {
  sendInformationalAlert(
    'OPS-REQ-01',
    'Unassigned pending consultation backlog',
    `${count} doctor consultation(s) pending assignment; oldest ${oldestMinutes} min`,
    { count, oldestMinutes },
    'pending-backlog',
  );
}

export function alertEmergencyUnassigned(count: number, maxMinutes: number): void {
  sendCriticalAlert(
    'OPS-REQ-03',
    'Emergency consultation unassigned',
    `${count} emergency request(s) pending >${maxMinutes} min without doctor assignment`,
    { count, maxMinutes },
    'emergency-unassigned',
  );
}

export function alertDoctorAcceptSlaBreaches(
  band: 'emergency' | 'high' | 'normal',
  rows: StaleServiceRequestRow[],
  maxMinutes: number,
): void {
  if (rows.length === 0) return;
  const title =
    band === 'emergency'
      ? 'Emergency doctor accept SLA breach'
      : 'Doctor accept SLA breach';
  const message = `${rows.length} assigned request(s) awaiting doctor accept >${maxMinutes} min (${band})`;
  const metadata = { ...sampleMeta(rows), band, maxMinutes };

  if (band === 'emergency') {
    sendCriticalAlert('OPS-REQ-02', title, message, metadata, `sr-accept:${band}`);
    return;
  }
  sendWarningAlert('OPS-REQ-02', title, message, metadata, `sr-accept:${band}`);
}

export function alertRejectionSpike(rejected: number, assigned: number, rate: number): void {
  sendWarningAlert(
    'OPS-REQ-04',
    'Consultation rejection rate elevated',
    `${rejected} rejections vs ${assigned} assignments (${Math.round(rate * 100)}% rate) in window`,
    { rejected, assigned, rate },
    'rejection-spike',
  );
}

export function alertEmergencyConsultationRejected(rows: StaleServiceRequestRow[]): void {
  if (rows.length === 0) return;
  sendWarningAlert(
    'OPS-CON-01',
    'Emergency consultation rejected',
    `${rows.length} emergency consultation(s) rejected recently`,
    sampleMeta(rows),
    `emergency-rejected:${rows[0]?.id ?? 'batch'}`,
  );
}

export function alertConsultationFailureSpike(count: number): void {
  sendWarningAlert(
    'OPS-CON-02',
    'Consultation failures elevated',
    `${count} consultation(s) cancelled after doctor accept in monitoring window`,
    { count },
    'consult-failure-spike',
  );
}

export function alertConsultationStalled(
  band: 'emergency' | 'normal',
  rows: StaleServiceRequestRow[],
  maxMinutes: number,
): void {
  if (rows.length === 0) return;
  const send = band === 'emergency' ? sendWarningAlert : sendInformationalAlert;
  send(
    'OPS-CON-03',
    'Consultation stalled in progress',
    `${rows.length} consultation(s) in IN_PROGRESS >${maxMinutes} min (${band})`,
    { ...sampleMeta(rows), band, maxMinutes },
    `stalled-${band}`,
  );
}

export function alertOnlineConsultMissedWindow(rows: StaleServiceRequestRow[]): void {
  if (rows.length === 0) return;
  sendWarningAlert(
    'OPS-CON-04',
    'Online consultation missed scheduled window',
    `${rows.length} online consultation(s) past scheduledStart without starting`,
    sampleMeta(rows),
    'online-missed-window',
  );
}

export function alertSupportTicketUnanswered(count: number, maxMinutes: number): void {
  sendInformationalAlert(
    'OPS-SUP-01',
    'Support tickets unanswered',
    `${count} OPEN ticket(s) without staff reply >${maxMinutes} min`,
    { count, maxMinutes },
    'support-unanswered',
  );
}

export function alertSupportUrgentAging(count: number, maxMinutes: number): void {
  sendWarningAlert(
    'OPS-SUP-02',
    'Urgent support ticket aging',
    `${count} URGENT ticket(s) still OPEN >${maxMinutes} min`,
    { count, maxMinutes },
    'support-urgent',
  );
}

export function alertTechnicianComplaintOpen(count: number, maxMinutes: number): void {
  sendInformationalAlert(
    'OPS-SUP-03',
    'AI technician complaints open',
    `${count} technician complaint(s) OPEN >${maxMinutes} min`,
    { count, maxMinutes },
    'technician-complaints',
  );
}

export function alertAiEscalationBacklog(count: number, threshold: number): void {
  sendWarningAlert(
    'OPS-ESC-01',
    'AI escalation backlog',
    `${count} AI escalation(s) pending review (threshold ${threshold})`,
    { count, threshold },
    'ai-escalation-backlog',
  );
}

export function alertAiEmergencySymptomUnreviewed(count: number, maxMinutes: number): void {
  sendCriticalAlert(
    'OPS-ESC-02',
    'AI emergency symptom escalation unreviewed',
    `${count} EMERGENCY_SYMPTOM escalation(s) unreviewed >${maxMinutes} min`,
    { count, maxMinutes },
    'ai-emergency-symptom',
  );
}

export function alertBillingFailedEmergency(count: number): void {
  sendInformationalAlert(
    'OPS-BIL-01',
    'Emergency consultation billing failed',
    `${count} emergency billing record(s) with FAILED payment status`,
    { count },
    'billing-failed-emergency',
  );
}

export const OPS_ALERT_RUNBOOK = ESCALATION_RUNBOOK;
