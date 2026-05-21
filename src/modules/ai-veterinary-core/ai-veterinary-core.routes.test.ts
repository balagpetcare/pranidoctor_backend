import { describe, expect, it } from 'vitest';

import { configureAiVeterinaryCoreRoutes } from './ai-veterinary-core.routes.js';
import { AiVeterinaryCoreController } from './ai-veterinary-core.controller.js';

describe('ai-veterinary-core routes', () => {
  it('registers core AI endpoints', () => {
    const paths: string[] = [];
    const router = {
      post: (path: string) => paths.push(`POST ${path}`),
      get: (path: string) => paths.push(`GET ${path}`),
      delete: (path: string) => paths.push(`DELETE ${path}`),
    } as unknown as import('express').Router;

    configureAiVeterinaryCoreRoutes(router, new AiVeterinaryCoreController());

    expect(paths).toContain('POST /chat');
    expect(paths).toContain('POST /triage');
    expect(paths).toContain('GET /memory');
    expect(paths).toContain('DELETE /memory');
    expect(paths).toContain('POST /escalate');
  });
});
