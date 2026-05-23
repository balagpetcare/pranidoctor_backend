import { beforeAll, describe, expect, it } from 'vitest';

import { loadEnvironment } from './load-env.js';

import {
  validateMobileProfileModules,
  validateMobileProfileModulesCheck,
} from './mobile-profile-startup.js';

beforeAll(() => {
  loadEnvironment();
});

describe('validateMobileProfileModules', () => {
  it('loads customer-address, mobile-me adapter, and compat routes', async () => {
    const result = await validateMobileProfileModules();
    expect(result.ok, result.error).toBe(true);
    expect(result.details.customerAddressService).toBe(true);
    expect(result.details.mobileMeAdapter).toBe(true);
    expect(result.details.profileModule).toBe(true);
    expect(result.details.meRouteGet).toBe(true);
    expect(result.details.meRoutePatch).toBe(true);
    expect(result.details.settingsRouteGet).toBe(true);
  });

  it('returns healthy startup check', async () => {
    const check = await validateMobileProfileModulesCheck();
    expect(check.healthy).toBe(true);
    expect(check.name).toBe('mobile-profile-modules');
  });
});
