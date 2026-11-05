import { adminGetPrescription } from '@/lib/admin-prescriptions/prescription-admin.service';
import { requireAdminPanelApiAccess } from '@/lib/admin-auth/api-guard';
import { jsonError, jsonOk } from '@/lib/api-response';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authError = await requireAdminPanelApiAccess();
  if (authError) return authError;

  const { id } = await context.params;

  try {
    const prescription = await adminGetPrescription(id);
    if (!prescription) {
      return jsonError('NOT_FOUND', 'Prescription not found', 404);
    }
    return jsonOk({ prescription });
  } catch {
    return jsonError('DATABASE_ERROR', 'Could not load prescription', 500);
  }
}
