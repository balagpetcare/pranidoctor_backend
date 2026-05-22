import { NotificationType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type CreateNotificationInput = {
  userId: string;
  title: string;
  body: string;
  type?: NotificationType;
  metadataJson?: Prisma.InputJsonValue;
};

export async function createNotificationForUser(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type ?? NotificationType.SYSTEM,
      ...(input.metadataJson !== undefined
        ? { metadataJson: input.metadataJson }
        : {}),
    },
  });
}

export type ListNotificationsOptions = {
  limit: number;
  offset: number;
  unreadOnly?: boolean;
};

export async function listNotificationsForUser(
  userId: string,
  options: ListNotificationsOptions,
) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(options.unreadOnly ? { readAt: null } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit,
      skip: options.offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return { items, total };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) return { ok: "NOT_FOUND" as const };

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: existing.readAt ?? new Date() },
  });
  return { ok: "UPDATED" as const, notification: updated };
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updatedCount: result.count };
}

export async function getUnreadCountForUser(userId: string) {
  const count = await prisma.notification.count({
    where: { userId, readAt: null },
  });
  return { count };
}

export async function deleteNotificationForUser(userId: string, notificationId: string) {
  const existing = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!existing) return { ok: "NOT_FOUND" as const };
  await prisma.notification.delete({ where: { id: notificationId } });
  return { ok: "DELETED" as const };
}

export type NotificationSettingsDto = {
  pushEnabled: boolean;
  marketingEnabled: boolean;
  treatmentReminderEnabled: boolean;
  vaccineReminderEnabled: boolean;
  orderServiceEnabled: boolean;
  updatedAt: string;
};

const defaultSettings = {
  pushEnabled: true,
  marketingEnabled: false,
  treatmentReminderEnabled: true,
  vaccineReminderEnabled: true,
  orderServiceEnabled: true,
};

export async function getNotificationSettingsForUser(
  userId: string,
): Promise<NotificationSettingsDto> {
  const row = await prisma.notificationSettings.findUnique({ where: { userId } });
  if (!row) {
    return {
      ...defaultSettings,
      updatedAt: new Date().toISOString(),
    };
  }
  return {
    pushEnabled: row.pushEnabled,
    marketingEnabled: row.marketingEnabled,
    treatmentReminderEnabled: row.treatmentReminderEnabled,
    vaccineReminderEnabled: row.vaccineReminderEnabled,
    orderServiceEnabled: row.orderServiceEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertNotificationSettingsForUser(
  userId: string,
  input: Partial<Omit<NotificationSettingsDto, "updatedAt">>,
): Promise<NotificationSettingsDto> {
  const row = await prisma.notificationSettings.upsert({
    where: { userId },
    create: {
      userId,
      pushEnabled: input.pushEnabled ?? defaultSettings.pushEnabled,
      marketingEnabled: input.marketingEnabled ?? defaultSettings.marketingEnabled,
      treatmentReminderEnabled:
        input.treatmentReminderEnabled ?? defaultSettings.treatmentReminderEnabled,
      vaccineReminderEnabled:
        input.vaccineReminderEnabled ?? defaultSettings.vaccineReminderEnabled,
      orderServiceEnabled: input.orderServiceEnabled ?? defaultSettings.orderServiceEnabled,
    },
    update: {
      ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
      ...(input.marketingEnabled !== undefined ? { marketingEnabled: input.marketingEnabled } : {}),
      ...(input.treatmentReminderEnabled !== undefined
        ? { treatmentReminderEnabled: input.treatmentReminderEnabled }
        : {}),
      ...(input.vaccineReminderEnabled !== undefined
        ? { vaccineReminderEnabled: input.vaccineReminderEnabled }
        : {}),
      ...(input.orderServiceEnabled !== undefined
        ? { orderServiceEnabled: input.orderServiceEnabled }
        : {}),
    },
  });
  return {
    pushEnabled: row.pushEnabled,
    marketingEnabled: row.marketingEnabled,
    treatmentReminderEnabled: row.treatmentReminderEnabled,
    vaccineReminderEnabled: row.vaccineReminderEnabled,
    orderServiceEnabled: row.orderServiceEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}
