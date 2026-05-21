import {
  AiServiceRequestStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  serializeAiServiceRecord,
  serializeAiServiceRequest,
  technicianCoversRequestLocation,
} from "@/lib/mobile-ai-services/ai-services-service";
import type { CompleteAiServiceRequestBody } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";
import type { ListTechnicianAiRequestsQuery } from "@/lib/mobile-ai-technician/technician-ai-requests-schemas";

const technicianRequestInclude = {
  customer: {
    select: {
      id: true,
      customerProfile: { select: { displayName: true } },
    },
  },
  technicianProfile: { select: { id: true, displayName: true } },
  aiServiceRecord: true,
} satisfies Prisma.AiServiceRequestInclude;

type TechnicianRequestRow = Prisma.AiServiceRequestGetPayload<{
  include: typeof technicianRequestInclude;
}>;

function serializeAiServiceRequestForTechnician(row: TechnicianRequestRow) {
  const base = serializeAiServiceRequest(row);
  const farmerDisplayName =
    row.customer.customerProfile?.displayName?.trim() || null;
  return {
    ...base,
    farmerDisplayName,
  };
}

async function requestVisibleToTechnician(
  row: TechnicianRequestRow,
  technicianProfileId: string,
): Promise<boolean> {
  if (row.technicianProfileId === technicianProfileId) return true;
  if (
    row.status === AiServiceRequestStatus.PENDING &&
    row.technicianProfileId == null
  ) {
    return technicianCoversRequestLocation(
      technicianProfileId,
      row.district,
      row.upazila,
      row.unionOrArea,
    );
  }
  return false;
}

function prismaTabWhere(
  tab: ListTechnicianAiRequestsQuery["tab"],
  technicianProfileId: string,
): Prisma.AiServiceRequestWhereInput {
  const mineOrPool: Prisma.AiServiceRequestWhereInput = {
    OR: [
      { technicianProfileId },
      {
        technicianProfileId: null,
        status: AiServiceRequestStatus.PENDING,
      },
    ],
  };

  if (!tab || tab === "all") {
    return mineOrPool;
  }
  if (tab === "new") {
    return {
      AND: [mineOrPool, { status: AiServiceRequestStatus.PENDING }],
    };
  }
  if (tab === "accepted") {
    return {
      technicianProfileId,
      status: AiServiceRequestStatus.ACCEPTED,
    };
  }
  if (tab === "ongoing") {
    return {
      technicianProfileId,
      status: {
        in: [
          AiServiceRequestStatus.ON_THE_WAY,
          AiServiceRequestStatus.ARRIVED,
          AiServiceRequestStatus.IN_PROGRESS,
        ],
      },
    };
  }
  if (tab === "completed") {
    return {
      technicianProfileId,
      status: AiServiceRequestStatus.COMPLETED,
    };
  }
  if (tab === "cancelled") {
    return {
      technicianProfileId,
      status: {
        in: [
          AiServiceRequestStatus.DECLINED,
          AiServiceRequestStatus.CANCELLED,
        ],
      },
    };
  }
  return mineOrPool;
}

const MAX_LIST_SCAN = 400;

export async function listTechnicianAiServiceRequests(params: {
  technicianProfileId: string;
  query: ListTechnicianAiRequestsQuery;
}) {
  const limit = params.query.limit ?? 30;
  const offset = params.query.offset ?? 0;
  const tab = params.query.tab;

  const rows = await prisma.aiServiceRequest.findMany({
    where: prismaTabWhere(tab, params.technicianProfileId),
    orderBy: { createdAt: "desc" },
    take: MAX_LIST_SCAN,
    include: technicianRequestInclude,
  });

  const visible: TechnicianRequestRow[] = [];
  for (const row of rows) {
    if (
      await requestVisibleToTechnician(row, params.technicianProfileId)
    ) {
      visible.push(row);
    }
  }

  const paged = visible.slice(offset, offset + limit);

  return {
    items: paged.map(serializeAiServiceRequestForTechnician),
    limit,
    offset,
    /** When results exceed scan window, counts may be incomplete. */
    truncated: visible.length >= MAX_LIST_SCAN,
  };
}

