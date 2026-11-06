/**
 * Partner (service-provider) role hierarchy.
 *
 * DOCTOR        → may provide DOCTOR, AI_TECHNICIAN and HEALTH_WORKER services
 * AI_TECHNICIAN → may provide AI_TECHNICIAN and HEALTH_WORKER services
 * HEALTH_WORKER → may provide HEALTH_WORKER services only
 *
 * A partner only submits credentials for their PRIMARY role. Lower services
 * need no extra certificate — they are activated (fees, area, schedule) only.
 */
export const PARTNER_ROLES = ['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER'] as const;

export type PartnerRole = (typeof PARTNER_ROLES)[number];

/** Higher number = broader permission. */
const RANK: Record<PartnerRole, number> = {
  DOCTOR: 3,
  AI_TECHNICIAN: 2,
  HEALTH_WORKER: 1,
};

export function isPartnerRole(value: string): value is PartnerRole {
  return (PARTNER_ROLES as readonly string[]).includes(value);
}

/** All service roles a partner with this primary role may provide (broadest first). */
export function grantedServiceRoles(primary: PartnerRole): PartnerRole[] {
  return PARTNER_ROLES.filter((r) => RANK[r] <= RANK[primary]);
}

export function canProvideService(primary: PartnerRole, service: PartnerRole): boolean {
  return RANK[service] <= RANK[primary];
}

/**
 * Only the primary role needs its own verification documents.
 * Lower services inherited from it never require a separate certificate.
 */
export function requiresOwnCredentials(primary: PartnerRole, service: PartnerRole): boolean {
  return service === primary;
}
