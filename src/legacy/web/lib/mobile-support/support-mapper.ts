import type {
  SupportMessageAuthorType,
  SupportTicket,
  SupportTicketAttachment,
  SupportTicketMessage,
} from "@/generated/prisma/client";

export type SupportAttachmentJsonDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl: string | null;
  uploadedFileId: string | null;
  createdAt: string;
};

export type SupportMessageJsonDto = {
  id: string;
  authorType: SupportMessageAuthorType;
  body: string;
  createdAt: string;
  attachments: SupportAttachmentJsonDto[];
};

export type SupportTicketListItemJsonDto = {
  id: string;
  category: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  lastMessagePreview: string | null;
  attachmentCount: number;
};

export type SupportTicketDetailJsonDto = SupportTicketListItemJsonDto & {
  description: string;
  messages: SupportMessageJsonDto[];
  attachments: SupportAttachmentJsonDto[];
  timeline: SupportMessageJsonDto[];
};

function toAttachmentDto(row: SupportTicketAttachment): SupportAttachmentJsonDto {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    downloadUrl: row.downloadUrl,
    uploadedFileId: row.uploadedFileId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toMessageDto(
  row: SupportTicketMessage & { attachments?: SupportTicketAttachment[] },
): SupportMessageJsonDto {
  return {
    id: row.id,
    authorType: row.authorType,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    attachments: (row.attachments ?? []).map(toAttachmentDto),
  };
}

export function toSupportTicketListItemDto(
  row: SupportTicket & {
    messages: (SupportTicketMessage & { attachments: SupportTicketAttachment[] })[];
    attachments: SupportTicketAttachment[];
  },
): SupportTicketListItemJsonDto {
  const lastMessage = row.messages.length > 0 ? row.messages[row.messages.length - 1] : null;
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    priority: row.priority,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
    lastMessagePreview: lastMessage?.body?.slice(0, 120) ?? row.description.slice(0, 120),
    attachmentCount: row.attachments.length,
  };
}

export function toSupportTicketDetailDto(
  row: SupportTicket & {
    messages: (SupportTicketMessage & { attachments: SupportTicketAttachment[] })[];
    attachments: SupportTicketAttachment[];
  },
): SupportTicketDetailJsonDto {
  const listItem = toSupportTicketListItemDto(row);
  const messages = row.messages.map(toMessageDto);
  const ticketAttachments = row.attachments.filter((a) => a.messageId == null).map(toAttachmentDto);
  return {
    ...listItem,
    description: row.description,
    messages,
    attachments: ticketAttachments,
    timeline: messages,
  };
}
