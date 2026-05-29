import {
  getAdminVetDisclaimerSettings,
  updateAdminVetDisclaimerSettings,
} from '@/lib/admin-legal/admin-vet-disclaimer-service';
import { adminVetDisclaimerPutSchema } from '@/lib/vet-disclaimer/schemas';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';

export async function GET() {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  try {
    const data = await getAdminVetDisclaimerSettings();
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load veterinary disclaimer settings', 500);
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

  const parsed = adminVetDisclaimerPutSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError('VALIDATION_ERROR', 'Invalid body', 422, parsed.error.flatten());
  }

  try {
    const data = await updateAdminVetDisclaimerSettings(parsed.data);
    return jsonOk(data);
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not save veterinary disclaimer settings', 500);
  }
}
