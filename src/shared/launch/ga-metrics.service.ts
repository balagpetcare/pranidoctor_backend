import {
  ProviderStatus,
  ServiceRequestStatus,
  ServiceRequestType,
  SupportTicketStatus,
  UserRole,
} from '../../generated/prisma/index.js';
import { getPrisma } from '../database/prisma.js';
import { getAiGovernanceService } from '../../modules/ai/governance/ai-governance.service.js';
import { getGaLaunchConfig } from './ga-config.service.js';
import type { GaDashboardMetrics } from './ga-launch.types.js';

const sevenDaysAgo = (): Date => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

export async function buildGaDashboardMetrics(): Promise<GaDashboardMetrics> {
  const config = await getGaLaunchConfig();
  const prisma = getPrisma();
  const since = sevenDaysAgo();

  const [
    totalCustomers,
    registeredLast7Days,
    activatedLast7Days,
    activeDoctors,
    emergencyDoctors,
    totalRequests,
    pendingRequests,
    completedRequests,
    emergencyRequests,
    openTickets,
    gaFeedbackTickets,
    aiSessions,
    openEscalations,
  ] = await Promise.all([
    prisma.user.count({ where: { role: UserRole.CUSTOMER } }),
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
        OR: [
          { subject: { startsWith: '[GA Feedback]' } },
          { subject: { startsWith: '[Beta Feedback]' } },
        ],
      },
    }),
    prisma.aiAssistantSession.count({ where: { createdAt: { gte: since } } }),
    prisma.aiEscalationRecord.count({
      where: { status: { in: ['PENDING_REVIEW', 'QUEUED'] } },
    }),
  ]);

  const completionRatePct =
    totalRequests > 0
      ? Math.round((completedRequests / totalRequests) * 1000) / 10
      : null;

  let llmDisabled = false;
  let governanceHydrated = false;
  try {
    const gov = getAiGovernanceService();
    llmDisabled = gov.isLlmDisabled();
    governanceHydrated = gov.isHydrated();
  } catch {
    /* optional in tests */
  }

  const weeklyCapRemaining =
    config.weeklyRegistrationCap !== null
      ? Math.max(0, config.weeklyRegistrationCap - registeredLast7Days)
      : null;

  return {
    generatedAt: new Date().toISOString(),
    config: {
      enabled: config.enabled,
      phase: config.phase,
      goNoGoVerdict: config.goNoGoVerdict,
      playRolloutPct: config.playRolloutPct,
      weeklyRegistrationCap: config.weeklyRegistrationCap,
      minDoctorsForPhase: config.minDoctorsForPhase,
    },
    users: {
      totalCustomers,
      registeredLast7Days,
      activatedLast7Days,
      registrationsLast7Days: registeredLast7Days,
      weeklyCapRemaining,
    },
    doctors: {
      activeVerified: activeDoctors,
      acceptingEmergency: emergencyDoctors,
      minRequired: config.minDoctorsForPhase,
      supplyOk: activeDoctors >= config.minDoctorsForPhase,
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
      gaFeedbackTicketsLast7Days: gaFeedbackTickets,
    },
    incident: {
      openSev1Placeholder: 0,
      warRoomUrl: config.monitoringLinks.warRoom ?? null,
    },
    systemHealth: {
      ready: true,
      aiGovernanceHydrated: governanceHydrated,
      llmDisabled,
    },
  };
}
