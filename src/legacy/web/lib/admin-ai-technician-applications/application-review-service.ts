import type { z } from "zod";

import {
  AiTechnicianStatus,
  Prisma,
  ProviderStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import type { TechnicianDetailPayload } from "@/lib/admin-ai-technicians/technician-admin-service";
import {
  serializeTechnicianDetail,
  technicianDetailInclude,
} from "@/lib/admin-ai-technicians/technician-admin-service";
import { prisma } from "@/lib/prisma";

import type { ApplicationTransitionBody } from "./schemas";
import { listTechnicianApplicationsQuerySchema } from "./schemas";

const technicianApplicationDetailInclude = {
  ...technicianDetailInclude,
  documents: {
    orderBy: { createdAt: "asc" as const },
    include: {
      uploadedFile: {
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          sizeBytes: true,
          width: true,
          height: true,
          fileCategory: true,
          createdAt: true,
        },
      },
    },
  },
  divisionCoverageAreas: {
    orderBy: { createdAt: "asc" as const },
  },
  reviewedBy: {
    select: {
      id: true,
      email: true,
      adminProfile: { select: { displayName: true } },
    },
  },
} satisfies Prisma.AiTechnicianProfileInclude;

export type TechnicianApplicationDetailPayload =
  Prisma.AiTechnicianProfileGetPayload<{
    include: typeof technicianApplicationDetailInclude;
  }>;

