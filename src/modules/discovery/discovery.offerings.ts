import type { NextFunction, Request, Response, Router } from 'express';
import { z } from 'zod';

import { Prisma, ProviderServiceMode } from '../../generated/prisma/index.js';
import { getPrisma } from '../../shared/database/prisma.js';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/errors/index.js';
import {
  authMobile,
  rateLimitStrict,
  whenRateLimitAvailable,
} from '../../shared/security/index.js';

import { SPECIES_GROUPS, type ProviderKindName } from './discovery.types.js';
import { idSchema } from './discovery.validator.js';

/** Hard cap per provider: keeps profiles scannable and bounds storage / abuse. */
export const MAX_OFFERINGS_PER_PROVIDER = 40;

const modeSchema = z.nativeEnum(ProviderServiceMode);

export const offeringCreateSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).optional(),
    mode: modeSchema,
    priceBdt: z.number().finite().min(0).max(100000),
    durationMinutes: z.number().int().min(5).max(1440).optional(),
    species: z.array(z.enum(SPECIES_GROUPS)).max(3).default([]),
    isActive: z.boolean().default(true),
  })
  .strict();

export const offeringUpdateSchema = offeringCreateSchema.partial().strict().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'Nothing to update' },
);

const idParams = z.object({ id: idSchema }).strict();
const myQuery = z.object({ kind: z.enum(['DOCTOR', 'AI_TECHNICIAN', 'HEALTH_WORKER']).optional() }).strict();

export interface OfferingDto {
  id: string;
  title: string;
  description: string | null;
  mode: ProviderServiceMode;
  priceBdt: number;
  durationMinutes: number | null;
  species: string[];
  isActive: boolean;
}

interface OfferingRow {
  id: string;
  title: string;
  description: string | null;
  mode: ProviderServiceMode;
  priceBdt: Prisma.Decimal;
  durationMinutes: number | null;
  species: string[];
  isActive: boolean;
}

const select = {
  id: true,
  title: true,
  description: true,
  mode: true,
  priceBdt: true,
  durationMinutes: true,
  species: true,
  isActive: true,
} as const;

function toDto(row: OfferingRow): OfferingDto {
  return { ...row, priceBdt: Number(row.priceBdt) };
}

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const r = schema.safeParse(input);
  if (!r.success) {
    throw new ValidationError('VALIDATION_FAILED', 'Invalid request', {
      issues: r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return r.data;
}

/** Public: what a customer sees on a provider profile. */
export async function listPublicOfferings(kind: ProviderKindName, providerId: string): Promise<OfferingDto[]> {
  const rows = await getPrisma().providerServiceOffering.findMany({
    where: { kind, providerId, isActive: true, adminHidden: false, approval: 'APPROVED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    take: MAX_OFFERINGS_PER_PROVIDER,
    select,
  });
  return rows.map(toDto);
}

/**
 * Which provider profile does this logged-in user manage? Derived from the DATABASE
 * (never a client-sent id/role). A user with several profiles must pass `kind`.
 */
async function ownProfile(
  userId: string,
  kind: ProviderKindName | undefined,
): Promise<{ kind: ProviderKindName; id: string; active: boolean }> {
  const prisma = getPrisma();
  const [doctor, tech, worker] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.aiTechnicianProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
    prisma.healthWorkerProfile.findUnique({ where: { userId }, select: { id: true, providerStatus: true } }),
  ]);
  const all: Array<{ kind: ProviderKindName; id: string; active: boolean }> = [];
  if (doctor) all.push({ kind: 'DOCTOR', id: doctor.id, active: doctor.providerStatus === 'ACTIVE' });
  if (tech) all.push({ kind: 'AI_TECHNICIAN', id: tech.id, active: tech.providerStatus === 'ACTIVE' });
  if (worker) all.push({ kind: 'HEALTH_WORKER', id: worker.id, active: worker.providerStatus === 'ACTIVE' });
  if (all.length === 0) {
    throw new ForbiddenError('NOT_A_PROVIDER', 'This account has no service-provider profile');
  }
  const match = kind ? all.find((p) => p.kind === kind) : all[0];
  if (!match || (!kind && all.length > 1)) {
    throw new ValidationError('KIND_REQUIRED', 'Specify which provider profile (kind)');
  }
  return match;
}

export function configureOfferingRoutes(router: Router): void {
  const guard = [authMobile, whenRateLimitAvailable(rateLimitStrict)] as const;

  const userId = (req: Request): string => {
    if (!req.user) throw new UnauthorizedError('AUTH_TOKEN_MISSING', 'Authentication required');
    return req.user.id;
  };

  router.get('/my/services', ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = parse(myQuery, req.query);
      const me = await ownProfile(userId(req), q.kind);
      const rows = await getPrisma().providerServiceOffering.findMany({
        where: { kind: me.kind, providerId: me.id },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: MAX_OFFERINGS_PER_PROVIDER + 5,
        select: { ...select, adminHidden: true },
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        data: rows.map((r) => ({ ...toDto(r), adminHidden: r.adminHidden })),
        meta: { kind: me.kind, max: MAX_OFFERINGS_PER_PROVIDER, profileActive: me.active },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/my/services', ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = parse(myQuery, req.query);
      const body = parse(offeringCreateSchema, req.body);
      const me = await ownProfile(userId(req), q.kind);
      const prisma = getPrisma();
      const count = await prisma.providerServiceOffering.count({ where: { kind: me.kind, providerId: me.id } });
      if (count >= MAX_OFFERINGS_PER_PROVIDER) {
        throw new ValidationError('OFFERING_LIMIT', `At most ${MAX_OFFERINGS_PER_PROVIDER} services allowed`);
      }
      const created = await prisma.providerServiceOffering.create({
        data: {
          kind: me.kind,
          providerId: me.id,
          title: body.title,
          description: body.description ?? null,
          mode: body.mode,
          priceBdt: body.priceBdt,
          durationMinutes: body.durationMinutes ?? null,
          species: body.species,
          isActive: body.isActive,
          sortOrder: count,
        },
        select,
      });
      res.status(201).json({ success: true, data: toDto(created) });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/my/services/:id', ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parse(idParams, req.params);
      const q = parse(myQuery, req.query);
      const body = parse(offeringUpdateSchema, req.body);
      const me = await ownProfile(userId(req), q.kind);
      const prisma = getPrisma();
      // Ownership enforced in the WHERE clause itself: another provider's id simply matches 0 rows.
      const result = await prisma.providerServiceOffering.updateMany({
        where: { id, kind: me.kind, providerId: me.id },
        data: {
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.mode !== undefined ? { mode: body.mode } : {}),
          ...(body.priceBdt !== undefined ? { priceBdt: body.priceBdt } : {}),
          ...(body.durationMinutes !== undefined ? { durationMinutes: body.durationMinutes } : {}),
          ...(body.species !== undefined ? { species: body.species } : {}),
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        },
      });
      if (result.count === 0) throw new NotFoundError('OFFERING_NOT_FOUND', 'Service not found');
      const row = await prisma.providerServiceOffering.findUniqueOrThrow({ where: { id }, select });
      res.json({ success: true, data: toDto(row) });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/my/services/:id', ...guard, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = parse(idParams, req.params);
      const q = parse(myQuery, req.query);
      const me = await ownProfile(userId(req), q.kind);
      const result = await getPrisma().providerServiceOffering.deleteMany({
        where: { id, kind: me.kind, providerId: me.id },
      });
      if (result.count === 0) throw new NotFoundError('OFFERING_NOT_FOUND', 'Service not found');
      res.json({ success: true, data: { id } });
    } catch (error) {
      next(error);
    }
  });
}
