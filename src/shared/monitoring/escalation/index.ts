export {
  getAiEmergencySymptomMaxMinutes,
  getAiEscalationBacklogThreshold,
  getDoctorAcceptEmergencyMaxMinutes,
  getDoctorAcceptHighMaxMinutes,
  getDoctorAcceptNormalMaxMinutes,
  getEmergencyUnassignedMaxMinutes,
  getEscalationCheckIntervalMs,
  getInProgressStalledEmergencyMaxMinutes,
  getInProgressStalledNormalMaxMinutes,
  getPendingBacklogCountThreshold,
  getPendingBacklogMinAgeMinutes,
  getRejectionSpikeRateThreshold,
  getRejectionSpikeWindowHours,
  getSupportUnansweredMaxMinutes,
  getSupportUrgentMaxMinutes,
  getTechnicianComplaintOpenMaxMinutes,
  isEscalationMonitoringEnabled,
  ESCALATION_RUNBOOK,
} from './escalation-config.js';
export {
  runEscalationMonitoringCycle,
  runEscalationMonitoringOnceForTests,
  startEscalationMonitoring,
  stopEscalationMonitoring,
} from './escalation-monitor.service.js';
export { renderEscalationPrometheusLines, resetEscalationMetricsForTests } from './escalation.metrics.js';