export function serializeApplicationListRow(
  row: Prisma.AiTechnicianProfileGetPayload<{
    include: {
      user: { select: { email: true; phone: true; status: true; role: true } };
    };
  }>,
) {
  return {
    id: row.id,
    displayName: row.displayName,
    applicationStatus: row.status,
    providerStatus: row.providerStatus,
    district: row.district,
    upazila: row.upazila,
    user: row.user,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function adminListTechnicianApplications(
  raw: z.infer<typeof listTechnicianApplicationsQuerySchema>,
) {
  const q = raw.q?.trim();
  const where: Prisma.AiTechnicianProfileWhereInput = {
    status: { not: AiTechnicianStatus.DRAFT },
  };

  if (raw.applicationStatus) {
    where.status = raw.applicationStatus;
  }

  const filters: Prisma.AiTechnicianProfileWhereInput[] = [];

  if (q) {
    filters.push({
      OR: [
        { displayName: { contains: q, mode: "insensitive" } },
        { district: { contains: q, mode: "insensitive" } },
        { upazila: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        { user: { phone: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (filters.length > 0) {
    where.AND = filters;
  }

  const limit = raw.limit ?? 50;
  const offset = raw.offset ?? 0;

  const [total, rows] = await prisma.$transaction([
    prisma.aiTechnicianProfile.count({ where }),
    prisma.aiTechnicianProfile.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            status: true,
            role: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    applications: rows.map(serializeApplicationListRow),
    meta: { total, limit, offset },
  };
}

export async function adminGetTechnicianApplicationById(
  id: string,
): Promise<TechnicianApplicationDetailPayload | null> {
  return prisma.aiTechnicianProfile.findUnique({
    where: { id },
    include: technicianApplicationDetailInclude,
  });
}

export function serializeTechnicianApplicationDetail(
  row: TechnicianApplicationDetailPayload,
) {
  const {
    documents: _documents,
    divisionCoverageAreas: _divisionCoverageAreas,
    reviewedBy: _reviewedBy,
    ...restForDetail
  } = row;
  void _documents;
  void _divisionCoverageAreas;
  void _reviewedBy;
  const base = serializeTechnicianDetail(restForDetail as TechnicianDetailPayload);
  return {
    ...base,
    applicationStatus: row.status,
    nidNumber: row.nidNumber,
    dateOfBirth: row.dateOfBirth?.toISOString() ?? null,
    gender: row.gender,
    presentAddress: row.presentAddress,
    district: row.district,
    upazila: row.upazila,
    unionOrArea: row.unionOrArea,
    experienceYears: row.experienceYears,
    trainingProvider: row.trainingProvider,
    certificateNumber: row.certificateNumber,
    adminNote: row.adminNote,
    correctionNote: row.correctionNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy
      ? {
          id: row.reviewedBy.id,
          email: row.reviewedBy.email,
          displayName: row.reviewedBy.adminProfile?.displayName ?? null,
        }
      : null,
    documents: row.documents.map((d) => ({
      id: d.id,
      type: d.type,
      title: d.title,
      fileUrl: d.fileUrl,
      storageKey: d.storageKey,
      mimeType: d.mimeType,
      uploadedFileId: d.uploadedFileId,
      reviewStatus: d.reviewStatus,
      uploadedAt: d.uploadedAt.toISOString(),
      uploadedFile: d.uploadedFile
        ? {
            id: d.uploadedFile.id,
            originalName: d.uploadedFile.originalName,
            mimeType: d.uploadedFile.mimeType,
            sizeBytes: d.uploadedFile.sizeBytes,
            width: d.uploadedFile.width,
            height: d.uploadedFile.height,
            fileCategory: d.uploadedFile.fileCategory,
            createdAt: d.uploadedFile.createdAt.toISOString(),
          }
        : null,
    })),
    divisionCoverageAreas: row.divisionCoverageAreas.map((a) => ({
      id: a.id,
      district: a.district,
      upazila: a.upazila,
      unionOrArea: a.unionOrArea,
      districtId: a.districtId,
      upazilaId: a.upazilaId,
      unionId: a.unionId,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
    })),
    statusHistoryNote:
      "স্ট্যাটাস ইতিহাসের পৃথক টেবিল এখনো নেই — reviewedAt / publishedAt / updatedAt দেখুন।",
  };
}

export type TransitionResult =
  | { ok: true; technician: ReturnType<typeof serializeTechnicianApplicationDetail> }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_TRANSITION"; message: string };

export async function adminApplyTechnicianApplicationTransition(
  profileId: string,
  adminUserId: string,
  body: ApplicationTransitionBody,
): Promise<TransitionResult> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { id: profileId },
    select: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!profile) {
    return { ok: "NOT_FOUND" };
  }

  const { action } = body;
  const note = body.note?.trim() || null;
  const adminNotePatch = body.adminNote?.trim();

  const now = new Date();

  const invalid = (message: string): TransitionResult => ({
    ok: "INVALID_TRANSITION",
    message,
  });

  const runTx = async (
    profileData: Prisma.AiTechnicianProfileUpdateInput,
    userData?: Prisma.UserUpdateInput,
  ) => {
    await prisma.$transaction(async (tx) => {
      await tx.aiTechnicianProfile.update({
        where: { id: profileId },
        data: {
          ...profileData,
          reviewedBy: { connect: { id: adminUserId } },
          reviewedAt: now,
        },
      });
      if (userData && Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: profile.userId },
          data: userData,
        });
      }
    });
  };

  switch (action) {
    case "mark_under_review": {
      if (profile.status !== AiTechnicianStatus.SUBMITTED) {
        return invalid("শুধু জমাকৃত আবেদন পর্যালোচনায় নেওয়া যাবে।");
      }
      await runTx({
        status: AiTechnicianStatus.UNDER_REVIEW,
        correctionNote: null,
      });
      break;
    }
    case "request_correction": {
      if (profile.status !== AiTechnicianStatus.UNDER_REVIEW) {
        return invalid("শুধু পর্যালোচনাধীন আবেদনে সংশোধন চাওয়া যাবে।");
      }
      await runTx({
        status: AiTechnicianStatus.NEEDS_CORRECTION,
        correctionNote: note,
        ...(adminNotePatch ? { adminNote: adminNotePatch } : {}),
      });
      break;
    }
    case "approve": {
      if (profile.status !== AiTechnicianStatus.UNDER_REVIEW) {
        return invalid("শুধু পর্যালোচনাধীন আবেদন অনুমোদন করা যাবে।");
      }
      await runTx({
        status: AiTechnicianStatus.APPROVED,
        providerStatus: ProviderStatus.PENDING_VERIFICATION,
        ...(adminNotePatch ? { adminNote: adminNotePatch } : {}),
      });
      break;
    }
    case "reject": {
      if (profile.status !== AiTechnicianStatus.UNDER_REVIEW) {
        return invalid("শুধু পর্যালোচনাধীন আবেদন প্রত্যাখ্যান করা যাবে।");
      }
      await runTx({
        status: AiTechnicianStatus.REJECTED,
        adminNote: note,
        providerStatus: ProviderStatus.REJECTED,
      });
      break;
    }
    case "publish": {
      if (profile.status !== AiTechnicianStatus.APPROVED) {
        return invalid("শুধু অনুমোদিত প্রোফাইল প্রকাশ করা যাবে।");
      }
      await runTx(
        {
          status: AiTechnicianStatus.PUBLISHED,
          publishedAt: now,
          providerStatus: ProviderStatus.ACTIVE,
          verifiedAt: now,
        },
        {
          role: UserRole.AI_TECHNICIAN,
          status: UserStatus.ACTIVE,
        },
      );
      break;
    }
    case "unpublish": {
      if (profile.status !== AiTechnicianStatus.PUBLISHED) {
        return invalid("শুধু প্রকাশিত প্রোফাইল অপ্রকাশ করা যাবে।");
      }
      await runTx({
        status: AiTechnicianStatus.APPROVED,
        publishedAt: null,
        providerStatus: ProviderStatus.PENDING_VERIFICATION,
      });
      break;
    }
    case "suspend": {
      if (
        profile.status !== AiTechnicianStatus.PUBLISHED &&
        profile.status !== AiTechnicianStatus.APPROVED
      ) {
        return invalid("শুধু প্রকাশিত বা অনুমোদিত অবস্থায় স্থগিত করা যাবে।");
      }
      await runTx(
        {
          status: AiTechnicianStatus.SUSPENDED,
          providerStatus: ProviderStatus.SUSPENDED,
        },
        { status: UserStatus.SUSPENDED },
      );
      break;
    }
    case "lift_suspension": {
      if (profile.status !== AiTechnicianStatus.SUSPENDED) {
        return invalid("শুধু স্থগিত প্রোফাইল পুনরায় সক্রিয় করা যাবে।");
      }
      await runTx(
        {
          status: AiTechnicianStatus.APPROVED,
          providerStatus: ProviderStatus.PENDING_VERIFICATION,
        },
        { status: UserStatus.ACTIVE },
      );
      break;
    }
    default: {
      const _exhaustive: never = action;
      return invalid(`অজানা কাজ: ${String(_exhaustive)}`);
    }
  }

  const fresh = await adminGetTechnicianApplicationById(profileId);
  if (!fresh) {
    return { ok: "NOT_FOUND" };
  }
  return {
    ok: true,
    technician: serializeTechnicianApplicationDetail(fresh),
  };
}
