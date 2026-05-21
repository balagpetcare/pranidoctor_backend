import { describe, expect, it } from 'vitest';

import { configureVoiceAssistantRoutes } from './voice-assistant.routes.js';
import { VoiceAssistantController } from './voice-assistant.controller.js';

describe('voice-assistant routes', () => {
  it('registers voice endpoints', () => {
    const paths: string[] = [];
    const router = {
      post: (path: string) => paths.push(`POST ${path}`),
      get: (path: string) => paths.push(`GET ${path}`),
    } as unknown as import('express').Router;

    configureVoiceAssistantRoutes(router, new VoiceAssistantController());

    expect(paths).toContain('POST /stt');
    expect(paths).toContain('POST /chat');
    expect(paths).toContain('POST /navigation');
    expect(paths).toContain('GET /session');
  });
});
