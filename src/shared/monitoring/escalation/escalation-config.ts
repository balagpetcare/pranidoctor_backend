function parseBool(raw: string | undefined, fallback: boolean): boolean {
  const v = raw?.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseRate(raw: string | undefined, fallback: number): number {
  const n = Number.parseFloat(raw ?? '');
  return Number.isFinite(n) && n > 0 && n <= 1 ? n : fallback;
}

/** Master toggle — defaults on when general monitoring is enabled. */
export function isEscalationMonitoringEnabled(): boolean {
  const raw = process.env['ESCALATION_MONITORING_ENABLED']?.trim().toLowerCase();
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  return parseBool(process.env['MONITORING_ENABLED'], true);
}

/** Interval between escalation DB checks (ms). Default 5 minutes. */
export function getEscalationCheckIntervalMs(): number {
  return parsePositiveInt(process.env['ESCALATION_CHECK_INTERVAL_MS'], 5 * 60 * 1000);
}

export function getPendingBacklogCountThreshold(): number {
  return parsePositiveInt(process.env['OPS_PENDING_BACKLOG_THRESHOLD'], 10);
}

/** Minimum age (minutes) before pending backlog triggers OPS-REQ-01. */
export function getPendingBacklogMinAgeMinutes(): number {
  return parsePositiveInt(process.env['OPS_PENDING_BACKLOG_MINUTES'], 120);
}

export function getEmergencyUnassignedMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_EMERGENCY_UNASSIGNED_MINUTES'], 15);
}

export function getDoctorAcceptEmergencyMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_DOCTOR_ACCEPT_EMERGENCY_MINUTES'], 15);
}

export function getDoctorAcceptHighMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_DOCTOR_ACCEPT_HIGH_MINUTES'], 60);
}

export function getDoctorAcceptNormalMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_DOCTOR_ACCEPT_NORMAL_MINUTES'], 240);
}

export function getInProgressStalledEmergencyMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_IN_PROGRESS_STALLED_EMERGENCY_MINUTES'], 240);
}

export function getInProgressStalledNormalMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_IN_PROGRESS_STALLED_NORMAL_MINUTES'], 1440);
}

export function getSupportUnansweredMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_SUPPORT_UNANSWERED_MINUTES'], 240);
}

export function getSupportUrgentMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_SUPPORT_URGENT_MINUTES'], 60);
}

export function getTechnicianComplaintOpenMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_TECHNICIAN_COMPLAINT_OPEN_MINUTES'], 1440);
}

export function getAiEscalationBacklogThreshold(): number {
  return parsePositiveInt(process.env['OPS_AI_ESCALATION_BACKLOG_THRESHOLD'], 10);
}

export function getAiEmergencySymptomMaxMinutes(): number {
  return parsePositiveInt(process.env['OPS_AI_EMERGENCY_SYMPTOM_MINUTES'], 30);
}

export function getRejectionSpikeWindowHours(): number {
  return parsePositiveInt(process.env['OPS_REJECTION_SPIKE_WINDOW_HOURS'], 4);
}

export function getRejectionSpikeRateThreshold(): number {
  return parseRate(process.env['OPS_REJECTION_SPIKE_RATE'], 0.2);
}

export function getConsultationFailureSpikeThreshold(): number {
  return parsePositiveInt(process.env['OPS_CONSULT_FAILURE_SPIKE_THRESHOLD'], 5);
}

export const ESCALATION_RUNBOOK = 'docs/production/operations/escalation-monitoring-plan.md';
