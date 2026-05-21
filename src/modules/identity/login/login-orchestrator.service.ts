import type { IdentityCapabilitiesDto, LoginMethod } from '../identity.types.js';

import {
  getDelegateOtpProvider,
  getPanelEmailAuthProvider,
  getStubSocialAuthProvider,
} from './login-providers.js';
import type { EmailAuthProvider, OtpAuthProvider, SocialAuthProvider } from './login-provider.types.js';

export class LoginOrchestrator {
  constructor(
    private readonly otp: OtpAuthProvider = getDelegateOtpProvider(),
    private readonly email: EmailAuthProvider = getPanelEmailAuthProvider(),
    private readonly social: SocialAuthProvider = getStubSocialAuthProvider(),
  ) {}

  getProvider(method: LoginMethod): OtpAuthProvider | EmailAuthProvider | SocialAuthProvider {
    switch (method) {
      case 'mobile_otp':
        return this.otp;
      case 'email':
        return this.email;
      case 'social':
        return this.social;
      default:
        throw new Error(`Unknown login method: ${method satisfies never}`);
    }
  }

  getCapabilities(): IdentityCapabilitiesDto {
    return {
      loginMethods: [
        {
          method: 'mobile_otp',
          available: true,
          channels: ['mobile'],
          notes: 'Primary customer login — compat /api/mobile/auth/* + foundation /api/auth/otp/*',
        },
        {
          method: 'email',
          available: true,
          channels: ['admin_panel', 'doctor_panel', 'technician_panel'],
          notes: 'Panel email+password — compat /api/{admin,doctor,technician}/auth/login',
        },
        {
          method: 'social',
          available: false,
          channels: [],
          notes: 'Provider abstraction only — OAuth routes blocked until SocialIdentity schema',
        },
      ],
      supportedLocales: ['bn-BD', 'en-US'],
      multiDevice: true,
      refreshRotation: true,
    };
  }
}

let orchestrator: LoginOrchestrator | null = null;

export function getLoginOrchestrator(): LoginOrchestrator {
  if (!orchestrator) orchestrator = new LoginOrchestrator();
  return orchestrator;
}
