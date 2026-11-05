import type { Prisma } from '../../../generated/prisma/index.js';
import {
  DEFAULT_DEMO_ID_PREFIXES,
  USER_APP_SEED_EMAIL_DOMAIN,
} from '../demo-data.constants.js';

import { daysAgo, hoursAgo, minutesAgo } from './escalation.helpers.js';
import {
  getMonitoringExcludeIdPrefixes,
  getMonitoringMaxRecordAgeDays,
  isMonitoringDemoIdExclusionEnabled,
  isMonitoringSeedCustomerExclusionEnabled,
  isProductionMonitoringEnvironment,
} from './escalation-config.js';

export type MonitoringScopeMeta = {
  environment: string;
  productionMonitoring: boolean;
  demoIdExclusion: boolean;
  seedCustomerExclusion: boolean;
  maxRecordAgeDays: number;
  excludeIdPrefixes: string[];
};

export function getMonitoringScopeMeta(): MonitoringScopeMeta {
  return {
    environment:
      process.env['APP_ENV']?.trim() ||
      process.env['NODE_ENV']?.trim() ||
      'development',
    productionMonitoring: isProductionMonitoringEnvironment(),
    demoIdExclusion: isMonitoringDemoIdExclusionEnabled(),
    seedCustomerExclusion: isMonitoringSeedCustomerExclusionEnabled(),
    maxRecordAgeDays: getMonitoringMaxRecordAgeDays(),
    excludeIdPrefixes: getMonitoringExcludeIdPrefixes(),
  };
}

/** IDs that must not drive production ops alerts (seed / demo / test fixtures). */
export function excludeDemoIdPrefixFilter(): Prisma.ServiceRequestWhereInput {
  if (!isMonitoringDemoIdExclusionEnabled()) {
    return {};
  }
  const prefixes = getMonitoringExcludeIdPrefixes();
  if (prefixes.length === 0) return {};
  return {
    NOT: {
      OR: prefixes.map((prefix) => ({ id: { startsWith: prefix } })),
    },
  };
}

export function excludeDemoServiceRequestIdFilter(): Prisma.ServiceRequestWhereInput {
  return excludeDemoIdPrefixFilter();
}

export function excludeDemoSupportTicketIdFilter(): Prisma.SupportTicketWhereInput {
  if (!isMonitoringDemoIdExclusionEnabled()) return {};
  const prefixes = getMonitoringExcludeIdPrefixes();
  if (prefixes.length === 0) return {};
  return {
    NOT: {
      OR: prefixes.map((prefix) => ({ id: { startsWith: prefix } })),
    },
  };
}

export function excludeSeedCustomerUserFilter(): Prisma.ServiceRequestWhereInput {
  if (!isMonitoringSeedCustomerExclusionEnabled()) return {};
  return {
    customer: {
      user: {
        email: { not: { endsWith: `@${USER_APP_SEED_EMAIL_DOMAIN}` } },
      },
    },
  };
}

export function excludeSeedCustomerOnSupportTicketFilter(): Prisma.SupportTicketWhereInput {
  if (!isMonitoringSeedCustomerExclusionEnabled()) return {};
  return {
    customer: {
      user: {
        email: { not: { endsWith: `@${USER_APP_SEED_EMAIL_DOMAIN}` } },
      },
    },
  };
}

/**
 * Drop records whose primary timestamp is older than the configured window
 * (avoids alerting on ancient seeded IN_PROGRESS rows).
 */
export function maxRecordAgeFilter(
  field: 'submittedAt' | 'assignedAt' | 'startedAt' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'flaggedAt',
): Record<string, { gte: Date }> | Record<string, never> {
  const days = getMonitoringMaxRecordAgeDays();
  if (days <= 0) return {};
  return { [field]: { gte: daysAgo(days) } };
}

export function serviceRequestMonitoringScope(
  extra?: Prisma.ServiceRequestWhereInput,
): Prisma.ServiceRequestWhereInput {
  return {
    AND: [
      excludeDemoServiceRequestIdFilter(),
      excludeSeedCustomerUserFilter(),
      ...(extra ? [extra] : []),
    ],
  };
}

export function supportTicketMonitoringScope(
  extra?: Prisma.SupportTicketWhereInput,
): Prisma.SupportTicketWhereInput {
  return {
    AND: [
      excludeDemoSupportTicketIdFilter(),
      excludeSeedCustomerOnSupportTicketFilter(),
      ...(extra ? [extra] : []),
    ],
  };
}

export function aiEscalationMonitoringScope(
  extra?: Prisma.AiEscalationRecordWhereInput,
): Prisma.AiEscalationRecordWhereInput {
  if (!isMonitoringDemoIdExclusionEnabled()) {
    return extra ?? {};
  }
  const prefixes = getMonitoringExcludeIdPrefixes();
  const demoFilter: Prisma.AiEscalationRecordWhereInput =
    prefixes.length > 0
      ? {
          NOT: {
            OR: prefixes.map((prefix) => ({ id: { startsWith: prefix } })),
          },
        }
      : {};
  return extra ? { AND: [demoFilter, extra] } : demoFilter;
}

/** Stalled IN_PROGRESS: older than stall threshold but not ancient history. */
export function inProgressStalledStartedAtFilter(maxStallMinutes: number): {
  lt: Date;
  gte?: Date;
} {
  const filter: { lt: Date; gte?: Date } = {
    lt: minutesAgo(maxStallMinutes),
  };
  const days = getMonitoringMaxRecordAgeDays();
  if (days > 0) {
    filter.gte = daysAgo(days);
  }
  return filter;
}

export function assignedStaleAssignedAtFilter(maxAgeMinutes: number): {
  lt: Date;
  gte?: Date;
} {
  const filter: { lt: Date; gte?: Date } = {
    lt: minutesAgo(maxAgeMinutes),
  };
  const days = getMonitoringMaxRecordAgeDays();
  if (days > 0) {
    filter.gte = daysAgo(days);
  }
  return filter;
}

export function windowSinceFilter(since: Date): { gte: Date } {
  const days = getMonitoringMaxRecordAgeDays();
  if (days <= 0) return { gte: since };
  const floor = daysAgo(days);
  return { gte: since > floor ? since : floor };
}

export function filterDemoSampleRows<T extends { id: string }>(rows: T[]): T[] {
  if (!isMonitoringDemoIdExclusionEnabled()) return rows;
  const prefixes = getMonitoringExcludeIdPrefixes();
  return rows.filter((row) => !prefixes.some((p) => row.id.startsWith(p)));
}

