import { logError, logInfo } from '../../logger/logger.js';

import {
  alertAiEmergencySymptomUnreviewed,
  alertAiEscalationBacklog,
  alertBillingFailedEmergency,
  alertConsultationFailureSpike,
  alertConsultationStalled,
  alertDoctorAcceptSlaBreaches,
  alertEmergencyConsultationRejected,
  alertEmergencyUnassigned,
  alertOnlineConsultMissedWindow,
  alertPendingBacklog,
  alertRejectionSpike,
  alertSupportTicketUnanswered,
  alertSupportUrgentAging,
  alertTechnicianComplaintOpen,
} from './escalation-alerts.js';
import {
  getAiEmergencySymptomMaxMinutes,
  getAiEscalationBacklogThreshold,
  getDoctorAcceptEmergencyMaxMinutes,
  getDoctorAcceptHighMaxMinutes,
  getDoctorAcceptNormalMaxMinutes,
  getEmergencyUnassignedMaxMinutes,
  getInProgressStalledEmergencyMaxMinutes,
  getInProgressStalledNormalMaxMinutes,
  getPendingBacklogCountThreshold,
  getPendingBacklogMinAgeMinutes,
  getRejectionSpikeRateThreshold,
  getRejectionSpikeWindowHours,
  getConsultationFailureSpikeThreshold,
  getSupportUnansweredMaxMinutes,
  getSupportUrgentMaxMinutes,
  getTechnicianComplaintOpenMaxMinutes,
  isEscalationMonitoringEnabled,
  getEscalationCheckIntervalMs,
} from './escalation-config.js';
import { recordEscalationGaugeSnapshot } from './escalation.metrics.js';
import * as repo from './escalation.repository.js';

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

