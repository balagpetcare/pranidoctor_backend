import {
  getAdminAiDisclaimerSettings,
  updateAdminAiDisclaimerSettings,
} from '@/lib/admin-legal/admin-ai-disclaimer-service';
import { adminAiDisclaimerPutSchema } from '@/lib/ai-disclaimer/schemas';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import { messagingComplianceResponse } from '@/lib/admin-legal/messaging-compliance-route.js';

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminAiDisclaimerSettings();
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load AI disclaimer settings', 500);
  }
}

export async function PUT(request: Request) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError('VALIDATION_ERROR', 'JSON body required', 400);
  }

  const parsed = adminAiDisclaimerPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  try {
    const data = await updateAdminAiDisclaimerSettings(parsed.data);
    return jsonOk(data);
  } catch (e) {
    const compliance = messagingComplianceResponse(e);
    if (compliance) return compliance;
    return jsonError('DATABASE_ERROR', 'Could not save AI disclaimer settings', 500);
  }
}
