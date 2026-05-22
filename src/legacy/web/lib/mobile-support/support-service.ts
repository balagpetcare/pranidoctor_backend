import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  toSupportTicketDetailDto,
  toSupportTicketListItemDto,
  type SupportTicketDetailJsonDto,
  type SupportTicketListItemJsonDto,
} from "./support-mapper";
import type {
  CreateSupportTicketBody,
  ListSupportTicketsQuery,
  PatchSupportTicketBody,
  ReplySupportTicketBody,
} from "./schemas";

const ticketInclude = {
  messages: {
    orderBy: { createdAt: "asc" as const },
    include: { attachments: true },
  },
  attachments: true,
} satisfies Prisma.SupportTicketInclude;

async function assertAttachmentOwnership(
  customerProfileId: string,
  userId: string,
  fileIds: string[],
): Promise<void> {
  if (fileIds.length === 0) return;
  const files = await prisma.uploadedFile.findMany({
    where: {
      id: { in: fileIds },
      ownerUserId: userId,
      fileCategory: "SUPPORT_ATTACHMENT",
    },
    select: { id: true },
  });
  if (files.length !== fileIds.length) {
    throw new Error("INVALID_ATTACHMENTS");
  }
  void customerProfileId;
}

async function linkAttachments(params: {
  ticketId: string;
  messageId: string | null;
  fileIds: string[];
  request: Request;
}): Promise<void> {
  if (params.fileIds.length === 0) return;

  const files = await prisma.uploadedFile.findMany({
    where: { id: { in: params.fileIds } },
  });

  const base = new URL(params.request.url).origin;
  for (const file of files) {
    const downloadUrl = `${base}/api/mobile/uploads/${file.id}`;
    await prisma.supportTicketAttachment.create({
      data: {
        ticketId: params.ticketId,
        messageId: params.messageId,
        uploadedFileId: file.id,
        fileName: file.originalName,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        downloadUrl,
      },
    });
  }
}

export async function listSupportTicketsForCustomer(
  customerProfileId: string,
  query: ListSupportTicketsQuery,
): Promise<{
  tickets: SupportTicketListItemJsonDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}> {
  const where: Prisma.SupportTicketWhereInput = {
    customerId: customerProfileId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.search
      ? {
          OR: [
            { subject: { contains: query.search, mode: "insensitive" } },
            { description: { contains: query.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.supportTicket.count({ where }),
    prisma.supportTicket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      include: ticketInclude,
    }),
  ]);

  return {
    tickets: rows.map(toSupportTicketListItemDto),
    total,
    page: query.page,
    limit: query.limit,
    hasMore: query.page * query.limit < total,
  };
}

export async function getSupportTicketForCustomer(
  customerProfileId: string,
  ticketId: string,
): Promise<SupportTicketDetailJsonDto | null> {
  const row = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: customerProfileId },
    include: ticketInclude,
  });
  if (!row) return null;
  return toSupportTicketDetailDto(row);
}

export async function createSupportTicketForCustomer(
  customerProfileId: string,
  userId: string,
  body: CreateSupportTicketBody,
  request: Request,
): Promise<SupportTicketDetailJsonDto> {
  const fileIds = body.attachmentFileIds ?? [];
  await assertAttachmentOwnership(customerProfileId, userId, fileIds);

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        customerId: customerProfileId,
        category: body.category,
        subject: body.subject,
        description: body.description,
        priority: body.priority,
        status: "OPEN",
        messages: {
          create: {
            authorType: "CUSTOMER",
            body: body.description,
          },
        },
      },
      include: ticketInclude,
    });

    const firstMessage = created.messages[0];
    if (firstMessage && fileIds.length > 0) {
      const files = await tx.uploadedFile.findMany({ where: { id: { in: fileIds } } });
      const base = new URL(request.url).origin;
      for (const file of files) {
        await tx.supportTicketAttachment.create({
          data: {
            ticketId: created.id,
            messageId: firstMessage.id,
            uploadedFileId: file.id,
            fileName: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            downloadUrl: `${base}/api/mobile/uploads/${file.id}`,
          },
        });
      }
    }

    return tx.supportTicket.findUniqueOrThrow({
      where: { id: created.id },
      include: ticketInclude,
    });
  });

  return toSupportTicketDetailDto(ticket);
}

export async function replySupportTicketForCustomer(
  customerProfileId: string,
  userId: string,
  ticketId: string,
  body: ReplySupportTicketBody,
  request: Request,
): Promise<SupportTicketDetailJsonDto | null> {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: customerProfileId },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (existing.status === "CLOSED") {
    throw new Error("TICKET_CLOSED");
  }

  const fileIds = body.attachmentFileIds ?? [];
  await assertAttachmentOwnership(customerProfileId, userId, fileIds);

  await prisma.$transaction(async (tx) => {
    const message = await tx.supportTicketMessage.create({
      data: {
        ticketId,
        authorType: "CUSTOMER",
        body: body.body,
      },
    });

    if (fileIds.length > 0) {
      const files = await tx.uploadedFile.findMany({ where: { id: { in: fileIds } } });
      const base = new URL(request.url).origin;
      for (const file of files) {
        await tx.supportTicketAttachment.create({
          data: {
            ticketId,
            messageId: message.id,
            uploadedFileId: file.id,
            fileName: file.originalName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            downloadUrl: `${base}/api/mobile/uploads/${file.id}`,
          },
        });
      }
    }

    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        updatedAt: new Date(),
        status: existing.status === "WAITING_CUSTOMER" ? "IN_PROGRESS" : existing.status,
      },
    });
  });

  return getSupportTicketForCustomer(customerProfileId, ticketId);
}

