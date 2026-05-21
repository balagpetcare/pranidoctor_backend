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
