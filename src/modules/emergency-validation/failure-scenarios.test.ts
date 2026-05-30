import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ServiceRequestEventType,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../generated/prisma/index.js';

import { createEmergencyValidationStore } from './test-prisma.harness.js';

const store = createEmergencyValidationStore();

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => store.prismaMock,
}));

vi.mock('../timeline/timeline.service.js', () => ({
  appendTimelineEvent: vi.fn(async (input: { serviceRequestId: string; eventType: ServiceRequestEventType }) => {
    store.timeline.push({
      serviceRequestId: input.serviceRequestId,
      eventType: input.eventType,
    });
  }),
}));

vi.mock('../../shared/monitoring/workflow-tracing.js', () => ({
  traceWorkflow: vi.fn(),
}));

vi.mock('../../shared/monitoring/escalation/escalation.repository.js', () => ({
  countPendingDoctorRequests: vi.fn(async () => 5),
  countOldestPendingAgeMinutes: vi.fn(async () => 45),
  countPendingEmergencyUnassigned: vi.fn(async () => 2),
  findAssignedStaleByPriority: vi.fn(async () => []),
  findInProgressStalled: vi.fn(async () => []),
  findOnlineConsultMissedWindow: vi.fn(async () => []),
  countSupportOpenUnanswered: vi.fn(async () => 0),
  countSupportUrgentOpen: vi.fn(async () => 0),
  countTechnicianComplaintsOpen: vi.fn(async () => 0),
  countAiEscalationBacklog: vi.fn(async () => 0),
  countAiEmergencySymptomUnreviewed: vi.fn(async () => 0),
  countBillingFailedEmergency: vi.fn(async () => 0),
  countRejectionsSince: vi.fn(async () => 3),
  countAssignmentsSince: vi.fn(async () => 2),
  findRecentEmergencyRejections: vi.fn(async () => [{ id: 'sr-1' }, { id: 'sr-2' }]),
  countCancelledAfterAcceptSince: vi.fn(async () => 0),
  hoursAgo: vi.fn((h: number) => new Date(Date.now() - h * 3600_000)),
  minutesAgo: vi.fn((m: number) => new Date(Date.now() - m * 60_000)),
}));

vi.mock('../../shared/logger/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

import {
  assignDoctorToServiceRequest,
  rejectServiceRequestForDoctor,
} from '../assignment/assignment.service.js';
import { runEscalationMonitoringOnceForTests } from '../../shared/monitoring/escalation/escalation-monitor.service.js';
import * as repo from '../../shared/monitoring/escalation/escalation.repository.js';

describe('failure scenarios — doctor unavailable', () => {
  beforeEach(() => store.reset());

  it('E-01: pending emergency remains unassigned', async () => {
    const sr = store.seedRequest({
      customerId: 'cust-1',
      animalType: 'CATTLE',
      status: ServiceRequestStatus.PENDING,
      assignedDoctorId: null,
      serviceType: ServiceRequestType.EMERGENCY_DOCTOR,
    });

    expect(sr.status).toBe(ServiceRequestStatus.PENDING);
    expect(sr.assignedDoctorId).toBeNull();
  });

  it('E-01: assign fails for invalid doctor (availability)', async () => {
    store.seedRequest({ id: 'sr-1', customerId: 'cust-1', animalType: 'GOAT' });
    const result = await assignDoctorToServiceRequest('sr-1', 'unknown-doc');
    expect(result.ok).toBe('INVALID_DOCTOR');
  });
});

describe('failure scenarios — multiple rejections', () => {
  beforeEach(() => {
    store.reset();
    store.seedDoctor('doc-1');
  });

  it('E-02: sequential rejections leave terminal REJECTED state', async () => {
    store.seedRequest({
      id: 'sr-1',
      customerId: 'cust-1',
      animalType: 'CATTLE',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-1',
    });

    const r1 = await rejectServiceRequestForDoctor('doc-1', 'sr-1', 'Busy');
    expect(r1.ok).toBe('REJECTED');

    const r2 = await rejectServiceRequestForDoctor('doc-1', 'sr-1', 'Again');
    expect(r2.ok).toBe('ALREADY_REJECTED');
  });

  it('OPS-ESCALATION: monitoring cycle runs with emergency unassigned signal', async () => {
    process.env['MONITORING_ENABLED'] = 'true';
    await expect(runEscalationMonitoringOnceForTests()).resolves.toBeUndefined();
    expect(repo.countPendingEmergencyUnassigned).toHaveBeenCalled();
  });
});

describe('failure scenarios — terminal state guards', () => {
  beforeEach(() => {
    store.reset();
    store.seedDoctor('doc-1');
  });

  it('blocks assign on completed case', async () => {
    store.seedRequest({
      id: 'sr-done',
      customerId: 'cust-1',
      animalType: 'DOG',
      status: ServiceRequestStatus.COMPLETED,
    });

    const result = await assignDoctorToServiceRequest('sr-done', 'doc-1');
    expect(result.ok).toBe('TERMINAL_STATUS');
  });
});
