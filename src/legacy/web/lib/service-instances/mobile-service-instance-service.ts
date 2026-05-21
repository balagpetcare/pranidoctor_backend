import "server-only";

import { z } from "zod";

import {
  Prisma,
  SemenTemplateApprovalStatus,
  ServiceInstanceMediaKind,
  ServiceInstanceReviewVisibility,
  ServiceInstanceStatus,
  UploadedFileStatus,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import { appendServiceInstanceAudit } from "./audit-service";
import { computeServiceInstancePayloadFingerprint } from "./fingerprint";
import {
  buildSemenServiceInstanceSchema,
  mergeTemplateAndPayloadValues,
} from "./semen-instance-schema";
import { assertMimeAllowedForInstanceMediaKind } from "./media-validation";
import { validateServiceInstancePayloadJson } from "./payload-validation";
import type { ClientRequestMeta } from "./request-meta";
import {
  assertStatusTransitionAllowed,
  roleLabelForLog,
} from "./workflow-engine";
import { getSignedDownloadUrlForUploadedFile } from "@/lib/storage/upload-download";

export const createServiceInstanceBodySchema = z.object({
  semenServiceTemplateId: z.string().trim().min(1),
  deploymentBranch: z.string().trim().max(120).optional(),
  tenantId: z.string().trim().max(64).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const patchServiceInstanceBodySchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  media: z
    .array(
      z.object({
        id: z.string().optional(),
        kind: z.nativeEnum(ServiceInstanceMediaKind),
        uploadedFileId: z.string().optional(),
        externalUrl: z.string().url().optional().nullable(),
        sortOrder: z.number().int().optional(),
      }),
    )
    .max(24)
    .optional(),
  expectedVersion: z.number().int().optional(),
});

export const listMyServiceInstancesQuerySchema = z.object({
  status: z.nativeEnum(ServiceInstanceStatus).optional(),
  deploymentBranch: z.string().trim().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const templateInclude = {
  semenProvider: true,
  breedMixes: { include: { breed: true } },
} satisfies Prisma.SemenServiceTemplateInclude;

const mobileDetailInclude = {
  semenServiceTemplate: { include: templateInclude },
  media: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" as const },
  },
  statusLogs: { orderBy: { createdAt: "desc" as const }, take: 100 },
  reviews: {
    where: {
      visibility: ServiceInstanceReviewVisibility.WORKER_VISIBLE,
    },
    orderBy: { createdAt: "desc" as const },
    take: 50,
  },
} satisfies Prisma.ServiceInstanceInclude;

export async function mobileCreateServiceInstance(
  userId: string,
  technicianProfileId: string,
  body: z.infer<typeof createServiceInstanceBodySchema>,
  meta: ClientRequestMeta,
) {
  const template = await prisma.semenServiceTemplate.findFirst({
    where: {
      id: body.semenServiceTemplateId,
      isActive: true,
      approvalStatus: SemenTemplateApprovalStatus.APPROVED,
    },
    include: templateInclude,
  });
  if (!template) return { ok: "TEMPLATE_NOT_FOUND" as const };

  const branch = body.deploymentBranch?.trim() || "main";
  const initialPayload = (body.payload ?? {}) as Record<string, unknown>;
  const fingerprint = computeServiceInstancePayloadFingerprint({
    semenServiceTemplateId: template.id,
    aiTechnicianProfileId: technicianProfileId,
    deploymentBranch: branch,
    payload: initialPayload,
  });

  const created = await prisma.serviceInstance.create({
    data: {
      semenServiceTemplateId: template.id,
      aiTechnicianProfileId: technicianProfileId,
      status: ServiceInstanceStatus.DRAFT,
      payloadJson: initialPayload as Prisma.InputJsonValue,
      deploymentBranch: branch,
      tenantId: body.tenantId?.trim() || null,
      payloadFingerprint: fingerprint,
    },
  });

  await appendServiceInstanceAudit({
    serviceInstanceId: created.id,
    action: "CREATE",
    actorUserId: userId,
    meta,
    details: { templateId: template.id },
  });

  return { ok: true as const, id: created.id };
}

export async function mobilePatchServiceInstance(
  userId: string,
  technicianProfileId: string,
  id: string,
  body: z.infer<typeof patchServiceInstanceBodySchema>,
  meta: ClientRequestMeta,
) {
  const row = await prisma.serviceInstance.findFirst({
    where: {
      id,
      aiTechnicianProfileId: technicianProfileId,
      deletedAt: null,
    },
  });
  if (!row) return { ok: "NOT_FOUND" as const };
  if (
    row.status !== ServiceInstanceStatus.DRAFT &&
    row.status !== ServiceInstanceStatus.NEEDS_CORRECTION
  ) {
    return { ok: "NOT_EDITABLE" as const, status: row.status };
  }

  if (
    body.expectedVersion !== undefined &&
    body.expectedVersion !== row.version
  ) {
    return { ok: "VERSION_CONFLICT" as const };
  }

  const nextPayload = {
    ...(typeof row.payloadJson === "object" && row.payloadJson
      ? (row.payloadJson as Record<string, unknown>)
      : {}),
    ...(body.payload ?? {}),
  };

  if (body.media?.length) {
    for (const line of body.media) {
      if (line.uploadedFileId) {
        const file = await prisma.uploadedFile.findFirst({
          where: {
            id: line.uploadedFileId,
            ownerUserId: userId,
            status: UploadedFileStatus.ACTIVE,
          },
        });
        if (!file) {
          return { ok: "INVALID_MEDIA" as const, message: "ফাইল মালিকানা যাচাই ব্যর্থ" };
        }
        const mimeOk = assertMimeAllowedForInstanceMediaKind(line.kind, file.mimeType);
        if (!mimeOk.ok) {
          return { ok: "INVALID_MEDIA" as const, message: mimeOk.message };
        }
      }
    }
  }

  const fingerprint = computeServiceInstancePayloadFingerprint({
    semenServiceTemplateId: row.semenServiceTemplateId,
    aiTechnicianProfileId: technicianProfileId,
    deploymentBranch: row.deploymentBranch,
    payload: nextPayload,
  });

  await prisma.$transaction(async (tx) => {
    await tx.serviceInstance.update({
      where: { id },
      data: {
        payloadJson: nextPayload as Prisma.InputJsonValue,
        payloadFingerprint: fingerprint,
        version: { increment: 1 },
      },
    });

    if (body.media?.length) {
      await tx.serviceInstanceMedia.deleteMany({ where: { serviceInstanceId: id } });
      let order = 0;
      for (const line of body.media) {
        await tx.serviceInstanceMedia.create({
          data: {
            serviceInstanceId: id,
            kind: line.kind,
            uploadedFileId: line.uploadedFileId ?? null,
            externalUrl: line.externalUrl ?? null,
            sortOrder: line.sortOrder ?? order++,
          },
        });
      }
    }
  });

  await appendServiceInstanceAudit({
    serviceInstanceId: id,
    action: "EDIT",
    actorUserId: userId,
    meta,
    details: { hasMedia: !!body.media?.length },
  });

  const fresh = await prisma.serviceInstance.findUniqueOrThrow({
    where: { id },
    include: mobileDetailInclude,
  });
  return { ok: true as const, instance: fresh };
}

export async function mobileListServiceInstances(
  userId: string,
  technicianProfileId: string,
  raw: z.infer<typeof listMyServiceInstancesQuerySchema>,
) {
  void userId;
  const branch = raw.deploymentBranch?.trim() || "main";
  const where: Prisma.ServiceInstanceWhereInput = {
    aiTechnicianProfileId: technicianProfileId,
    deletedAt: null,
    deploymentBranch: { equals: branch },
  };
  if (raw.status) where.status = raw.status;

  const take = raw.limit ?? 30;
  const rows = await prisma.serviceInstance.findMany({
    where,
    take: take + 1,
    orderBy: [{ updatedAt: "desc" }],
    ...(raw.cursor
      ? {
          skip: 1,
          cursor: { id: raw.cursor },
        }
      : {}),
    include: {
      semenServiceTemplate: { select: { id: true, internalName: true } },
    },
  });

  let nextCursor: string | null = null;
  const page = rows.length > take ? rows.slice(0, take) : rows;
  if (rows.length > take) {
    nextCursor = page[page.length - 1]?.id ?? null;
  }

  return {
    ok: true as const,
    items: page.map((r) => ({
      id: r.id,
      status: r.status,
      version: r.version,
      updatedAt: r.updatedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      template: r.semenServiceTemplate,
    })),
    nextCursor,
  };
}

export async function mobileGetServiceInstanceDetail(
  userId: string,
  technicianProfileId: string,
  id: string,
) {
  void userId;
  const row = await prisma.serviceInstance.findFirst({
    where: { id, aiTechnicianProfileId: technicianProfileId, deletedAt: null },
    include: mobileDetailInclude,
  });
  if (!row) return { ok: "NOT_FOUND" as const };

  const schema = buildSemenServiceInstanceSchema(row.semenServiceTemplate);
  const mergedValues = mergeTemplateAndPayloadValues(
    row.semenServiceTemplate,
    row.payloadJson,
  );

  const media: { id: string; kind: string; signedUrl: string | null }[] = [];
  for (const m of row.media) {
    let signedUrl: string | null = null;
    if (m.uploadedFileId) {
      const s = await getSignedDownloadUrlForUploadedFile(m.uploadedFileId);
      signedUrl = s !== "NOT_FOUND" && s !== "NOT_CONFIGURED" ? s.url : null;
    }
    media.push({ id: m.id, kind: m.kind, signedUrl });
  }

  return {
    ok: true as const,
    instance: row,
    schema,
    mergedValues,
    media,
  };
}

export async function mobileSubmitServiceInstance(
  userId: string,
  technicianProfileId: string,
  id: string,
  meta: ClientRequestMeta,
) {
  const row = await prisma.serviceInstance.findFirst({
    where: { id, aiTechnicianProfileId: technicianProfileId, deletedAt: null },
    include: { semenServiceTemplate: { include: templateInclude } },
  });
  if (!row) return { ok: "NOT_FOUND" as const };
  if (
    row.status !== ServiceInstanceStatus.DRAFT &&
    row.status !== ServiceInstanceStatus.NEEDS_CORRECTION
  ) {
    return { ok: "NOT_SUBMITTABLE" as const, status: row.status };
  }

  if (!row.semenServiceTemplate.isActive) {
    return { ok: "TEMPLATE_INACTIVE" as const };
  }

  const validation = validateServiceInstancePayloadJson(row.payloadJson);
  const validationResult = validation.ok
    ? { ok: true }
    : { ok: false, issues: validation.issues };

  if (!validation.ok) {
    return {
      ok: "VALIDATION" as const,
      issues: validation.issues,
    };
  }

  const check = assertStatusTransitionAllowed({
    from: row.status,
    to: ServiceInstanceStatus.SUBMITTED,
    actor: "worker",
  });
  if (!check.ok) {
    return { ok: "INVALID_TRANSITION" as const, message: check.message };
  }

  const mergedSnapshot = mergeTemplateAndPayloadValues(
    row.semenServiceTemplate,
    row.payloadJson,
  );

  const dup = await prisma.serviceInstance.findFirst({
    where: {
      id: { not: id },
      aiTechnicianProfileId: technicianProfileId,
      semenServiceTemplateId: row.semenServiceTemplateId,
      payloadFingerprint: row.payloadFingerprint,
      deletedAt: null,
      status: {
        notIn: [
          ServiceInstanceStatus.REJECTED,
          ServiceInstanceStatus.ARCHIVED,
        ],
      },
    },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.serviceInstance.update({
      where: { id },
      data: {
        status: ServiceInstanceStatus.SUBMITTED,
        submittedAt: new Date(),
        lockedSnapshotJson: mergedSnapshot as Prisma.InputJsonValue,
        validationResultJson: validationResult as unknown as Prisma.InputJsonValue,
        duplicateOfId: dup?.id ?? null,
        version: { increment: 1 },
      },
    });
    await tx.serviceInstanceStatusLog.create({
      data: {
        serviceInstanceId: id,
        fromStatus: row.status,
        toStatus: ServiceInstanceStatus.SUBMITTED,
        actorUserId: userId,
        actorRole: roleLabelForLog(UserRole.AI_TECHNICIAN),
        reason: dup ? `সম্ভাব্য ডুপ্লিকেট: ${dup.id}` : null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
  });

  await appendServiceInstanceAudit({
    serviceInstanceId: id,
    action: "SUBMIT",
    actorUserId: userId,
    meta,
    details: { duplicateOfId: dup?.id ?? null },
  });

  const fresh = await prisma.serviceInstance.findUniqueOrThrow({
    where: { id },
    include: mobileDetailInclude,
  });
  return { ok: true as const, instance: fresh, duplicateWarning: dup?.id ?? null };
}
