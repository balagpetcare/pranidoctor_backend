/**
 * Mobile customer notifications — same persistence as `/api/notifications`,
 * scoped to Bearer mobile auth at `/api/mobile/notifications`.
 */
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireMobileCustomer } from "@/lib/mobile-auth/guard";
import {
  listNotificationsForUser,
} from "@/lib/notifications/notification-service";
import { z } from "zod";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

function serializeNotification(n: {
  id: string;
  userId: string;
  type: string | { toString(): string };
  title: string;
  body: string;
  readAt: Date | null;
  createdAt: Date;
  metadataJson: unknown;
}) {
  return {
    id: n.id,
    userId: n.userId,
    type: typeof n.type === "string" ? n.type : String(n.type),
    title: n.title,
    body: n.body,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
    metadata: n.metadataJson,
  };
}

export async function GET(request: Request) {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
  });
  if (!parsed.success) {
    return jsonError("VALIDATION_ERROR", "Invalid query parameters", 422, parsed.error.flatten());
  }

  try {
    const data = await listNotificationsForUser(auth.ctx.userId, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      unreadOnly: parsed.data.unreadOnly,
    });
    return jsonOk({
      items: data.items.map(serializeNotification),
      total: data.total,
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load notifications", 500);
  }
}
