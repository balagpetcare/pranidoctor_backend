import { authJsonError, authJsonOk } from '../../auth/i18n/compat-error.js';
import { normalizeLocaleTag } from '../../auth/i18n/locale.js';
import {
  getCustomerAddressService,
  type PatchMobileMeInput,
} from '../customer-address.service.js';
import { getCustomerProfileService } from '../customer-profile.service.js';
import { z } from 'zod';

const patchBodySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  area: z.string().trim().min(1).max(500).optional(),
  locale: z.enum(['bn-BD', 'en-US']).optional(),
  address: z
    .object({
      divisionId: z.string().min(1).optional(),
      districtId: z.string().min(1).optional(),
      upazilaId: z.string().min(1).optional(),
      unionId: z.string().min(1).optional(),
      villageId: z.string().min(1).optional(),
      line1: z.string().trim().max(500).optional(),
      postalCode: z.string().trim().max(20).optional(),
    })
    .strict()
    .optional(),
});

function localeOpt(profileLocale: string | undefined): string | null {
  return profileLocale ?? null;
}

export async function handleMobileMeGet(
  request: Request,
  userId: string,
  profileLocale: string | undefined,
): Promise<Response> {
  try {
    const me = await getCustomerProfileService().getMobileMe(userId);
    if (!me) {
      return authJsonError(request, 'NOT_FOUND', 404, {
        messageKey: 'CUSTOMER_PROFILE_MISSING',
        profileLocale: localeOpt(profileLocale),
      });
    }
    return authJsonOk(request, me, undefined, { profileLocale: localeOpt(profileLocale) });
  } catch {
    return authJsonError(request, 'DATABASE_ERROR', 500, {
      messageKey: 'DATABASE_ERROR',
      profileLocale: localeOpt(profileLocale),
    });
  }
}

export async function handleMobileMePatch(
  request: Request,
  userId: string,
  profileLocale: string | undefined,
): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return authJsonError(request, 'INVALID_JSON', 400, {
      messageKey: 'INVALID_JSON',
      profileLocale: localeOpt(profileLocale),
    });
  }

  if (json !== null && typeof json === 'object' && !Array.isArray(json)) {
    const body = { ...(json as Record<string, unknown>) };
    if (body.email === '') delete body.email;
    json = body;
  }

  const parsed = patchBodySchema.safeParse(json);
  if (!parsed.success) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR_INVALID_BODY',
      details: parsed.error.flatten(),
      profileLocale: localeOpt(profileLocale),
    });
  }

  const { name, email, area, locale, address } = parsed.data;
  if (
    name === undefined &&
    email === undefined &&
    area === undefined &&
    locale === undefined &&
    address === undefined
  ) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR_NO_FIELDS',
      profileLocale: localeOpt(profileLocale),
    });
  }

  if (locale !== undefined && !normalizeLocaleTag(locale)) {
    return authJsonError(request, 'VALIDATION_ERROR', 422, {
      messageKey: 'VALIDATION_ERROR',
      profileLocale: localeOpt(profileLocale),
    });
  }

  try {
    const patchInput: PatchMobileMeInput = {};
    if (name !== undefined) patchInput.name = name;
    if (email !== undefined) patchInput.email = email;
    if (area !== undefined) patchInput.area = area;
    if (locale !== undefined) patchInput.locale = locale;
    if (address !== undefined) {
      const addr: NonNullable<PatchMobileMeInput['address']> = {};
      if (address.divisionId) addr.divisionId = address.divisionId;
      if (address.districtId) addr.districtId = address.districtId;
      if (address.upazilaId) addr.upazilaId = address.upazilaId;
      if (address.unionId) addr.unionId = address.unionId;
      if (address.villageId) addr.villageId = address.villageId;
      if (address.line1) addr.line1 = address.line1;
      if (address.postalCode) addr.postalCode = address.postalCode;
      patchInput.address = addr;
    }

    const result = await getCustomerAddressService().patchMobileMe(userId, patchInput);

    if (!result.ok) {
      const key =
        result.code === 'EMAIL_IN_USE'
          ? 'EMAIL_IN_USE'
          : result.code === 'CUSTOMER_PROFILE_MISSING'
            ? 'CUSTOMER_PROFILE_MISSING'
            : 'VALIDATION_ERROR';
      return authJsonError(request, result.code, result.httpStatus, {
        messageKey: key,
        details: result.details,
        profileLocale: localeOpt(profileLocale),
      });
    }

    return authJsonOk(request, result.data, undefined, {
      profileLocale: result.data.locale,
    });
  } catch {
    return authJsonError(request, 'DATABASE_ERROR', 500, {
      messageKey: 'DATABASE_ERROR',
      profileLocale: localeOpt(profileLocale),
    });
  }
}
