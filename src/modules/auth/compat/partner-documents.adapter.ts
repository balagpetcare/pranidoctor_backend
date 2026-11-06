import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { publicMobileAssetBaseUrl } from '../../../legacy/web/lib/mobile-api/public-base-url.js';
import {
  deleteMyDocument,
  isDocumentType,
  listMyDocuments,
  uploadMyDocument,
} from '../../partner-auth/partner-documents.service.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';
import { isPartnerRole } from '../../partner-auth/partner-roles.js';

/** GET /api/mobile/partner/documents — checklist + uploads per applied role. */
export async function handleListMyDocuments(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const data = await listMyDocuments(auth.userId);
  if (!data) return jsonError('NOT_FOUND', 'অ্যাকাউন্ট পাওয়া যায়নি।', 404);
  return jsonOk({ roles: data });
}

/** POST /api/mobile/partner/documents (multipart: role, type, title?, file) */
export async function handleUploadMyDocument(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('INVALID_BODY', 'multipart/form-data প্রয়োজন', 400);
  }
  const role = form.get('role');
  const type = form.get('type');
  const file = form.get('file');
  const title = form.get('title');
  if (typeof role !== 'string' || !isPartnerRole(role.trim())) {
    return jsonError('VALIDATION_ERROR', 'ভূমিকা সঠিক নয়', 422);
  }
  if (typeof type !== 'string' || !isDocumentType(type.trim())) {
    return jsonError('VALIDATION_ERROR', 'ডকুমেন্টের ধরন সঠিক নয়', 422);
  }
  if (!(file instanceof File)) {
    return jsonError('VALIDATION_ERROR', 'ফাইল (file) প্রয়োজন', 422);
  }

  const result = await uploadMyDocument({
    userId: auth.userId,
    role: role.trim() as Parameters<typeof uploadMyDocument>[0]['role'],
    type: type.trim() as Parameters<typeof uploadMyDocument>[0]['type'],
    title: typeof title === 'string' ? title : undefined,
    file: {
      buffer: Buffer.from(await file.arrayBuffer()),
      name: file.name || 'document',
      mime: file.type || null,
    },
    appBaseUrl: publicMobileAssetBaseUrl(request),
  });
  if (!result.ok) return jsonError(result.code, result.message, result.httpStatus);
  const data = await listMyDocuments(auth.userId);
  return jsonOk({ roles: data ?? [] }, { status: 201 });
}

/** DELETE /api/mobile/partner/documents/:id */
export async function handleDeleteMyDocument(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const result = await deleteMyDocument(auth.userId, id);
  if (!result.ok) return jsonError(result.code, result.message, result.httpStatus);
  const data = await listMyDocuments(auth.userId);
  return jsonOk({ roles: data ?? [] });
}
