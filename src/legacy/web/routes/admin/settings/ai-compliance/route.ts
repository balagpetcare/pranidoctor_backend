import {
  getAdminAiComplianceSettings,
  updateAdminAiComplianceSettings,
} from '@/lib/admin-legal/admin-ai-compliance-service';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';
import { z } from 'zod';

const putSchema = z.object({
  contentVersion: z.string().trim().min(1).max(64),
  enabled: z.boolean(),
  auditEnabled: z.boolean(),
  emergencyDetectionEnabled: z.boolean(),
});

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminAiComplianceSettings();
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load AI compliance settings', 500);
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

  const parsed = putSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  try {
    const data = await updateAdminAiComplianceSettings(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not save AI compliance settings', 500);
  }
}
