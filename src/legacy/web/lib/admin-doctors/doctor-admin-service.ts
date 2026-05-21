import bcrypt from "bcryptjs";
import type { z } from "zod";

import {
  Prisma,
  ProviderStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import {
  createDoctorBodySchema,
  listDoctorsQuerySchema,
  patchDoctorBodySchema,
} from "./schemas";

const BCRYPT_COST = 12;

export const doctorDetailInclude = {
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
  doctorProfileAreas: {
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
  doctorProfileServiceCategories: {
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
} satisfies Prisma.DoctorProfileInclude;

export type DoctorDetailPayload = Prisma.DoctorProfileGetPayload<{
  include: typeof doctorDetailInclude;
}>;

function decimalToString(d: unknown): string | null {
  if (d == null) return null;
  if (typeof (d as { toString?: () => string }).toString === "function") {
    return (d as { toString: () => string }).toString();
  }
  return String(d);
}

/** Maps lifecycle to UI-friendly labels (existing `ProviderStatus` kept as source of truth). */
export function verificationSummary(profile: {
  providerStatus: ProviderStatus;
  verifiedAt: Date | null;
}): string {
  switch (profile.providerStatus) {
    case ProviderStatus.REJECTED:
      return "REJECTED";
    case ProviderStatus.SUSPENDED:
      return "SUSPENDED";
    case ProviderStatus.PENDING_VERIFICATION:
      return profile.verifiedAt ? "VERIFIED_PENDING_APPROVAL" : "PENDING_VERIFICATION";
    case ProviderStatus.ACTIVE:
      return profile.verifiedAt ? "VERIFIED_ACTIVE" : "APPROVED_ACTIVE";
    default:
      return "UNKNOWN";
  }
}

export function serializeDoctorDetail(row: DoctorDetailPayload) {
  const { user, doctorProfileAreas, doctorProfileServiceCategories, ...profile } =
    row;

  return {
    ...profile,
    visitFeeBdt: decimalToString(profile.visitFeeBdt ?? null),
    user,
    verificationSummary: verificationSummary(profile),
    workingAreas: doctorProfileAreas.map((link) => ({
      id: link.id,
      priority: link.priority,
      area: link.area,
    })),
    serviceCategories: doctorProfileServiceCategories.map((link) => ({
      id: link.id,
      serviceCategory: link.serviceCategory,
    })),
  };
}

export function serializeDoctorListRow(
  row: Prisma.DoctorProfileGetPayload<{
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
          doctorProfileAreas: true;
          doctorProfileServiceCategories: true;
        };
      };
    };
  }>,
) {
  return {
    id: row.id,
    displayName: row.displayName,
    degree: row.degree,
    licenseNumber: row.licenseNumber,
    specialization: row.specialization,
    providerStatus: row.providerStatus,
    verifiedAt: row.verifiedAt,
    visitFeeBdt: decimalToString(row.visitFeeBdt ?? null),
    acceptsEmergency: row.acceptsEmergency,
    acceptsOnlineConsultation: row.acceptsOnlineConsultation,
    verificationSummary: verificationSummary(row),
    user: row.user,
    counts: {
      workingAreas: row._count.doctorProfileAreas,
      serviceCategories: row._count.doctorProfileServiceCategories,
    },
    updatedAt: row.updatedAt,
  };
}

