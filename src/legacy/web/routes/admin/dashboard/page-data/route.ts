import {
  BillingStatus,
  ProviderStatus,
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

function serviceRequestStatusLabel(status: ServiceRequestStatus): string {
  switch (status) {
    case ServiceRequestStatus.PENDING:
      return "অপেক্ষমান";
    case ServiceRequestStatus.ACCEPTED:
      return "গৃহীত";
    case ServiceRequestStatus.ASSIGNED:
      return "বরাদ্দ";
    case ServiceRequestStatus.IN_PROGRESS:
      return "চলমান";
    case ServiceRequestStatus.COMPLETED:
      return "সম্পন্ন";
    case ServiceRequestStatus.CANCELLED:
      return "বাতিল";
    case ServiceRequestStatus.REJECTED:
      return "প্রত্যাখ্যাত";
    default:
      return status;
  }
}

function serviceRequestTypeLabel(type: ServiceRequestType): string {
  switch (type) {
    case ServiceRequestType.DOCTOR_HOME_VISIT:
      return "হোম ভিজিট";
    case ServiceRequestType.EMERGENCY_DOCTOR:
      return "জরুরি";
    case ServiceRequestType.AI_SERVICE:
      return "এআই";
    case ServiceRequestType.ONLINE_CONSULTATION_LATER:
      return "অনলাইন";
    default:
      return type;
  }
}

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
      statusGroups,
      typeGroups,
      doctorActive,
      doctorPending,
      doctorSuspended,
      doctorRejected,
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
      prisma.serviceRequest.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.serviceRequest.groupBy({
        by: ["serviceType"],
        _count: { _all: true },
      }),
      prisma.doctorProfile.count({
        where: { providerStatus: ProviderStatus.ACTIVE },
      }),
      prisma.doctorProfile.count({
        where: { providerStatus: ProviderStatus.PENDING_VERIFICATION },
      }),
      prisma.doctorProfile.count({
        where: { providerStatus: ProviderStatus.SUSPENDED },
      }),
      prisma.doctorProfile.count({
        where: { providerStatus: ProviderStatus.REJECTED },
      }),
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
      totalRevenueBdt: amount,
      paidRevenueBdt: paidAmount,
      unpaidRevenueBdt: Math.max(0, amount - paidAmount),
    };

    const recentRequests = recentRows.map((r) => ({
      id: r.id,
      status: r.status,
      serviceType: r.serviceType,
      submittedAt: r.submittedAt.toISOString(),
      customerDisplayName: r.customer.displayName,
    }));

    const charts = {
      serviceRequestsByStatus: statusGroups.map((row) => ({
        key: row.status,
        label: serviceRequestStatusLabel(row.status),
        value: row._count._all,
      })),
      serviceRequestsByType: typeGroups.map((row) => ({
        key: row.serviceType,
        label: serviceRequestTypeLabel(row.serviceType),
        value: row._count._all,
      })),
      teamComposition: [
        { key: "doctors", label: "ডাক্তার", value: totalDoctors },
        { key: "aiTechnicians", label: "এআই টেক", value: totalAiTechnicians },
        { key: "customers", label: "গ্রাহক", value: totalCustomers },
      ],
    };

    const doctorStats = {
      total: totalDoctors,
      active: doctorActive,
      pendingVerification: doctorPending,
      suspended: doctorSuspended,
      rejected: doctorRejected,
    };

    const revenue = {
      totalBdt: amount,
      paidBdt: paidAmount,
      unpaidBdt: Math.max(0, amount - paidAmount),
      totalDisplay: formatBdt(amount),
      paidDisplay: formatBdt(paidAmount),
      unpaidDisplay: formatBdt(Math.max(0, amount - paidAmount)),
    };

    return jsonOk({
      stats,
      recentRequests,
      unreadNotifications,
      charts,
      doctorStats,
      revenue,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return jsonError("DATABASE_ERROR", "Failed to load dashboard data", 500);
  }
}
