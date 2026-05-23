import { jsonError, jsonOk } from '@/lib/api-response';
import { requireMobileCustomer } from '@/lib/mobile-auth/guard';
import { prisma } from '@/lib/prisma';

import {
  clearProfileMedia,
  ingestProfileMedia,
  type ProfileMediaKind,
} from '../../../../modules/profile/profile-media.pipeline.js';

function logMedia(event: 'MEDIA_PARSE' | 'MEDIA_UPLOAD' | 'MEDIA_REQ' | 'MEDIA_RES', payload: Record<string, unknown>) {
  console.info(`[${event}]`, JSON.stringify(payload));
}

function mapUploadError(code: string): Response {
  switch (code) {
    case 'STORAGE_DISABLED':
      return jsonError('STORAGE_DISABLED', 'File upload is disabled', 503);
    case 'STORAGE_NOT_CONFIGURED':
      return jsonError('STORAGE_NOT_CONFIGURED', 'Storage is not configured', 503);
    case 'FILE_TOO_LARGE':
      return jsonError('FILE_TOO_LARGE', 'File exceeds 10 MB limit', 413);
    case 'INVALID_TYPE':
    case 'DANGEROUS_FILE':
      return jsonError('INVALID_TYPE', 'File type is not allowed', 415);
    default:
      return jsonError('UPLOAD_FAILED', 'Upload failed', 503);
  }
}

function pickFile(form: FormData, kind: ProfileMediaKind): File | null {
  const keys =
    kind === 'avatar'
      ? ['avatar', 'profile_image', 'profileImage', 'file']
      : ['cover', 'cover_image', 'coverImage', 'coverPhoto'];
  for (const key of keys) {
    const value = form.get(key);
    if (value instanceof File && value.size > 0) return value;
  }
  return null;
}

async function readProfileMediaUrls(customerProfileId: string) {
  return prisma.customerProfile.findUnique({
    where: { id: customerProfileId },
    select: {
      profilePhotoUrl: true,
      profilePhotoThumbUrl: true,
      coverPhotoUrl: true,
      coverPhotoThumbUrl: true,
    },
  });
}

function toMediaPayload(
  cp: {
    profilePhotoUrl: string | null;
    profilePhotoThumbUrl: string | null;
    coverPhotoUrl: string | null;
    coverPhotoThumbUrl: string | null;
  } | null,
  kind?: ProfileMediaKind,
) {
  const avatarUrl = cp?.profilePhotoUrl ?? null;
  const avatarThumbUrl = cp?.profilePhotoThumbUrl ?? null;
  const coverUrl = cp?.coverPhotoUrl ?? null;
  const coverThumbUrl = cp?.coverPhotoThumbUrl ?? null;

  const payload: Record<string, unknown> = {
    avatarUrl,
    avatarThumbUrl,
    coverUrl,
    coverThumbUrl,
    profileImageUrl: avatarUrl,
    profileThumbUrl: avatarThumbUrl,
    coverImageUrl: coverUrl,
    coverThumbUrl,
  };

  if (kind === 'avatar') {
    payload.url = avatarUrl;
    payload.thumbUrl = avatarThumbUrl;
    payload.thumb = avatarThumbUrl;
  } else if (kind === 'cover') {
    payload.url = coverUrl;
    payload.thumbUrl = coverThumbUrl;
    payload.thumb = coverThumbUrl;
  }

  return payload;
}

