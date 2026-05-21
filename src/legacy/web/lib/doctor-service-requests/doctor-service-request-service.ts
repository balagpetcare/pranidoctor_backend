import {
  notifyDoctorAcceptedRequest,
  notifyServiceRequestCompleted,
} from "@/lib/notifications/events";
import type { ServiceRequestWithRelations } from "@/lib/mobile-service-requests/service-request-mapper";
import {
  serviceRequestInclude,
  toServiceRequestDto,
} from "@/lib/mobile-service-requests/service-request-mapper";
import { prisma } from "@/lib/prisma";
import {
  PaymentStatus,
  Prisma,
  ServiceRequestStatus,
  TreatmentCaseStatus,
} from "@/generated/prisma/client";

import {
  acceptServiceRequestForDoctor as acceptCore,
  recordServiceRequestCompleted,
  rejectServiceRequestForDoctor as rejectCore,
} from "../../../../modules/assignment/assignment.service.js";
import { listServiceRequestsForDoctor as listDoctorQueue } from "../../../../modules/doctor-queue/doctor-queue.service.js";

import { DOCTOR_CASE_COMPLETABLE_STATUSES } from "./clinical-constants";

import {
  buildDoctorCaseDetailInclude,
  type DoctorServiceRequestCaseRow,
  type DoctorServiceRequestDetailRow,
} from "./doctor-detail-include";
import type {
  DoctorPrescriptionSummaryDto,
  DoctorTreatmentSummaryDto,
} from "./doctor-clinical-service";
import {
  toDoctorPrescriptionSummaryDto,
  toDoctorTreatmentSummaryDto,
} from "./doctor-clinical-service";
import {
  toDoctorBillingDtoFromRecord,
  toDoctorBillingDtoFromTotals,
  type DoctorBillingDto,
} from "./doctor-billing-dto";
import { mapPaymentStatusToBillingStatus } from "./billing-status-map";
import type { DoctorCompleteBillingBody } from "./complete-billing-schema";
import { calculateBillingTotals } from "@/lib/billing-calculation";
import { getPlatformCommissionRate } from "@/lib/platform-commission-rate";
import type { DoctorListServiceRequestsQuery } from "./schemas";

function moneyDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

export type { DoctorBillingDto } from "./doctor-billing-dto";

export type DoctorServiceRequestDetailDto = ReturnType<
  typeof toDoctorServiceRequestDetailBaseDto
> & {
  treatments: DoctorTreatmentSummaryDto[];
  prescriptions: DoctorPrescriptionSummaryDto[];
  billing?: DoctorBillingDto;
};

function narrowAnimalForServiceDto(
  animal: DoctorServiceRequestDetailRow["animal"],
): ServiceRequestWithRelations["animal"] {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    active: animal.active,
    animalType: animal.animalType,
  };
}

function toDoctorAnimalDetailDto(animal: DoctorServiceRequestDetailRow["animal"]) {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    active: animal.active,
    animalType: animal.animalType,
    breed: animal.breed,
    weightKg: animal.weightKg != null ? String(animal.weightKg) : null,
    notes: animal.notes,
  };
}

function toDoctorServiceRequestDetailBaseDto(row: DoctorServiceRequestDetailRow) {
  const { customer, animal, ...rest } = row;
  const base = toServiceRequestDto({
    ...rest,
    animal: narrowAnimalForServiceDto(animal),
  } as ServiceRequestWithRelations);

  return {
    ...base,
    animal: toDoctorAnimalDetailDto(animal),
    customer: {
      id: customer.id,
      displayName: customer.displayName,
    },
  };
}

function mapDoctorCaseToDetailDto(row: DoctorServiceRequestCaseRow): DoctorServiceRequestDetailDto {
  const { treatmentCases, prescriptions, billingRecords, ...rest } = row;
  const base = toDoctorServiceRequestDetailBaseDto(rest);
  const billingRow = billingRecords[0];
  return {
    ...base,
    treatments: treatmentCases.map(toDoctorTreatmentSummaryDto),
    prescriptions: prescriptions.map(toDoctorPrescriptionSummaryDto),
    billing: billingRow ? toDoctorBillingDtoFromRecord(billingRow) : undefined,
  };
}

export async function listServiceRequestsForDoctor(
  doctorProfileId: string,
  query: DoctorListServiceRequestsQuery,
) {
  return listDoctorQueue(doctorProfileId, query);
}

export async function getServiceRequestDetailForDoctor(
  doctorProfileId: string,
  requestId: string,
) {
  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    include: buildDoctorCaseDetailInclude(doctorProfileId),
  });
  return row ? mapDoctorCaseToDetailDto(row) : null;
}

export type AcceptDoctorServiceRequestResult =
  | { ok: "ACCEPTED"; request: DoctorServiceRequestDetailDto }
  | { ok: "ALREADY_ACCEPTED"; request: DoctorServiceRequestDetailDto }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_STATUS"; status: ServiceRequestStatus };

