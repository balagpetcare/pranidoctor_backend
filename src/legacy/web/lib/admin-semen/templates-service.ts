import {
  AnimalType,
  Prisma,
  SemenTemplateApprovalStatus,
  UploadedFileStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { CreateSemenServiceTemplateBody } from "./schemas";

const templateInclude = {
  semenProvider: true,
  approvedBy: { select: { id: true, email: true } },
  breedMixes: { include: { breed: true }, orderBy: { id: "asc" } },
  media: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.SemenServiceTemplateInclude;

export type SemenTemplateRow = Prisma.SemenServiceTemplateGetPayload<{
  include: typeof templateInclude;
}>;

function toDecimal(v: number | string): Prisma.Decimal {
  const s = typeof v === "number" ? String(v) : v.trim();
  if (s === "") {
    throw new Error("INVALID_DECIMAL");
  }
  return new Prisma.Decimal(s);
}

export function serializeSemenTemplate(row: SemenTemplateRow) {
  return {
    id: row.id,
    internalName: row.internalName,
    animalType: row.animalType,
    semenProviderId: row.semenProviderId,
    semenProvider: {
      id: row.semenProvider.id,
      slug: row.semenProvider.slug,
      name: row.semenProvider.name,
      nameBn: row.semenProvider.nameBn,
    },
    semenProductKind: row.semenProductKind,
    otherSemenLabel: row.otherSemenLabel,
    shortDescription: row.shortDescription,
    detailedDescription: row.detailedDescription,
    expectedBenefits: row.expectedBenefits,
    recommendedAnimalCondition: row.recommendedAnimalCondition,
    warningsContraindications: row.warningsContraindications,
    defaultBasePrice: row.defaultBasePrice.toString(),
    defaultOfferPrice: row.defaultOfferPrice?.toString() ?? null,
    defaultDiscountPercent: row.defaultDiscountPercent?.toString() ?? null,
    tagsJson: row.tagsJson,
    isActive: row.isActive,
    approvalStatus: row.approvalStatus,
    approvedById: row.approvedById,
    approvedBy:
      row.approvedBy == null
        ? null
        : { id: row.approvedBy.id, email: row.approvedBy.email },
    approvedAt: row.approvedAt?.toISOString() ?? null,
    rejectedReason: row.rejectedReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    breedMix: row.breedMixes.map((m) => ({
      id: m.id,
      breedId: m.breedId,
      percentage: m.percentage.toString(),
      breed: {
        id: m.breed.id,
        slug: m.breed.slug,
        nameEn: m.breed.nameEn,
        nameBn: m.breed.nameBn,
        animalType: m.breed.animalType,
      },
    })),
    media: row.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      uploadedFileId: m.uploadedFileId,
      externalUrl: m.externalUrl,
      sortOrder: m.sortOrder,
    })),
  };
}

export type SerializedSemenTemplate = ReturnType<typeof serializeSemenTemplate>;

async function assertBreedMixValid(
  animalType: AnimalType,
  mix: { breedId: string; percentage: number }[],
) {
  const breedIds = [...new Set(mix.map((m) => m.breedId))];
  const breeds = await prisma.livestockBreed.findMany({
    where: { id: { in: breedIds }, isActive: true },
    select: { id: true, animalType: true },
  });
  if (breeds.length !== breedIds.length) {
    throw new Error("BREED_NOT_FOUND");
  }
  for (const b of breeds) {
    if (b.animalType !== animalType) {
      throw new Error("BREED_ANIMAL_TYPE_MISMATCH");
    }
  }
}

async function assertMediaFilesOwned(media: CreateSemenServiceTemplateBody["media"]) {
  for (const m of media) {
    if (!m.uploadedFileId?.trim()) continue;
    const f = await prisma.uploadedFile.findFirst({
      where: { id: m.uploadedFileId.trim(), status: UploadedFileStatus.ACTIVE },
      select: { id: true },
    });
    if (!f) throw new Error("MEDIA_FILE_NOT_FOUND");
  }
}

function validateCoverSingle(media: CreateSemenServiceTemplateBody["media"]) {
  const covers = media.filter((m) => m.kind === "COVER");
  if (covers.length > 1) {
    throw new Error("MULTIPLE_COVERS");
  }
}