export async function adminListDoctors(
  raw: z.infer<typeof listDoctorsQuerySchema>,
) {
  const q = raw.q?.trim();
  const where: Prisma.DoctorProfileWhereInput = {
    user: {
      role: UserRole.DOCTOR,
    },
  };

  const filters: Prisma.DoctorProfileWhereInput[] = [];

  if (raw.providerStatus) {
    filters.push({ providerStatus: raw.providerStatus });
  }

  if (raw.userStatus) {
    filters.push({ user: { status: raw.userStatus } });
  }

  if (q) {
    filters.push({
      OR: [
        { licenseNumber: { contains: q, mode: "insensitive" } },
        { displayName: { contains: q, mode: "insensitive" } },
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
    prisma.doctorProfile.count({ where }),
    prisma.doctorProfile.findMany({
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
            doctorProfileAreas: true,
            doctorProfileServiceCategories: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return {
    doctors: rows.map(serializeDoctorListRow),
    meta: { total, limit, offset },
  };
}

export async function adminGetDoctorById(id: string) {
  const row = await prisma.doctorProfile.findFirst({
    where: {
      id,
      user: { role: UserRole.DOCTOR },
    },
    include: doctorDetailInclude,
  });
  return row;
}

type CreateBody = z.infer<typeof createDoctorBodySchema>;
type PatchBody = z.infer<typeof patchDoctorBodySchema>;

export async function adminCreateDoctor(body: CreateBody) {
  const email = body.email.toLowerCase();
  const phone = body.phone.trim();

  const passwordHash = await bcrypt.hash(body.password, BCRYPT_COST);

  let visitFee: Prisma.Decimal | undefined;
  if (body.visitFeeBdt !== undefined) {
    visitFee = new Prisma.Decimal(body.visitFeeBdt);
  }

  const row = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        phone,
        passwordHash,
        role: UserRole.DOCTOR,
        status: UserStatus.PENDING_VERIFICATION,
      },
    });

    await tx.doctorProfile.create({
      data: {
        userId: user.id,
        displayName: body.displayName,
        licenseNumber: body.licenseNumber.trim(),
        degree: body.degree?.trim() ?? undefined,
        specialization: body.specialization?.trim() ?? undefined,
        experienceYears: body.experienceYears ?? undefined,
        bio: body.bio?.trim() ?? undefined,
        profilePhotoUrl:
          body.profilePhotoUrl === undefined || body.profilePhotoUrl === ""
            ? undefined
            : body.profilePhotoUrl.trim(),
        visitFeeBdt: visitFee,
        acceptsEmergency: body.acceptsEmergency ?? false,
        acceptsOnlineConsultation: body.acceptsOnlineConsultation ?? false,
        providerStatus: ProviderStatus.PENDING_VERIFICATION,
      },
    });

    return tx.doctorProfile.findUniqueOrThrow({
      where: { userId: user.id },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminPatchDoctor(id: string, body: PatchBody) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true, userId: true },
  });

  if (!existing) return null;

  const userData: Prisma.UserUpdateInput = {};
  if (body.email !== undefined) {
    userData.email = body.email.toLowerCase();
  }
  if (body.phone !== undefined) {
    userData.phone = body.phone === null ? null : body.phone.trim();
  }

  const profileData: Prisma.DoctorProfileUpdateInput = {};

  if (body.displayName !== undefined) {
    profileData.displayName = body.displayName;
  }
  if (body.licenseNumber !== undefined) {
    profileData.licenseNumber = body.licenseNumber.trim();
  }
  if (body.degree !== undefined) {
    profileData.degree = body.degree;
  }
  if (body.specialization !== undefined) {
    profileData.specialization = body.specialization;
  }
  if (body.experienceYears !== undefined) {
    profileData.experienceYears = body.experienceYears;
  }
  if (body.bio !== undefined) {
    profileData.bio = body.bio;
  }
  if (body.profilePhotoUrl !== undefined) {
    profileData.profilePhotoUrl =
      body.profilePhotoUrl === null || body.profilePhotoUrl === ""
        ? null
        : body.profilePhotoUrl.trim();
  }
  if (body.visitFeeBdt !== undefined) {
    profileData.visitFeeBdt =
      body.visitFeeBdt === null ? null : new Prisma.Decimal(body.visitFeeBdt);
  }
  if (body.acceptsEmergency !== undefined) {
    profileData.acceptsEmergency = body.acceptsEmergency;
  }
  if (body.acceptsOnlineConsultation !== undefined) {
    profileData.acceptsOnlineConsultation = body.acceptsOnlineConsultation;
  }

  const row = await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: existing.userId },
        data: userData,
      });
    }

    if (Object.keys(profileData).length > 0) {
      await tx.doctorProfile.update({
        where: { id: existing.id },
        data: profileData,
      });
    }

    return tx.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminApproveDoctor(id: string) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.ACTIVE },
    });

    await tx.doctorProfile.update({
      where: { id: existing.id },
      data: {
        providerStatus: ProviderStatus.ACTIVE,
      },
    });

    return tx.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminRejectDoctor(id: string) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await tx.doctorProfile.update({
      where: { id: existing.id },
      data: { providerStatus: ProviderStatus.REJECTED },
    });

    return tx.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminVerifyDoctor(id: string) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.doctorProfile.update({
    where: { id: existing.id },
    data: {
      verifiedAt: new Date(),
    },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}

export async function adminActivateDoctor(id: string) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
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

    return tx.doctorProfile.update({
      where: { id: existing.id },
      data: {
        providerStatus: ProviderStatus.ACTIVE,
      },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminSuspendDoctor(id: string) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true, userId: true },
  });
  if (!existing) return null;

  const row = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: existing.userId },
      data: { status: UserStatus.SUSPENDED },
    });

    await tx.doctorProfile.update({
      where: { id: existing.id },
      data: { providerStatus: ProviderStatus.SUSPENDED },
    });

    return tx.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
  });

  return serializeDoctorDetail(row);
}