export async function acceptServiceRequestForDoctor(
  doctorProfileId: string,
  requestId: string,
): Promise<AcceptDoctorServiceRequestResult> {
  const result = await acceptCore(doctorProfileId, requestId);

  if (result.ok === "NOT_FOUND" || result.ok === "INVALID_STATUS") {
    return result;
  }

  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    include: buildDoctorCaseDetailInclude(doctorProfileId),
  });

  if (!row) {
    return { ok: "NOT_FOUND" };
  }

  const detail = mapDoctorCaseToDetailDto(row);

  if (result.ok === "ACCEPTED") {
    void notifyDoctorAcceptedRequest(requestId).catch((err) =>
      console.error("[notifications] notifyDoctorAcceptedRequest", err),
    );
    return { ok: "ACCEPTED", request: detail };
  }

  return { ok: "ALREADY_ACCEPTED", request: detail };
}

export type RejectDoctorServiceRequestResult =
  | { ok: "REJECTED"; request: DoctorServiceRequestDetailDto }
  | { ok: "ALREADY_REJECTED"; request: DoctorServiceRequestDetailDto }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_STATUS"; status: ServiceRequestStatus };

export async function rejectServiceRequestForDoctor(
  doctorProfileId: string,
  requestId: string,
  reason: string | undefined,
): Promise<RejectDoctorServiceRequestResult> {
  const result = await rejectCore(doctorProfileId, requestId, reason);

  if (result.ok === "NOT_FOUND" || result.ok === "INVALID_STATUS") {
    return result;
  }

  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    include: buildDoctorCaseDetailInclude(doctorProfileId),
  });

  if (!row) {
    return { ok: "NOT_FOUND" };
  }

  const detail = mapDoctorCaseToDetailDto(row);
  return result.ok === "REJECTED"
    ? { ok: "REJECTED", request: detail }
    : { ok: "ALREADY_REJECTED", request: detail };
}

export type CompleteDoctorServiceRequestResult =
  | { ok: "COMPLETED"; request: DoctorServiceRequestDetailDto; billing: DoctorBillingDto }
  | {
      ok: "ALREADY_COMPLETED";
      request: DoctorServiceRequestDetailDto;
      billing: DoctorBillingDto | null;
    }
  | { ok: "NOT_FOUND" }
  | { ok: "INVALID_STATUS"; status: ServiceRequestStatus }
  | { ok: "TREATMENT_REQUIRED" }
  | { ok: "BILLING_REQUIRED" }
  | { ok: "BILLING_EXISTS" };

