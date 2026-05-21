import {
  AiTechnicianStatus,
  AnimalType,
  Prisma,
  SemenTemplateApprovalStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function canManageTechnicianServices(status: AiTechnicianStatus): boolean {
  return status === AiTechnicianStatus.APPROVED || status === AiTechnicianStatus.PUBLISHED;
}

const catalogTemplateInclude = {
  semenProvider: { select: { id: true, slug: true, name: true, nameBn: true } },
  breedMixes: {
    include: { breed: { select: { id: true, slug: true, nameEn: true, nameBn: true, animalType: true } } },
    orderBy: { id: "asc" },
  },
  media: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.SemenServiceTemplateInclude;

export type CatalogTemplate = Prisma.SemenServiceTemplateGetPayload<{
  include: typeof catalogTemplateInclude;
}>;

export function serializeCatalogTemplate(row: CatalogTemplate) {
  return {
    id: row.id,
    internalName: row.internalName,
    animalType: row.animalType,
    semenProductKind: row.semenProductKind,
    otherSemenLabel: row.otherSemenLabel,
    shortDescription: row.shortDescription,
    semenProvider: row.semenProvider,
    breedMix: row.breedMixes.map((m) => ({
      breedId: m.breedId,
      percentage: m.percentage.toString(),
      breed: m.breed,
    })),
    media: row.media.map((m) => ({
      id: m.id,
      kind: m.kind,
      uploadedFileId: m.uploadedFileId,
      externalUrl: m.externalUrl,
      sortOrder: m.sortOrder,
    })),
    defaultBasePrice: row.defaultBasePrice.toString(),
    defaultOfferPrice: row.defaultOfferPrice?.toString() ?? null,
    defaultDiscountPercent: row.defaultDiscountPercent?.toString() ?? null,
    warningsContraindications: row.warningsContraindications,
    expectedBenefits: row.expectedBenefits,
    recommendedAnimalCondition: row.recommendedAnimalCondition,
    detailedDescription: row.detailedDescription,
  };
}

export async function listSemenTemplatesForTechnicianCatalog(params: {
  animalType?: AnimalType;
  providerId?: string;
  breedId?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.SemenServiceTemplateWhereInput = {
    isActive: true,
    approvalStatus: SemenTemplateApprovalStatus.APPROVED,
  };
  if (params.animalType) where.animalType = params.animalType;
  if (params.providerId?.trim()) where.semenProviderId = params.providerId.trim();
  if (params.breedId?.trim()) {
    where.breedMixes = { some: { breedId: params.breedId.trim() } };
  }
  const [total, rows] = await Promise.all([
    prisma.semenServiceTemplate.count({ where }),
    prisma.semenServiceTemplate.findMany({
      where,
      orderBy: [{ internalName: "asc" }],
      take: params.limit,
      skip: params.offset,
      include: catalogTemplateInclude,
    }),
  ]);
  return { total, templates: rows.map(serializeCatalogTemplate) };
}

export async function getSemenTemplateDetailForTechnician(id: string) {
  const row = await prisma.semenServiceTemplate.findFirst({
    where: {
      id,
      isActive: true,
      approvalStatus: SemenTemplateApprovalStatus.APPROVED,
    },
    include: catalogTemplateInclude,
  });
  return row ? serializeCatalogTemplate(row) : null;
}

export async function assertTechnicianCanUseTemplates(userId: string) {
  const profile = await prisma.aiTechnicianProfile.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!profile) return { ok: "NO_PROFILE" as const };
  if (!canManageTechnicianServices(profile.status)) {
    return { ok: "NOT_ALLOWED" as const, status: profile.status };
  }
  return { ok: true as const, profileId: profile.id };
}
