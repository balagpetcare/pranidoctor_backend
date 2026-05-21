import "server-only";

import { z } from "zod";

import {
  AiTechnicianServiceStatus,
  AuthAuditAction,
  Prisma,
  SemenTemplateApprovalStatus,
  ServiceInstancePublishAction,
  ServiceInstanceReviewDecision,
  ServiceInstanceReviewVisibility,
  ServiceInstanceStatus,
  UserRole,
} from "@/generated/prisma/client";
import {
  adminCan,
  type ServiceInstanceAdminCapability,
} from "@/lib/admin-auth/permissions";
import { AUTH_CHANNELS, recordAuthAuditFireAndForget } from "@/lib/auth-audit";
import type { AdminPanelActor } from "@/lib/admin-auth/panel-classify";
import { prisma } from "@/lib/prisma";

import { appendServiceInstanceAudit } from "./audit-service";
import {
  buildSemenServiceInstanceSchema,
  mergeTemplateAndPayloadValues,
} from "./semen-instance-schema";
import { validateServiceInstancePayloadJson } from "./payload-validation";
import type { ClientRequestMeta } from "./request-meta";

function recordAdminCapabilityDeny(
  actor: AdminPanelActor,
  capability: ServiceInstanceAdminCapability,
): void {
  recordAuthAuditFireAndForget({
    action: AuthAuditAction.PERMISSION_DENIED,
    channel: AUTH_CHANNELS.adminPanel,
    userId: actor.id,
    role: actor.role,
    metadata: { capability },
  });
}
import {
  assertStatusTransitionAllowed,
  roleLabelForLog,
} from "./workflow-engine";
import { getSignedDownloadUrlForUploadedFile } from "@/lib/storage/upload-download";
import type { PraniSchemaDocument } from "./semen-instance-schema.types";

