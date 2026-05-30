import { isMessagingComplianceError } from '../../../../shared/compliance/messaging-compliance.js';
import { jsonError } from '../api-response.js';

export function messagingComplianceResponse(error: unknown) {
  if (!isMessagingComplianceError(error)) return null;
  return jsonError('VALIDATION_ERROR', error.message, 422, {
    violations: error.violations,
  });
}
