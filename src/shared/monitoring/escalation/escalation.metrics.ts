import { Gauge } from '../metrics/prometheus-series.js';

const pendingRequests = new Gauge();
const assignedStale = new Gauge();
const inProgressStalled = new Gauge();
const supportUnanswered = new Gauge();
const aiEscalationBacklog = new Gauge();
const onlineConsultMissed = new Gauge();

export type EscalationGaugeSnapshot = {
  pendingDoctorRequests: number;
  assignedStaleEmergency: number;
  assignedStaleHigh: number;
  assignedStaleNormal: number;
  inProgressStalledEmergency: number;
  inProgressStalledNormal: number;
  supportOpenUnanswered: number;
  aiEscalationBacklog: number;
  onlineConsultMissedWindow: number;
};

export function recordEscalationGaugeSnapshot(snapshot: EscalationGaugeSnapshot): void {
  pendingRequests.setUnlabeled(snapshot.pendingDoctorRequests);
  assignedStale.set({ priority: 'emergency' }, snapshot.assignedStaleEmergency);
  assignedStale.set({ priority: 'high' }, snapshot.assignedStaleHigh);
  assignedStale.set({ priority: 'normal' }, snapshot.assignedStaleNormal);
  inProgressStalled.set({ priority: 'emergency' }, snapshot.inProgressStalledEmergency);
  inProgressStalled.set({ priority: 'normal' }, snapshot.inProgressStalledNormal);
  supportUnanswered.setUnlabeled(snapshot.supportOpenUnanswered);
  aiEscalationBacklog.setUnlabeled(snapshot.aiEscalationBacklog);
  onlineConsultMissed.setUnlabeled(snapshot.onlineConsultMissedWindow);
}

export function renderEscalationPrometheusLines(): string[] {
  return [
    ...pendingRequests.entries(
      'pranidoctor_ops_pending_consultations',
      'Doctor consultation service requests awaiting assignment',
    ),
    ...assignedStale.entries(
      'pranidoctor_ops_assigned_stale_total',
      'Assigned consultations exceeding doctor-accept SLA threshold',
    ),
    ...inProgressStalled.entries(
      'pranidoctor_ops_in_progress_stalled_total',
      'In-progress consultations exceeding completion SLA threshold',
    ),
    ...supportUnanswered.entries(
      'pranidoctor_ops_support_unanswered_total',
      'Open support tickets without staff reply beyond threshold',
    ),
    ...aiEscalationBacklog.entries(
      'pranidoctor_ops_ai_escalation_backlog_total',
      'AI escalations in PENDING_REVIEW or QUEUED status',
    ),
    ...onlineConsultMissed.entries(
      'pranidoctor_ops_online_consult_missed_window_total',
      'Online consultations past scheduledStart without starting',
    ),
  ];
}

export function resetEscalationMetricsForTests(): void {
  pendingRequests.clear();
  assignedStale.clear();
  inProgressStalled.clear();
  supportUnanswered.clear();
  aiEscalationBacklog.clear();
  onlineConsultMissed.clear();
}
