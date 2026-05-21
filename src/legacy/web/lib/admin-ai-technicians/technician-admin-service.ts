import bcrypt from "bcryptjs";
import type { z } from "zod";

import {
  Prisma,
  ProviderStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { verificationSummary } from "@/lib/admin-doctors/doctor-admin-service";

import {
  createTechnicianBodySchema,
  listTechniciansQuerySchema,
  patchTechnicianBodySchema,
} from "./schemas";

const BCRYPT_COST = 12;

/** Shared include for admin technician profile API + application review detail. */
export const technicianDetailInclude = {
  user: {
    select: {
      id: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  aiTechnicianProfileAreas: {
    include: {
      area: {
        select: {
          id: true,
          name: true,
          nameBn: true,
          slug: true,
          type: true,
          isActive: true,
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
  aiTechnicianProfileServiceCategories: {
    include: {
      serviceCategory: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  aiTechnicianServiceAreas: {
    include: {
      village: {
        select: {
          id: true,
          name: true,
          slug: true,
          union: {
            select: {
              name: true,
              slug: true,
              upazila: {
                select: {
                  name: true,
                  slug: true,
                  district: {
                    select: {
                      name: true,
                      slug: true,
                      division: {
                        select: { name: true, slug: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.AiTechnicianProfileInclude;

export type TechnicianDetailPayload = Prisma.AiTechnicianProfileGetPayload<{
  include: typeof technicianDetailInclude;
}>;

function decimalToString(d: unknown): string | null {
  if (d == null) return null;
  if (typeof (d as { toString?: () => string }).toString === "function") {
    return (d as { toString: () => string }).toString();
  }
  return String(d);
}

export function serializeTechnicianDetail(row: TechnicianDetailPayload) {
  const {
    user,
    aiTechnicianProfileAreas,
    aiTechnicianProfileServiceCategories,
    aiTechnicianServiceAreas,
    ...profile
  } = row;

  return {
    ...profile,
    serviceFeeBdt: decimalToString(profile.serviceFeeBdt ?? null),
    user,
    verificationSummary: verificationSummary(profile),
    workingAreas: aiTechnicianProfileAreas.map((link) => ({
      id: link.id,
      priority: link.priority,
      area: link.area,
    })),
    villageServiceAreas: aiTechnicianServiceAreas.map((link) => ({
      id: link.id,
      priority: link.priority,
      village: link.village,
    })),
    serviceCategories: aiTechnicianProfileServiceCategories.map((link) => ({
      id: link.id,
      serviceCategory: link.serviceCategory,
    })),
  };
}

export function serializeTechnicianListRow(
  row: Prisma.AiTechnicianProfileGetPayload<{
    include: {
      user: {
        select: {
          email: true;
          phone: true;
          status: true;
        };
      };
      _count: {
        select: {
          aiTechnicianProfileAreas: true;
          aiTechnicianProfileServiceCategories: true;
          aiTechnicianServiceAreas: true;
        };
      };
    };
  }>,
) {
  return {
    id: row.id,
    displayName: row.displayName,
    certification: row.certification,
    providerStatus: row.providerStatus,
    verifiedAt: row.verifiedAt,
    serviceFeeBdt: decimalToString(row.serviceFeeBdt ?? null),
    acceptsEmergency: row.acceptsEmergency,
    verificationSummary: verificationSummary(row),
    user: row.user,
    counts: {
      workingAreas: row._count.aiTechnicianProfileAreas,
      villageServiceAreas: row._count.aiTechnicianServiceAreas,
      serviceCategories: row._count.aiTechnicianProfileServiceCategories,
    },
    updatedAt: row.updatedAt,
  };
}

export async function adminListTechnicians(
  raw: z.infer<typeof listTechniciansQuerySchema>,
) {
  const q = raw.q?.trim();
  const where: Prisma.AiTechnicianProfileWhereInput = {
    user: {
      role: UserRole.AI_TECHNICIAN,
    },
  };

  const filters: Prisma.AiTechnicianProfileWhereInput[] = [];

  if (raw.providerStatus) {
    filters.push({ providerStatus: raw.providerStatus });
  }

  if (raw.userStatus) {
    filters.push({ user: { status: raw.userStatus } });
  }

  if (raw.areaId) {
    filters.push({
      aiTechnicianProfileAreas: { some: { areaId: raw.areaId } },
    });
  }

  if (raw.villageId) {
    filters.push({
      aiTechnicianServiceAreas: { some: { villageId: raw.villageId } },
    });
  }

  if (q) {
    filters.push({
      OR: [
        { certification: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
        { bio: { contains: q, mode: "insensitive" } },
        { user: { email: { contains: q, mode: "insensitive" } } },
        {
          user: {
            phone: { contains: q, mode: "insensitive" },
          },
        },
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
          },
        },
        _count: {
          select: {
            aiTechnicianProfileAreas: true,
            aiTechnicianProfileServiceCategories: true,
            aiTechnicianServiceAreas: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    technicians: rows.map(serializeTechnicianListRow),
    meta: { total, limit, offset },
  };
}

export async function adminGetTechnicianById(id: string) {
  const row = await prisma.aiTechnicianProfile.findFirst({
    where: {
      id,
      user: { role: UserRole.AI_TECHNICIAN },
    },
    include: technicianDetailInclude,
  });
  return row;
}

type CreateBody = z.infer<typeof createTechnicianBodySchema>;
type PatchBody = z.infer<typeof patchTechnicianBodySchema>;

async function validateAreaIds(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const areas = await prisma.area.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (areas.length !== uniqueIds.length) {
    throw new Error("INVALID_AREA_IDS");
  }
}

async function validateVillageIds(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const villages = await prisma.village.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (villages.length !== uniqueIds.length) {
    throw new Error("INVALID_VILLAGE_IDS");
  }
}

async function validateCategoryIds(ids: string[]): Promise<void> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) return;
  const cats = await prisma.serviceCategory.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });
  if (cats.length !== uniqueIds.length) {
    throw new Error("INVALID_CATEGORY_IDS");
  }
}

export async function adminCreateTechnician(body: CreateBody) {
  const email = body.email.toLowerCase();
  const phone = body.phone.trim();

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);

  let serviceFee: Prisma.Decimal | undefined;
  if (body.serviceFeeBdt !== undefined) {
    serviceFee = new Prisma.Decimal(body.serviceFeeBdt);
  }

  const initialAreaIds = body.initialAreaIds ?? [];
  const initialVillageIds = body.initialVillageIds ?? [];
  const initialCategoryIds = body.initialServiceCategoryIds ?? [];

  await validateAreaIds(initialAreaIds);
  await validateVillageIds(initialVillageIds);
  await validateCategoryIds(initialCategoryIds);

  const row = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: UserRole.AI_TECHNICIAN,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });

    const profile = await tx.aiTechnicianProfile.create({
      data: {
        userId: user.id,
        displayName: body.displayName,
        certification: body.certification.trim(),
        bio: body.bio?.trim() ?? undefined,
        serviceFeeBdt: serviceFee,
        acceptsEmergency: body.acceptsEmergency ?? false,
        metadataJson:
          body.metadataJson === undefined
            ? undefined
            : (body.metadataJson as Prisma.InputJsonValue),
        providerStatus: ProviderStatus.PENDING_VERIFICATION,
      },
    });

    const uniqueAreas = [...new Set(initialAreaIds)];
    if (uniqueAreas.length > 0) {
      await tx.aiTechnicianProfileArea.createMany({
        data: uniqueAreas.map((areaId, index) => ({
          aiTechnicianId: profile.id,
          areaId,
          priority: index + 1,
        })),
      });
    }

    const uniqueVillages = [...new Set(initialVillageIds)];
    if (uniqueVillages.length > 0) {
      await tx.aiTechnicianServiceArea.createMany({
        data: uniqueVillages.map((villageId, index) => ({
          aiTechnicianId: profile.id,
          villageId,
          priority: index + 1,
        })),
      });
    }

    const uniqueCats = [...new Set(initialCategoryIds)];
    if (uniqueCats.length > 0) {
      await tx.aiTechnicianProfileServiceCategory.createMany({
        data: uniqueCats.map((serviceCategoryId) => ({
          aiTechnicianId: profile.id,
          serviceCategoryId,
        })),
      });
    }

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminPatchTechnician(id: string, body: PatchBody) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: {
      id: true,
      userId: true,
      providerStatus: true,
    },
  });

  if (!existing) return null;

  const userData: Prisma.UserUpdateInput = {};
  if (body.email !== undefined) {
    userData.email = body.email.toLowerCase();
  }
  if (body.phone !== undefined) {
    userData.phone = body.phone === null ? null : body.phone.trim();
  }

  if (body.userStatus !== undefined) {
    userData.status = body.userStatus;

    if (body.userStatus === UserStatus.ACTIVE) {
      if (existing.providerStatus === ProviderStatus.REJECTED) {
        throw new Error("CANNOT_ACTIVATE_REJECTED");
      }
    }
  }

  const profileData: Prisma.AiTechnicianProfileUpdateInput = {};

  if (body.displayName !== undefined) {
    profileData.displayName = body.displayName;
  }
  if (body.certification !== undefined) {
    profileData.certification = body.certification;
  }
  if (body.bio !== undefined) {
    profileData.bio = body.bio;
  }
  if (body.serviceFeeBdt !== undefined) {
    profileData.serviceFeeBdt =
      body.serviceFeeBdt === null ? null : new Prisma.Decimal(body.serviceFeeBdt);
  }
  if (body.acceptsEmergency !== undefined) {
    profileData.acceptsEmergency = body.acceptsEmergency;
  }
  if (body.metadataJson !== undefined) {
    profileData.metadataJson =
      body.metadataJson === null
        ? Prisma.DbNull
        : (body.metadataJson as Prisma.InputJsonValue);
  }

  if (body.userStatus === UserStatus.SUSPENDED) {
    profileData.providerStatus = ProviderStatus.SUSPENDED;
  } else if (body.userStatus === UserStatus.ACTIVE) {
    profileData.providerStatus = ProviderStatus.ACTIVE;
  }

  const row = await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: existing.userId },
        data: userData,
      });
    }

    if (Object.keys(profileData).length > 0) {
      await tx.aiTechnicianProfile.update({
        where: { id: existing.id },
        data: profileData,
      });
    }

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminApproveTechnician(id: string) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.ACTIVE },
    });

    await tx.aiTechnicianProfile.update({
      where: { id: existing.id },
      data: {
        providerStatus: ProviderStatus.ACTIVE,
      },
    });

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminRejectTechnician(id: string) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await tx.aiTechnicianProfile.update({
      where: { id: existing.id },
      data: { providerStatus: ProviderStatus.REJECTED },
    });

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminVerifyTechnician(id: string) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.aiTechnicianProfile.update({
    where: { id: existing.id },
    data: {
      verifiedAt: new Date(),
    },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}

export async function adminActivateTechnician(id: string) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true, userId: true, providerStatus: true },
  });
  if (!existing) return null;

  if (existing.providerStatus === ProviderStatus.REJECTED) {
    throw new Error("CANNOT_ACTIVATE_REJECTED");
  }

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.ACTIVE },
    });

    return tx.aiTechnicianProfile.update({
      where: { id: existing.id },
      data: {
        providerStatus: ProviderStatus.ACTIVE,
      },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminSuspendTechnician(id: string) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await tx.aiTechnicianProfile.update({
      where: { id: existing.id },
      data: { providerStatus: ProviderStatus.SUSPENDED },
    });

    return tx.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
  });

  return serializeTechnicianDetail(row);
}

export async function adminReplaceWorkingAreas(id: string, areaIds: string[]) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const uniqueIds = [...new Set(areaIds)];

  if (uniqueIds.length === 0) {
    await prisma.aiTechnicianProfileArea.deleteMany({
      where: { aiTechnicianId: existing.id },
    });
    const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
    return serializeTechnicianDetail(row);
  }

  const areas = await prisma.area.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (areas.length !== uniqueIds.length) {
    throw new Error("INVALID_AREA_IDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiTechnicianProfileArea.deleteMany({
      where: { aiTechnicianId: existing.id },
    });

    await tx.aiTechnicianProfileArea.createMany({
      data: uniqueIds.map((areaId, index) => ({
        aiTechnicianId: existing.id,
        areaId,
        priority: index + 1,
      })),
    });
  });

  const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}

export async function adminReplaceVillageServiceAreas(
  id: string,
  villageIds: string[],
) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const uniqueIds = [...new Set(villageIds)];

  if (uniqueIds.length === 0) {
    await prisma.aiTechnicianServiceArea.deleteMany({
      where: { aiTechnicianId: existing.id },
    });
    const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
    return serializeTechnicianDetail(row);
  }

  const villages = await prisma.village.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (villages.length !== uniqueIds.length) {
    throw new Error("INVALID_VILLAGE_IDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiTechnicianServiceArea.deleteMany({
      where: { aiTechnicianId: existing.id },
    });

    await tx.aiTechnicianServiceArea.createMany({
      data: uniqueIds.map((villageId, index) => ({
        aiTechnicianId: existing.id,
        villageId,
        priority: index + 1,
      })),
    });
  });

  const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}

