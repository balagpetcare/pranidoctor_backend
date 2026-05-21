/**
 * Legacy import path `@/lib/auth-audit` → Phase 1 auth-audit module.
 */
export {
  authRequestContext,
  recordAuthAudit,
  recordAuthAuditFireAndForget,
  type RecordAuthAuditInput,
} from '../../../../modules/auth/auth-audit.service.js';

export { AUTH_CHANNELS, type AuthChannel } from '../../../../modules/auth/identity-core.js';