export async function patchSupportTicketForCustomer(
  customerProfileId: string,
  ticketId: string,
  body: PatchSupportTicketBody,
): Promise<SupportTicketDetailJsonDto | null> {
  const existing = await prisma.supportTicket.findFirst({
    where: { id: ticketId, customerId: customerProfileId },
    select: { id: true, status: true },
  });
  if (!existing) return null;

  const now = new Date();
  const isClose = body.status === "CLOSED";
  const isReopen = body.status === "OPEN";

  if (isClose && existing.status === "CLOSED") {
    return getSupportTicketForCustomer(customerProfileId, ticketId);
  }
  if (isReopen && existing.status !== "CLOSED") {
    return getSupportTicketForCustomer(customerProfileId, ticketId);
  }

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticketId },
      data: {
        status: isClose ? "CLOSED" : "OPEN",
        closedAt: isClose ? now : null,
        updatedAt: now,
      },
    });

    await tx.supportTicketMessage.create({
      data: {
        ticketId,
        authorType: "SYSTEM",
        body: isClose ? "Ticket closed by customer." : "Ticket reopened by customer.",
      },
    });
  });

  return getSupportTicketForCustomer(customerProfileId, ticketId);
}

export type SupportHelpJsonDto = {
  faq: Array<{ id: string; category: string; question: string; answer: string }>;
  contact: {
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  };
  quickActions: Array<{
    id: string;
    label: string;
    action: "create_ticket" | "call" | "whatsapp" | "view_tickets";
    value?: string;
  }>;
};

const STATIC_FAQ: SupportHelpJsonDto["faq"] = [
  {
    id: "faq-account",
    category: "ACCOUNT",
    question: "How do I update my profile?",
    answer: "Open Settings → Profile to edit your name, photo, and farm location.",
  },
  {
    id: "faq-vaccine",
    category: "ANIMAL_HEALTH",
    question: "How do vaccine reminders work?",
    answer: "Schedule vaccines under Vaccines. Reminders appear when a dose is due or overdue.",
  },
  {
    id: "faq-offline",
    category: "APP_USAGE",
    question: "Can I use the app offline?",
    answer: "Yes. Records you add offline sync automatically when your connection returns.",
  },
  {
    id: "faq-billing",
    category: "BILLING",
    question: "Where can I see service payments?",
    answer: "Check Inbox for service requests and Finance for farm income and expenses.",
  },
];

export async function getSupportHelp(): Promise<SupportHelpJsonDto> {
  let supportPhone: string | null = process.env.MOBILE_EMERGENCY_PHONE?.trim() || null;
  let supportWhatsapp: string | null = null;
  let supportEmail: string | null = process.env.MOBILE_SUPPORT_EMAIL?.trim() || null;

  try {
    const row = await prisma.setting.findUnique({
      where: { key: "mobile.app.config" },
      select: { valueJson: true },
    });
    const j = row?.valueJson;
    if (j !== null && typeof j === "object" && !Array.isArray(j)) {
      const o = j as Record<string, unknown>;
      if (typeof o.supportPhone === "string" && o.supportPhone.trim()) {
        supportPhone = o.supportPhone.trim();
      }
      if (typeof o.supportWhatsapp === "string" && o.supportWhatsapp.trim()) {
        supportWhatsapp = o.supportWhatsapp.trim();
      }
      if (typeof o.supportEmail === "string" && o.supportEmail.trim()) {
        supportEmail = o.supportEmail.trim();
      }
    }
  } catch {
    /* optional */
  }

  const quickActions: SupportHelpJsonDto["quickActions"] = [
    { id: "create-ticket", label: "Create support ticket", action: "create_ticket" },
    { id: "view-tickets", label: "My tickets", action: "view_tickets" },
  ];
  if (supportPhone) {
    quickActions.push({
      id: "call-support",
      label: "Call support",
      action: "call",
      value: supportPhone,
    });
  }
  if (supportWhatsapp) {
    quickActions.push({
      id: "whatsapp-support",
      label: "WhatsApp support",
      action: "whatsapp",
      value: supportWhatsapp,
    });
  }

  return {
    faq: STATIC_FAQ,
    contact: {
      phone: supportPhone,
      whatsapp: supportWhatsapp,
      email: supportEmail,
    },
    quickActions,
  };
}

export { linkAttachments };
