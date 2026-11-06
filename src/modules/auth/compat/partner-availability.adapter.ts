import { z } from 'zod';

import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';
import {
  getAvailability,
  saveSchedule,
  setOnline,
  type AvailabilityResult,
} from '../../partner-auth/partner-availability.service.js';

function respond<T>(r: AvailabilityResult<T>): Response {
  return r.ok ? jsonOk(r.data) : jsonError(r.code, r.message, r.httpStatus);
}

async function readJson(request: Request): Promise<unknown | undefined> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

const slotSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .strict();

const scheduleSchema = z.object({ slots: z.array(slotSchema).max(28) }).strict();
const onlineSchema = z.object({ online: z.boolean() }).strict();

/** GET /api/mobile/partner/availability */
export async function handleGetAvailability(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return respond(await getAvailability(auth.userId));
}

/** PUT /api/mobile/partner/availability/online  { online } */
export async function handlePutOnline(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const parsed = onlineSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  return respond(await setOnline(auth.userId, parsed.data.online));
}

/** PUT /api/mobile/partner/availability/schedule  { slots:[{weekday,startMinute,endMinute}] } */
export async function handlePutSchedule(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const parsed = scheduleSchema.safeParse(await readJson(request));
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  return respond(await saveSchedule(auth.userId, parsed.data.slots));
}
