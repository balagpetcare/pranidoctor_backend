import { MobileUploadPurpose, UploadedFileStatus } from '../../../generated/prisma/index.js';
import { publicMobileAssetBaseUrl } from '../../../legacy/web/lib/mobile-api/public-base-url.js';
import { prisma } from '../../../legacy/web/lib/prisma.js';
import { ingestMobileUpload } from '../../../legacy/web/lib/storage/upload-service.js';

import type { PatchMobileMeInput } from '../customer-address.service.js';

function formString(form: FormData, key: string): string | undefined {
  const raw = form.get(key);
  if (raw == null) return undefined;
  const value = String(raw).trim();
  return value.length > 0 ? value : undefined;
}

function formBool(form: FormData, key: string): boolean {
  const raw = formString(form, key);
  return raw === 'true' || raw === '1' || raw === 'yes';
}

async function linkUploadedFileToProfile(params: {
  request: Request;
  userId: string;
  customerProfileId: string;
  fileId: string;
  expectedPurpose: MobileUploadPurpose;
  profileField: 'profilePhotoUrl' | 'coverPhotoUrl';
}): Promise<{ ok: true; url: string } | { ok: false; code: string; httpStatus: number }> {
  const row = await prisma.uploadedFile.findFirst({
    where: {
      id: params.fileId,
      ownerUserId: params.userId,
      status: UploadedFileStatus.ACTIVE,
    },
  });
  if (!row) {
    return { ok: false, code: 'NOT_FOUND', httpStatus: 404 };
  }
  if (row.fileCategory !== params.expectedPurpose) {
    return { ok: false, code: 'VALIDATION_ERROR', httpStatus: 422 };
  }

  const base = publicMobileAssetBaseUrl(params.request);
  const downloadUrl = `${base}/api/mobile/uploads/${row.id}`;

  await prisma.customerProfile.update({
    where: { id: params.customerProfileId },
    data:
      params.profileField === 'profilePhotoUrl'
        ? { profilePhotoUrl: downloadUrl }
        : { coverPhotoUrl: downloadUrl },
  });

  return { ok: true, url: downloadUrl };
}

async function uploadProfileFile(
  request: Request,
  userId: string,
  customerProfileId: string,
  file: File,
  purpose: MobileUploadPurpose,
  profileField: 'profilePhotoUrl' | 'coverPhotoUrl',
): Promise<{ ok: true; url: string } | { ok: false; code: string; httpStatus: number }> {
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await ingestMobileUpload({
    ownerUserId: userId,
    purpose,
    originalName: file.name || 'upload.bin',
    declaredMime: file.type || null,
    fileBuffer: buf,
  });

  if (result.ok !== true) {
    const status =
      result.ok === 'FILE_TOO_LARGE'
        ? 413
        : result.ok === 'STORAGE_DISABLED' || result.ok === 'STORAGE_NOT_CONFIGURED'
          ? 503
          : 415;
    return { ok: false, code: result.ok, httpStatus: status };
  }

  const base = publicMobileAssetBaseUrl(request);
  const downloadUrl = `${base}/api/mobile/uploads/${result.id}`;

  await prisma.customerProfile.update({
    where: { id: customerProfileId },
    data:
      profileField === 'profilePhotoUrl'
        ? { profilePhotoUrl: downloadUrl }
        : { coverPhotoUrl: downloadUrl },
  });

  return { ok: true, url: downloadUrl };
}

export type ParseMultipartPatchResult =
  | { ok: true; input: PatchMobileMeInput }
  | { ok: false; code: string; httpStatus: number; details?: unknown };

