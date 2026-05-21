import {
  AiServiceRequestStatus,
  AiTechnicianComplaintStatus,
  AiTechnicianReviewVisibility,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function moduleReviewStatsForTechnicians(
  technicianProfileIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const map = new Map<string, { avg: number; count: number }>();
  if (technicianProfileIds.length === 0) return map;
  const rows = await prisma.aiTechnicianReview.groupBy({
    by: ["technicianProfileId"],
    where: {
      technicianProfileId: { in: technicianProfileIds },
      visibility: AiTechnicianReviewVisibility.VISIBLE,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const r of rows) {
    map.set(r.technicianProfileId, {
      avg: r._avg.rating ?? 0,
      count: r._count._all,
    });
  }
  return map;
}

export function mergeLegacyAndModuleRating(
  legacy: { avg: number; count: number } | undefined,
  module: { avg: number; count: number } | undefined,
): { avg: number | null; count: number } {
  const lc = legacy?.count ?? 0;
  const mc = module?.count ?? 0;
  const total = lc + mc;
  if (total === 0) return { avg: null, count: 0 };
  const sum =
    (legacy?.avg ?? 0) * lc + (module?.avg ?? 0) * mc;
  return { avg: sum / total, count: total };
}

export async function getTechnicianModuleReviewBundle(
  technicianProfileId: string,
) {
  const [agg, recent] = await Promise.all([
    prisma.aiTechnicianReview.aggregate({
      where: {
        technicianProfileId,
        visibility: AiTechnicianReviewVisibility.VISIBLE,
      },
      _avg: { rating: true },
      _count: { _all: true },
    }),
    prisma.aiTechnicianReview.findMany({
      where: {
        technicianProfileId,
        visibility: AiTechnicianReviewVisibility.VISIBLE,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    ratingAverage:
      agg._count._all > 0 ? agg._avg.rating ?? null : null,
    ratingCount: agg._count._all,
    recentReviews: recent.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export async function createAiTechnicianReviewForCustomer(params: {
  customerUserId: string;
  requestId: string;
  rating: number;
  comment?: string | null;
}) {
  const row = await prisma.aiServiceRequest.findFirst({
    where: {
      id: params.requestId,
      customerUserId: params.customerUserId,
      status: AiServiceRequestStatus.COMPLETED,
      technicianProfileId: { not: null },
    },
    select: { id: true, technicianProfileId: true },
  });
  if (!row?.technicianProfileId) {
    return { ok: "NOT_FOUND" as const };
  }

  const existing = await prisma.aiTechnicianReview.findUnique({
    where: { aiServiceRequestId: row.id },
  });
  if (existing) {
    return { ok: "ALREADY_REVIEWED" as const };
  }

  const created = await prisma.aiTechnicianReview.create({
    data: {
      aiServiceRequestId: row.id,
      technicianProfileId: row.technicianProfileId,
      customerUserId: params.customerUserId,
      rating: params.rating,
      comment: params.comment?.trim() || null,
      visibility: AiTechnicianReviewVisibility.VISIBLE,
    },
  });

  return {
    ok: true as const,
    review: {
      id: created.id,
      aiServiceRequestId: created.aiServiceRequestId,
      technicianProfileId: created.technicianProfileId,
      rating: created.rating,
      comment: created.comment,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function createAiTechnicianComplaintForCustomer(params: {
  customerUserId: string;
  requestId: string;
  category: string;
  message: string;
}) {
  const row = await prisma.aiServiceRequest.findFirst({
    where: {
      id: params.requestId,
      customerUserId: params.customerUserId,
    },
    select: { id: true, technicianProfileId: true },
  });
  if (!row) {
    return { ok: "NOT_FOUND" as const };
  }
  if (!row.technicianProfileId) {
    return { ok: "NO_TECHNICIAN" as const };
  }

  const created = await prisma.aiTechnicianComplaint.create({
    data: {
      aiServiceRequestId: row.id,
      technicianProfileId: row.technicianProfileId,
      customerUserId: params.customerUserId,
      category: params.category.trim(),
      message: params.message.trim(),
      status: AiTechnicianComplaintStatus.OPEN,
    },
  });

  return {
    ok: true as const,
    complaint: {
      id: created.id,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    },
  };
}

export async function adminListAiTechnicianComplaints(params: {
  status?: AiTechnicianComplaintStatus;
  limit: number;
  offset: number;
}) {
  const where: Prisma.AiTechnicianComplaintWhereInput = {};
  if (params.status) {
    where.status = params.status;
  }

  const [total, rows] = await Promise.all([
    prisma.aiTechnicianComplaint.count({ where }),
    prisma.aiTechnicianComplaint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: params.limit,
      skip: params.offset,
      include: {
        technicianProfile: { select: { id: true, displayName: true } },
      },
    }),
  ]);

  return {
    complaints: rows.map((c) => ({
      id: c.id,
      aiServiceRequestId: c.aiServiceRequestId,
      technicianProfileId: c.technicianProfileId,
      technicianDisplayName: c.technicianProfile.displayName?.trim() || null,
      customerUserId: c.customerUserId,
      category: c.category,
      message: c.message,
      status: c.status,
      adminNote: c.adminNote,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    pagination: {
      limit: params.limit,
      offset: params.offset,
      total,
      hasMore: params.offset + rows.length < total,
    },
  };
}

export async function adminUpdateAiTechnicianComplaintStatus(params: {
  id: string;
  status: AiTechnicianComplaintStatus;
  adminNote?: string | null;
}) {
  const row = await prisma.aiTechnicianComplaint.findUnique({
    where: { id: params.id },
  });
  if (!row) return { ok: "NOT_FOUND" as const };

  const updated = await prisma.aiTechnicianComplaint.update({
    where: { id: params.id },
    data: {
      status: params.status,
      adminNote:
        params.adminNote === undefined
          ? undefined
          : params.adminNote?.trim() || null,
    },
  });

  return {
    ok: true as const,
    complaint: {
      id: updated.id,
      status: updated.status,
      adminNote: updated.adminNote,
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}
