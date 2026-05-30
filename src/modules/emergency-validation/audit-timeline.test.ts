import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ServiceRequestEventType,
  ServiceRequestStatus,
  UserRole,
} from '../../generated/prisma/index.js';

import { createEmergencyValidationStore } from './test-prisma.harness.js';
import { EMERGENCY_HAPPY_PATH_EVENTS } from './workflow-expectations.js';

const store = createEmergencyValidationStore();
const timelineCreates: Array<{
  serviceRequestId: string;
  eventType: ServiceRequestEventType;
  actorRole?: UserRole;
}> = [];

vi.mock('../../shared/database/prisma.js', () => ({
  getPrisma: () => store.prismaMock,
}));

vi.mock('../timeline/timeline.service.js', () => ({
  appendTimelineEvent: vi.fn(async (input: {
    serviceRequestId: string;
    eventType: ServiceRequestEventType;
    actorRole?: UserRole;
  }) => {
    timelineCreates.push(input);
    store.timeline.push({
      serviceRequestId: input.serviceRequestId,
      eventType: input.eventType,
    });
    return {
      id: 'evt',
      eventType: input.eventType,
      actorUserId: null,
      actorRole: input.actorRole ?? null,
      note: null,
      metadata: null,
      createdAt: new Date().toISOString(),
    };
  }),
}));

vi.mock('../../shared/monitoring/workflow-tracing.js', () => ({
  traceWorkflow: vi.fn(),
}));

import {
  assignDoctorToServiceRequest,
  acceptServiceRequestForDoctor,
  rejectServiceRequestForDoctor,
  recordServiceRequestCompleted,
} from '../assignment/assignment.service.js';

describe('audit — timeline coverage', () => {
  beforeEach(() => {
    store.reset();
    timelineCreates.length = 0;
    store.seedDoctor('doc-1');
  });

  it('E2E-EM-CLOSE-01 / AUDIT-CHAIN: logs creation through completion', async () => {
    const sr = store.seedRequest({
      id: 'sr-audit',
      customerId: 'cust-1',
      animalType: 'CATTLE',
      status: ServiceRequestStatus.PENDING,
    });

    store.timeline.push({
      serviceRequestId: sr.id,
      eventType: ServiceRequestEventType.CREATED,
    });

    await assignDoctorToServiceRequest(sr.id, 'doc-1');
    await acceptServiceRequestForDoctor('doc-1', sr.id);
    await recordServiceRequestCompleted(sr.id, 'doc-1');

    const types = timelineCreates.map((e) => e.eventType);
    expect(types).toEqual(
      expect.arrayContaining([
        ServiceRequestEventType.ASSIGNED,
        ServiceRequestEventType.ACCEPTED,
        ServiceRequestEventType.COMPLETED,
      ]),
    );

    const fullChain = [
      ServiceRequestEventType.CREATED,
      ...types,
    ];
    for (const expected of EMERGENCY_HAPPY_PATH_EVENTS) {
      expect(fullChain).toContain(expected);
    }

    const assignEvt = timelineCreates.find((e) => e.eventType === ServiceRequestEventType.ASSIGNED);
    expect(assignEvt?.actorRole).toBe(UserRole.ADMIN);
  });

  it('logs rejection with doctor actor', async () => {
    store.seedRequest({
      id: 'sr-rej',
      customerId: 'cust-1',
      animalType: 'DOG',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-1',
    });

    await rejectServiceRequestForDoctor('doc-1', 'sr-rej', 'Too far');
    expect(timelineCreates.some((e) => e.eventType === ServiceRequestEventType.REJECTED)).toBe(
      true,
    );
  });
});
