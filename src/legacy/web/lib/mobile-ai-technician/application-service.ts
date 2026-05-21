import {
  AiTechnicianDocumentType,
  AiTechnicianStatus,
  Prisma,
  ProviderStatus,
  UploadedFileStatus,
} from "@/generated/prisma/client";
import { resolveGeoLabelsByIds } from "@/lib/mobile-locations/geo-resolve";
import { prisma } from "@/lib/prisma";
import { documentTypeToUploadPurpose } from "@/lib/storage/upload-service";

import type {
  ApplyAiTechnicianBody,
  CreateAiTechnicianDocumentBody,
  CreateDivisionServiceAreaBody,
} from "./schemas";

const technicianMeInclude = {
  documents: {
    orderBy: { createdAt: "desc" as const },
  },
  divisionCoverageAreas: {
    where: { isActive: true },
    orderBy: { createdAt: "asc" as const },
  },
  technicianServices: {
    orderBy: { createdAt: "desc" as const },
    take: 20,
  },
} satisfies Prisma.AiTechnicianProfileInclude;

export type TechnicianMePayload = Prisma.AiTechnicianProfileGetPayload<{
  include: typeof technicianMeInclude;
}>;

function isEditableStatus(status: AiTechnicianStatus): boolean {
  return status === AiTechnicianStatus.DRAFT || status === AiTechnicianStatus.NEEDS_CORRECTION;
}

function decimalToString(d: unknown): string | null {
  if (d == null) return null;
  if (typeof (d as { toString?: () => string }).toString === "function") {
    return (d as { toString: () => string }).toString();
  }
  return String(d);
}

export function serializeTechnicianProfile(row: TechnicianMePayload) {
  return {
    id: row.id,
    userId: row.userId,
    displayName: row.displayName,
    phone: row.phone,
    email: row.email,
    nidNumber: row.nidNumber,
    dateOfBirth: row.dateOfBirth?.toISOString() ?? null,
    gender: row.gender,
    presentAddress: row.presentAddress,
    district: row.district,
    upazila: row.upazila,
    unionOrArea: row.unionOrArea,
    districtId: row.districtId,
    upazilaId: row.upazilaId,
    unionId: row.unionId,
    experienceYears: row.experienceYears,
    trainingProvider: row.trainingProvider,
    certificateNumber: row.certificateNumber,
    certification: row.certification,
    bio: row.bio,
    serviceFeeBdt: decimalToString(row.serviceFeeBdt),
    acceptsEmergency: row.acceptsEmergency,
    metadataJson: row.metadataJson,
    status: row.status,
    providerStatus: row.providerStatus,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    adminNote: row.adminNote,
    correctionNote: row.correctionNote,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
      createdAt: d.createdAt.toISOString(),
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
    servicesSummary: {
      count: row.technicianServices.length,
      items: row.technicianServices.map((s) => ({
        id: s.id,
        title: s.title,
        animalType: s.animalType,
        status: s.status,
        basePrice: decimalToString(s.basePrice),
      })),
    },
  };
}

export async function getTechnicianProfileForUser(
  userId: string,
): Promise<TechnicianMePayload | null> {
  return prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    include: technicianMeInclude,
  });
}

function parseServiceFee(
  v: ApplyAiTechnicianBody["serviceFeeBdt"],
): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const s = typeof v === "number" ? String(v) : v.trim();
  if (s === "") return null;
  return new Prisma.Decimal(s);
}

function parseDob(iso: string | null | undefined): Date | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null || iso.trim() === "") return null;
  const t = iso.trim();
  // Mobile sends `YYYY-MM-DD` from date pickers; parse as UTC noon to avoid TZ drift.
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (ymd) {
    const y = Number(ymd[1]);
    const mo = Number(ymd[2]);
    const d = Number(ymd[3]);
    if (
      !Number.isFinite(y) ||
      !Number.isFinite(mo) ||
      !Number.isFinite(d) ||
      mo < 1 ||
      mo > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }
    return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  }
  const parsed = new Date(t);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function upsertDraftApplication(
  userId: string,
  body: ApplyAiTechnicianBody,
): Promise<
  | { ok: true; profile: TechnicianMePayload }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
  | { ok: "INVALID_EMAIL" }
  | { ok: "INVALID_LOCATION" }
