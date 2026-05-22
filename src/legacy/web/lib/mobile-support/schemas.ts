import { z } from "zod";

export const supportCategorySchema = z.enum([
  "ACCOUNT",
  "BILLING",
  "TECHNICAL",
  "ANIMAL_HEALTH",
  "APP_USAGE",
  "OTHER",
]);

export const supportPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export const supportStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "WAITING_CUSTOMER",
  "RESOLVED",
  "CLOSED",
]);

export const listSupportTicketsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: supportStatusSchema.optional(),
  category: supportCategorySchema.optional(),
  priority: supportPrioritySchema.optional(),
  search: z.string().trim().max(200).optional(),
});

export const createSupportTicketBodySchema = z.object({
  category: supportCategorySchema,
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  priority: supportPrioritySchema.default("MEDIUM"),
  attachmentFileIds: z.array(z.string().trim().min(1)).max(5).optional(),
});

export const replySupportTicketBodySchema = z.object({
  body: z.string().trim().min(1).max(5000),
  attachmentFileIds: z.array(z.string().trim().min(1)).max(5).optional(),
});

export const patchSupportTicketBodySchema = z.object({
  status: z.enum(["CLOSED", "OPEN"]),
});

export type ListSupportTicketsQuery = z.infer<typeof listSupportTicketsQuerySchema>;
export type CreateSupportTicketBody = z.infer<typeof createSupportTicketBodySchema>;
export type ReplySupportTicketBody = z.infer<typeof replySupportTicketBodySchema>;
export type PatchSupportTicketBody = z.infer<typeof patchSupportTicketBodySchema>;
