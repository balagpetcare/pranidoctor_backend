import {
  ProviderStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  SupportTicketStatus,
  UserRole,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../database/prisma.js';
import { getAiGovernanceService } from '../../modules/ai/governance/ai-governance.service.js';
import { getClosedBetaConfig } from './closed-beta-config.service.js';
import type { ClosedBetaDashboardMetrics } from './closed-beta.types.js';

const sevenDaysAgo = (): Date => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function buildClosedBetaDashboardMetrics(): Promise<ClosedBetaDashboardMetrics> {
  const config = await getClosedBetaConfig();
  const prisma = getPrisma();
  const since = sevenDaysAgo();
  const betaUserIds = Object.keys(config.betaUserTags);

  const [
    registeredLast7Days,
    activatedLast7Days,
    activeDoctors,
    emergencyDoctors,
    totalRequests,
    pendingRequests,
    completedRequests,
    emergencyRequests,
    openTickets,
    betaFeedbackTickets,
    aiSessions,
    openEscalations,
  ] = await Promise.all([
    prisma.user.count({
      where: { role: UserRole.CUSTOMER, createdAt: { gte: since } },
    }),
    prisma.customerProfile.count({
      where: { profileCompletedAt: { gte: since } },
    }),
    prisma.doctorProfile.count({
      where: { providerStatus: ProviderStatus.ACTIVE },
    }),
    prisma.doctorProfile.count({
      where: { providerStatus: ProviderStatus.ACTIVE, acceptsEmergency: true },
    }),
    prisma.serviceRequest.count(),
    prisma.serviceRequest.count({
      where: {
        status: {
          in: [
            ServiceRequestStatus.PENDING,
            ServiceRequestStatus.ACCEPTED,
            ServiceRequestStatus.ASSIGNED,
            ServiceRequestStatus.IN_PROGRESS,
          ],
        },
      },
    }),
    prisma.serviceRequest.count({
      where: { status: ServiceRequestStatus.COMPLETED },
    }),
    prisma.serviceRequest.count({
      where: { serviceType: ServiceRequestType.EMERGENCY_DOCTOR },
    }),
    prisma.supportTicket.count({
      where: {
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
    }),
    prisma.supportTicket.count({
      where: {
        createdAt: { gte: since },
        subject: { startsWith: '[Beta Feedback]' },
      },
    }),
    prisma.aiAssistantSession.count({ where: { createdAt: { gte: since } } }),
    prisma.aiEscalationRecord.count({
      where: { status: { in: ['PENDING_REVIEW', 'QUEUED'] } },
    }),
  ]);

  const taggedBetaUsers = betaUserIds.length;
  const taggedBetaDoctors = Object.keys(config.betaDoctorTags).length;
  const submitted = totalRequests;
  const completionRatePct =
    submitted > 0 ? Math.round((completedRequests / submitted) * 1000) / 10 : null;

  let llmDisabled = false;
  let governanceHydrated = false;
  try {
    const gov = getAiGovernanceService();
    llmDisabled = gov.isLlmDisabled();
    governanceHydrated = gov.isHydrated();
  } catch {
    /* governance optional during tests */
  }

  return {
    generatedAt: new Date().toISOString(),
    config: {
      enabled: config.enabled,
      activeCohort: config.activeCohort,
      maxUsers: config.maxUsers,
      maxDoctors: config.maxDoctors,
      enforceInviteList: config.enforceInviteList,
      feedbackEnabled: config.feedbackEnabled,
    },
    users: {
      totalBetaTagged: taggedBetaUsers,
      registeredLast7Days,
      activatedLast7Days,
      capRemaining: config.enforceUserCap
        ? Math.max(0, config.maxUsers - taggedBetaUsers)
        : null,
    },
    doctors: {
      totalBetaTagged: taggedBetaDoctors,
      activeVerified: activeDoctors,
      acceptingEmergency: emergencyDoctors,
      capRemaining: Math.max(0, config.maxDoctors - taggedBetaDoctors),
    },
    consultations: {
      totalRequests,
      pending: pendingRequests,
      completed: completedRequests,
      emergencyRequests,
      completionRatePct,
    },
    ai: {
      sessionsLast7Days: aiSessions,
      escalationsOpen: openEscalations,
      llmDisabled,
    },
    support: {
      openTickets,
      betaFeedbackTicketsLast7Days: betaFeedbackTickets,
    },
    systemHealth: {
      ready: true,
      aiGovernanceHydrated: governanceHydrated,
      llmDisabled,
    },
  };
}
