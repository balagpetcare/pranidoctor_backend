import { describe, expect, it } from 'vitest';

import { buildFcmMessage, readFcmConfig } from './fcm.service.js';

describe('readFcmConfig', () => {
  it('returns null when anything is missing', () => {
    expect(readFcmConfig({ FCM_PROJECT_ID: 'p' } as NodeJS.ProcessEnv)).toBeNull();
  });
  it('restores newlines in the private key', () => {
    const c = readFcmConfig({ FCM_PROJECT_ID: 'p', FCM_CLIENT_EMAIL: 'a@b.c', FCM_PRIVATE_KEY: 'A\\nB' } as NodeJS.ProcessEnv);
    expect(c?.privateKey).toBe('A\nB');
  });
});

describe('buildFcmMessage', () => {
  it('builds a notification with optional data', () => {
    const m = buildFcmMessage('tok', { title: 't', body: 'b', data: { id: '1' } });
    expect(m.message.token).toBe('tok');
    expect(m.message.notification).toEqual({ title: 't', body: 'b' });
    expect(m.message.data).toEqual({ id: '1' });
  });
});
