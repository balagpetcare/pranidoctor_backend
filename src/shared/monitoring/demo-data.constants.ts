/**
 * Aligns with scripts/seed/user-app-seed-helpers.ts — used to exclude demo rows from ops monitoring.
 */
export const USER_APP_SEED_ID_PREFIX = 'uaseed-';
export const USER_APP_SEED_EMAIL_DOMAIN = 'userapp.seed.pranidoctor.test';

/** Additional ID prefixes commonly used for test fixtures. */
export const DEFAULT_DEMO_ID_PREFIXES = [
  USER_APP_SEED_ID_PREFIX,
  'demo-',
  'test-seed-',
] as const;
