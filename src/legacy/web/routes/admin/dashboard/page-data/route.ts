import {
  BillingStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  TreatmentCaseStatus,
} from "@/generated/prisma/client";
import { jsonError, jsonOk } from "@/lib/api-response";
import { requireAdminPanelApiAccess } from "@/lib/admin-auth/api-guard";
import { prisma } from "@/lib/prisma";

const pendingStatuses: ServiceRequestStatus[] = [
  ServiceRequestStatus.PENDING,
  ServiceRequestStatus.ACCEPTED,
  ServiceRequestStatus.ASSIGNED,
  ServiceRequestStatus.IN_PROGRESS,
];

const revenueStatuses: BillingStatus[] = [
  BillingStatus.ISSUED,
  BillingStatus.PARTIALLY_PAID,
  BillingStatus.PAID,
];

function formatBdt(amount: number): string {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

const RECENT_LIMIT = 8;

export async function GET(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const url = new URL(request.url);
  const adminUserId = url.searchParams.get("adminUserId") ?? undefined;

  try {
    const [
      totalDoctors,
      totalAiTechnicians,
      totalCustomers,
      totalServiceRequests,
      pendingRequests,
      completedServiceRequests,
      completedTreatments,
      revenueAgg,
      paidAgg,
      recentRows,
      unreadNotifications,
    ] = await Promise.all([
      prisma.doctorProfile.count(),
      prisma.aiTechnicianProfile.count(),
      prisma.customerProfile.count(),
      prisma.serviceRequest.count(),
      prisma.serviceRequest.count({
        where: { status: { in: pendingStatuses } },
      }),
      prisma.serviceRequest.count({
        where: { status: ServiceRequestStatus.COMPLETED },
      }),
      prisma.treatmentCase.count({
        where: { status: TreatmentCaseStatus.FINALIZED },
      }),
      prisma.billingRecord.aggregate({
        _sum: { total: true },
        where: { status: { in: revenueStatuses } },
      }),
      prisma.billingRecord.aggregate({
        _sum: { total: true },
        where: { status: BillingStatus.PAID },
      }),
      prisma.serviceRequest.findMany({
        orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
        take: RECENT_LIMIT,
        select: {
          id: true,
          status: true,
          serviceType: true,
          submittedAt: true,
          customer: { select: { displayName: true } },
        },
      }),
      adminUserId
        ? prisma.notification.count({
            where: { userId: adminUserId, readAt: null },
          })
        : Promise.resolve(0),
    ]);

    const sum = revenueAgg._sum.total;
    const amount = sum == null ? 0 : Number(sum);
    const paidSum = paidAgg._sum.total;
    const paidAmount = paidSum == null ? 0 : Number(paidSum);

    const stats = {
      totalDoctors,
      totalAiTechnicians,
      totalCustomers,
      totalServiceRequests,
      pendingRequests,
      completedServiceRequests,
      completedTreatments,
      totalRevenueDisplay: formatBdt(amount),
      paidRevenueDisplay: formatBdt(paidAmount),
    };

    const recentRequests = recentRows.map((r) => ({
      id: r.id,
      status: r.status,
      serviceType: r.serviceType,
      submittedAt: r.submittedAt.toISOString(),
      customerDisplayName: r.customer.displayName,
    }));

    return jsonOk({ stats, recentRequests, unreadNotifications });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load dashboard data", 500);
  }
}