export async function runEscalationMonitoringCycle(): Promise<void> {
  if (running) return;
  running = true;

  try {
    const [
      pendingCount,
      oldestPendingMinutes,
      emergencyUnassigned,
      assignedEmergency,
      assignedHigh,
      assignedNormal,
      stalledEmergency,
      stalledNormal,
      onlineMissed,
      supportUnanswered,
      supportUrgent,
      technicianOpen,
      aiBacklog,
      aiEmergencySymptom,
      billingFailedEmergency,
      rejections,
      assignments,
      emergencyRejected,
      cancelledAfterAccept,
    ] = await Promise.all([
      repo.countPendingDoctorRequests(),
      repo.countOldestPendingAgeMinutes(),
      repo.countPendingEmergencyUnassigned(
        repo.minutesAgo(getEmergencyUnassignedMaxMinutes()),
      ),
      repo.findAssignedStaleByPriority(
        'emergency',
        getDoctorAcceptEmergencyMaxMinutes(),
      ),
      repo.findAssignedStaleByPriority('high', getDoctorAcceptHighMaxMinutes()),
      repo.findAssignedStaleByPriority('normal', getDoctorAcceptNormalMaxMinutes()),
      repo.findInProgressStalled(
        'emergency',
        getInProgressStalledEmergencyMaxMinutes(),
      ),
      repo.findInProgressStalled('normal', getInProgressStalledNormalMaxMinutes()),
      repo.findOnlineConsultMissedWindow(),
      repo.countSupportOpenUnanswered(getSupportUnansweredMaxMinutes()),
      repo.countSupportUrgentOpen(getSupportUrgentMaxMinutes()),
      repo.countTechnicianComplaintsOpen(getTechnicianComplaintOpenMaxMinutes()),
      repo.countAiEscalationBacklog(),
      repo.countAiEmergencySymptomUnreviewed(getAiEmergencySymptomMaxMinutes()),
      repo.countBillingFailedEmergency(),
      repo.countRejectionsSince(repo.hoursAgo(getRejectionSpikeWindowHours())),
      repo.countAssignmentsSince(repo.hoursAgo(getRejectionSpikeWindowHours())),
      repo.findRecentEmergencyRejections(repo.hoursAgo(getRejectionSpikeWindowHours())),
      repo.countCancelledAfterAcceptSince(repo.hoursAgo(getRejectionSpikeWindowHours())),
    ]);

    recordEscalationGaugeSnapshot({
      pendingDoctorRequests: pendingCount,
      assignedStaleEmergency: assignedEmergency.length,
      assignedStaleHigh: assignedHigh.length,
      assignedStaleNormal: assignedNormal.length,
      inProgressStalledEmergency: stalledEmergency.length,
      inProgressStalledNormal: stalledNormal.length,
      supportOpenUnanswered: supportUnanswered,
      aiEscalationBacklog: aiBacklog,
      onlineConsultMissedWindow: onlineMissed.length,
    });

    if (
      pendingCount >= getPendingBacklogCountThreshold() &&
      oldestPendingMinutes >= getPendingBacklogMinAgeMinutes()
    ) {
      alertPendingBacklog(pendingCount, oldestPendingMinutes);
    }

    if (emergencyUnassigned > 0) {
      alertEmergencyUnassigned(emergencyUnassigned, getEmergencyUnassignedMaxMinutes());
    }

    alertDoctorAcceptSlaBreaches(
      'emergency',
      assignedEmergency,
      getDoctorAcceptEmergencyMaxMinutes(),
    );
    alertDoctorAcceptSlaBreaches('high', assignedHigh, getDoctorAcceptHighMaxMinutes());
    alertDoctorAcceptSlaBreaches(
      'normal',
      assignedNormal,
      getDoctorAcceptNormalMaxMinutes(),
    );

    if (assignments > 0) {
      const rate = rejections / assignments;
      if (rate >= getRejectionSpikeRateThreshold()) {
        alertRejectionSpike(rejections, assignments, rate);
      }
    }

    alertEmergencyConsultationRejected(emergencyRejected);

    if (cancelledAfterAccept >= getConsultationFailureSpikeThreshold()) {
      alertConsultationFailureSpike(cancelledAfterAccept);
    }

    alertConsultationStalled(
      'emergency',
      stalledEmergency,
      getInProgressStalledEmergencyMaxMinutes(),
    );
    alertConsultationStalled(
      'normal',
      stalledNormal,
      getInProgressStalledNormalMaxMinutes(),
    );

    alertOnlineConsultMissedWindow(onlineMissed);

    if (supportUnanswered > 0) {
      alertSupportTicketUnanswered(supportUnanswered, getSupportUnansweredMaxMinutes());
    }

    if (supportUrgent > 0) {
      alertSupportUrgentAging(supportUrgent, getSupportUrgentMaxMinutes());
    }

    if (technicianOpen > 0) {
      alertTechnicianComplaintOpen(technicianOpen, getTechnicianComplaintOpenMaxMinutes());
    }

    if (aiBacklog >= getAiEscalationBacklogThreshold()) {
      alertAiEscalationBacklog(aiBacklog, getAiEscalationBacklogThreshold());
    }

    if (aiEmergencySymptom > 0) {
      alertAiEmergencySymptomUnreviewed(aiEmergencySymptom, getAiEmergencySymptomMaxMinutes());
    }

    if (billingFailedEmergency > 0) {
      alertBillingFailedEmergency(billingFailedEmergency);
    }

    logInfo('Escalation monitoring cycle complete', {
      event: 'ops.escalation.check',
      pendingCount,
      emergencyUnassigned,
      assignedStale:
        assignedEmergency.length + assignedHigh.length + assignedNormal.length,
      aiBacklog,
    });
  } catch (error) {
    logError('Escalation monitoring cycle failed', error, {
      event: 'ops.escalation.error',
    });
  } finally {
    running = false;
  }
}

export function startEscalationMonitoring(): void {
  if (!isEscalationMonitoringEnabled()) {
    logInfo('Escalation monitoring disabled');
    return;
  }
  if (intervalHandle) return;

  const intervalMs = getEscalationCheckIntervalMs();
  logInfo('Starting escalation monitoring', { intervalMs });

  void runEscalationMonitoringCycle();

  intervalHandle = setInterval(() => {
    void runEscalationMonitoringCycle();
  }, intervalMs);
}

export function stopEscalationMonitoring(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

/** Test helper — run one cycle without interval. */
export async function runEscalationMonitoringOnceForTests(): Promise<void> {
  await runEscalationMonitoringCycle();
}
