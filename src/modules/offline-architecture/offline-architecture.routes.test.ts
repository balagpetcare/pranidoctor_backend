import { describe, expect, it } from 'vitest';

import { configureSyncRoutes, configureOfflineRoutes } from './offline-architecture.routes.js';
import { SyncController, OfflineController } from './offline-architecture.controller.js';

describe('offline-architecture routes', () => {
  it('registers sync endpoints', () => {
    const paths: string[] = [];
    const router = {
      get: (path: string) => paths.push(`GET ${path}`),
      post: (path: string) => paths.push(`POST ${path}`),
    } as never;

    configureSyncRoutes(router, new SyncController());
    expect(paths).toContain('GET /status');
    expect(paths).toContain('POST /');
    expect(paths).toContain('POST /retry');
  });

  it('registers offline queue endpoint', () => {
    const paths: string[] = [];
    const router = {
      get: (path: string) => paths.push(`GET ${path}`),
    } as never;

    configureOfflineRoutes(router, new OfflineController());
    expect(paths).toContain('GET /queue');
  });
});
