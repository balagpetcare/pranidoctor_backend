import { PanelAdminAuthService } from './services/panel-admin-auth.service.js';
import { PanelDoctorAuthService } from './services/panel-doctor-auth.service.js';
import { PanelTechnicianAuthService } from './services/panel-technician-auth.service.js';
import {
  getMobileOtpAuthService,
  MobileOtpAuthService,
} from './services/mobile-otp-auth.service.js';

/**
 * Phase 1 identity facade — single entry for compat adapters and AuthService.
 */
export class IdentityAuthService {
  readonly admin = new PanelAdminAuthService();
  readonly doctor = new PanelDoctorAuthService();
  readonly technician = new PanelTechnicianAuthService();
  readonly mobileOtp: MobileOtpAuthService = getMobileOtpAuthService();
}

let identityInstance: IdentityAuthService | null = null;

export function getIdentityAuthService(): IdentityAuthService {
  if (!identityInstance) {
    identityInstance = new IdentityAuthService();
  }
  return identityInstance;
}
