import { describe, expect, it, vi, beforeEach } from 'vitest';

import { validateLegalSafeMessaging } from '../../shared/compliance/messaging-compliance.js';

const { createNotificationForUser, sendSms } = vi.hoisted(() => ({
  createNotificationForUser: vi.fn(),
  sendSms: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    serviceRequest: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(async () => [{ id: 'admin-1' }]),
    },
  },
}));

vi.mock('@/lib/notifications/notification-service', () => ({
  createNotificationForUser,
}));

vi.mock('@/lib/sms/service', () => ({
  getSmsService: () => ({
    sendSms,
  }),
}));

import { prisma } from '@/lib/prisma';
import {
  notifyDoctorAcceptedRequest,
  notifyServiceRequestCompleted,
  notifyServiceRequestSubmitted,
} from '@/lib/notifications/events.js';

describe('notifications — emergency service request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSms.mockResolvedValue({ ok: true });
    createNotificationForUser.mockResolvedValue({ id: 'n1' });
  });

  const baseSr = {
    id: 'sr-1',
    serviceCategory: { name: 'Emergency Vet' },
    customer: {
      user: { id: 'user-1', phone: '+8801700000000' },
    },
    assignedDoctor: { displayName: 'Dr. Rahman' },
  };

  it('NOTIF-SUBMIT: creates in-app notification and SMS on submit', async () => {
    vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue(baseSr as never);

    await notifyServiceRequestSubmitted('sr-1');

    expect(createNotificationForUser).toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ to: '+8801700000000' }),
    );
  });

  it('NOTIF-ACCEPT: notifies customer when doctor accepts', async () => {
    vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue(baseSr as never);

    await notifyDoctorAcceptedRequest('sr-1');

    expect(createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        metadataJson: expect.objectContaining({ event: 'DOCTOR_ACCEPTED' }),
      }),
    );
    expect(sendSms).toHaveBeenCalled();
  });

  it('NOTIF-COMPLETE: notifies on completion', async () => {
    vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue({
      ...baseSr,
      assignedDoctor: undefined,
    } as never);

    await notifyServiceRequestCompleted('sr-1');
    expect(createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        metadataJson: expect.objectContaining({ event: 'SERVICE_REQUEST_COMPLETED' }),
      }),
    );
  });

  it('E-04: swallows notification errors without throwing', async () => {
    vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue(baseSr as never);
    createNotificationForUser.mockRejectedValueOnce(new Error('db down'));

    await expect(notifyServiceRequestSubmitted('sr-1')).resolves.toBeUndefined();
  });

  it('skips SMS when phone missing', async () => {
    vi.mocked(prisma.serviceRequest.findUnique).mockResolvedValue({
      ...baseSr,
      customer: { user: { id: 'user-1', phone: null } },
    } as never);

    await notifyServiceRequestSubmitted('sr-1');
    expect(createNotificationForUser).toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe('notifications — copy compliance', () => {
  const samples = [
    'Your Emergency Vet request was submitted successfully.',
    'Dr. Rahman accepted your service request.',
    'Your service request has been marked completed.',
    'A customer submitted a Emergency Vet request (pending assignment).',
  ];

  it.each(samples)('STATIC: notification body is legal-safe: %s', (body) => {
    const result = validateLegalSafeMessaging(body);
    expect(result.ok).toBe(true);
  });
});