> {
  const existing = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
  });

  if (existing && !isEditableStatus(existing.status)) {
    return { ok: "NOT_EDITABLE", status: existing.status };
  }

  if (body.email !== undefined && body.email !== null && body.email.trim() !== "") {
    const clash = await prisma.user.findFirst({
      where: { email: body.email.trim(), NOT: { id: userId } },
      select: { id: true },
    });
    if (clash) {
      return { ok: "INVALID_EMAIL" };
    }
  }

  type LocationPatch =
    | { kind: "none" }
    | {
        kind: "resolved";
        district: string;
        upazila: string;
        unionOrArea: string | null;
        districtId: string;
        upazilaId: string;
        unionId: string | null;
      };

  let locationPatch: LocationPatch = { kind: "none" };
  if (body.districtId && body.upazilaId) {
    const resolved = await resolveGeoLabelsByIds(prisma, {
      districtId: body.districtId,
      upazilaId: body.upazilaId,
      unionId: body.unionId ?? null,
    });
    if (resolved === "INVALID") {
      return { ok: "INVALID_LOCATION" };
    }
    locationPatch = {
      kind: "resolved",
      district: resolved.district,
      upazila: resolved.upazila,
      unionOrArea: resolved.unionOrArea,
      districtId: body.districtId,
      upazilaId: body.upazilaId,
      unionId: body.unionId ?? null,
    };
  }

  const data: Prisma.AiTechnicianProfileUncheckedUpdateInput = {};

  if (body.displayName !== undefined) data.displayName = body.displayName?.trim() || null;
  if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
  if (body.email !== undefined) data.email = body.email?.trim() || null;
  if (body.nidNumber !== undefined) data.nidNumber = body.nidNumber?.trim() || null;
  if (body.dateOfBirth !== undefined) {
    data.dateOfBirth = parseDob(body.dateOfBirth ?? null) ?? null;
  }
  if (body.gender !== undefined) data.gender = body.gender;
  if (body.presentAddress !== undefined)
    data.presentAddress = body.presentAddress?.trim() || null;
  if (locationPatch.kind === "resolved") {
    data.district = locationPatch.district;
    data.upazila = locationPatch.upazila;
    data.unionOrArea = locationPatch.unionOrArea;
    data.districtId = locationPatch.districtId;
    data.upazilaId = locationPatch.upazilaId;
    data.unionId = locationPatch.unionId;
  } else {
    if (body.district !== undefined) data.district = body.district?.trim() || null;
    if (body.upazila !== undefined) data.upazila = body.upazila?.trim() || null;
    if (body.unionOrArea !== undefined) data.unionOrArea = body.unionOrArea?.trim() || null;
  }
  if (body.experienceYears !== undefined) data.experienceYears = body.experienceYears;
  if (body.trainingProvider !== undefined)
    data.trainingProvider = body.trainingProvider?.trim() || null;
  if (body.certificateNumber !== undefined)
    data.certificateNumber = body.certificateNumber?.trim() || null;
  if (body.certification !== undefined) data.certification = body.certification?.trim() || null;
  if (body.bio !== undefined) data.bio = body.bio?.trim() || null;
  if (body.acceptsEmergency !== undefined) data.acceptsEmergency = body.acceptsEmergency;
  if (body.serviceFeeBdt !== undefined) {
    const fee = parseServiceFee(body.serviceFeeBdt);
    data.serviceFeeBdt = fee === undefined ? undefined : fee;
  }
  if (body.metadataJson !== undefined) {
    data.metadataJson =
      body.metadataJson === null
        ? Prisma.JsonNull
        : (body.metadataJson as Prisma.InputJsonValue);
  }

  const profile = await prisma.$transaction(async (tx) => {
    if (!existing) {
      const created = await tx.aiTechnicianProfile.create({
        data: {
          userId,
          status: AiTechnicianStatus.DRAFT,
          providerStatus: ProviderStatus.PENDING_VERIFICATION,
          displayName: body.displayName?.trim() ?? undefined,
          phone: body.phone?.trim() ?? undefined,
          email: body.email?.trim() ?? undefined,
          nidNumber: body.nidNumber?.trim() ?? undefined,
          dateOfBirth: parseDob(body.dateOfBirth ?? null) ?? undefined,
          gender: body.gender ?? undefined,
          presentAddress: body.presentAddress?.trim() ?? undefined,
          district:
            locationPatch.kind === "resolved"
              ? locationPatch.district
              : (body.district?.trim() ?? undefined),
          upazila:
            locationPatch.kind === "resolved"
              ? locationPatch.upazila
              : (body.upazila?.trim() ?? undefined),
          unionOrArea:
            locationPatch.kind === "resolved"
              ? locationPatch.unionOrArea ?? undefined
              : (body.unionOrArea?.trim() ?? undefined),
          districtId:
            locationPatch.kind === "resolved" ? locationPatch.districtId : undefined,
          upazilaId:
            locationPatch.kind === "resolved" ? locationPatch.upazilaId : undefined,
          unionId:
            locationPatch.kind === "resolved" ? locationPatch.unionId ?? undefined : undefined,
          experienceYears: body.experienceYears ?? undefined,
          trainingProvider: body.trainingProvider?.trim() ?? undefined,
          certificateNumber: body.certificateNumber?.trim() ?? undefined,
          certification: body.certification?.trim() ?? undefined,
          bio: body.bio?.trim() ?? undefined,
          acceptsEmergency: body.acceptsEmergency ?? false,
          serviceFeeBdt: parseServiceFee(body.serviceFeeBdt) ?? undefined,
          metadataJson:
            body.metadataJson === undefined
              ? undefined
              : body.metadataJson === null
                ? Prisma.JsonNull
                : (body.metadataJson as Prisma.InputJsonValue),
        },
      });
      if (body.email !== undefined && body.email !== null && body.email.trim() !== "") {
        await tx.user.update({
          where: { id: userId },
          data: { email: body.email.trim().toLowerCase() },
        });
      }
      return tx.aiTechnicianProfile.findUniqueOrThrow({
        where: { id: created.id },
        include: technicianMeInclude,
      });
    }

    if (body.email !== undefined && body.email !== null && body.email.trim() !== "") {
      await tx.user.update({
        where: { id: userId },
        data: { email: body.email.trim().toLowerCase() },
      });
    }

    if (Object.keys(data).length > 0) {
      await tx.aiTechnicianProfile.update({
        where: { id: existing.id },
        data,
      });
    }

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianMeInclude,
    });
  });

  return { ok: true, profile };
}

