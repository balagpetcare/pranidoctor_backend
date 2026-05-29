import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../logger/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import { resetProductionAlertingForTests } from '../alerting/alert-service.js';

import { runEscalationMonitoringOnceForTests } from './escalation-monitor.service.js';
import * as repo from './escalation.repository.js';

vi.mock('./escalation.repository.js', () => ({
  countPendingDoctorRequests: vi.fn(async () => 0),
  countOldestPendingAgeMinutes: vi.fn(async () => 0),
  countPendingEmergencyUnassigned: vi.fn(async () => 0),
  findAssignedStaleByPriority: vi.fn(async () => []),
  findInProgressStalled: vi.fn(async () => []),
  findOnlineConsultMissedWindow: vi.fn(async () => []),
  countSupportOpenUnanswered: vi.fn(async () => 0),
  countSupportUrgentOpen: vi.fn(async () => 0),
  countTechnicianComplaintsOpen: vi.fn(async () => 0),
  countAiEscalationBacklog: vi.fn(async () => 0),
  countAiEmergencySymptomUnreviewed: vi.fn(async () => 0),
  countBillingFailedEmergency: vi.fn(async () => 0),
  countRejectionsSince: vi.fn(async () => 0),
  countAssignmentsSince: vi.fn(async () => 0),
  findRecentEmergencyRejections: vi.fn(async () => []),
  countCancelledAfterAcceptSince: vi.fn(async () => 0),
  hoursAgo: vi.fn((h: number) => new Date(Date.now() - h * 3600_000)),
  minutesAgo: vi.fn((m: number) => new Date(Date.now() - m * 60_000)),
}));

describe('escalation-monitor.service', () => {
  beforeEach(() => {
    resetProductionAlertingForTests();
    vi.clearAllMocks();
    process.env['MONITORING_ENABLED'] = 'true';
    process.env['OPS_AI_ESCALATION_BACKLOG_THRESHOLD'] = '5';
  });

  it('completes cycle with no breaches', async () => {
    await expect(runEscalationMonitoringOnceForTests()).resolves.toBeUndefined();
    expect(repo.countPendingDoctorRequests).toHaveBeenCalled();
  });

  it('evaluates emergency unassigned breach path', async () => {
    vi.mocked(repo.countPendingEmergencyUnassigned).mockResolvedValueOnce(2);
    await runEscalationMonitoringOnceForTests();
    expect(repo.countPendingEmergencyUnassigned).toHaveBeenCalled();
  });
});
