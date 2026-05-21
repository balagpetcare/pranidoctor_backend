/**
 * Registry of migrated web domain code (read-only reference + future Express ports).
 * Routes: src/legacy/web/routes (171 Next.js handlers)
 * Services: src/legacy/web/lib
 */
export const LEGACY_ROUTE_COUNT = 171;

export const LEGACY_LIB_DOMAINS = [
  'admin-auth',
  'mobile-auth',
  'storage',
  'locations',
  'service-instances',
  'mobile-ai-technician',
  'admin-semen',
  'notifications',
  'sms',
  'mobile-ai-services',
  'doctor-service-requests',
  'mobile-service-requests',
] as const;