export async function parseMobileMeMultipartPatch(
  request: Request,
  userId: string,
  customerProfileId: string,
): Promise<ParseMultipartPatchResult> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, code: 'INVALID_JSON', httpStatus: 400 };
  }

  const name = formString(form, 'fullName') ?? formString(form, 'name');
  const email = formString(form, 'email');
  const area = formString(form, 'area');
  const localeRaw = formString(form, 'locale');
  const locale =
    localeRaw === 'bn-BD' || localeRaw === 'en-US'
      ? (localeRaw as 'bn-BD' | 'en-US')
      : undefined;

  const addressKeys = [
    'divisionId',
    'districtId',
    'upazilaId',
    'unionId',
    'villageId',
    'villageName',
    'line1',
    'postalCode',
  ] as const;

  const address: NonNullable<PatchMobileMeInput['address']> = {};
  let hasAddress = false;
  for (const key of addressKeys) {
    let value = formString(form, key);
    if (key === 'villageName' && value === undefined) {
      value = formString(form, 'village');
    }
    if (value !== undefined) {
      hasAddress = true;
      address[key] = value;
    }
  }

  const avatarFileId = formString(form, 'avatarFileId');
  const coverFileId = formString(form, 'coverFileId');
  const clearAvatar = formBool(form, 'clearAvatar');
  const clearCover = formBool(form, 'clearCover');

  if (clearAvatar) {
    await prisma.customerProfile.update({
      where: { id: customerProfileId },
      data: { profilePhotoUrl: null },
    });
  }
  if (clearCover) {
    await prisma.customerProfile.update({
      where: { id: customerProfileId },
      data: { coverPhotoUrl: null },
    });
  }

  if (avatarFileId) {
    const linked = await linkUploadedFileToProfile({
      request,
      userId,
      customerProfileId,
      fileId: avatarFileId,
      expectedPurpose: MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO,
      profileField: 'profilePhotoUrl',
    });
    if (!linked.ok) {
      return { ok: false, code: linked.code, httpStatus: linked.httpStatus };
    }
  }

  if (coverFileId) {
    const linked = await linkUploadedFileToProfile({
      request,
      userId,
      customerProfileId,
      fileId: coverFileId,
      expectedPurpose: MobileUploadPurpose.CUSTOMER_COVER_IMAGE,
      profileField: 'coverPhotoUrl',
    });
    if (!linked.ok) {
      return { ok: false, code: linked.code, httpStatus: linked.httpStatus };
    }
  }

  const avatar =
    form.get('avatar') ??
    form.get('profilePhoto') ??
    form.get('profileImage') ??
    form.get('file');
  if (avatar instanceof File && avatar.size > 0) {
    const uploaded = await uploadProfileFile(
      request,
      userId,
      customerProfileId,
      avatar,
      MobileUploadPurpose.CUSTOMER_PROFILE_PHOTO,
      'profilePhotoUrl',
    );
    if (!uploaded.ok) {
      return {
        ok: false,
        code: uploaded.code,
        httpStatus: uploaded.httpStatus,
      };
    }
  }

  const cover = form.get('coverImage') ?? form.get('cover') ?? form.get('coverPhoto');
  if (cover instanceof File && cover.size > 0) {
    const uploaded = await uploadProfileFile(
      request,
      userId,
      customerProfileId,
      cover,
      MobileUploadPurpose.CUSTOMER_COVER_IMAGE,
      'coverPhotoUrl',
    );
    if (!uploaded.ok) {
      return {
        ok: false,
        code: uploaded.code,
        httpStatus: uploaded.httpStatus,
      };
    }
  }

  const input: PatchMobileMeInput = {};
  if (name !== undefined) input.name = name;
  if (email !== undefined) input.email = email;
  if (area !== undefined) input.area = area;
  if (locale !== undefined) input.locale = locale;
  if (hasAddress) input.address = address;

  const hasText =
    name !== undefined ||
    email !== undefined ||
    area !== undefined ||
    locale !== undefined ||
    hasAddress;
  const hasFiles =
    (avatar instanceof File && avatar.size > 0) || (cover instanceof File && cover.size > 0);
  const hasFileIds = avatarFileId !== undefined || coverFileId !== undefined;
  const hasClears = clearAvatar || clearCover;

  if (!hasText && !hasFiles && !hasFileIds && !hasClears) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      httpStatus: 422,
      details: { message: 'No profile fields provided' },
    };
  }

  return { ok: true, input };
}