export async function getTechnicianAiServiceRequestById(params: {
  technicianProfileId: string;
  id: string;
}) {
  const row = await prisma.aiServiceRequest.findFirst({
    where: { id: params.id },
    include: technicianRequestInclude,
  });
  if (!row) return null;

  if (
    !(await requestVisibleToTechnician(row, params.technicianProfileId))
  ) {
    return null;
  }

  return serializeAiServiceRequestForTechnician(row);
}

async function loadRequestForTechnician(params: {
  technicianProfileId: string;
  id: string;
}): Promise<TechnicianRequestRow | null> {
  const row = await prisma.aiServiceRequest.findFirst({
    where: { id: params.id },
    include: technicianRequestInclude,
  });
  if (!row) return null;

  if (
    !(await requestVisibleToTechnician(row, params.technicianProfileId))
  ) {
    return null;
  }
  return row;
}

export async function acceptTechnicianAiServiceRequest(params: {
  technicianProfileId: string;
  id: string;
}) {
  const row = await loadRequestForTechnician(params);
  if (!row) return { ok: false as const, code: "NOT_FOUND" as const };

  if (row.status !== AiServiceRequestStatus.PENDING) {
    return { ok: false as const, code: "INVALID_STATUS" as const };
  }

  if (
    row.technicianProfileId != null &&
    row.technicianProfileId !== params.technicianProfileId
  ) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }

  const covers = await technicianCoversRequestLocation(
    params.technicianProfileId,
    row.district,
    row.upazila,
    row.unionOrArea,
  );
  if (!covers) {
    return { ok: false as const, code: "AREA_MISMATCH" as const };
  }

  const updated = await prisma.aiServiceRequest.update({
    where: { id: row.id },
    data: {
      status: AiServiceRequestStatus.ACCEPTED,
      technicianProfileId: params.technicianProfileId,
    },
    include: technicianRequestInclude,
  });

  return {
    ok: true as const,
    request: serializeAiServiceRequestForTechnician(updated),
  };
}

export async function declineTechnicianAiServiceRequest(params: {
  technicianProfileId: string;
  id: string;
  reason?: string | null;
}) {
  const row = await loadRequestForTechnician(params);
  if (!row) return { ok: false as const, code: "NOT_FOUND" as const };

  if (row.status !== AiServiceRequestStatus.PENDING) {
    return { ok: false as const, code: "INVALID_STATUS" as const };
  }

  if (
    row.technicianProfileId != null &&
    row.technicianProfileId !== params.technicianProfileId
  ) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }

  const updated = await prisma.aiServiceRequest.update({
    where: { id: row.id },
    data: {
      status: AiServiceRequestStatus.DECLINED,
      declineReason: params.reason?.trim() || null,
    },
    include: technicianRequestInclude,
  });

  return {
    ok: true as const,
    request: serializeAiServiceRequestForTechnician(updated),
  };
}

const statusOrder: AiServiceRequestStatus[] = [
  AiServiceRequestStatus.ACCEPTED,
  AiServiceRequestStatus.ON_THE_WAY,
  AiServiceRequestStatus.ARRIVED,
  AiServiceRequestStatus.IN_PROGRESS,
];

function canTransitionTo(
  current: AiServiceRequestStatus,
  next: AiServiceRequestStatus,
): boolean {
  const idx = statusOrder.indexOf(current);
  if (idx < 0) return false;
  const nextIdx = statusOrder.indexOf(next);
  if (nextIdx < 0) return false;
  return nextIdx === idx + 1;
}

export async function updateTechnicianAiServiceRequestStatus(params: {
  technicianProfileId: string;
  id: string;
  status: "ON_THE_WAY" | "ARRIVED" | "IN_PROGRESS";
}) {
  const row = await loadRequestForTechnician(params);
  if (!row) return { ok: false as const, code: "NOT_FOUND" as const };

  if (row.technicianProfileId !== params.technicianProfileId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }

  const nextStatus =
    params.status === "ON_THE_WAY"
      ? AiServiceRequestStatus.ON_THE_WAY
      : params.status === "ARRIVED"
        ? AiServiceRequestStatus.ARRIVED
        : AiServiceRequestStatus.IN_PROGRESS;

  if (!canTransitionTo(row.status, nextStatus)) {
    return { ok: false as const, code: "INVALID_TRANSITION" as const };
  }

  const updated = await prisma.aiServiceRequest.update({
    where: { id: row.id },
    data: { status: nextStatus },
    include: technicianRequestInclude,
  });

  return {
    ok: true as const,
    request: serializeAiServiceRequestForTechnician(updated),
  };
}

