import {
  getAdminAiEscalationDisclosureSettings,
  updateAdminAiEscalationDisclosureSettings,
} from '@/lib/admin-legal/admin-ai-escalation-disclosure-service';
import { adminAiEscalationDisclosurePutSchema } from '@/lib/ai-escalation-disclosure/schemas';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import { messagingComplianceResponse } from '@/lib/admin-legal/messaging-compliance-route.js';

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminAiEscalationDisclosureSettings();
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load AI escalation disclosure settings', 500);
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

  const parsed = adminAiEscalationDisclosurePutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  try {
    const data = await updateAdminAiEscalationDisclosureSettings(parsed.data);
    return jsonOk(data);
  } catch (e) {
    const compliance = messagingComplianceResponse(e);
    if (compliance) return compliance;
    return jsonError('DATABASE_ERROR', 'Could not save AI escalation disclosure settings', 500);
  }
}
