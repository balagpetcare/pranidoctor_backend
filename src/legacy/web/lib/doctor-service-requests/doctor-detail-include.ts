import type { Prisma } from "@/generated/prisma/client";

/**
 * Doctor case detail — animal + category + assignment + minimal customer (no PII).
 */
export const doctorServiceRequestDetailInclude = {
  serviceCategory: { select: { id: true, name: true, slug: true } },
  animal: {
    select: {
      id: true,
      name: true,
      species: true,
      active: true,
      animalType: true,
      breed: true,
      weightKg: true,
      notes: true,
    },
  },
  assignedDoctor: { select: { id: true, displayName: true } },
  assignedTechnician: { select: { id: true, displayName: true } },
  customer: {
    select: {
      id: true,
      displayName: true,
    },
  },
} satisfies Prisma.ServiceRequestInclude;

export function buildDoctorCaseDetailInclude(
  doctorProfileId: string,
): Prisma.ServiceRequestInclude {
  return {
    ...doctorServiceRequestDetailInclude,
    treatmentCases: {
      where: { doctorId: doctorProfileId },
      orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
    },
    prescriptions: {
      where: { doctorId: doctorProfileId },
      orderBy: { createdAt: "desc" },
      include: {
        items: { orderBy: { createdAt: "asc" } },
      },
    },
    billingRecords: {
      where: { doctorId: doctorProfileId },
      orderBy: { createdAt: "desc" },
      take: 1,
    },
  };
}

export type DoctorServiceRequestDetailRow = Prisma.ServiceRequestGetPayload<{
  include: typeof doctorServiceRequestDetailInclude;
}>;

export type DoctorServiceRequestCaseRow = Prisma.ServiceRequestGetPayload<{
  include: ReturnType<typeof buildDoctorCaseDetailInclude>;
}>;