export async function adminListSemenTemplates(params: {
  q?: string;
  animalType?: AnimalType;
  semenProviderId?: string;
  approvalStatus?: SemenTemplateApprovalStatus;
  isActive?: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.SemenServiceTemplateWhereInput = {};
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.approvalStatus) where.approvalStatus = params.approvalStatus;
  if (params.animalType) where.animalType = params.animalType;
  if (params.semenProviderId?.trim()) where.semenProviderId = params.semenProviderId.trim();
  if (params.q?.trim()) {
    const q = params.q.trim();
    where.internalName = { contains: q, mode: "insensitive" };
  }
  const [total, rows] = await Promise.all([
    prisma.semenServiceTemplate.count({ where }),
    prisma.semenServiceTemplate.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: params.limit,
      skip: params.offset,
      include: templateInclude,
    }),
  ]);
  return { total, templates: rows.map(serializeSemenTemplate) };
}

export async function adminGetSemenTemplate(id: string) {
  const row = await prisma.semenServiceTemplate.findUnique({
    where: { id },
    include: templateInclude,
  });
  if (!row) return null;
  return serializeSemenTemplate(row);
}

export async function adminCreateSemenServiceTemplate(
  body: CreateSemenServiceTemplateBody,
  actorUserId?: string | null,
) {
  const provider = await prisma.semenProvider.findFirst({
    where: { id: body.semenProviderId, isActive: true },
    select: { id: true },
  });
  if (!provider) throw new Error("PROVIDER_NOT_FOUND");

  const mix = body.breedMix.map((m) => ({
    breedId: m.breedId.trim(),
    percentage: Number(m.percentage),
  }));
  await assertBreedMixValid(body.animalType, mix);
  validateCoverSingle(body.media);
  await assertMediaFilesOwned(body.media);

  const approvalStatus = body.approvalStatus ?? SemenTemplateApprovalStatus.DRAFT;

  function approvalCreateInput(): Pick<
    Prisma.SemenServiceTemplateUncheckedCreateInput,
    "approvalStatus" | "approvedById" | "approvedAt" | "rejectedReason"
  > {
    if (approvalStatus === SemenTemplateApprovalStatus.APPROVED) {
      if (!actorUserId?.trim()) throw new Error("ACTOR_REQUIRED_FOR_APPROVAL");
      return {
        approvalStatus,
        approvedById: actorUserId.trim(),
        approvedAt: new Date(),
        rejectedReason: null,
      };
    }
    if (approvalStatus === SemenTemplateApprovalStatus.REJECTED) {
      if (!actorUserId?.trim()) throw new Error("ACTOR_REQUIRED_FOR_APPROVAL");
      const rr = body.rejectedReason?.trim();
      if (!rr) throw new Error("REJECT_REASON_REQUIRED");
      return {
        approvalStatus,
        approvedById: actorUserId.trim(),
        approvedAt: new Date(),
        rejectedReason: rr,
      };
    }
    return {
      approvalStatus,
      rejectedReason: null,
    };
  }

  const row = await prisma.$transaction(async (tx) => {
    const t = await tx.semenServiceTemplate.create({
      data: {
        internalName: body.internalName.trim(),
        animalType: body.animalType,
        semenProviderId: body.semenProviderId.trim(),
        semenProductKind: body.semenProductKind,
        otherSemenLabel: body.otherSemenLabel?.trim() || null,
        shortDescription: body.shortDescription?.trim() || null,
        detailedDescription: body.detailedDescription?.trim() || null,
        expectedBenefits: body.expectedBenefits?.trim() || null,
        recommendedAnimalCondition: body.recommendedAnimalCondition?.trim() || null,
        warningsContraindications: body.warningsContraindications?.trim() || null,
        defaultBasePrice: toDecimal(body.defaultBasePrice),
        defaultOfferPrice:
          body.defaultOfferPrice === undefined || body.defaultOfferPrice === null
            ? null
            : toDecimal(body.defaultOfferPrice),
        defaultDiscountPercent:
          body.defaultDiscountPercent === undefined || body.defaultDiscountPercent === null
            ? null
            : toDecimal(body.defaultDiscountPercent),
        tagsJson:
          body.tagsJson === undefined
            ? undefined
            : body.tagsJson === null
              ? Prisma.JsonNull
              : (body.tagsJson as Prisma.InputJsonValue),
        isActive: body.isActive ?? true,
        ...approvalCreateInput(),
        breedMixes: {
          create: mix.map((m) => ({
            breedId: m.breedId,
            percentage: toDecimal(m.percentage),
          })),
        },
        media: {
          create: body.media.map((m, i) => ({
            kind: m.kind,
            uploadedFileId: m.uploadedFileId?.trim() || null,
            externalUrl: m.externalUrl?.trim() || null,
            sortOrder: m.sortOrder ?? i,
          })),
        },
      },
      include: templateInclude,
    });
    return t;
  });

  return serializeSemenTemplate(row as SemenTemplateRow);
}

