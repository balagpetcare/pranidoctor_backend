import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ServiceRequestEventType,
  ServiceRequestStatus,
  ServiceRequestType,
} from '../../generated/prisma/index.js';

import { createEmergencyValidationStore } from './test-prisma.harness.js';
import {
  EMERGENCY_CANCEL_PATH_EVENTS,
  EMERGENCY_HAPPY_PATH_EVENTS,
  LIVESTOCK_ANIMAL_TYPES,
  PET_ANIMAL_TYPES,
} from './workflow-expectations.js';

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
  recordServiceRequestCompleted,
} from '../assignment/assignment.service.js';
import { cancelServiceRequestForCustomer } from '../lead/customer-lead.service.js';
import { createServiceRequestForCustomer } from '../lead/customer-lead.service.js';

function timelineTypes(): ServiceRequestEventType[] {
  return store.timeline.map((e) => e.eventType);
}

async function runHappyPath(animalType: string) {
  store.seedDoctor('doc-1');
  const created = await createServiceRequestForCustomer('cust-1', {
    animalId: 'animal-1',
    serviceCategoryId: 'cat-1',
    serviceType: ServiceRequestType.EMERGENCY_DOCTOR,
    problemOrSymptom: `${animalType} emergency`,
  });
  expect(created.ok).toBe('CREATED');
  if (created.ok !== 'CREATED') return null;
  const srId = created.request.id;

  const assign = await assignDoctorToServiceRequest(srId, 'doc-1');
  expect(assign.ok).toBe('UPDATED');

  const accept = await acceptServiceRequestForDoctor('doc-1', srId);
  expect(accept.ok).toBe('ACCEPTED');

  await recordServiceRequestCompleted(srId, 'doc-1');

  return srId;
}

describe('emergency workflow — livestock', () => {
  beforeEach(() => store.reset());

  it.each(LIVESTOCK_ANIMAL_TYPES)('E2E-EM-LIVESTOCK-01: %s emergency lifecycle', async (animalType) => {
    store.prismaMock.animalProfile.findFirst = async () => ({
      id: 'animal-1',
      customerId: 'cust-1',
      active: true,
      animalType,
    });

    const srId = await runHappyPath(animalType);
    expect(srId).toBeTruthy();

    const row = store.requests.get(srId!);
    expect(row?.isEmergency).toBe(true);
    expect(row?.serviceType).toBe(ServiceRequestType.EMERGENCY_DOCTOR);
    expect(row?.status).toBe(ServiceRequestStatus.ACCEPTED);

    expect(timelineTypes()).toEqual(
      expect.arrayContaining(EMERGENCY_HAPPY_PATH_EVENTS),
    );
  });

  it('sets EMERGENCY priority on create', async () => {
    store.prismaMock.animalProfile.findFirst = async () => ({
      id: 'animal-1',
      customerId: 'cust-1',
      active: true,
      animalType: 'CATTLE',
    });

    const created = await createServiceRequestForCustomer('cust-1', {
      animalId: 'animal-1',
      serviceCategoryId: 'cat-1',
      serviceType: ServiceRequestType.EMERGENCY_DOCTOR,
      problemOrSymptom: 'Down cow',
    });

    expect(created.ok).toBe('CREATED');
    if (created.ok === 'CREATED') {
      expect(created.request.isEmergency).toBe(true);
      const stored = store.requests.get(created.request.id);
      expect(stored?.isEmergency).toBe(true);
      expect(stored?.serviceType).toBe(ServiceRequestType.EMERGENCY_DOCTOR);
    }
  });
});

describe('emergency workflow — pet', () => {
  beforeEach(() => store.reset());

  it.each(PET_ANIMAL_TYPES)('E2E-EM-PET-01: %s emergency lifecycle', async (animalType) => {
    store.prismaMock.animalProfile.findFirst = async () => ({
      id: 'animal-1',
      customerId: 'cust-1',
      active: true,
      animalType,
    });

    const srId = await runHappyPath(animalType);
    expect(srId).toBeTruthy();
    expect(store.requests.get(srId!)?.animalType).toBe(animalType);
  });
});

describe('emergency workflow — cancellation', () => {
  beforeEach(() => store.reset());

  it('E2E-EM-CANCEL-01 / E-07: customer cancels pending emergency', async () => {
    const sr = store.seedRequest({
      id: 'sr-cancel',
      customerId: 'cust-1',
      animalType: 'DOG',
      status: ServiceRequestStatus.PENDING,
    });
    store.timeline.push({
      serviceRequestId: sr.id,
      eventType: ServiceRequestEventType.CREATED,
    });

    const result = await cancelServiceRequestForCustomer('cust-1', sr.id, 'Changed mind');
    expect(result.ok).toBe('CANCELLED');
    expect(sr.status).toBe(ServiceRequestStatus.CANCELLED);
    expect(timelineTypes()).toEqual(
      expect.arrayContaining(EMERGENCY_CANCEL_PATH_EVENTS),
    );
  });
});
