import { NotificationType, Prisma } from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireNotificationViewer } from "@/lib/notifications/guard";
import {
  createNotificationForUser,
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

const createBodySchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  type: z.nativeEnum(NotificationType).optional(),
  metadataJson: z.unknown().optional(),
});

export async function GET(request: Request) {
  const auth = await requireNotificationViewer(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    offset: url.searchParams.get("offset") ?? undefined,
    unreadOnly: url.searchParams.get("unreadOnly") ?? undefined,
  });

  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid query parameters",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const data = await listNotificationsForUser(auth.ctx.userId, {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      unreadOnly: parsed.data.unreadOnly,
    });
    return jsonOk(data);
  } catch {
    return jsonError("DATABASE_ERROR", "Could not load notifications", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireNotificationViewer(request);
  if (!auth.ok) return auth.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return jsonError("INVALID_JSON", "Request body must be JSON", 400);
  }

  const parsed = createBodySchema.safeParse(json);
  if (!parsed.success) {
    return jsonError(
      "VALIDATION_ERROR",
      "Invalid notification payload",
      422,
      parsed.error.flatten(),
    );
  }

  try {
    const row = await createNotificationForUser({
      userId: auth.ctx.userId,
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      ...(parsed.data.metadataJson !== undefined
        ? {
            metadataJson: parsed.data.metadataJson as Prisma.InputJsonValue,
          }
        : {}),
    });
    return jsonOk({ notification: row });
  } catch {
    return jsonError("DATABASE_ERROR", "Could not create notification", 500);
  }
}
