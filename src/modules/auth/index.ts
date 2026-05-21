export { AuthModule, createAuthModule } from './auth.module.js';
export {
  AuthService,
  createAuthService,
  type AuthServiceInterface,
} from './auth.service.js';
export { getIdentityAuthService, IdentityAuthService } from './identity-auth.service.js';
// Foundation repository layer removed in P1-03; use IdentityAuthService + token services (P1-10).
export { AuthController } from './auth.controller.js';
export { authEvents } from './auth.events.js';
export * from './auth.types.js';
export * from './auth.dto.js';
export * from './auth.validator.js';
