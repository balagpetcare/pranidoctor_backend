import { describe, expect, it } from 'vitest';

import { configureAreaEngineRoutes } from './area-engine.routes.js';
import { AreaEngineController } from './area-engine.controller.js';

describe('area-engine routes', () => {
  it('registers hierarchy and search endpoints', () => {
    const paths: string[] = [];
    const router = {
      get: (path: string) => {
        paths.push(path);
      },
    } as unknown as import('express').Router;

    configureAreaEngineRoutes(router, new AreaEngineController());

    expect(paths).toContain('/divisions');
    expect(paths).toContain('/divisions/:id/districts');
    expect(paths).toContain('/districts/:id/upazilas');
    expect(paths).toContain('/upazilas/:id/unions');
    expect(paths).toContain('/unions/:id/villages');
    expect(paths).toContain('/search');
  });
});