export async function submitApplication(userId: string): Promise<
  | { ok: true; profile: TechnicianMePayload }
  | { ok: "NO_PROFILE" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
  | { ok: "VALIDATION"; code: string; message: string }
> {
  const row = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    include: {
      documents: true,
      divisionCoverageAreas: { where: { isActive: true } },
    },
  });

  if (!row) {
    return { ok: "NO_PROFILE" };
  }

  if (!isEditableStatus(row.status)) {
    return { ok: "NOT_EDITABLE", status: row.status };
  }

  const displayName = row.displayName?.trim();
  if (!displayName) {
    return {
      ok: "VALIDATION",
      code: "DISPLAY_NAME_REQUIRED",
      message: "প্রদর্শন নাম প্রয়োজন",
    };
  }

  const district = row.district?.trim();
  const upazila = row.upazila?.trim();
  if (!district || !upazila) {
    return {
      ok: "VALIDATION",
      code: "DISTRICT_UPAZILA_REQUIRED",
      message: "জেলা ও উপজেলা পূরণ করুন",
    };
  }

  if (row.divisionCoverageAreas.length === 0) {
    return {
      ok: "VALIDATION",
      code: "SERVICE_AREA_REQUIRED",
      message: "কমপক্ষে একটি সেবা এলাকা যোগ করুন",
    };
  }

  const types = new Set(row.documents.map((d) => d.type));
  if (!types.has(AiTechnicianDocumentType.NID_FRONT) || !types.has(AiTechnicianDocumentType.NID_BACK)) {
    return {
      ok: "VALIDATION",
      code: "NID_DOCUMENTS_REQUIRED",
      message: "জাতীয় পরিচয়পত্রের সামনে ও পিছনের ছবি/লিংক প্রয়োজন",
    };
  }

  await prisma.aiTechnicianProfile.update({
    where: { id: row.id },
    data: {
      status: AiTechnicianStatus.SUBMITTED,
      providerStatus: ProviderStatus.PENDING_VERIFICATION,
    },
  });

  const fresh = await prisma.aiTechnicianProfile.findUniqueOrThrow({
    where: { id: row.id },
    include: technicianMeInclude,
  });

  return { ok: true, profile: fresh };
}