export async function postCustomerProfileMedia(
  request: Request,
  kind: ProfileMediaKind,
): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const contentType = request.headers.get('content-type') ?? '';
  logMedia('MEDIA_REQ', {
    method: request.method,
    kind,
    contentType,
    path: new URL(request.url).pathname,
  });

  if (!contentType.includes('multipart/form-data')) {
    logMedia('MEDIA_PARSE', { kind, ok: false, reason: 'missing_multipart_content_type' });
    return jsonError('INVALID_BODY', 'multipart/form-data required', 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
    logMedia('MEDIA_PARSE', {
      kind,
      ok: true,
      fields: [...form.keys()],
    });
  } catch (error) {
    logMedia('MEDIA_PARSE', {
      kind,
      ok: false,
      reason: 'FORM_PARSE_FAILED',
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError('INVALID_BODY', 'multipart/form-data required', 400);
  }

  if (form.get('remove') === 'true' || form.get('clear') === 'true') {
    await clearProfileMedia({
      customerProfileId: auth.ctx.customerProfileId,
      kind,
    });
    const cp = await readProfileMediaUrls(auth.ctx.customerProfileId);
    const data = toMediaPayload(cp, kind);
    logMedia('MEDIA_RES', { kind, status: 200, removed: true, ...data });
    return jsonOk(data);
  }

  const file = pickFile(form, kind);
  if (!file) {
    logMedia('MEDIA_PARSE', { kind, ok: false, reason: 'file_missing_or_empty' });
    return jsonError('VALIDATION_ERROR', 'Image file is required', 422);
  }

  logMedia('MEDIA_UPLOAD', {
    kind,
    field: kind === 'avatar' ? 'avatar' : 'cover',
    name: file.name,
    mime: file.type,
    size: file.size,
  });

  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestProfileMedia({
    request,
    ownerUserId: auth.ctx.userId,
    customerProfileId: auth.ctx.customerProfileId,
    kind,
    originalName: file.name || 'upload.bin',
    declaredMime: file.type || null,
    fileBuffer: buf,
  });

  if (result.ok !== true) {
    const errRes = mapUploadError(result.ok);
    logMedia('MEDIA_UPLOAD', { kind, ok: false, error: result.ok, status: errRes.status });
    return errRes;
  }

  const cp = await readProfileMediaUrls(auth.ctx.customerProfileId);
  const data = {
    ...toMediaPayload(cp, kind),
    mainBytes: result.mainBytes,
    thumbBytes: result.thumbBytes,
    mimeType: 'image/webp',
  };
  logMedia('MEDIA_UPLOAD', { kind, ok: true, ...data });
  logMedia('MEDIA_RES', { kind, status: 201, ...data });
  return jsonOk(data, { status: 201 });
}

export async function deleteCustomerProfileMedia(
  request: Request,
  kind: ProfileMediaKind,
): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  logMedia('MEDIA_REQ', {
    method: 'DELETE',
    kind,
    path: new URL(request.url).pathname,
  });

  await clearProfileMedia({
    customerProfileId: auth.ctx.customerProfileId,
    kind,
  });
  const cp = await readProfileMediaUrls(auth.ctx.customerProfileId);
  const data = toMediaPayload(cp, kind);
  logMedia('MEDIA_RES', { kind, status: 200, removed: true, ...data });
  return jsonOk(data);
}

/** Legacy batch upload — avatar / cover optional either. */
export async function postCustomerProfileMediaBatch(request: Request): Promise<Response> {
  const auth = await requireMobileCustomer(request);
  if (!auth.ok) return auth.response;

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return jsonError('INVALID_BODY', 'multipart/form-data required', 400);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError('INVALID_BODY', 'multipart/form-data required', 400);
  }

  const avatar = pickFile(form, 'avatar');
  const cover = pickFile(form, 'cover');
  if (!avatar && !cover) {
    return jsonError('VALIDATION_ERROR', 'avatar or cover required', 422);
  }

  if (avatar) {
    const buf = Buffer.from(await avatar.arrayBuffer());
    const result = await ingestProfileMedia({
      request,
      ownerUserId: auth.ctx.userId,
      customerProfileId: auth.ctx.customerProfileId,
      kind: 'avatar',
      originalName: avatar.name || 'avatar.webp',
      declaredMime: avatar.type || null,
      fileBuffer: buf,
    });
    if (result.ok !== true) return mapUploadError(result.ok);
  }

  if (cover) {
    const buf = Buffer.from(await cover.arrayBuffer());
    const result = await ingestProfileMedia({
      request,
      ownerUserId: auth.ctx.userId,
      customerProfileId: auth.ctx.customerProfileId,
      kind: 'cover',
      originalName: cover.name || 'cover.webp',
      declaredMime: cover.type || null,
      fileBuffer: buf,
    });
    if (result.ok !== true) return mapUploadError(result.ok);
  }

  const cp = await readProfileMediaUrls(auth.ctx.customerProfileId);
  return jsonOk(toMediaPayload(cp), { status: 201 });
}
