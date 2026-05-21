import {
  NotificationType,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createNotificationForUser,
} from "@/lib/notifications/notification-service";
import { getSmsService } from "@/lib/sms/service";

async function smsIfPhone(userPhone: string | null | undefined, body: string) {
  const phone = userPhone?.trim();
  if (!phone) return;
  const sms = getSmsService();
  await sms.sendSms({ to: phone, body });
}

/**
 * Sends OTP SMS only (no in-app notification row — avoids persisting OTP context).
 *
 * Mobile customer login uses {@link dispatchMobileOtpDelivery} in `otp-dispatch.ts`
 * (dev: terminal log; live: SMS). This helper remains for other flows that need a
 * direct SMS send with an explicit code.
 */
export async function notifyOtpSms(params: {
  phone: string;
  code: string;
}): Promise<void> {
  const sms = getSmsService();
  await sms.sendSms({
    to: params.phone.trim(),
    body: `Prani Doctor verification code: ${params.code}`,
    referenceId: "otp",
  });
}

export async function notifyServiceRequestSubmitted(serviceRequestId: string) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      customer: {
        include: {
          user: { select: { id: true, phone: true } },
        },
      },
      serviceCategory: { select: { name: true } },
    },
  });
  if (!sr) return;

  const userId = sr.customer.user.id;
  const categoryName = sr.serviceCategory.name;

  try {
    await createNotificationForUser({
      userId,
      type: NotificationType.REQUEST_UPDATE,
      title: "Service request submitted",
      body: `Your ${categoryName} request was submitted successfully.`,
      metadataJson: {
        event: "SERVICE_REQUEST_SUBMITTED",
        serviceRequestId: sr.id,
      },
    });

    await smsIfPhone(
      sr.customer.user.phone,
      `Prani Doctor: Your request (${categoryName}) was submitted. Ref: ${sr.id.slice(0, 8)}…`,
    );
  } catch (e) {
    console.error("[notifications] customer submit notify failed", e);
  }

  /** In-app only for panel admins; assigned doctor is unknown until admin assigns. */
  try {
    const admins = await prisma.user.findMany({
      where: {
        status: UserStatus.ACTIVE,
        role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
        adminProfile: { isNot: null },
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((a) =>
        createNotificationForUser({
          userId: a.id,
          type: NotificationType.REQUEST_UPDATE,
          title: "New service request",
          body: `A customer submitted a ${categoryName} request (pending assignment).`,
          metadataJson: {
            event: "ADMIN_NEW_SERVICE_REQUEST",
            serviceRequestId: sr.id,
          },
        }),
      ),
    );
  } catch (e) {
    console.error("[notifications] admin submit notify failed", e);
  }
}

export async function notifyDoctorAcceptedRequest(serviceRequestId: string) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      customer: {
        include: {
          user: { select: { id: true, phone: true } },
        },
      },
      assignedDoctor: {
        select: { displayName: true },
      },
    },
  });
  if (!sr) return;

  const userId = sr.customer.user.id;
  const doctorLabel =
    sr.assignedDoctor?.displayName?.trim() || "A veterinarian";

  try {
    await createNotificationForUser({
      userId,
      type: NotificationType.REQUEST_UPDATE,
      title: "Doctor accepted your request",
      body: `${doctorLabel} accepted your service request.`,
      metadataJson: {
        event: "DOCTOR_ACCEPTED",
        serviceRequestId: sr.id,
      },
    });

    await smsIfPhone(
      sr.customer.user.phone,
      `Prani Doctor: ${doctorLabel} accepted your request. Ref: ${sr.id.slice(0, 8)}…`,
    );
  } catch (e) {
    console.error("[notifications] doctor accepted notify failed", e);
  }
}

export async function notifyServiceRequestCompleted(serviceRequestId: string) {
  const sr = await prisma.serviceRequest.findUnique({
    where: { id: serviceRequestId },
    include: {
      customer: {
        include: {
          user: { select: { id: true, phone: true } },
        },
      },
    },
  });
  if (!sr) return;

  const userId = sr.customer.user.id;

  try {
    await createNotificationForUser({
      userId,
      type: NotificationType.REQUEST_UPDATE,
      title: "Service completed",
      body: "Your service request has been marked completed.",
      metadataJson: {
        event: "SERVICE_REQUEST_COMPLETED",
        serviceRequestId: sr.id,
      },
    });

    await smsIfPhone(
      sr.customer.user.phone,
      `Prani Doctor: Your service request is completed. Ref: ${sr.id.slice(0, 8)}…`,
    );
  } catch (e) {
    console.error("[notifications] request completed notify failed", e);
  }
}

/**
 * Placeholder for scheduled follow-up reminders (queue/cron not implemented).
 */
export async function notifyFollowUpReminderLaterPlaceholder(params: {
  customerUserId: string;
  serviceRequestId: string;
  scheduledForIso?: string;
}) {
  await createNotificationForUser({
    userId: params.customerUserId,
    type: NotificationType.SYSTEM,
    title: "Follow-up reminder (scheduled)",
    body:
      "This is a placeholder notification for a future follow-up reminder.",
    metadataJson: {
      event: "FOLLOW_UP_REMINDER_PLACEHOLDER",
      serviceRequestId: params.serviceRequestId,
      scheduledFor: params.scheduledForIso ?? null,
    },
  });
}