export async function adminReplaceWorkingAreas(id: string, areaIds: string[]) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const uniqueIds = [...new Set(areaIds)];

  if (uniqueIds.length === 0) {
    await prisma.doctorProfileArea.deleteMany({
      where: { doctorId: existing.id },
    });
    const row = await prisma.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
    return serializeDoctorDetail(row);
  }

  const areas = await prisma.area.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (areas.length !== uniqueIds.length) {
    throw new Error("INVALID_AREA_IDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctorProfileArea.deleteMany({
      where: { doctorId: existing.id },
    });

    await tx.doctorProfileArea.createMany({
      data: uniqueIds.map((areaId, index) => ({
        doctorId: existing.id,
        areaId,
        priority: index + 1,
      })),
    });
  });

  const row = await prisma.doctorProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}

export async function adminReplaceServiceCategories(
  id: string,
  categoryIds: string[],
) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const uniqueIds = [...new Set(categoryIds)];

  if (uniqueIds.length === 0) {
    await prisma.doctorProfileServiceCategory.deleteMany({
      where: { doctorId: existing.id },
    });
    const row = await prisma.doctorProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: doctorDetailInclude,
    });
    return serializeDoctorDetail(row);
  }

  const cats = await prisma.serviceCategory.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true },
  });

  if (cats.length !== uniqueIds.length) {
    throw new Error("INVALID_CATEGORY_IDS");
  }

  await prisma.$transaction(async (tx) => {
    await tx.doctorProfileServiceCategory.deleteMany({
      where: { doctorId: existing.id },
    });

    await tx.doctorProfileServiceCategory.createMany({
      data: uniqueIds.map((serviceCategoryId) => ({
        doctorId: existing.id,
        serviceCategoryId,
      })),
    });
  });

  const row = await prisma.doctorProfile.findUniqueOrThrow({
    where: { id: existing.id },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}

export async function adminUpdateVisitFee(
  id: string,
  value: Prisma.Decimal | null,
) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.doctorProfile.update({
    where: { id: existing.id },
    data: { visitFeeBdt: value },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}

export async function adminUpdateEmergency(id: string, accepts: boolean) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.doctorProfile.update({
    where: { id: existing.id },
    data: { acceptsEmergency: accepts },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}

export async function adminUpdateOnlineConsultation(id: string, accepts: boolean) {
  const existing = await prisma.doctorProfile.findFirst({
    where: { id, user: { role: UserRole.DOCTOR } },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.doctorProfile.update({
    where: { id: existing.id },
    data: { acceptsOnlineConsultation: accepts },
    include: doctorDetailInclude,
  });

  return serializeDoctorDetail(row);
}