export const listServiceInstancesQuerySchema = z.object({
  status: z.nativeEnum(ServiceInstanceStatus).optional(),
  statuses: z.string().max(200).optional(),
  q: z.string().trim().max(200).optional(),
  deploymentBranch: z.string().trim().max(120).optional(),
  tenantId: z.string().trim().max(64).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export const patchServiceInstanceStatusSchema = z.object({
  toStatus: z.nativeEnum(ServiceInstanceStatus),
  reason: z.string().trim().max(4000).optional(),
});

export const patchServiceInstancePublishSchema = z.object({
  action: z.enum(["PUBLISH", "UNPUBLISH", "ROLLBACK"]),
});

export const patchServiceInstanceReviewSchema = z.object({
  decision: z.nativeEnum(ServiceInstanceReviewDecision),
  body: z.string().trim().min(1).max(8000),
  visibility: z.nativeEnum(ServiceInstanceReviewVisibility).optional(),
});

const templateInclude = {
  semenProvider: true,
  breedMixes: { include: { breed: true } },
} satisfies Prisma.SemenServiceTemplateInclude;

export type ServiceInstanceDetailTemplate = Prisma.SemenServiceTemplateGetPayload<{
  include: typeof templateInclude;
}>;

const instanceDetailInclude = {
  semenServiceTemplate: { include: templateInclude },
  aiTechnicianProfile: {
    include: {
      user: { select: { email: true, phone: true } },
    },
  },
  media: {
    where: { deletedAt: null },
    orderBy: { sortOrder: "asc" as const },
  },
  statusLogs: { orderBy: { createdAt: "desc" as const }, take: 200 },
  reviews: { orderBy: { createdAt: "desc" as const }, take: 100 },
  publishLogs: { orderBy: { createdAt: "desc" as const }, take: 50 },
  auditEvents: { orderBy: { createdAt: "desc" as const }, take: 200 },
} satisfies Prisma.ServiceInstanceInclude;

export type ServiceInstanceDetailRow = Prisma.ServiceInstanceGetPayload<{
  include: typeof instanceDetailInclude;
}>;

function branchWhere(
  deploymentBranch: string | undefined,
): Prisma.StringNullableFilter | string | undefined {
  const b = deploymentBranch?.trim() || "main";
  return { equals: b };
}

export async function adminListServiceInstances(
  actor: AdminPanelActor,
  raw: z.infer<typeof listServiceInstancesQuerySchema>,
) {
  if (!adminCan(actor, "serviceInstance.view")) {
    recordAdminCapabilityDeny(actor, "serviceInstance.view");
    return { ok: "FORBIDDEN" as const };
  }

  const where: Prisma.ServiceInstanceWhereInput = {
    deletedAt: null,
    deploymentBranch: branchWhere(raw.deploymentBranch) as Prisma.StringNullableFilter,
  };
  if (raw.tenantId) {
    where.tenantId = raw.tenantId;
  }
  if (raw.status) {
    where.status = raw.status;
  } else if (raw.statuses?.trim()) {
    const parts = raw.statuses
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = parts.filter((p) =>
      Object.values(ServiceInstanceStatus).includes(p as ServiceInstanceStatus),
    ) as ServiceInstanceStatus[];
    if (parsed.length) {
      where.status = { in: parsed };
    }
  }
  const q = raw.q?.trim();
  if (q) {
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      {
        aiTechnicianProfile: {
          displayName: { contains: q, mode: "insensitive" },
        },
      },
      {
        semenServiceTemplate: {
          internalName: { contains: q, mode: "insensitive" },
        },
      },
      {
        aiTechnicianProfile: {
          user: { email: { contains: q, mode: "insensitive" } },
        },
      },
    ];
  }

  const take = raw.limit ?? 30;
  const cursor = raw.cursor
    ? await prisma.serviceInstance.findUnique({
        where: { id: raw.cursor },
        select: { id: true, updatedAt: true },
      })
    : null;

  const rows = await prisma.serviceInstance.findMany({
    where,
    take: take + 1,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    ...(cursor
      ? {
          skip: 1,
          cursor: { id: cursor.id },
        }
      : {}),
    include: {
      semenServiceTemplate: { select: { id: true, internalName: true } },
      aiTechnicianProfile: {
        select: { id: true, displayName: true, userId: true },
      },
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
      deploymentBranch: r.deploymentBranch,
      updatedAt: r.updatedAt.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      template: r.semenServiceTemplate,
      technician: r.aiTechnicianProfile,
    })),
    nextCursor,
  };
}

export async function adminGetServiceInstanceDetail(
  actor: AdminPanelActor,
  id: string,
  deploymentBranch?: string,
): Promise<
  | { ok: "FORBIDDEN" }
  | { ok: "NOT_FOUND" }
  | { ok: true; instance: ServiceInstanceDetailRow; schema: PraniSchemaDocument; mergedValues: Record<string, unknown>; mediaPreviews: { id: string; kind: string; signedUrl: string | null }[] }
> {
  if (!adminCan(actor, "serviceInstance.view")) {
    recordAdminCapabilityDeny(actor, "serviceInstance.view");
    return { ok: "FORBIDDEN" };
  }

  const branch = deploymentBranch?.trim() || "main";
  const row = await prisma.serviceInstance.findFirst({
    where: {
      id,
      deletedAt: null,
      deploymentBranch: { equals: branch },
    },
    include: instanceDetailInclude,
  });
  if (!row) return { ok: "NOT_FOUND" };

  const schema = buildSemenServiceInstanceSchema(row.semenServiceTemplate);
  const mergedValues = mergeTemplateAndPayloadValues(
    row.semenServiceTemplate,
    row.payloadJson,
  );

  const mediaPreviews: { id: string; kind: string; signedUrl: string | null }[] =
    [];
  for (const m of row.media) {
    let signedUrl: string | null = null;
    if (m.uploadedFileId) {
      const s = await getSignedDownloadUrlForUploadedFile(m.uploadedFileId);
      signedUrl = s !== "NOT_FOUND" && s !== "NOT_CONFIGURED" ? s.url : null;
    }
    mediaPreviews.push({
      id: m.id,
      kind: m.kind,
      signedUrl,
    });
  }

  return { ok: true, instance: row, schema, mergedValues, mediaPreviews };
}

