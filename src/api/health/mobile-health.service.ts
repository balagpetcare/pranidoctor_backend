import { getMobileJwtSecret } from '../../modules/auth/tokens/mobile-jwt.js';
import {
  validateMobileProfileModules,
  type MobileProfileModuleValidation,
} from '../../shared/config/mobile-profile-startup.js';

export interface MobileHealthResponse {
  mobileMe: boolean;
  profile: boolean;
  settings: boolean;
  auth: boolean;
  timestamp: string;
  error?: string;
}

export async function getMobileHealthStatus(): Promise<MobileHealthResponse> {
  const modules: MobileProfileModuleValidation = await validateMobileProfileModules();
  const authConfigured = getMobileJwtSecret() !== null;

  return {
    mobileMe: modules.ok && modules.details.meRouteGet,
    profile: modules.ok && modules.details.profileModule,
    settings: modules.ok && modules.details.settingsRouteGet,
    auth: authConfigured,
    timestamp: new Date().toISOString(),
    ...(modules.ok ? {} : { error: modules.error }),
  };
}

export function isMobileHealthOk(status: MobileHealthResponse): boolean {
  return (
    status.mobileMe &&
    status.profile &&
    status.settings &&
    status.auth
  );
}