export async function adminReplaceTechnicianServiceCategories(
  id: string,
  categoryIds: string[],
) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const uniqueIds = [...new Set(categoryIds)];

  if (uniqueIds.length === 0) {
    await prisma.aiTechnicianProfileServiceCategory.deleteMany({
      where: { aiTechnicianId: existing.id },
    });
    const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: technicianDetailInclude,
    });
    return serializeTechnicianDetail(row);
  }

  const cats = await prisma.serviceCategory.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (cats.length !== uniqueIds.length) {
    throw new Error("INVALID_CATEGORY_IDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.aiTechnicianProfileServiceCategory.deleteMany({
      where: { aiTechnicianId: existing.id },
    });

    await tx.aiTechnicianProfileServiceCategory.createMany({
      data: uniqueIds.map((serviceCategoryId) => ({
        aiTechnicianId: existing.id,
        serviceCategoryId,
      })),
    });
  });

  const row = await prisma.aiTechnicianProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}

export async function adminUpdateServiceFee(
  id: string,
  value: Prisma.Decimal | null,
) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.aiTechnicianProfile.update({
    where: { id: existing.id },
    data: { serviceFeeBdt: value },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}

export async function adminUpdateEmergencyAvailability(
  id: string,
  accepts: boolean,
) {
  const existing = await prisma.aiTechnicianProfile.findFirst({
    where: { id, user: { role: UserRole.AI_TECHNICIAN } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.aiTechnicianProfile.update({
    where: { id: existing.id },
    data: { acceptsEmergency: accepts },
    include: technicianDetailInclude,
  });

  return serializeTechnicianDetail(row);
}
