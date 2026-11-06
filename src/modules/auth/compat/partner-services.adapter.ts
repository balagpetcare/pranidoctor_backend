import { z } from 'zod';

import { requireAdminPanelApiAccess } from '../../../legacy/web/lib/admin-auth/api-guard.js';
import { jsonError, jsonOk } from '../../../legacy/web/lib/api-response.js';
import { OfferingApproval, ProviderKind, ProviderServiceMode } from '../../../generated/prisma/index.js';
import { requirePartnerUser } from '../../partner-auth/partner-guard.js';
import {
  addCatalogOffering,
  addCustomOffering,
  deleteOffering,
  getServiceSetup,
  updateFees,
  updateOffering,
  type ServiceResult,
} from '../../partner-auth/partner-services.service.js';
import {
  adminCreateCatalogItem,
  adminDecideOffering,
  adminListCatalog,
  adminListOfferings,
  adminUpdateCatalogItem,
} from '../../partner-auth/service-catalog.admin.service.js';

async function readJson(request: Request): Promise<{ ok: true; json: unknown } | { ok: false; res: Response }> {
  try {
    return { ok: true, json: await request.json() };
  } catch {
    return { ok: false, res: jsonError('INVALID_JSON', 'Invalid JSON', 400) };
  }
}

function fromResult<T>(r: ServiceResult<T>): Response {
  return r.ok ? jsonOk(r.data ?? { done: true }) : jsonError(r.code, r.message, r.httpStatus);
}

const SPECIES = z.enum(['cattle_goat', 'poultry_duck', 'pet']);
const mode = z.nativeEnum(ProviderServiceMode);

const addSchema = z.union([
  z
    .object({
      catalogId: z.string().min(1).max(64),
      priceBdt: z.number().finite().min(0).max(1_000_000),
      durationMinutes: z.number().int().min(5).max(1440).optional(),
      isActive: z.boolean().default(true),
    })
    .strict(),
  z
    .object({
      title: z.string().trim().min(3).max(120),
      description: z.string().trim().max(1000).optional(),
      mode,
      priceBdt: z.number().finite().min(0).max(1_000_000),
      durationMinutes: z.number().int().min(5).max(1440).optional(),
      species: z.array(SPECIES).min(1).max(3),
    })
    .strict(),
]);

const patchSchema = z
  .object({
    priceBdt: z.number().finite().min(0).max(1_000_000).optional(),
    durationMinutes: z.number().int().min(5).max(1440).optional(),
    isActive: z.boolean().optional(),
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

const feesSchema = z
  .object({
    onlineFeeBdt: z.number().finite().min(0).nullable().optional(),
    emergencyFeeBdt: z.number().finite().min(0).nullable().optional(),
    visitFeeBdt: z.number().finite().min(0).nullable().optional(),
    acceptsOnlineConsultation: z.boolean().optional(),
    acceptsEmergency: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);

/** GET /api/mobile/partner/services */
export async function handleGetServices(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  return fromResult(await getServiceSetup(auth.userId));
}

/** POST /api/mobile/partner/services — from catalog ({catalogId, priceBdt}) or custom (needs approval). */
export async function handleAddService(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = addSchema.safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  const d = parsed.data;
  const r =
    'catalogId' in d
      ? await addCatalogOffering(auth.userId, d)
      : await addCustomOffering(auth.userId, d);
  if (!r.ok) return fromResult(r);
  return fromResult(await getServiceSetup(auth.userId));
}

/** PATCH /api/mobile/partner/services/:id */
export async function handlePatchService(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = patchSchema.safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  const { id } = await ctx.params;
  const r = await updateOffering(auth.userId, id, parsed.data);
  if (!r.ok) return fromResult(r);
  return fromResult(await getServiceSetup(auth.userId));
}

/** DELETE /api/mobile/partner/services/:id */
export async function handleDeleteService(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const r = await deleteOffering(auth.userId, id);
  if (!r.ok) return fromResult(r);
  return fromResult(await getServiceSetup(auth.userId));
}

/** PUT /api/mobile/partner/doctor/fees */
export async function handlePutFees(request: Request): Promise<Response> {
  const auth = await requirePartnerUser(request);
  if (!auth.ok) return auth.response;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = feesSchema.safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'ফি সঠিক নয়', 422);
  const r = await updateFees(auth.userId, parsed.data);
  if (!r.ok) return fromResult(r);
  return fromResult(await getServiceSetup(auth.userId));
}

// ---------------- admin ----------------

const catalogSchema = z
  .object({
    key: z.string().trim().min(3).max(60).regex(/^[a-z0-9_]+$/),
    titleBn: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).nullable().optional(),
    category: z.enum(['CONSULTATION', 'SURGERY', 'TREATMENT', 'VACCINATION', 'FIELD']),
    providerKinds: z.array(z.nativeEnum(ProviderKind)).min(1),
    species: z.array(SPECIES).min(1),
    mode,
    minPriceBdt: z.number().finite().min(0).nullable().optional(),
    maxPriceBdt: z.number().finite().min(0).nullable().optional(),
    suggestedDurationMinutes: z.number().int().min(5).max(1440).nullable().optional(),
    isActive: z.boolean().default(true),
    sortOrder: z.number().int().min(0).max(100000).default(0),
  })
  .strict();

/** GET/POST /api/admin/service-catalog */
export async function handleAdminCatalogList(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  return jsonOk({ items: await adminListCatalog() });
}

export async function handleAdminCatalogCreate(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = catalogSchema.safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  const r = await adminCreateCatalogItem(parsed.data);
  return r.ok ? jsonOk({ done: true }, { status: 201 }) : jsonError(r.code, r.message, r.httpStatus);
}

/** PATCH /api/admin/service-catalog/:id */
export async function handleAdminCatalogUpdate(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = catalogSchema.partial().safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  const { id } = await ctx.params;
  const r = await adminUpdateCatalogItem(id, parsed.data);
  return r.ok ? jsonOk({ done: true }) : jsonError(r.code, r.message, r.httpStatus);
}

/** GET /api/admin/provider-offerings?approval=PENDING */
export async function handleAdminOfferingsList(request: Request): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const url = new URL(request.url);
  const approval = z.nativeEnum(OfferingApproval).catch(OfferingApproval.PENDING).parse(url.searchParams.get('approval') ?? undefined);
  const limit = z.coerce.number().int().min(1).max(100).catch(20).parse(url.searchParams.get('limit') ?? undefined);
  const offset = z.coerce.number().int().min(0).catch(0).parse(url.searchParams.get('offset') ?? undefined);
  return jsonOk(await adminListOfferings(approval, limit, offset));
}

/** POST /api/admin/provider-offerings/:id/decision */
export async function handleAdminOfferingDecision(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> {
  const authError = await requireAdminPanelApiAccess(request);
  if (authError) return authError;
  const body = await readJson(request);
  if (!body.ok) return body.res;
  const parsed = z
    .object({ action: z.enum(['approve', 'reject']), note: z.string().trim().max(500).optional() })
    .strict()
    .safeParse(body.json);
  if (!parsed.success) return jsonError('VALIDATION_ERROR', 'তথ্য সঠিক নয়', 422);
  if (parsed.data.action === 'reject' && !parsed.data.note) {
    return jsonError('NOTE_REQUIRED', 'প্রত্যাখ্যানের কারণ লিখুন।', 422);
  }
  const { id } = await ctx.params;
  const r = await adminDecideOffering(id, parsed.data.action, parsed.data.note);
  return r.ok ? jsonOk({ done: true }) : jsonError(r.code, r.message, r.httpStatus);
}
