import { endOfDay, parseISO, startOfDay } from "date-fns";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

import type { AdminBillingListQuery } from "./schemas";

function decNum(v: { toString(): string } | null | undefined): number {
  if (v == null) return 0;
  const n = Number(v.toString());
  return Number.isFinite(n) ? n : 0;
}

export type AdminBillingListItemDto = {
  id: string;
  serviceRequestId: string;
  doctor: { id: string; displayName: string | null } | null;
  customer: { id: string; displayName: string };
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  discount: number;
  totalCollected: number;
  platformCommission: number;
  providerPayout: number;
  paymentMethod: string | null;
  paymentStatus: string;
  createdAt: string;
};

export async function adminListBillingRecords(query: AdminBillingListQuery): Promise<{
  rows: AdminBillingListItemDto[];
  total: number;
  limit: number;
  offset: number;
}> {
  const where: Prisma.BillingRecordWhereInput = {};

  if (query.paymentStatus) {
    where.paymentStatus = query.paymentStatus;
  }
  if (query.paymentMethod) {
    where.paymentMethod = query.paymentMethod;
  }

  const ds = query.dateFrom ? parseISO(query.dateFrom) : null;
  const de = query.dateTo ? parseISO(query.dateTo) : null;
  if ((ds && Number.isNaN(ds.getTime())) || (de && Number.isNaN(de.getTime()))) {
    throw new Error("INVALID_DATE_RANGE");
  }

  if (query.dateFrom || query.dateTo) {
    where.createdAt = {};
    if (query.dateFrom && ds) {
      where.createdAt.gte = startOfDay(ds);
    }
    if (query.dateTo && de) {
      where.createdAt.lte = endOfDay(de);
    }
  }

  if (query.doctorSearch?.trim()) {
    where.doctor = {
      is: {
        displayName: {
          contains: query.doctorSearch.trim(),
          mode: "insensitive",
        },
      },
    };
  }

  const [raw, total] = await Promise.all([
    prisma.billingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        doctor: { select: { id: true, displayName: true } },
        customer: { select: { id: true, displayName: true } },
      },
    }),
    prisma.billingRecord.count({ where }),
  ]);

  const rows: AdminBillingListItemDto[] = raw.map((r) => ({
    id: r.id,
    serviceRequestId: r.serviceRequestId,
    doctor: r.doctor
      ? { id: r.doctor.id, displayName: r.doctor.displayName }
      : null,
    customer: {
      id: r.customer.id,
      displayName: r.customer.displayName,
    },
    serviceFee: decNum(r.serviceFee),
    travelCost: decNum(r.travelCost),
    medicineCost: decNum(r.medicineCost),
    discount: decNum(r.discountAmount),
    totalCollected: decNum(r.totalCollected),
    platformCommission: decNum(r.platformCommission),
    providerPayout: decNum(r.providerPayout),
    paymentMethod: r.paymentMethod,
    paymentStatus: r.paymentStatus,
    createdAt: r.createdAt.toISOString(),
  }));

  return { rows, total, limit: query.limit, offset: query.offset };
}

export type AdminBillingDetailDto = {
  id: string;
  serviceRequestId: string;
  treatmentCaseId: string | null;
  currency: string;
  billingStatus: string;
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  discount: number;
  subtotal: number | null;
  totalCollected: number;
  platformCommission: number;
  providerPayout: number;
  paymentMethod: string | null;
  paymentStatus: string;
  issuedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  commissionFormula: {
    title: string;
    lines: string[];
  };
  serviceRequest: {
    id: string;
    status: string;
    completedAt: string | null;
    serviceType: string;
    problemOrSymptom: string | null;
    animal: { id: string; name: string; species: string } | null;
  } | null;
  treatmentCase: {
    id: string;
    status: string;
    diagnosis: string | null;
  } | null;
  doctor: { id: string; displayName: string | null } | null;
  customer: { id: string; displayName: string; userEmail: string | null };
};

const FORMULA_TITLE = "How platform commission is calculated (MVP)";

