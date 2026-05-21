import { describe, expect, it } from 'vitest';

import { getLoginOrchestrator } from './login-orchestrator.service.js';
import { getStubSocialAuthProvider } from './login-providers.js';

describe('LoginOrchestrator', () => {
  it('exposes capability matrix with frozen login surfaces', () => {
    const caps = getLoginOrchestrator().getCapabilities();

    expect(caps.multiDevice).toBe(true);
    expect(caps.refreshRotation).toBe(true);
    expect(caps.supportedLocales).toContain('bn-BD');

    const otp = caps.loginMethods.find((m) => m.method === 'mobile_otp');
    const email = caps.loginMethods.find((m) => m.method === 'email');
    const social = caps.loginMethods.find((m) => m.method === 'social');

    expect(otp?.available).toBe(true);
    expect(email?.available).toBe(true);
    expect(social?.available).toBe(false);
  });

  it('routes login methods to providers', () => {
    const orchestrator = getLoginOrchestrator();
    expect(orchestrator.getProvider('mobile_otp').method).toBe('mobile_otp');
    expect(orchestrator.getProvider('email').method).toBe('email');
    expect(orchestrator.getProvider('social').method).toBe('social');
  });
});

describe('StubSocialAuthProvider', () => {
  it('returns NOT_IMPLEMENTED without OAuth wiring', async () => {
    const result = await getStubSocialAuthProvider().login({
      provider: 'google',
      idToken: 'token',
    });
    expect(result.ok).toBe(false);
    expect(result.errorCode).toBe('NOT_IMPLEMENTED');
  });
});
