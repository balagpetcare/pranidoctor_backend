/**
 * Maps Express module names to legacy web lib paths for incremental porting.
 */
export const MODULE_TO_LEGACY_LIB: Record<string, string> = {
  auth: 'mobile-auth',
  users: 'mobile-customer',
  doctors: 'doctor-service-requests',
  animals: 'mobile-customer',
  clinics: 'mobile-ai-technician',
  ai: 'mobile-ai-services',
  notifications: 'notifications',
  media: 'storage',
  locations: 'locations',
  'service-instances': 'service-instances',
  'admin-semen': 'admin-semen',
};