function parseDecimalFee(
  input: CompleteAiServiceRequestBody["totalFee"],
): Prisma.Decimal | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if (typeof input === "number") return new Prisma.Decimal(input);
  const n = Number(input);
  if (Number.isNaN(n)) return undefined;
  return new Prisma.Decimal(input);
}

export async function completeTechnicianAiServiceRequest(params: {
  technicianProfileId: string;
  id: string;
  body: CompleteAiServiceRequestBody;
}) {
  const row = await loadRequestForTechnician(params);
  if (!row) return { ok: false as const, code: "NOT_FOUND" as const };

  if (row.technicianProfileId !== params.technicianProfileId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }

  if (row.status !== AiServiceRequestStatus.IN_PROGRESS) {
    return { ok: false as const, code: "INVALID_STATUS" as const };
  }

  if (row.aiServiceRecord) {
    return { ok: false as const, code: "ALREADY_COMPLETED" as const };
  }

  const totalFee = parseDecimalFee(params.body.totalFee);
  if (totalFee === undefined && params.body.totalFee != null) {
    return { ok: false as const, code: "INVALID_FEE" as const };
  }

  const paymentStatus =
    params.body.paymentStatus ?? row.paymentStatus ?? undefined;

  const result = await prisma.$transaction(async (tx) => {
    const record = await tx.aiServiceRecord.create({
      data: {
        aiServiceRequestId: row.id,
        technicianProfileId: params.technicianProfileId,
        customerUserId: row.customerUserId,
        serviceDate: new Date(params.body.serviceDate),
        animalType: params.body.animalType,
        serviceNote: params.body.serviceNote.trim(),
        breedOrSemenType: params.body.breedOrSemenType?.trim() || null,
        semenBatch: params.body.semenBatch?.trim() || null,
        heatObservation: params.body.heatObservation?.trim() || null,
        inseminationTime: params.body.inseminationTime
          ? new Date(params.body.inseminationTime)
          : null,
        nextFollowUpDate: params.body.nextFollowUpDate
          ? new Date(params.body.nextFollowUpDate)
          : null,
        pregnancyCheckDate: params.body.pregnancyCheckDate
          ? new Date(params.body.pregnancyCheckDate)
          : null,
        totalFee: totalFee ?? null,
        paymentStatus: paymentStatus ?? undefined,
      },
    });

    const updated = await tx.aiServiceRequest.update({
      where: { id: row.id },
      data: {
        status: AiServiceRequestStatus.COMPLETED,
        paymentStatus: paymentStatus ?? undefined,
        ...(totalFee !== undefined ? { finalFee: totalFee } : {}),
      },
      include: technicianRequestInclude,
    });

    return { record, updated };
  });

  return {
    ok: true as const,
    request: serializeAiServiceRequestForTechnician(result.updated),
    record: serializeAiServiceRecord(result.record),
  };
}

export async function getAiServiceRecordForRequestViewer(params: {
  requestId: string;
  viewer:
    | { kind: "customer"; userId: string }
    | { kind: "technician"; technicianProfileId: string };
}) {
  const row = await prisma.aiServiceRequest.findFirst({
    where: { id: params.requestId },
    include: {
      aiServiceRecord: true,
      technicianProfile: { select: { id: true } },
    },
  });

  if (!row?.aiServiceRecord) return null;
  if (row.status !== AiServiceRequestStatus.COMPLETED) return null;

  if (params.viewer.kind === "customer") {
    if (row.customerUserId !== params.viewer.userId) return null;
  } else if (row.technicianProfile?.id !== params.viewer.technicianProfileId) {
    return null;
  }

  return serializeAiServiceRecord(row.aiServiceRecord);
}
