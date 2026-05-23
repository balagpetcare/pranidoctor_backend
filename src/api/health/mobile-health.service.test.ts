import { beforeAll, describe, expect, it } from 'vitest';

import { loadEnvironment } from '../../shared/config/load-env.js';

import { getMobileHealthStatus, isMobileHealthOk } from './mobile-health.service.js';

beforeAll(() => {
  loadEnvironment();
});

describe('getMobileHealthStatus', () => {
  it('reports mobile profile dependencies healthy', async () => {
    const status = await getMobileHealthStatus();
    expect(isMobileHealthOk(status)).toBe(true);
    expect(status.mobileMe).toBe(true);
    expect(status.profile).toBe(true);
    expect(status.settings).toBe(true);
    expect(status.auth).toBe(true);
    expect(status.timestamp).toBeTruthy();
  });
});
