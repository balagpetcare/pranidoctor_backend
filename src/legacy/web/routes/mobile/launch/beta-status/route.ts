import { jsonError, jsonOk } from '@/lib/api-response';
import {
  getClosedBetaConfig,
  toPublicBetaStatus,
} from '../../../../../../shared/launch/closed-beta-config.service.js';

/** Public read-only closed beta status for mobile boot banner. */
export async function GET() {
  try {
    const config = await getClosedBetaConfig();
    return jsonOk(toPublicBetaStatus(config));
  } catch {
    return jsonError('INTERNAL', 'Could not read beta status', 500);
  }
}
