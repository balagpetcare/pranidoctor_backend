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

import {
  assignDoctorToServiceRequest,
  acceptServiceRequestForDoctor,
  rejectServiceRequestForDoctor,
} from '../assignment/assignment.service.js';

function pushCreated() {
  store.timeline.push({
    serviceRequestId: 'sr-1',
    eventType: ServiceRequestEventType.CREATED,
  });
}

describe('doctor workflow — accept', () => {
  beforeEach(() => {
    store.reset();
    store.seedDoctor('doc-1');
    pushCreated();
  });

  it('E2E-EM-DOC-ACCEPT-01: accepts assigned emergency', async () => {
    store.seedRequest({
      id: 'sr-1',
      customerId: 'cust-1',
      animalType: 'CATTLE',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-1',
      serviceType: ServiceRequestType.EMERGENCY_DOCTOR,
    });

    const result = await acceptServiceRequestForDoctor('doc-1', 'sr-1');
    expect(result.ok).toBe('ACCEPTED');
    expect(store.requests.get('sr-1')?.status).toBe(ServiceRequestStatus.ACCEPTED);
    expect(store.timeline.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        ServiceRequestEventType.CREATED,
        ServiceRequestEventType.ACCEPTED,
      ]),
    );
  });

  it('rejects accept when not assigned to doctor', async () => {
    store.seedRequest({
      id: 'sr-1',
      customerId: 'cust-1',
      animalType: 'CATTLE',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-2',
    });

    const result = await acceptServiceRequestForDoctor('doc-1', 'sr-1');
    expect(result.ok).toBe('NOT_FOUND');
  });
});

describe('doctor workflow — reject', () => {
  beforeEach(() => {
    store.reset();
    store.seedDoctor('doc-1');
    pushCreated();
  });

  it('E2E-EM-DOC-REJECT-01: rejects assigned emergency', async () => {
    store.seedRequest({
      id: 'sr-1',
      customerId: 'cust-1',
      animalType: 'GOAT',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-1',
    });

    const result = await rejectServiceRequestForDoctor('doc-1', 'sr-1', 'Unavailable');
    expect(result.ok).toBe('REJECTED');
    expect(store.requests.get('sr-1')?.status).toBe(ServiceRequestStatus.REJECTED);
    expect(store.timeline.map((e) => e.eventType)).toContain(
      ServiceRequestEventType.REJECTED,
    );
  });
});

describe('doctor workflow — reassignment', () => {
  beforeEach(() => {
    store.reset();
    store.seedDoctor('doc-1');
    store.seedDoctor('doc-2');
    pushCreated();
  });

  it('E2E-EM-REASSIGN-01: admin reassigns to second doctor', async () => {
    store.seedRequest({
      id: 'sr-1',
      customerId: 'cust-1',
      animalType: 'POULTRY',
      status: ServiceRequestStatus.ASSIGNED,
      assignedDoctorId: 'doc-1',
    });

    const reassign = await assignDoctorToServiceRequest('sr-1', 'doc-2');
    expect(reassign.ok).toBe('UPDATED');
    expect(store.requests.get('sr-1')?.assignedDoctorId).toBe('doc-2');

    const accept = await acceptServiceRequestForDoctor('doc-2', 'sr-1');
    expect(accept.ok).toBe('ACCEPTED');

    expect(store.timeline.map((e) => e.eventType)).toEqual(
      expect.arrayContaining([
        ServiceRequestEventType.REASSIGNED,
        ServiceRequestEventType.ACCEPTED,
      ]),
    );
  });

  it('blocks assign to inactive doctor', async () => {
    store.seedRequest({ id: 'sr-1', customerId: 'cust-1', animalType: 'CATTLE' });
    const result = await assignDoctorToServiceRequest('sr-1', 'doc-missing');
    expect(result.ok).toBe('INVALID_DOCTOR');
  });
});
