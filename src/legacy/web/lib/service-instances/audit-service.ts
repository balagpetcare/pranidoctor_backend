import "server-only";

import type { ServiceInstanceAuditAction } from "@/generated/prisma/client";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { ClientRequestMeta } from "./request-meta";

export async function appendServiceInstanceAudit(params: {
  serviceInstanceId: string;
  action: ServiceInstanceAuditAction;
  actorUserId: string | null;
  meta: ClientRequestMeta;
  details?: unknown;
}) {
  await prisma.serviceInstanceAuditEvent.create({
    data: {
      serviceInstanceId: params.serviceInstanceId,
      action: params.action,
      actorUserId: params.actorUserId,
      ipAddress: params.meta.ipAddress,
      userAgent: params.meta.userAgent,
      detailsJson:
        params.details === undefined
          ? Prisma.JsonNull
          : (params.details as Prisma.InputJsonValue),
    },
  });
}