export async function adminPatchServiceInstanceStatus(
  actor: AdminPanelActor,
  id: string,
  body: z.infer<typeof patchServiceInstanceStatusSchema>,
  meta: ClientRequestMeta,
  deploymentBranch?: string,
) {
  if (!adminCan(actor, "serviceInstance.review")) {
    recordAdminCapabilityDeny(actor, "serviceInstance.review");
    return { ok: "FORBIDDEN" as const };
  }

  const branch = deploymentBranch?.trim() || "main";
  const row = await prisma.serviceInstance.findFirst({
    where: { id, deletedAt: null, deploymentBranch: { equals: branch } },
  });
  if (!row) return { ok: "NOT_FOUND" as const };

  const check = assertStatusTransitionAllowed({
    from: row.status,
    to: body.toStatus,
    actor: "admin",
  });
  if (!check.ok) {
    return {
      ok: "INVALID_TRANSITION" as const,
      message: check.message,
      code: check.code,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceInstance.update({
      where: { id },
      data: {
        status: body.toStatus,
        version: { increment: 1 },
        lastReviewedById: actor.id,
        correctionNote:
          body.toStatus === ServiceInstanceStatus.NEEDS_CORRECTION
            ? body.reason ?? null
            : row.correctionNote,
      },
    });
    await tx.serviceInstanceStatusLog.create({
      data: {
        serviceInstanceId: id,
        fromStatus: row.status,
        toStatus: body.toStatus,
        actorUserId: actor.id,
        actorRole: roleLabelForLog(actor.role),
        reason: body.reason ?? null,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    await tx.serviceInstanceAuditEvent.create({
      data: {
        serviceInstanceId: id,
        action: "STATUS_CHANGE",
        actorUserId: actor.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        detailsJson: { from: row.status, to: body.toStatus },
      },
    });
  });

  const fresh = await prisma.serviceInstance.findUniqueOrThrow({
    where: { id },
    include: instanceDetailInclude,
  });
  return { ok: true as const, instance: fresh };
}

export async function adminPatchServiceInstanceReview(
  actor: AdminPanelActor,
  id: string,
  body: z.infer<typeof patchServiceInstanceReviewSchema>,
  meta: ClientRequestMeta,
  deploymentBranch?: string,
) {
  if (!adminCan(actor, "serviceInstance.review")) {
    recordAdminCapabilityDeny(actor, "serviceInstance.review");
    return { ok: "FORBIDDEN" as const };
  }

  const branch = deploymentBranch?.trim() || "main";
  const row = await prisma.serviceInstance.findFirst({
    where: { id, deletedAt: null, deploymentBranch: { equals: branch } },
  });
  if (!row) return { ok: "NOT_FOUND" as const };

  let nextStatus = row.status;
  if (
    body.decision === ServiceInstanceReviewDecision.APPROVE &&
    row.status === ServiceInstanceStatus.UNDER_REVIEW
  ) {
    nextStatus = ServiceInstanceStatus.APPROVED;
  } else if (
    body.decision === ServiceInstanceReviewDecision.REJECT &&
    row.status === ServiceInstanceStatus.UNDER_REVIEW
  ) {
    nextStatus = ServiceInstanceStatus.REJECTED;
  } else if (
    body.decision === ServiceInstanceReviewDecision.REQUEST_CORRECTION &&
    row.status === ServiceInstanceStatus.UNDER_REVIEW
  ) {
    nextStatus = ServiceInstanceStatus.NEEDS_CORRECTION;
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceInstanceReview.create({
      data: {
        serviceInstanceId: id,
        reviewerUserId: actor.id,
        decision: body.decision,
        body: body.body,
        visibility: body.visibility ?? ServiceInstanceReviewVisibility.WORKER_VISIBLE,
      },
    });

    if (nextStatus !== row.status) {
      await tx.serviceInstance.update({
        where: { id },
        data: {
          status: nextStatus,
          version: { increment: 1 },
          lastReviewedById: actor.id,
        },
      });
      await tx.serviceInstanceStatusLog.create({
        data: {
          serviceInstanceId: id,
          fromStatus: row.status,
          toStatus: nextStatus,
          actorUserId: actor.id,
          actorRole: roleLabelForLog(actor.role),
          reason: body.body.slice(0, 2000),
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
        },
      });
    }
  });

  const auditAction =
    body.decision === ServiceInstanceReviewDecision.APPROVE
      ? ("APPROVE" as const)
      : body.decision === ServiceInstanceReviewDecision.REJECT
        ? ("REJECT" as const)
        : ("REVIEW" as const);

  await appendServiceInstanceAudit({
    serviceInstanceId: id,
    action: auditAction,
    actorUserId: actor.id,
    meta,
    details: { decision: body.decision },
  });

  const fresh = await prisma.serviceInstance.findUniqueOrThrow({
    where: { id },
    include: instanceDetailInclude,
  });
  return { ok: true as const, instance: fresh };
}

function toDecimal(v: number | string): Prisma.Decimal {
  const s = typeof v === "number" ? String(v) : v.trim();
  return new Prisma.Decimal(s);
}

function buildBreedCompositionLabel(
  mixes: { percentage: Prisma.Decimal; breed: { nameEn: string } }[],
): string {
  return mixes
    .map((m) => `${m.percentage.toString()}% ${m.breed.nameEn}`)
    .join(" + ");
}

export async function adminPatchServiceInstancePublish(
  actor: AdminPanelActor,
  id: string,
  body: z.infer<typeof patchServiceInstancePublishSchema>,
  meta: ClientRequestMeta,
  deploymentBranch?: string,
) {
  if (!adminCan(actor, "serviceInstance.publish")) {
    recordAdminCapabilityDeny(actor, "serviceInstance.publish");
    return { ok: "FORBIDDEN" as const };
  }
  if (actor.role !== UserRole.SUPER_ADMIN) {
    return { ok: "FORBIDDEN_ROLE" as const };
  }

  const branch = deploymentBranch?.trim() || "main";
  const row = await prisma.serviceInstance.findFirst({
    where: { id, deletedAt: null, deploymentBranch: { equals: branch } },
    include: {
      semenServiceTemplate: { include: templateInclude },
      aiTechnicianProfile: true,
    },
  });
  if (!row) return { ok: "NOT_FOUND" as const };

  const template = row.semenServiceTemplate;
  if (template.approvalStatus !== SemenTemplateApprovalStatus.APPROVED) {
    return { ok: "TEMPLATE_NOT_APPROVED" as const };
  }

  const payload = row.payloadJson as Record<string, unknown>;
  const validation = validateServiceInstancePayloadJson(payload);
  if (!validation.ok) {
    return { ok: "VALIDATION" as const, issues: validation.issues };
  }

  if (body.action === "PUBLISH") {
    if (row.status !== ServiceInstanceStatus.APPROVED) {
      return { ok: "INVALID_STATE" as const, message: "শুধুমাত্র অনুমোদিত খসড়া প্রকাশ করা যাবে" };
    }

    const basePriceRaw = payload.basePrice;
    const basePrice =
      basePriceRaw != null && String(basePriceRaw).trim() !== ""
        ? toDecimal(basePriceRaw as string | number)
        : template.defaultBasePrice;

    const offerPrice =
      payload.offerPrice != null && String(payload.offerPrice).trim() !== ""
        ? toDecimal(payload.offerPrice as string | number)
        : template.defaultOfferPrice;

    const discountPercent =
      payload.discountPercent != null &&
      String(payload.discountPercent).trim() !== ""
        ? toDecimal(payload.discountPercent as string | number)
        : template.defaultDiscountPercent;

    const breedLabel = buildBreedCompositionLabel(template.breedMixes);

    try {
      await prisma.$transaction(async (tx) => {
        const prevId = row.publishedAiTechnicianServiceId;
        let serviceId = prevId;

        const existing = await tx.aiTechnicianService.findFirst({
          where: {
            aiTechnicianId: row.aiTechnicianProfileId,
            semenServiceTemplateId: template.id,
          },
        });

        if (existing) {
          await tx.aiTechnicianService.update({
            where: { id: existing.id },
            data: {
              title: template.internalName.trim(),
              animalType: template.animalType,
              breedOrSemenType: breedLabel,
              description: template.shortDescription?.trim() || null,
              basePrice,
              visitFee:
                payload.visitFee == null || String(payload.visitFee).trim() === ""
                  ? null
                  : toDecimal(payload.visitFee as string | number),
              emergencyFee:
                payload.emergencyFee == null ||
                String(payload.emergencyFee).trim() === ""
                  ? null
                  : toDecimal(payload.emergencyFee as string | number),
              status: AiTechnicianServiceStatus.ACTIVE,
              offerPrice: offerPrice ?? null,
              discountPercent: discountPercent ?? null,
              isAvailable:
                typeof payload.isAvailable === "boolean" ? payload.isAvailable : true,
              technicianServiceNote:
                typeof payload.technicianServiceNote === "string"
                  ? payload.technicianServiceNote.trim() || null
                  : null,
            },
          });
          serviceId = existing.id;
        } else {
          const created = await tx.aiTechnicianService.create({
            data: {
              aiTechnicianId: row.aiTechnicianProfileId,
              title: template.internalName.trim(),
              animalType: template.animalType,
              breedOrSemenType: breedLabel,
              description: template.shortDescription?.trim() || null,
              basePrice,
              visitFee:
                payload.visitFee == null || String(payload.visitFee).trim() === ""
                  ? null
                  : toDecimal(payload.visitFee as string | number),
              emergencyFee:
                payload.emergencyFee == null ||
                String(payload.emergencyFee).trim() === ""
                  ? null
                  : toDecimal(payload.emergencyFee as string | number),
              repeatServicePolicy: null,
              followUpIncluded: false,
              status: AiTechnicianServiceStatus.ACTIVE,
              semenServiceTemplateId: template.id,
              offerPrice: offerPrice ?? null,
              discountPercent: discountPercent ?? null,
              isAvailable:
                typeof payload.isAvailable === "boolean" ? payload.isAvailable : true,
              technicianServiceNote:
                typeof payload.technicianServiceNote === "string"
                  ? payload.technicianServiceNote.trim() || null
                  : null,
            },
          });
          serviceId = created.id;
        }

        const lot = payload.initialInventoryLot as
          | {
              currentQuantity?: number;
              reservedQuantity?: number;
              usedQuantity?: number;
              minStockAlert?: number | null;
              batchNumber?: string | null;
              expiryDate?: string | null;
              sourceNote?: string | null;
              storageNote?: string | null;
            }
          | undefined;

        if (lot && typeof lot.currentQuantity === "number" && lot.currentQuantity >= 0) {
          const existingLots = await tx.technicianSemenInventory.count({
            where: { aiTechnicianServiceId: serviceId! },
          });
          if (existingLots === 0) {
            await tx.technicianSemenInventory.create({
              data: {
                aiTechnicianServiceId: serviceId!,
                currentQuantity: lot.currentQuantity,
                reservedQuantity: lot.reservedQuantity ?? 0,
                usedQuantity: lot.usedQuantity ?? 0,
                minStockAlert: lot.minStockAlert ?? null,
                batchNumber: lot.batchNumber?.trim() || null,
                expiryDate: lot.expiryDate ? new Date(lot.expiryDate) : null,
                sourceNote: lot.sourceNote?.trim() || null,
                storageNote: lot.storageNote?.trim() || null,
                isActive: true,
              },
            });
          }
        }

        await tx.serviceInstance.update({
          where: { id },
          data: {
            status: ServiceInstanceStatus.PUBLISHED,
            publishedAt: new Date(),
            publishedAiTechnicianServiceId: serviceId,
            version: { increment: 1 },
          },
        });

        await tx.serviceInstancePublishLog.create({
          data: {
            serviceInstanceId: id,
            action: ServiceInstancePublishAction.PUBLISH,
            actorUserId: actor.id,
            previousPublishedServiceId: prevId,
            newPublishedServiceId: serviceId,
            payloadSnapshotJson: row.payloadJson as Prisma.InputJsonValue,
          },
        });

        await tx.serviceInstanceAuditEvent.create({
          data: {
            serviceInstanceId: id,
            action: "PUBLISH",
            actorUserId: actor.id,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
            detailsJson: { serviceId },
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: "DUPLICATE_LISTING" as const };
      }
      throw e;
    }

    const fresh = await prisma.serviceInstance.findUniqueOrThrow({
      where: { id },
      include: instanceDetailInclude,
    });
    return { ok: true as const, instance: fresh };
  }

  if (body.action === "ROLLBACK") {
    if (row.status !== ServiceInstanceStatus.PUBLISHED) {
      return { ok: "INVALID_STATE" as const, message: "প্রকাশিত নয়" };
    }
    const prevSvc = row.publishedAiTechnicianServiceId;
    await prisma.$transaction(async (tx) => {
      if (prevSvc) {
        await tx.aiTechnicianService.update({
          where: { id: prevSvc },
          data: {
            status: AiTechnicianServiceStatus.INACTIVE,
            isAvailable: false,
          },
        });
      }
      await tx.serviceInstance.update({
        where: { id },
        data: {
          status: ServiceInstanceStatus.APPROVED,
          publishedAt: null,
          publishedAiTechnicianServiceId: null,
          version: { increment: 1 },
        },
      });
      await tx.serviceInstancePublishLog.create({
        data: {
          serviceInstanceId: id,
          action: ServiceInstancePublishAction.ROLLBACK,
          actorUserId: actor.id,
          previousPublishedServiceId: prevSvc,
          newPublishedServiceId: null,
        },
      });
    });
    await appendServiceInstanceAudit({
      serviceInstanceId: id,
      action: "ROLLBACK",
      actorUserId: actor.id,
      meta,
      details: {},
    });
    const fresh = await prisma.serviceInstance.findUniqueOrThrow({
      where: { id },
      include: instanceDetailInclude,
    });
    return { ok: true as const, instance: fresh };
  }

  // UNPUBLISH
  if (row.status !== ServiceInstanceStatus.PUBLISHED) {
    return { ok: "INVALID_STATE" as const, message: "প্রকাশিত নয়" };
  }
  const prevSvc = row.publishedAiTechnicianServiceId;
  await prisma.$transaction(async (tx) => {
    if (prevSvc) {
      await tx.aiTechnicianService.update({
        where: { id: prevSvc },
        data: { status: AiTechnicianServiceStatus.INACTIVE, isAvailable: false },
      });
    }
    await tx.serviceInstance.update({
      where: { id },
      data: {
        status: ServiceInstanceStatus.ARCHIVED,
        archivedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.serviceInstancePublishLog.create({
      data: {
        serviceInstanceId: id,
        action: ServiceInstancePublishAction.UNPUBLISH,
        actorUserId: actor.id,
        previousPublishedServiceId: prevSvc,
        newPublishedServiceId: null,
      },
    });
  });
  await appendServiceInstanceAudit({
    serviceInstanceId: id,
    action: "ARCHIVE",
    actorUserId: actor.id,
    meta,
    details: { via: "unpublish" },
  });
  const fresh = await prisma.serviceInstance.findUniqueOrThrow({
    where: { id },
    include: instanceDetailInclude,
  });
  return { ok: true as const, instance: fresh };
}