function buildCommissionFormulaBlock(params: {
  serviceFee: number;
  travelCost: number;
  medicineCost: number;
  discount: number;
  totalCollected: number;
  platformCommission: number;
  providerPayout: number;
}): { title: string; lines: string[] } {
  const subtotal = params.serviceFee + params.travelCost + params.medicineCost;
  const discountAppliedToService = Math.min(
    Math.max(params.discount, 0),
    Math.max(params.serviceFee, 0),
  );
  const commissionBase = Math.max(params.serviceFee - discountAppliedToService, 0);
  return {
    title: FORMULA_TITLE,
    lines: [
      `serviceFee = ${params.serviceFee.toFixed(2)} BDT · travelCost = ${params.travelCost.toFixed(2)} · medicineCost = ${params.medicineCost.toFixed(2)}`,
      `subtotal = ${subtotal.toFixed(2)} BDT`,
      `discount (invoice) = ${params.discount.toFixed(2)} BDT`,
      `discountAppliedToServiceFee (MVP default) = min(discount, serviceFee) = ${discountAppliedToService.toFixed(2)} BDT`,
      `commissionBase = max(serviceFee − discountAppliedToServiceFee, 0) = ${commissionBase.toFixed(2)} BDT (medicine/travel are not in this base)`,
      `platformCommission (stored) = ${params.platformCommission.toFixed(2)} BDT`,
      `totalCollected (stored) = ${params.totalCollected.toFixed(2)} BDT`,
      `providerPayout (stored) = ${params.providerPayout.toFixed(2)} BDT`,
    ],
  };
}

export async function adminGetBillingRecord(
  id: string,
): Promise<AdminBillingDetailDto | null> {
  const row = await prisma.billingRecord.findUnique({
    where: { id },
    include: {
      doctor: { select: { id: true, displayName: true } },
      customer: {
        select: {
          id: true,
          displayName: true,
          user: { select: { email: true } },
        },
      },
      treatmentCase: {
        select: { id: true, status: true, diagnosis: true },
      },
      serviceRequest: {
        select: {
          id: true,
          status: true,
          completedAt: true,
          serviceType: true,
          problemOrSymptom: true,
          animal: { select: { id: true, name: true, species: true } },
        },
      },
    },
  });

  if (!row) return null;

  const serviceFee = decNum(row.serviceFee);
  const travelCost = decNum(row.travelCost);
  const medicineCost = decNum(row.medicineCost);
  const discount = decNum(row.discountAmount);
  const platformCommission = decNum(row.platformCommission);
  const totalCollected = decNum(row.totalCollected);
  const providerPayout = decNum(row.providerPayout);

  return {
    id: row.id,
    serviceRequestId: row.serviceRequestId,
    treatmentCaseId: row.treatmentCaseId,
    currency: row.currency,
    billingStatus: row.status,
    serviceFee,
    travelCost,
    medicineCost,
    discount,
    subtotal: row.subtotal != null ? decNum(row.subtotal) : null,
    totalCollected,
    platformCommission,
    providerPayout,
    paymentMethod: row.paymentMethod,
    paymentStatus: row.paymentStatus,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    paidAt: row.paidAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    commissionFormula: buildCommissionFormulaBlock({
      serviceFee,
      travelCost,
      medicineCost,
      discount,
      totalCollected,
      platformCommission,
      providerPayout,
    }),
    serviceRequest: row.serviceRequest
      ? {
          id: row.serviceRequest.id,
          status: row.serviceRequest.status,
          completedAt: row.serviceRequest.completedAt?.toISOString() ?? null,
          serviceType: row.serviceRequest.serviceType,
          problemOrSymptom: row.serviceRequest.problemOrSymptom,
          animal: row.serviceRequest.animal,
        }
      : null,
    treatmentCase: row.treatmentCase
      ? {
          id: row.treatmentCase.id,
          status: row.treatmentCase.status,
          diagnosis: row.treatmentCase.diagnosis,
        }
      : null,
    doctor: row.doctor,
    customer: {
      id: row.customer.id,
      displayName: row.customer.displayName,
      userEmail: row.customer.user?.email ?? null,
    },
  };
}
