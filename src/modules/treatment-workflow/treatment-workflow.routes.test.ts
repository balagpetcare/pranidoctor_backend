import { describe, expect, it } from 'vitest';

import { configureTreatmentWorkflowRoutes } from './treatment-workflow.routes.js';
import { TreatmentWorkflowController } from './treatment-workflow.controller.js';

describe('treatment-workflow routes', () => {
  it('registers treatment workflow endpoints', () => {
    const paths: string[] = [];
    const router = {
      get: (path: string) => paths.push(`GET ${path}`),
      post: (path: string) => paths.push(`POST ${path}`),
    } as unknown as import('express').Router;

    configureTreatmentWorkflowRoutes(router, new TreatmentWorkflowController());

    expect(paths).toContain('GET /:id/treatment');
    expect(paths).toContain('POST /:id/consultation');
    expect(paths).toContain('POST /:id/diagnosis');
    expect(paths).toContain('POST /:id/prescription');
    expect(paths).toContain('POST /:id/followup');
    expect(paths).toContain('POST /:id/close');
    expect(paths).toContain('GET /:id/notes');
    expect(paths).toContain('POST /:id/notes');
  });
});