export async function addDocument(
  userId: string,
  body: CreateAiTechnicianDocumentBody,
): Promise<
  | { ok: true; documentId: string }
  | { ok: "NO_PROFILE" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
  | { ok: "UPLOAD_NOT_FOUND" }
  | { ok: "UPLOAD_PURPOSE_MISMATCH" }
> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) return { ok: "NO_PROFILE" };
  if (!isEditableStatus(profile.status)) {
    return { ok: "NOT_EDITABLE", status: profile.status };
  }

  let fileUrl: string | null = body.fileUrl?.trim() || null;
  let storageKey: string | null = body.storageKey?.trim() || null;
  let mimeType: string | null = body.mimeType?.trim() || null;
  let uploadedFileId: string | null = null;

  if (body.uploadedFileId) {
    const uf = await prisma.uploadedFile.findFirst({
      where: {
        id: body.uploadedFileId,
        ownerUserId: userId,
        status: UploadedFileStatus.ACTIVE,
      },
      include: { aiTechnicianDocument: { select: { id: true } } },
    });
    if (!uf || uf.aiTechnicianDocument) {
      return { ok: "UPLOAD_NOT_FOUND" };
    }
    const expected = documentTypeToUploadPurpose(body.type);
    if (uf.fileCategory !== expected) {
      return { ok: "UPLOAD_PURPOSE_MISMATCH" };
    }
    uploadedFileId = uf.id;
    storageKey = uf.storageKey;
    mimeType = uf.mimeType;
    fileUrl = null;
  }

  const doc = await prisma.aiTechnicianDocument.create({
    data: {
      aiTechnicianId: profile.id,
      type: body.type,
      title: body.title.trim(),
      fileUrl,
      storageKey,
      mimeType,
      uploadedFileId,
    },
    select: { id: true },
  });

  return { ok: true, documentId: doc.id };
}

export async function deleteDocument(
  userId: string,
  documentId: string,
): Promise<
  | { ok: true }
  | { ok: "NOT_FOUND" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) return { ok: "NOT_FOUND" };
  if (!isEditableStatus(profile.status)) {
    return { ok: "NOT_EDITABLE", status: profile.status };
  }

  const doc = await prisma.aiTechnicianDocument.findFirst({
    where: { id: documentId, aiTechnicianId: profile.id },
    select: { id: true },
  });
  if (!doc) return { ok: "NOT_FOUND" };

  await prisma.aiTechnicianDocument.delete({ where: { id: documentId } });
  return { ok: true };
}

export async function addDivisionServiceArea(
  userId: string,
  body: CreateDivisionServiceAreaBody,
): Promise<
  | { ok: true; areaId: string }
  | { ok: "NO_PROFILE" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
  | { ok: "INVALID_LOCATION" }
> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) return { ok: "NO_PROFILE" };
  if (!isEditableStatus(profile.status)) {
    return { ok: "NOT_EDITABLE", status: profile.status };
  }

  let districtText = body.district?.trim() ?? "";
  let upazilaText = body.upazila?.trim() ?? "";
  let unionText = body.unionOrArea?.trim() || null;
  let districtId: string | null = body.districtId ?? null;
  let upazilaId: string | null = body.upazilaId ?? null;
  let unionId: string | null = body.unionId ?? null;

  if (body.districtId && body.upazilaId) {
    const resolved = await resolveGeoLabelsByIds(prisma, {
      districtId: body.districtId,
      upazilaId: body.upazilaId,
      unionId: body.unionId ?? null,
    });
    if (resolved === "INVALID") {
      return { ok: "INVALID_LOCATION" };
    }
    districtText = resolved.district;
    upazilaText = resolved.upazila;
    unionText = resolved.unionOrArea;
    districtId = body.districtId;
    upazilaId = body.upazilaId;
    unionId = body.unionId ?? null;
  } else if (districtText.length < 1 || upazilaText.length < 1) {
    return { ok: "INVALID_LOCATION" };
  }

  const area = await prisma.aiTechnicianDivisionServiceArea.create({
    data: {
      aiTechnicianId: profile.id,
      district: districtText,
      upazila: upazilaText,
      unionOrArea: unionText,
      districtId,
      upazilaId,
      unionId,
      isActive: body.isActive ?? true,
    },
    select: { id: true },
  });

  return { ok: true, areaId: area.id };
}

export async function deleteDivisionServiceArea(
  userId: string,
  areaId: string,
): Promise<
  | { ok: true }
  | { ok: "NOT_FOUND" }
  | { ok: "NOT_EDITABLE"; status: AiTechnicianStatus }
> {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) return { ok: "NOT_FOUND" };
  if (!isEditableStatus(profile.status)) {
    return { ok: "NOT_EDITABLE", status: profile.status };
  }

  const row = await prisma.aiTechnicianDivisionServiceArea.findFirst({
    where: { id: areaId, aiTechnicianId: profile.id },
    select: { id: true },
  });
  if (!row) return { ok: "NOT_FOUND" };

  await prisma.aiTechnicianDivisionServiceArea.delete({ where: { id: areaId } });
  return { ok: true };
}