export type PatchSemenServiceTemplateInput = Partial<
  Omit<CreateSemenServiceTemplateBody, "breedMix" | "media">
> & {
  breedMix?: CreateSemenServiceTemplateBody["breedMix"];
  media?: CreateSemenServiceTemplateBody["media"];
};

export async function adminPatchSemenServiceTemplate(
  id: string,
  body: PatchSemenServiceTemplateInput,
  actorUserId?: string | null,
) {
  const existing = await prisma.semenServiceTemplate.findUnique({ where: { id } });
  if (!existing) return null;

  const animalType = body.animalType ?? existing.animalType;
  if (body.breedMix) {
    const mix = body.breedMix.map((m) => ({
      breedId: m.breedId.trim(),
      percentage: Number(m.percentage),
    }));
    const sum = mix.reduce((a, m) => a + m.percentage, 0);
    if (Math.abs(sum - 100) > 0.02) throw new Error("BREED_MIX_SUM");
    await assertBreedMixValid(animalType, mix);
  }
  if (body.media) {
    validateCoverSingle(body.media);
    await assertMediaFilesOwned(body.media);
  }

  const hasOffer =
    body.defaultOfferPrice !== undefined &&
    body.defaultOfferPrice !== null &&
    String(body.defaultOfferPrice).trim() !== "";
  const hasDisc =
    body.defaultDiscountPercent !== undefined &&
    body.defaultDiscountPercent !== null &&
    String(body.defaultDiscountPercent).trim() !== "";
  if (hasOffer && hasDisc) throw new Error("OFFER_DISCOUNT_BOTH");

  await prisma.$transaction(async (tx) => {
    const data: Prisma.SemenServiceTemplateUpdateInput = {};
    if (body.internalName !== undefined) data.internalName = body.internalName.trim();
    if (body.animalType !== undefined) data.animalType = body.animalType;
    if (body.semenProviderId !== undefined) {
      const p = await tx.semenProvider.findFirst({
        where: { id: body.semenProviderId.trim(), isActive: true },
        select: { id: true },
      });
      if (!p) throw new Error("PROVIDER_NOT_FOUND");
      data.semenProvider = { connect: { id: p.id } };
    }
    if (body.semenProductKind !== undefined) data.semenProductKind = body.semenProductKind;
    if (body.otherSemenLabel !== undefined) data.otherSemenLabel = body.otherSemenLabel?.trim() || null;
    if (body.shortDescription !== undefined) data.shortDescription = body.shortDescription?.trim() || null;
    if (body.detailedDescription !== undefined) {
      data.detailedDescription = body.detailedDescription?.trim() || null;
    }
    if (body.expectedBenefits !== undefined) {
      data.expectedBenefits = body.expectedBenefits?.trim() || null;
    }
    if (body.recommendedAnimalCondition !== undefined) {
      data.recommendedAnimalCondition = body.recommendedAnimalCondition?.trim() || null;
    }
    if (body.warningsContraindications !== undefined) {
      data.warningsContraindications = body.warningsContraindications?.trim() || null;
    }
    if (body.defaultBasePrice !== undefined) data.defaultBasePrice = toDecimal(body.defaultBasePrice);
    if (body.defaultOfferPrice !== undefined) {
      data.defaultOfferPrice =
        body.defaultOfferPrice === null ? null : toDecimal(body.defaultOfferPrice);
    }
    if (body.defaultDiscountPercent !== undefined) {
      data.defaultDiscountPercent =
        body.defaultDiscountPercent === null ? null : toDecimal(body.defaultDiscountPercent);
    }
    if (body.tagsJson !== undefined) {
      data.tagsJson =
        body.tagsJson === null ? Prisma.JsonNull : (body.tagsJson as Prisma.InputJsonValue);
    }
    if (body.isActive !== undefined) data.isActive = body.isActive;

    if (body.approvalStatus !== undefined) {
      data.approvalStatus = body.approvalStatus;
      if (body.approvalStatus === SemenTemplateApprovalStatus.APPROVED) {
        if (!actorUserId?.trim()) throw new Error("ACTOR_REQUIRED_FOR_APPROVAL");
        if (existing.approvalStatus !== SemenTemplateApprovalStatus.APPROVED) {
          data.approvedBy = { connect: { id: actorUserId.trim() } };
          data.approvedAt = new Date();
          data.rejectedReason = null;
        }
      } else if (body.approvalStatus === SemenTemplateApprovalStatus.REJECTED) {
        if (!actorUserId?.trim()) throw new Error("ACTOR_REQUIRED_FOR_APPROVAL");
        const rr = body.rejectedReason?.trim() || existing.rejectedReason?.trim();
        if (!rr) throw new Error("REJECT_REASON_REQUIRED");
        data.rejectedReason = rr;
        if (existing.approvalStatus !== SemenTemplateApprovalStatus.REJECTED) {
          data.approvedBy = { connect: { id: actorUserId.trim() } };
          data.approvedAt = new Date();
        }
      } else {
        if (
          existing.approvalStatus === SemenTemplateApprovalStatus.APPROVED ||
          existing.approvalStatus === SemenTemplateApprovalStatus.REJECTED
        ) {
          data.approvedBy = { disconnect: true };
          data.approvedAt = null;
          data.rejectedReason = null;
        }
      }
    } else if (body.rejectedReason !== undefined) {
      if (existing.approvalStatus === SemenTemplateApprovalStatus.REJECTED) {
        data.rejectedReason = body.rejectedReason?.trim() || null;
      }
    }

    if (Object.keys(data).length > 0) {
      await tx.semenServiceTemplate.update({ where: { id }, data });
    }

    if (body.breedMix) {
      const mix = body.breedMix.map((m) => ({
        breedId: m.breedId.trim(),
        percentage: Number(m.percentage),
      }));
      await tx.semenServiceTemplateBreedMix.deleteMany({ where: { templateId: id } });
      await tx.semenServiceTemplateBreedMix.createMany({
        data: mix.map((m) => ({
          templateId: id,
          breedId: m.breedId,
          percentage: toDecimal(m.percentage),
        })),
      });
    }

    if (body.media) {
      await tx.semenServiceTemplateMedia.deleteMany({ where: { templateId: id } });
      await tx.semenServiceTemplateMedia.createMany({
        data: body.media.map((m, i) => ({
          templateId: id,
          kind: m.kind,
          uploadedFileId: m.uploadedFileId?.trim() || null,
          externalUrl: m.externalUrl?.trim() || null,
          sortOrder: m.sortOrder ?? i,
        })),
      });
    }
  });

  const row = await prisma.semenServiceTemplate.findUniqueOrThrow({
    where: { id },
    include: templateInclude,
  });
  return serializeSemenTemplate(row);
}

export async function adminApproveSemenTemplate(
  id: string,
  action: "APPROVE" | "REJECT",
  actorUserId: string,
  rejectedReason?: string | null,
) {
  const existing = await prisma.semenServiceTemplate.findUnique({ where: { id } });
  if (!existing) return null;

  if (action === "APPROVE") {
    const row = await prisma.semenServiceTemplate.update({
      where: { id },
      data: {
        approvalStatus: SemenTemplateApprovalStatus.APPROVED,
        approvedById: actorUserId,
        approvedAt: new Date(),
        rejectedReason: null,
      },
      include: templateInclude,
    });
    return serializeSemenTemplate(row);
  }

  const row = await prisma.semenServiceTemplate.update({
    where: { id },
    data: {
      approvalStatus: SemenTemplateApprovalStatus.REJECTED,
      rejectedReason: rejectedReason?.trim() || null,
      approvedById: actorUserId,
      approvedAt: new Date(),
    },
    include: templateInclude,
  });
  return serializeSemenTemplate(row);
}
