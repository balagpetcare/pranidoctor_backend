import { z } from 'zod';

import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';
import {
  getAreaSetup,
  getPartnerProfile,
  listChildAreas,
  saveAreas,
  savePartnerProfile,
  type AreaResult,
} from '../../partner-auth/partner-area.service.js';

function respond<T>(r: AreaResult<T>): Response {
  return r.ok ? jsonOk(r.data) : jsonError(r.code, r.message, r.httpStatus);
}

async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const areaSchema = z.object({ areaIds: z.array(z.string().min(1).max(64)).max(40) }).strict();
const profileSchema = z
  .object({
    displayName: z.string().trim().max(80).nullable().optional(),
    bio: z.string().trim().max(1000).nullable().optional(),
    experienceYears: z.number().int().min(0).max(70).nullable().optional(),
  })
  .strict();

/** GET /api/mobile/partner/area */
export async function handleGetArea(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await getAreaSetup(auth.userId));
}

/** PUT /api/mobile/partner/area  { areaIds } */
export async function handlePutArea(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const parsed = areaSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  return respond(await saveAreas(auth.userId, parsed.data.areaIds));
}

/** GET /api/mobile/partner/area/children?parentId= */
export async function handleAreaChildren(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const parentId = new URL(request.url).searchParams.get('parentId')?.trim();
  if (!parentId || parentId.length > 64) return jsonError('VALIDATION_ERROR', 'জেলা বাছাই করুন', 422);
  return respond(await listChildAreas(parentId));
}

/** GET /api/mobile/partner/profile */
export async function handleGetProfile(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await getPartnerProfile(auth.userId));
}

/** PUT /api/mobile/partner/profile  { displayName?, bio?, experienceYears? } */
export async function handlePutProfile(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  return respond(await savePartnerProfile(auth.userId, parsed.data));
}