export async function completeServiceRequestForDoctor(
  doctorProfileId: string,
  requestId: string,
  billingInput: DoctorCompleteBillingBody | undefined,
): Promise<CompleteDoctorServiceRequestResult> {
  const access = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    select: { status: true, customerId: true },
  });

  if (!access) {
    return { ok: "NOT_FOUND" };
  }

  if (access.status === ServiceRequestStatus.COMPLETED) {
    const full = await prisma.serviceRequest.findFirst({
      where: { id: requestId, assignedDoctorId: doctorProfileId },
      include: buildDoctorCaseDetailInclude(doctorProfileId),
    });
    if (!full) return { ok: "NOT_FOUND" };
    const billingRow = await prisma.billingRecord.findFirst({
      where: { serviceRequestId: requestId, doctorId: doctorProfileId },
    });
    return {
      ok: "ALREADY_COMPLETED",
      request: mapDoctorCaseToDetailDto(full),
      billing: billingRow ? toDoctorBillingDtoFromRecord(billingRow) : null,
    };
  }

  if (!billingInput) {
    return { ok: "BILLING_REQUIRED" };
  }

  if (!DOCTOR_CASE_COMPLETABLE_STATUSES.includes(access.status)) {
    return { ok: "INVALID_STATUS", status: access.status };
  }

  const finalizedByDoctor = await prisma.treatmentCase.count({
    where: {
      serviceRequestId: requestId,
      doctorId: doctorProfileId,
      status: TreatmentCaseStatus.FINALIZED,
    },
  });

  if (finalizedByDoctor < 1) {
    return { ok: "TREATMENT_REQUIRED" };
  }

  const existingBilling = await prisma.billingRecord.findFirst({
    where: { serviceRequestId: requestId, doctorId: doctorProfileId },
    select: { id: true },
  });
  if (existingBilling) {
    return { ok: "BILLING_EXISTS" };
  }

  let txnResult: {
    billingId: string;
    totals: ReturnType<typeof calculateBillingTotals>;
  };
  try {
    txnResult = await prisma.$transaction(async (tx) => {
      const dup = await tx.billingRecord.findFirst({
        where: { serviceRequestId: requestId, doctorId: doctorProfileId },
        select: { id: true },
      });
      if (dup) {
        throw new Error("BILLING_RACE");
      }

      const updated = await tx.serviceRequest.updateMany({
        where: {
          id: requestId,
          assignedDoctorId: doctorProfileId,
          status: { in: [...DOCTOR_CASE_COMPLETABLE_STATUSES] },
        },
        data: {
          status: ServiceRequestStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        const again = await tx.serviceRequest.findFirst({
          where: { id: requestId, assignedDoctorId: doctorProfileId },
          select: { status: true },
        });
        if (again?.status === ServiceRequestStatus.COMPLETED) {
          throw new Error("ALREADY_COMPLETED_RACE");
        }
        throw new Error(
          `INVALID_STATUS:${again?.status ?? access.status}`,
        );
      }

      const treatmentCase = await tx.treatmentCase.findFirst({
        where: {
          serviceRequestId: requestId,
          doctorId: doctorProfileId,
          status: TreatmentCaseStatus.FINALIZED,
        },
        orderBy: [{ recordedAt: "desc" }, { createdAt: "desc" }],
        select: { id: true },
      });

      const commissionRate = await getPlatformCommissionRate(tx);

      const totals = calculateBillingTotals({
        serviceFee: billingInput.serviceFee,
        travelCost: billingInput.travelCost,
        medicineCost: billingInput.medicineCost,
        discount: billingInput.discount,
        commissionRate,
      });

      const billingLifecycleStatus = mapPaymentStatusToBillingStatus(
        billingInput.paymentStatus,
      );
      const paidAt =
        billingInput.paymentStatus === PaymentStatus.PAID ||
        billingInput.paymentStatus === PaymentStatus.PARTIAL
          ? new Date()
          : null;

      const created = await tx.billingRecord.create({
        data: {
          serviceRequestId: requestId,
          treatmentCaseId: treatmentCase?.id ?? null,
          doctorId: doctorProfileId,
          customerId: access.customerId,
          aiTechnicianId: null,
          status: billingLifecycleStatus,
          currency: "BDT",
          subtotal: moneyDecimal(totals.subtotal),
          tax: null,
          total: moneyDecimal(totals.totalCollected),
          serviceFee: moneyDecimal(totals.serviceFee),
          travelCost: moneyDecimal(totals.travelCost),
          medicineCost: moneyDecimal(totals.medicineCost),
          discountAmount: moneyDecimal(totals.discount),
          totalCollected: moneyDecimal(totals.totalCollected),
          platformCommission: moneyDecimal(totals.platformCommission),
          providerPayout: moneyDecimal(totals.providerPayout),
          paymentMethod: billingInput.paymentMethod,
          paymentStatus: billingInput.paymentStatus,
          issuedAt: new Date(),
          paidAt,
        },
        select: { id: true },
      });

      return { billingId: created.id, totals };
    });
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "BILLING_RACE") {
        return { ok: "BILLING_EXISTS" };
      }
      if (e.message === "ALREADY_COMPLETED_RACE") {
        const full = await prisma.serviceRequest.findFirst({
          where: { id: requestId, assignedDoctorId: doctorProfileId },
          include: buildDoctorCaseDetailInclude(doctorProfileId),
        });
        const billingRow = await prisma.billingRecord.findFirst({
          where: { serviceRequestId: requestId, doctorId: doctorProfileId },
        });
        return full
          ? {
              ok: "ALREADY_COMPLETED",
              request: mapDoctorCaseToDetailDto(full),
              billing: billingRow ? toDoctorBillingDtoFromRecord(billingRow) : null,
            }
          : { ok: "NOT_FOUND" };
      }
      if (e.message.startsWith("INVALID_STATUS:")) {
        const st = e.message.slice("INVALID_STATUS:".length) as ServiceRequestStatus;
        return { ok: "INVALID_STATUS", status: st };
      }
    }
    throw e;
  }

  const row = await prisma.serviceRequest.findFirst({
    where: { id: requestId, assignedDoctorId: doctorProfileId },
    include: buildDoctorCaseDetailInclude(doctorProfileId),
  });

  if (!row) {
    return { ok: "NOT_FOUND" };
  }

  const billingDto = toDoctorBillingDtoFromTotals({
    id: txnResult.billingId,
    totals: txnResult.totals,
    paymentMethod: billingInput.paymentMethod,
    paymentStatus: billingInput.paymentStatus,
    currency: "BDT",
  });

  void notifyServiceRequestCompleted(requestId).catch((err) =>
    console.error("[notifications] notifyServiceRequestCompleted", err),
  );

  void recordServiceRequestCompleted(requestId, doctorProfileId).catch((err) =>
    console.error("[timeline] recordServiceRequestCompleted", err),
  );

  return {
    ok: "COMPLETED",
    request: mapDoctorCaseToDetailDto(row),
    billing: billingDto,
  };
}
